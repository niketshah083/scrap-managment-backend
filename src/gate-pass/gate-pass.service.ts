import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction, OperationalLevel, TransactionStatus } from '../entities/transaction.entity';
import { Vehicle } from '../entities/vehicle.entity';
import { AuditLog, AuditAction } from '../entities/audit-log.entity';
import * as QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';

export interface GatePassData {
  transactionId: string;
  vehicleNumber: string;
  qrCode: string;
  expiresAt: Date;
  generatedBy: string;
  generatedAt: Date;
}

export interface GatePassValidationResult {
  isValid: boolean;
  transaction?: Transaction;
  errors: string[];
  requiresSupervisorOverride?: boolean;
}

@Injectable()
export class GatePassService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(Vehicle)
    private vehicleRepository: Repository<Vehicle>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  /**
   * Generate a time-bound QR-based gate pass after GRN completion
   */
  async generateGatePass(
    transactionId: string,
    userId: string,
    validityHours: number = 24
  ): Promise<GatePassData> {
    // Validate that GRN is completed
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId },
      relations: ['vehicle']
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    // Check if GRN is completed (L6)
    if (transaction.currentLevel < OperationalLevel.L6_GRN_GENERATION) {
      throw new BadRequestException('Gate pass cannot be generated without completed GRN');
    }

    // Check if L6 is approved
    const l6Data = transaction.levelData?.[OperationalLevel.L6_GRN_GENERATION];
    if (!l6Data || l6Data.validationStatus !== 'APPROVED') {
      throw new BadRequestException('Gate pass cannot be generated without approved GRN');
    }

    // Check if gate pass already exists and is still valid
    if (transaction.gatePassQrCode && transaction.gatePassExpiresAt) {
      if (new Date() < transaction.gatePassExpiresAt) {
        throw new BadRequestException('Valid gate pass already exists for this transaction');
      }
    }

    // Generate QR code data
    const qrData = {
      transactionId: transaction.id,
      vehicleNumber: transaction.vehicle.vehicleNumber,
      generatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + validityHours * 60 * 60 * 1000).toISOString(),
      nonce: uuidv4() // Prevent reuse
    };

    const qrCodeString = await QRCode.toDataURL(JSON.stringify(qrData));
    const expiresAt = new Date(Date.now() + validityHours * 60 * 60 * 1000);

    // Update transaction with gate pass data
    await this.transactionRepository.update(transaction.id, {
      gatePassQrCode: qrCodeString,
      gatePassExpiresAt: expiresAt,
      currentLevel: OperationalLevel.L7_GATE_PASS_EXIT
    });

    // Create audit log
    await this.auditLogRepository.save({
      userId,
      transactionId: transaction.id,
      action: AuditAction.GATE_PASS_GENERATED,
      entityType: 'Transaction',
      entityId: transaction.id,
      description: 'Gate pass generated for vehicle exit',
      newValues: {
        expiresAt: expiresAt.toISOString(),
        validityHours
      },
      metadata: {
        operationalLevel: OperationalLevel.L7_GATE_PASS_EXIT
      },
      timestamp: new Date()
    });

    return {
      transactionId: transaction.id,
      vehicleNumber: transaction.vehicle.vehicleNumber,
      qrCode: qrCodeString,
      expiresAt,
      generatedBy: userId,
      generatedAt: new Date()
    };
  }

  /**
   * Validate QR code and check time bounds during exit attempt
   */
  async validateGatePass(qrCodeData: string): Promise<GatePassValidationResult> {
    try {
      // Parse QR code data
      const qrData = JSON.parse(qrCodeData);
      
      // Validate required fields
      if (!qrData.transactionId || !qrData.vehicleNumber || !qrData.expiresAt) {
        return {
          isValid: false,
          errors: ['Invalid QR code format']
        };
      }

      const { transactionId, vehicleNumber, expiresAt } = qrData;

      // Find transaction
      const transaction = await this.transactionRepository.findOne({
        where: { id: transactionId },
        relations: ['vehicle']
      });

      if (!transaction) {
        return {
          isValid: false,
          errors: ['Transaction not found']
        };
      }

      // Verify vehicle number matches
      if (transaction.vehicle.vehicleNumber !== vehicleNumber) {
        return {
          isValid: false,
          errors: ['Vehicle number mismatch']
        };
      }

      // Check if already used (transaction completed)
      if (transaction.status === TransactionStatus.COMPLETED) {
        return {
          isValid: false,
          errors: ['Gate pass already used - vehicle has exited']
        };
      }

      // Check time bounds
      const now = new Date();
      const expirationDate = new Date(expiresAt);

      if (now > expirationDate) {
        return {
          isValid: false,
          transaction,
          errors: ['Gate pass has expired'],
          requiresSupervisorOverride: true
        };
      }

      // Validate QR code matches stored data
      if (transaction.gatePassQrCode !== qrCodeData) {
        return {
          isValid: false,
          errors: ['Invalid QR code']
        };
      }

      return {
        isValid: true,
        transaction,
        errors: []
      };

    } catch (error) {
      return {
        isValid: false,
        errors: ['Invalid QR code format']
      };
    }
  }

  /**
   * Process vehicle exit and lock record
   */
  async processVehicleExit(
    transactionId: string,
    userId: string,
    supervisorOverride: boolean = false
  ): Promise<void> {
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId },
      relations: ['vehicle']
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    // Validate gate pass if no supervisor override
    if (!supervisorOverride) {
      const validation = await this.validateGatePass(transaction.gatePassQrCode);
      if (!validation.isValid) {
        throw new BadRequestException(`Gate pass validation failed: ${validation.errors.join(', ')}`);
      }
    }

    // Mark transaction as completed and lock it
    await this.transactionRepository.update(transaction.id, {
      status: TransactionStatus.COMPLETED,
      isLocked: true,
      completedAt: new Date()
    });

    // Update vehicle visit history
    const vehicle = transaction.vehicle;
    const visitHistory = vehicle.visitHistory || [];
    visitHistory.push({
      transactionId: transaction.id,
      visitDate: new Date(),
      factoryId: transaction.factoryId,
      status: 'COMPLETED'
    });

    await this.vehicleRepository.update(vehicle.id, {
      visitHistory
    });

    // Create audit log
    await this.auditLogRepository.save({
      userId,
      transactionId: transaction.id,
      action: supervisorOverride ? AuditAction.VEHICLE_EXIT_SUPERVISOR_OVERRIDE : AuditAction.VEHICLE_EXIT_COMPLETED,
      entityType: 'Transaction',
      entityId: transaction.id,
      description: supervisorOverride ? 'Vehicle exit with supervisor override' : 'Vehicle exit completed',
      newValues: {
        vehicleNumber: vehicle.vehicleNumber,
        supervisorOverride,
        status: TransactionStatus.COMPLETED
      },
      metadata: {
        operationalLevel: OperationalLevel.L7_GATE_PASS_EXIT
      },
      timestamp: new Date()
    });
  }

  /**
   * Supervisor override for expired gate pass
   */
  async supervisorOverrideExpiredGatePass(
    transactionId: string,
    supervisorId: string,
    justification: string
  ): Promise<void> {
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId }
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    // Create audit log for supervisor override
    await this.auditLogRepository.save({
      userId: supervisorId,
      transactionId: transaction.id,
      action: AuditAction.SUPERVISOR_OVERRIDE_EXPIRED_GATE_PASS,
      entityType: 'Transaction',
      entityId: transaction.id,
      description: 'Supervisor override for expired gate pass',
      newValues: {
        justification,
        originalExpiryTime: transaction.gatePassExpiresAt?.toISOString()
      },
      metadata: {
        operationalLevel: OperationalLevel.L7_GATE_PASS_EXIT
      },
      timestamp: new Date()
    });

    // Process exit with supervisor override
    await this.processVehicleExit(transactionId, supervisorId, true);
  }
}