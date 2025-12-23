import { Repository } from 'typeorm';
import { AuditLog, AuditAction } from '../entities/audit-log.entity';
export interface CreateAuditLogDto {
    userId: string;
    action: AuditAction;
    entityType: string;
    entityId?: string;
    transactionId?: string;
    description?: string;
    oldValues?: Record<string, any>;
    newValues?: Record<string, any>;
    metadata?: {
        ipAddress?: string;
        userAgent?: string;
        gpsCoordinates?: {
            latitude: number;
            longitude: number;
            accuracy?: number;
        };
        deviceInfo?: {
            deviceId: string;
            deviceModel: string;
            osVersion: string;
            appVersion: string;
        };
        sessionId?: string;
        operationalLevel?: number;
        additionalContext?: Record<string, any>;
    };
    isSensitive?: boolean;
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}
export declare class AuditService {
    private auditLogRepository;
    constructor(auditLogRepository: Repository<AuditLog>);
    createAuditLog(dto: CreateAuditLogDto): Promise<AuditLog>;
    logPOCreation(userId: string, poId: string, poData: Record<string, any>): Promise<AuditLog>;
    logPOUpdate(userId: string, poId: string, oldValues: Record<string, any>, newValues: Record<string, any>): Promise<AuditLog>;
    logPOCancellation(userId: string, poId: string, reason?: string): Promise<AuditLog>;
    logPODocumentUpload(userId: string, poId: string, documentInfo: Record<string, any>): Promise<AuditLog>;
    logGRNStepSave(userId: string, transactionId: string, stepNumber: number, stepData: Record<string, any>): Promise<AuditLog>;
    logTransactionCreation(userId: string, transactionId: string, transactionData: Record<string, any>): Promise<AuditLog>;
    logGRNCompletion(userId: string, transactionId: string, transactionData: Record<string, any>): Promise<AuditLog>;
    logQCReportCreation(userId: string, qcReportId: string, transactionId: string, qcData: Record<string, any>): Promise<AuditLog>;
    logQCReportUpdate(userId: string, qcReportId: string, transactionId: string, oldValues: Record<string, any>, newValues: Record<string, any>): Promise<AuditLog>;
    logQCReportApproval(userId: string, qcReportId: string, transactionId: string, approvalData: Record<string, any>): Promise<AuditLog>;
    logDebitNoteGeneration(userId: string, debitNoteId: string, qcReportId: string, transactionId: string, debitNoteData: Record<string, any>): Promise<AuditLog>;
    logQCReportSent(userId: string, qcReportId: string, transactionId: string, sendData: Record<string, any>): Promise<AuditLog>;
    getAuditLogsForEntity(entityType: string, entityId: string): Promise<AuditLog[]>;
    getAuditLogsForTransaction(transactionId: string): Promise<AuditLog[]>;
    getAuditLogsByUser(userId: string, limit?: number): Promise<AuditLog[]>;
}
