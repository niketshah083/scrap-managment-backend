import { Transaction } from './transaction.entity';
export declare enum QCReportStatus {
    DRAFT = "DRAFT",
    APPROVED = "APPROVED"
}
export interface QCLineItem {
    id: number;
    date: string;
    scrapType: string;
    grossWeight: number;
    bardana: number;
    rejection: number;
    netWeight: number;
    expPercent: number;
    qualityDeductPercent: number;
    finalQuantity: number;
    rate: number;
    amount: number;
    deliveryRate: number;
    deliveryDifference: number;
}
export interface QCTotals {
    grossWeight: number;
    bardana: number;
    rejection: number;
    netWeight: number;
    finalQuantity: number;
    amount: number;
    deliveryDifference: number;
}
export declare class QCReport {
    id: string;
    transactionId: string;
    tenantId: string;
    lineItems: QCLineItem[];
    totals: QCTotals;
    remarks: string;
    labTechnician: string;
    verifiedBy: string;
    status: QCReportStatus;
    approvedAt: Date;
    approvedBy: string;
    debitNoteId: string;
    createdAt: Date;
    updatedAt: Date;
    transaction: Transaction;
}
