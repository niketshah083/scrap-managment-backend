import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Transaction, TransactionStatus, OperationalLevel } from '../entities/transaction.entity';
import { PurchaseOrder, POStatus } from '../entities/purchase-order.entity';
import { Vendor } from '../entities/vendor.entity';
import { AuditService } from '../audit/audit.service';

export interface CreateTransactionDto {
  tenantId: string;
  factoryId: string;
  vendorId: string;
  vehicleId?: string;
  purchaseOrderId?: string;
  vehicleNumber?: string;
  driverName?: string;
  driverMobile?: string;
  createdBy?: string;
}

export interface SaveStepDataDto {
  stepNumber: number;
  data: Record<string, any>;
  files?: Record<string, { name: string; url: string; type: string }[]>;
  userId: string;
}

export interface TransactionWithDetails extends Transaction {
  vendorName?: string;
  vehicleNumber?: string;
  poNumber?: string;
  materialType?: string;
}

@Injectable()
export class TransactionService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(PurchaseOrder)
    private poRepository: Repository<PurchaseOrder>,
    @InjectRepository(Vendor)
    private vendorRepository: Repository<Vendor>,
    private auditService: AuditService,
  ) {}

  // Generate unique transaction number
  private generateTransactionNumber(): string {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `GRN-${timestamp}-${random}`;
  }

  // Create new transaction
  async createTransaction(dto: CreateTransactionDto): Promise<Transaction> {
    const transactionNumber = this.generateTransactionNumber();
    
    // Create vehicle ID if not provided (for new vehicles)
    const vehicleId = dto.vehicleId || `VEH-${Date.now()}`;
    
    const transaction = this.transactionRepository.create({
      tenantId: dto.tenantId,
      factoryId: dto.factoryId,
      vendorId: dto.vendorId,
      vehicleId: vehicleId,
      purchaseOrderId: dto.purchaseOrderId,
      transactionNumber,
      currentLevel: OperationalLevel.L1_VENDOR_DISPATCH,
      status: TransactionStatus.ACTIVE,
      stepData: {},
      levelData: {},
    });

    // Save initial step data if provided
    if (dto.vehicleNumber || dto.driverName) {
      transaction.stepData = {
        0: {
          stepNumber: 0,
          data: {
            vehicleNumber: dto.vehicleNumber,
            driverName: dto.driverName,
            driverMobile: dto.driverMobile,
          },
          files: {},
          timestamp: new Date(),
          userId: dto.createdBy || 'system',
        }
      };
    }

    const savedTransaction = await this.transactionRepository.save(transaction);

    // Create audit log for transaction creation
    await this.auditService.logTransactionCreation(
      dto.createdBy || 'system',
      savedTransaction.id,
      {
        transactionNumber: savedTransaction.transactionNumber,
        tenantId: savedTransaction.tenantId,
        factoryId: savedTransaction.factoryId,
        vendorId: savedTransaction.vendorId,
        purchaseOrderId: savedTransaction.purchaseOrderId,
        vehicleNumber: dto.vehicleNumber,
        driverName: dto.driverName,
      },
    );

    return savedTransaction;
  }

  // Get active transactions for dashboard
  async getActiveTransactions(tenantId: string): Promise<TransactionWithDetails[]> {
    const transactions = await this.transactionRepository.find({
      where: {
        tenantId,
        status: In([TransactionStatus.ACTIVE]),
      },
      relations: ['vendor', 'purchaseOrder'],
      order: { createdAt: 'DESC' },
      take: 20,
    });

    return transactions.map(tx => ({
      ...tx,
      vendorName: tx.vendor?.vendorName || 'Unknown Vendor',
      vehicleNumber: tx.stepData?.[1]?.data?.truck_number || tx.stepData?.[0]?.data?.vehicleNumber || 'N/A',
      poNumber: tx.purchaseOrder?.poNumber,
      materialType: tx.purchaseOrder?.materialType,
    }));
  }

  // Get transaction by ID
  async getTransactionById(id: string): Promise<TransactionWithDetails> {
    const transaction = await this.transactionRepository.findOne({
      where: { id },
      relations: ['vendor', 'purchaseOrder'],
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction ${id} not found`);
    }

    return {
      ...transaction,
      vendorName: transaction.vendor?.vendorName || 'Unknown Vendor',
      vehicleNumber: transaction.stepData?.[1]?.data?.truck_number || 'N/A',
      poNumber: transaction.purchaseOrder?.poNumber,
      materialType: transaction.purchaseOrder?.materialType,
    };
  }

  // Save step data
  async saveStepData(transactionId: string, dto: SaveStepDataDto): Promise<Transaction> {
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }

    if (transaction.isLocked) {
      throw new BadRequestException('Transaction is locked and cannot be modified');
    }

    // Update step data
    const stepData = transaction.stepData || {};
    stepData[dto.stepNumber] = {
      stepNumber: dto.stepNumber,
      data: dto.data,
      files: dto.files || {},
      timestamp: new Date(),
      userId: dto.userId,
    };

    transaction.stepData = stepData;

    // Update current level based on step
    const levelMapping: Record<number, OperationalLevel> = {
      0: OperationalLevel.L1_VENDOR_DISPATCH,
      1: OperationalLevel.L2_GATE_ENTRY,
      2: OperationalLevel.L3_WEIGHBRIDGE_GROSS,
      3: OperationalLevel.L4_MATERIAL_INSPECTION,
      4: OperationalLevel.L5_WEIGHBRIDGE_TARE,
      5: OperationalLevel.L6_GRN_GENERATION,
      6: OperationalLevel.L7_GATE_PASS_EXIT,
    };

    if (levelMapping[dto.stepNumber + 1]) {
      transaction.currentLevel = levelMapping[dto.stepNumber + 1];
    }

    // Update weighbridge data if applicable
    if (dto.stepNumber === 2 && dto.data.gross_weight) {
      transaction.weighbridgeData = {
        ...transaction.weighbridgeData,
        grossWeight: parseFloat(dto.data.gross_weight),
        grossWeightTimestamp: new Date(),
        grossWeightOperator: dto.userId,
      };
    }

    if (dto.stepNumber === 4 && dto.data.tare_weight) {
      transaction.weighbridgeData = {
        ...transaction.weighbridgeData,
        tareWeight: parseFloat(dto.data.tare_weight),
        netWeight: (transaction.weighbridgeData?.grossWeight || 0) - parseFloat(dto.data.tare_weight),
        tareWeightTimestamp: new Date(),
        tareWeightOperator: dto.userId,
      };
    }

    // Update inspection data if applicable
    if (dto.stepNumber === 3) {
      transaction.inspectionData = {
        ...transaction.inspectionData,
        grade: dto.data.quality_grade,
        contaminationLevel: dto.data.contamination ? parseFloat(dto.data.contamination) : undefined,
        moistureLevel: dto.data.moisture ? parseFloat(dto.data.moisture) : undefined,
        inspectorId: dto.userId,
        inspectionTimestamp: new Date(),
        qualityNotes: dto.data.inspection_notes,
      };
    }

    const savedTransaction = await this.transactionRepository.save(transaction);

    // Create audit log for step save
    await this.auditService.logGRNStepSave(
      dto.userId,
      savedTransaction.id,
      dto.stepNumber,
      {
        data: dto.data,
        hasFiles: dto.files && Object.keys(dto.files).length > 0,
        currentLevel: savedTransaction.currentLevel,
      },
    );

    return savedTransaction;
  }

  // Complete transaction
  async completeTransaction(transactionId: string, userId: string): Promise<Transaction> {
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId },
      relations: ['purchaseOrder'],
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }

    transaction.status = TransactionStatus.COMPLETED;
    transaction.completedAt = new Date();
    transaction.isLocked = true;
    transaction.currentLevel = OperationalLevel.L7_GATE_PASS_EXIT;

    // Update PO received quantity if linked
    if (transaction.purchaseOrderId && transaction.weighbridgeData?.netWeight) {
      const po = await this.poRepository.findOne({
        where: { id: transaction.purchaseOrderId },
      });

      if (po) {
        po.receivedQuantity = (po.receivedQuantity || 0) + transaction.weighbridgeData.netWeight;
        
        // Update PO status
        if (po.receivedQuantity >= po.orderedQuantity) {
          po.status = POStatus.COMPLETED;
        } else if (po.receivedQuantity > 0) {
          po.status = POStatus.PARTIAL;
        }

        await this.poRepository.save(po);
      }
    }

    const savedTransaction = await this.transactionRepository.save(transaction);

    // Create audit log for GRN completion
    await this.auditService.logGRNCompletion(
      userId,
      savedTransaction.id,
      {
        transactionNumber: savedTransaction.transactionNumber,
        status: savedTransaction.status,
        completedAt: savedTransaction.completedAt,
        netWeight: savedTransaction.weighbridgeData?.netWeight,
        purchaseOrderId: savedTransaction.purchaseOrderId,
      },
    );

    return savedTransaction;
  }

  // Get dashboard stats
  async getDashboardStats(tenantId: string): Promise<{
    todayInward: number;
    totalWeight: number;
    pendingInspections: number;
    rejectedMaterials: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayTransactions, activeTransactions, rejectedTransactions] = await Promise.all([
      this.transactionRepository.count({
        where: {
          tenantId,
          createdAt: today,
        },
      }),
      this.transactionRepository.find({
        where: {
          tenantId,
          status: TransactionStatus.ACTIVE,
        },
      }),
      this.transactionRepository.count({
        where: {
          tenantId,
          status: TransactionStatus.REJECTED,
          createdAt: today,
        },
      }),
    ]);

    // Calculate total weight from completed transactions today
    const completedToday = await this.transactionRepository.find({
      where: {
        tenantId,
        status: TransactionStatus.COMPLETED,
      },
    });

    const totalWeight = completedToday.reduce((sum, tx) => {
      return sum + (tx.weighbridgeData?.netWeight || 0);
    }, 0);

    // Count pending inspections (transactions at L4)
    const pendingInspections = activeTransactions.filter(
      tx => tx.currentLevel === OperationalLevel.L4_MATERIAL_INSPECTION
    ).length;

    return {
      todayInward: todayTransactions || activeTransactions.length,
      totalWeight: totalWeight / 1000, // Convert to MT
      pendingInspections,
      rejectedMaterials: rejectedTransactions,
    };
  }

  // Get draft transaction for restoration
  async getDraftTransaction(transactionId: string): Promise<Transaction | null> {
    return this.transactionRepository.findOne({
      where: { 
        id: transactionId,
        status: TransactionStatus.ACTIVE,
      },
      relations: ['vendor', 'purchaseOrder'],
    });
  }

  // Load draft transaction with step data and last completed step
  async loadDraftTransaction(transactionId: string): Promise<{
    transaction: TransactionWithDetails;
    stepData: Record<number, any>;
    lastCompletedStep: number;
  }> {
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId },
      relations: ['vendor', 'purchaseOrder'],
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }

    // Calculate last completed step
    const stepData = transaction.stepData || {};
    const completedSteps = Object.keys(stepData).map(Number).filter(n => !isNaN(n));
    const lastCompletedStep = completedSteps.length > 0 ? Math.max(...completedSteps) : -1;

    return {
      transaction: {
        ...transaction,
        vendorName: transaction.vendor?.vendorName || 'Unknown Vendor',
        vehicleNumber: stepData[1]?.data?.truck_number || stepData[0]?.data?.vehicleNumber || 'N/A',
        poNumber: transaction.purchaseOrder?.poNumber,
        materialType: transaction.purchaseOrder?.materialType,
      },
      stepData,
      lastCompletedStep,
    };
  }

  // Get last incomplete step for navigation
  async getLastIncompleteStep(transactionId: string): Promise<number> {
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }

    const stepData = transaction.stepData || {};
    const completedSteps = Object.keys(stepData).map(Number).filter(n => !isNaN(n));
    
    if (completedSteps.length === 0) {
      return 1; // Start from step 1
    }

    const maxCompletedStep = Math.max(...completedSteps);
    return maxCompletedStep + 1; // Return next step
  }

  // Get completed transactions for QC
  async getCompletedTransactionsForQC(tenantId: string): Promise<TransactionWithDetails[]> {
    const transactions = await this.transactionRepository.find({
      where: {
        tenantId,
        status: TransactionStatus.COMPLETED,
      },
      relations: ['vendor', 'purchaseOrder'],
      order: { completedAt: 'DESC' },
    });

    // Filter to only include transactions without QC or with pending QC
    return transactions
      .filter(tx => !tx.qcStatus || tx.qcStatus === 'PENDING')
      .map(tx => ({
        ...tx,
        vendorName: tx.vendor?.vendorName || 'Unknown Vendor',
        vehicleNumber: tx.stepData?.[1]?.data?.truck_number || 'N/A',
        poNumber: tx.purchaseOrder?.poNumber,
        materialType: tx.purchaseOrder?.materialType,
      }));
  }

  // Get all draft transactions for a tenant
  async getDraftTransactions(tenantId: string): Promise<TransactionWithDetails[]> {
    const transactions = await this.transactionRepository.find({
      where: {
        tenantId,
        status: TransactionStatus.ACTIVE,
      },
      relations: ['vendor', 'purchaseOrder'],
      order: { updatedAt: 'DESC' },
    });

    return transactions.map(tx => ({
      ...tx,
      vendorName: tx.vendor?.vendorName || 'Unknown Vendor',
      vehicleNumber: tx.stepData?.[1]?.data?.truck_number || tx.stepData?.[0]?.data?.vehicleNumber || 'N/A',
      poNumber: tx.purchaseOrder?.poNumber,
      materialType: tx.purchaseOrder?.materialType,
    }));
  }

  // Get completed transactions (for general use)
  async getCompletedTransactions(tenantId?: string): Promise<TransactionWithDetails[]> {
    const where: any = { status: TransactionStatus.COMPLETED };
    if (tenantId) {
      where.tenantId = tenantId;
    }

    const transactions = await this.transactionRepository.find({
      where,
      relations: ['vendor', 'purchaseOrder'],
      order: { completedAt: 'DESC' },
      take: 50,
    });

    return transactions.map(tx => ({
      ...tx,
      vendorName: tx.vendor?.vendorName || 'Unknown Vendor',
      vehicleNumber: tx.stepData?.[1]?.data?.truck_number || 'N/A',
      poNumber: tx.purchaseOrder?.poNumber,
      materialType: tx.purchaseOrder?.materialType,
    }));
  }

  // Get all transactions (both active and completed) for GRN list
  async getAllTransactions(tenantId?: string): Promise<TransactionWithDetails[]> {
    const where: any = {};
    if (tenantId) {
      where.tenantId = tenantId;
    }

    const transactions = await this.transactionRepository.find({
      where,
      relations: ['vendor', 'purchaseOrder'],
      order: { createdAt: 'DESC' },
      take: 100,
    });

    return transactions.map(tx => ({
      ...tx,
      vendorName: tx.vendor?.vendorName || 'Unknown Vendor',
      vehicleNumber: tx.stepData?.[1]?.data?.truck_number || tx.stepData?.[0]?.data?.vehicleNumber || 'N/A',
      poNumber: tx.purchaseOrder?.poNumber,
      materialType: tx.purchaseOrder?.materialType,
    }));
  }
}
