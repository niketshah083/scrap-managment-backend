import { TransactionService, CreateTransactionDto, SaveStepDataDto } from './transaction.service';
export declare class TransactionController {
    private readonly transactionService;
    constructor(transactionService: TransactionService);
    createTransaction(dto: CreateTransactionDto): Promise<import("../entities").Transaction>;
    getActiveTransactions(tenantId?: string): Promise<import("./transaction.service").TransactionWithDetails[]>;
    getDashboardStats(tenantId?: string): Promise<{
        todayInward: number;
        totalWeight: number;
        pendingInspections: number;
        rejectedMaterials: number;
    }>;
    getCompletedTransactionsForQC(tenantId?: string): Promise<import("./transaction.service").TransactionWithDetails[]>;
    getCompletedTransactions(tenantId?: string): Promise<import("./transaction.service").TransactionWithDetails[]>;
    getTransactionById(id: string): Promise<import("./transaction.service").TransactionWithDetails>;
    saveStepData(id: string, dto: SaveStepDataDto): Promise<import("../entities").Transaction>;
    completeTransaction(id: string, userId: string): Promise<import("../entities").Transaction>;
    getDraftTransaction(id: string): Promise<import("../entities").Transaction>;
    getTransactions(tenantId?: string, status?: string): Promise<import("./transaction.service").TransactionWithDetails[]>;
}
