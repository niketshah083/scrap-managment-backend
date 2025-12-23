import { Repository } from 'typeorm';
import { Evidence } from '../entities/evidence.entity';
import { Transaction } from '../entities/transaction.entity';
import { User } from '../entities/user.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { OcrService, OcrExtractionResult } from './ocr.service';
export interface DocumentUploadDto {
    transactionId: string;
    operationalLevel: number;
    file: Buffer;
    fileName: string;
    mimeType: string;
    documentType: 'PO' | 'INVOICE' | 'CHALLAN' | 'OTHER';
    extractFields?: boolean;
}
export interface DocumentConfirmationDto {
    documentId: string;
    confirmedData: {
        vendorName?: string;
        invoiceNumber?: string;
        poNumber?: string;
        date?: string;
        amount?: string;
        materialLines?: Array<{
            description: string;
            quantity: string;
            unit: string;
            rate?: string;
        }>;
        customFields?: Record<string, any>;
    };
    confirmedBy: string;
}
export interface ProcessedDocument {
    id: string;
    transactionId: string;
    documentType: string;
    fileName: string;
    ocrResult: OcrExtractionResult;
    isConfirmed: boolean;
    confirmedData?: any;
    confirmedBy?: string;
    confirmedAt?: Date;
    createdAt: Date;
}
export declare class DocumentProcessingService {
    private evidenceRepository;
    private transactionRepository;
    private userRepository;
    private auditLogRepository;
    private ocrService;
    private readonly logger;
    constructor(evidenceRepository: Repository<Evidence>, transactionRepository: Repository<Transaction>, userRepository: Repository<User>, auditLogRepository: Repository<AuditLog>, ocrService: OcrService);
    processDocument(uploadDto: DocumentUploadDto, uploadedBy: string, tenantId: string): Promise<ProcessedDocument>;
    confirmDocumentData(confirmationDto: DocumentConfirmationDto, tenantId: string): Promise<ProcessedDocument>;
    getDocumentsByTransaction(transactionId: string, tenantId: string): Promise<ProcessedDocument[]>;
    getUnconfirmedDocuments(tenantId: string): Promise<ProcessedDocument[]>;
    linkDocumentToTransaction(documentId: string, transactionId: string, tenantId: string): Promise<void>;
    private createAuditLog;
}
