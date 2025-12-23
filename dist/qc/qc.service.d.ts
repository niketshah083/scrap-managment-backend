import { Repository } from 'typeorm';
import { QCReport, QCReportStatus, QCLineItem, QCTotals } from '../entities/qc-report.entity';
import { DebitNote } from '../entities/debit-note.entity';
import { Transaction } from '../entities/transaction.entity';
import { AuditService } from '../audit/audit.service';
export interface CreateQCReportDto {
    transactionId: string;
    tenantId: string;
    lineItems: Omit<QCLineItem, 'netWeight' | 'finalQuantity' | 'amount' | 'deliveryDifference'>[];
    remarks?: string;
    labTechnician: string;
    verifiedBy?: string;
    userId?: string;
}
export interface UpdateQCReportDto {
    lineItems?: Omit<QCLineItem, 'netWeight' | 'finalQuantity' | 'amount' | 'deliveryDifference'>[];
    remarks?: string;
    labTechnician?: string;
    verifiedBy?: string;
}
export declare class QCService {
    private qcReportRepository;
    private debitNoteRepository;
    private transactionRepository;
    private auditService;
    constructor(qcReportRepository: Repository<QCReport>, debitNoteRepository: Repository<DebitNote>, transactionRepository: Repository<Transaction>, auditService: AuditService);
    calculateNetWeight(grossWeight: number, bardana: number, rejection: number): number;
    calculateFinalQuantity(netWeight: number, expPercent: number, qualityDeductPercent: number): number;
    calculateAmount(finalQuantity: number, rate: number): number;
    calculateDeliveryDifference(finalQuantity: number, rate: number, deliveryRate: number): number;
    processLineItems(lineItems: Omit<QCLineItem, 'netWeight' | 'finalQuantity' | 'amount' | 'deliveryDifference'>[]): QCLineItem[];
    calculateTotals(lineItems: QCLineItem[]): QCTotals;
    createQCReport(dto: CreateQCReportDto): Promise<QCReport>;
    updateQCReport(id: string, dto: UpdateQCReportDto, userId?: string): Promise<QCReport>;
    getQCReportById(id: string): Promise<QCReport>;
    getQCReportByTransaction(transactionId: string): Promise<QCReport | null>;
    approveQCReport(id: string, approverUserId: string): Promise<QCReport>;
    generateDebitNote(qcReportId: string, userId?: string): Promise<DebitNote>;
    private generateDebitNoteNumber;
    getQCReportsByTenant(tenantId: string, status?: QCReportStatus): Promise<QCReport[]>;
    getDebitNoteById(id: string): Promise<DebitNote>;
    sendQCReportToVendor(qcReportId: string, sendMethod: 'EMAIL' | 'WHATSAPP' | 'BOTH', userId?: string): Promise<{
        success: boolean;
        message: string;
        sentAt: Date;
    }>;
}
