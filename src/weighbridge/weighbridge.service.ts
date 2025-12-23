import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction, OperationalLevel, TransactionStatus } from '../entities/transaction.entity';
import { Evidence, EvidenceType } from '../entities/evidence.entity';
import { AuditLog, AuditAction } from '../entities/audit-log.entity';

export interface WeighbridgeReading {
  weight: number;
  timestamp: Date;
  operatorId: string;
  equipmentId?: string;
  ticketNumber?: string;
}

export interface WeightCalculationResult {
  grossWeight: number;
  tareWeight: number;
  netWeight: number;
  isValid: boolean;
  discrepancyPercentage?: number;
  requiresSupervisorApproval: boolean;
}

export interface WeighbridgeIntegrationConfig {
  isIntegrated: boolean;
  equipmentModel?: string;
  ipAddress?: string;
  port?: number;
  timeout?: number;
  discrepancyThreshold: number; // Percentage threshold for weight discrepancies
}

@Injectable()
export class WeighbridgeService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(Evidence)
    private evidenceRepository: Repository<Evidence>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>
  ) {}

  /**
   * Capture gross weight (L3 - Weighbridge Gross)
   */
  async captureGrossWeight(
    transactionId: string,
    reading: WeighbridgeReading,
    photoEvidence?: Express.Multer.File
  ): Promise<Transaction> {
    const transaction = await this.getTransactionForWeighing(transactionId, OperationalLevel.L3_WEIGHBRIDGE_GROSS);
    
    // Validate weight reading
    this.validateWeightReading(reading);
    
    // Update transaction with gross weight
    transaction.weighbridgeData = {
      ...transaction.weighbridgeData,
      grossWeight: reading.weight,
      grossWeightTimestamp: reading.timestamp,
      grossWeightOperator: reading.operatorId,
      weighbridgeTicketUrl: photoEvidence ? await this.storeWeighbridgeTicket(photoEvidence, transactionId, 'gross') : undefined
    };

    // Update current level and level data
    transaction.currentLevel = OperationalLevel.L4_MATERIAL_INSPECTION;
    transaction.levelData = {
      ...transaction.levelData,
      [OperationalLevel.L3_WEIGHBRIDGE_GROSS]: {
        level: OperationalLevel.L3_WEIGHBRIDGE_GROSS,
        fieldValues: {
          grossWeight: reading.weight,
          equipmentId: reading.equipmentId,
          ticketNumber: reading.ticketNumber
        },
        completedBy: reading.operatorId,
        completedAt: reading.timestamp,
        evidenceIds: photoEvidence ? [await this.createEvidenceRecord(photoEvidence, transactionId, OperationalLevel.L3_WEIGHBRIDGE_GROSS)] : [],
        validationStatus: 'APPROVED'
      }
    };

    await this.transactionRepository.save(transaction);
    await this.createAuditLog(transactionId, reading.operatorId, AuditAction.WEIGHBRIDGE_GROSS_CAPTURED, {
      weight: reading.weight,
      timestamp: reading.timestamp
    });

    return transaction;
  }

  /**
   * Capture tare weight (L5 - Weighbridge Tare)
   */
  async captureTareWeight(
    transactionId: string,
    reading: WeighbridgeReading,
    photoEvidence?: Express.Multer.File
  ): Promise<WeightCalculationResult> {
    const transaction = await this.getTransactionForWeighing(transactionId, OperationalLevel.L5_WEIGHBRIDGE_TARE);
    
    // Validate weight reading
    this.validateWeightReading(reading);
    
    // Ensure gross weight exists
    if (!transaction.weighbridgeData?.grossWeight) {
      throw new BadRequestException('Gross weight must be captured before tare weight');
    }

    // Calculate net weight
    const result = this.calculateNetWeight(
      transaction.weighbridgeData.grossWeight,
      reading.weight,
      transaction.factory?.weighbridgeConfig?.discrepancyThreshold || 5
    );

    // Update transaction with tare weight and calculation
    transaction.weighbridgeData = {
      ...transaction.weighbridgeData,
      tareWeight: reading.weight,
      netWeight: result.netWeight,
      tareWeightTimestamp: reading.timestamp,
      tareWeightOperator: reading.operatorId,
      weighbridgeTicketUrl: photoEvidence ? await this.storeWeighbridgeTicket(photoEvidence, transactionId, 'tare') : transaction.weighbridgeData.weighbridgeTicketUrl
    };

    // Update current level and level data
    transaction.currentLevel = OperationalLevel.L6_GRN_GENERATION;
    transaction.levelData = {
      ...transaction.levelData,
      [OperationalLevel.L5_WEIGHBRIDGE_TARE]: {
        level: OperationalLevel.L5_WEIGHBRIDGE_TARE,
        fieldValues: {
          tareWeight: reading.weight,
          netWeight: result.netWeight,
          discrepancyPercentage: result.discrepancyPercentage,
          requiresSupervisorApproval: result.requiresSupervisorApproval
        },
        completedBy: reading.operatorId,
        completedAt: reading.timestamp,
        evidenceIds: photoEvidence ? [await this.createEvidenceRecord(photoEvidence, transactionId, OperationalLevel.L5_WEIGHBRIDGE_TARE)] : [],
        validationStatus: result.requiresSupervisorApproval ? 'PENDING' : 'APPROVED'
      }
    };

    await this.transactionRepository.save(transaction);
    await this.createAuditLog(transactionId, reading.operatorId, AuditAction.WEIGHBRIDGE_TARE_CAPTURED, {
      tareWeight: reading.weight,
      netWeight: result.netWeight,
      discrepancyPercentage: result.discrepancyPercentage,
      requiresSupervisorApproval: result.requiresSupervisorApproval
    });

    return result;
  }

  /**
   * Calculate net weight and validate against thresholds
   */
  calculateNetWeight(grossWeight: number, tareWeight: number, discrepancyThreshold: number): WeightCalculationResult {
    // Basic validation
    if (!Number.isFinite(grossWeight) || !Number.isFinite(tareWeight) || !Number.isFinite(discrepancyThreshold)) {
      throw new BadRequestException('Weight values must be valid finite numbers');
    }

    if (grossWeight <= 0 || tareWeight <= 0) {
      throw new BadRequestException('Weight values must be positive numbers');
    }

    if (tareWeight >= grossWeight) {
      throw new BadRequestException('Tare weight cannot be greater than or equal to gross weight');
    }

    const netWeight = grossWeight - tareWeight;
    
    // Calculate discrepancy percentage (if expected weight is available)
    // For now, we'll use a simple validation based on reasonable weight ratios
    const weightRatio = tareWeight / grossWeight;
    const discrepancyPercentage = Math.abs(weightRatio - 0.5) * 100; // Assuming 50% is typical ratio
    
    const requiresSupervisorApproval = discrepancyPercentage > discrepancyThreshold;

    return {
      grossWeight,
      tareWeight,
      netWeight,
      isValid: netWeight > 0,
      discrepancyPercentage,
      requiresSupervisorApproval
    };
  }

  /**
   * Integrate with weighbridge equipment (if available)
   */
  async readFromEquipment(equipmentConfig: WeighbridgeIntegrationConfig): Promise<number> {
    if (!equipmentConfig.isIntegrated) {
      throw new BadRequestException('Weighbridge equipment is not integrated');
    }

    // TODO: Implement actual equipment integration
    // This would typically involve:
    // 1. TCP/IP connection to weighbridge equipment
    // 2. Send command to read current weight
    // 3. Parse response and return weight value
    // 4. Handle equipment errors and timeouts
    
    // For now, return a mock reading
    throw new BadRequestException('Equipment integration not yet implemented. Please use manual entry with photo proof.');
  }

  /**
   * Validate manual weight entry with mandatory photo proof
   */
  async validateManualEntry(
    weight: number,
    photoEvidence: Express.Multer.File,
    operatorId: string
  ): Promise<boolean> {
    if (!photoEvidence) {
      throw new BadRequestException('Photo evidence is mandatory for manual weight entry');
    }

    if (weight <= 0) {
      throw new BadRequestException('Weight must be a positive number');
    }

    // Additional validations can be added here
    // e.g., reasonable weight ranges, photo quality checks, etc.

    return true;
  }

  private async getTransactionForWeighing(transactionId: string, expectedLevel: OperationalLevel): Promise<Transaction> {
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId },
      relations: ['factory']
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    if (transaction.status !== TransactionStatus.ACTIVE) {
      throw new BadRequestException('Transaction is not active');
    }

    if (transaction.isLocked) {
      throw new BadRequestException('Transaction is locked and cannot be modified');
    }

    // Validate level progression
    if (expectedLevel === OperationalLevel.L3_WEIGHBRIDGE_GROSS && transaction.currentLevel !== OperationalLevel.L2_GATE_ENTRY) {
      throw new BadRequestException('Must complete Gate Entry (L2) before Weighbridge Gross (L3)');
    }

    if (expectedLevel === OperationalLevel.L5_WEIGHBRIDGE_TARE && transaction.currentLevel !== OperationalLevel.L4_MATERIAL_INSPECTION) {
      throw new BadRequestException('Must complete Material Inspection (L4) before Weighbridge Tare (L5)');
    }

    return transaction;
  }

  private validateWeightReading(reading: WeighbridgeReading): void {
    if (!reading.weight || reading.weight <= 0) {
      throw new BadRequestException('Weight must be a positive number');
    }

    if (!reading.timestamp) {
      throw new BadRequestException('Timestamp is required');
    }

    if (!reading.operatorId) {
      throw new BadRequestException('Operator ID is required');
    }

    // Additional validations
    if (reading.weight > 100000) { // 100 tons max
      throw new BadRequestException('Weight exceeds maximum allowed limit');
    }
  }

  private async storeWeighbridgeTicket(file: Express.Multer.File, transactionId: string, type: 'gross' | 'tare'): Promise<string> {
    // TODO: Implement file storage to S3 or local storage
    // For now, return a mock URL
    return `weighbridge-tickets/${transactionId}-${type}-${Date.now()}.jpg`;
  }

  private async createEvidenceRecord(file: Express.Multer.File, transactionId: string, level: OperationalLevel): Promise<string> {
    const evidence = this.evidenceRepository.create({
      transactionId,
      operationalLevel: level,
      evidenceType: EvidenceType.WEIGHBRIDGE_TICKET,
      filePath: await this.storeWeighbridgeTicket(file, transactionId, level === OperationalLevel.L3_WEIGHBRIDGE_GROSS ? 'gross' : 'tare'),
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      capturedBy: 'system', // This should be the actual operator ID
      metadata: {
        customFields: {
          level: level,
          type: level === OperationalLevel.L3_WEIGHBRIDGE_GROSS ? 'gross_weight_ticket' : 'tare_weight_ticket'
        }
      }
    });

    const savedEvidence = await this.evidenceRepository.save(evidence);
    return savedEvidence.id;
  }

  private async createAuditLog(transactionId: string, userId: string, action: AuditAction, details: any): Promise<void> {
    const auditLog = this.auditLogRepository.create({
      transactionId,
      userId,
      action,
      entityType: 'Transaction',
      entityId: transactionId,
      description: `Weighbridge operation: ${action}`,
      newValues: details,
      metadata: {
        ipAddress: '127.0.0.1', // This should come from request
        userAgent: 'WeighbridgeService', // This should come from request
        operationalLevel: action === AuditAction.WEIGHBRIDGE_GROSS_CAPTURED ? 3 : 5
      },
      severity: 'MEDIUM',
      timestamp: new Date()
    });

    await this.auditLogRepository.save(auditLog);
  }
}