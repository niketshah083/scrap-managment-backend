import { QCReport } from './qc-report.entity';
export declare enum DebitNoteStatus {
    GENERATED = "GENERATED",
    SENT = "SENT",
    ACKNOWLEDGED = "ACKNOWLEDGED"
}
export declare class DebitNote {
    id: string;
    debitNoteNumber: string;
    qcReportId: string;
    transactionId: string;
    vendorId: string;
    tenantId: string;
    weightDifference: number;
    qualityDifference: number;
    bardanaDeduction: number;
    rejectionAmount: number;
    grandTotal: number;
    status: DebitNoteStatus;
    createdAt: Date;
    updatedAt: Date;
    qcReport: QCReport;
}
