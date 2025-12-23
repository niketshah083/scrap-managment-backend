import { Repository } from 'typeorm';
import { Transaction } from '../entities/transaction.entity';
import { PurchaseOrder } from '../entities/purchase-order.entity';
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
    files?: Record<string, {
        name: string;
        url: string;
        type: string;
    }[]>;
    userId: string;
}
export interface TransactionWithDetails extends Transaction {
    vendorName?: string;
    vehicleNumber?: string;
    poNumber?: string;
    materialType?: string;
}
export declare class TransactionService {
    private transactionRepository;
    private poRepository;
    private vendorRepository;
    private auditService;
    constructor(transactionRepository: Repository<Transaction>, poRepository: Repository<PurchaseOrder>, vendorRepository: Repository<Vendor>, auditService: AuditService);
    private generateTransactionNumber;
    createTransaction(dto: CreateTransactionDto): Promise<Transaction>;
    getActiveTransactions(tenantId: string): Promise<TransactionWithDetails[]>;
    getTransactionById(id: string): Promise<TransactionWithDetails>;
    saveStepData(transactionId: string, dto: SaveStepDataDto): Promise<Transaction>;
    completeTransaction(transactionId: string, userId: string): Promise<Transaction>;
    getDashboardStats(tenantId: string): Promise<{
        todayInward: number;
        totalWeight: number;
        pendingInspections: number;
        rejectedMaterials: number;
    }>;
    getDraftTransaction(transactionId: string): Promise<Transaction | null>;
    loadDraftTransaction(transactionId: string): Promise<{
        transaction: TransactionWithDetails;
        stepData: Record<number, any>;
        lastCompletedStep: number;
    }>;
    getLastIncompleteStep(transactionId: string): Promise<number>;
    getCompletedTransactionsForQC(tenantId: string): Promise<TransactionWithDetails[]>;
    getDraftTransactions(tenantId: string): Promise<TransactionWithDetails[]>;
    getCompletedTransactions(tenantId?: string): Promise<TransactionWithDetails[]>;
    getAllTransactions(tenantId?: string): Promise<TransactionWithDetails[]>;
}
