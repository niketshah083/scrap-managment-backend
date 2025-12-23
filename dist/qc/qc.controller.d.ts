import { QCService, CreateQCReportDto, UpdateQCReportDto } from './qc.service';
import { QCReportStatus } from '../entities/qc-report.entity';
export declare class QCController {
    private readonly qcService;
    constructor(qcService: QCService);
    createQCReport(dto: CreateQCReportDto): Promise<import("../entities/qc-report.entity").QCReport>;
    getQCReportById(id: string): Promise<import("../entities/qc-report.entity").QCReport>;
    getQCReportByTransaction(transactionId: string): Promise<import("../entities/qc-report.entity").QCReport>;
    getQCReports(tenantId: string, status?: QCReportStatus): Promise<import("../entities/qc-report.entity").QCReport[]>;
    updateQCReport(id: string, dto: UpdateQCReportDto): Promise<import("../entities/qc-report.entity").QCReport>;
    approveQCReport(id: string, approverUserId: string): Promise<import("../entities/qc-report.entity").QCReport>;
    generateDebitNote(id: string): Promise<import("../entities").DebitNote>;
    getDebitNoteById(id: string): Promise<import("../entities").DebitNote>;
    sendQCReportToVendor(id: string, sendMethod: 'EMAIL' | 'WHATSAPP' | 'BOTH', userId?: string): Promise<{
        success: boolean;
        message: string;
        sentAt: Date;
    }>;
}
