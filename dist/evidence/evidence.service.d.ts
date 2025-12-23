import { Repository } from 'typeorm';
import { Evidence, EvidenceType } from '../entities/evidence.entity';
import { Transaction } from '../entities/transaction.entity';
import { User } from '../entities/user.entity';
import { AuditLog } from '../entities/audit-log.entity';
export interface CreateEvidenceDto {
    transactionId: string;
    operationalLevel: number;
    evidenceType: EvidenceType;
    file?: Buffer;
    fileName?: string;
    mimeType?: string;
    description?: string;
    tags?: string[];
    metadata?: {
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
        cameraInfo?: {
            make?: string;
            model?: string;
            orientation?: number;
            flash?: boolean;
        };
        ocrData?: {
            extractedText: string;
            confidence: number;
            language: string;
        };
        customFields?: Record<string, any>;
    };
}
export interface EvidenceMetadata {
    gpsCoordinates?: {
        latitude: number;
        longitude: number;
        accuracy?: number;
        timestamp: Date;
    };
    deviceInfo: {
        deviceId: string;
        deviceModel: string;
        osVersion: string;
        appVersion: string;
        userAgent?: string;
    };
    captureInfo: {
        timestamp: Date;
        timezone: string;
        networkType?: string;
        batteryLevel?: number;
    };
    cameraInfo?: {
        make?: string;
        model?: string;
        orientation?: number;
        flash?: boolean;
        focusMode?: string;
    };
    fileInfo: {
        originalName: string;
        size: number;
        hash: string;
        mimeType: string;
    };
}
export declare class EvidenceService {
    private evidenceRepository;
    private transactionRepository;
    private userRepository;
    private auditLogRepository;
    constructor(evidenceRepository: Repository<Evidence>, transactionRepository: Repository<Transaction>, userRepository: Repository<User>, auditLogRepository: Repository<AuditLog>);
    createEvidence(createEvidenceDto: CreateEvidenceDto, capturedBy: string, tenantId: string): Promise<Evidence>;
    getEvidenceByTransaction(transactionId: string, tenantId: string): Promise<Evidence[]>;
    getEvidenceById(evidenceId: string, tenantId: string): Promise<Evidence>;
    verifyEvidenceIntegrity(evidenceId: string): Promise<boolean>;
    markAsProcessed(evidenceId: string): Promise<void>;
    getEvidenceByLevel(transactionId: string, operationalLevel: number, tenantId: string): Promise<Evidence[]>;
    validateChronologicalIntegrity(transactionId: string): Promise<boolean>;
    preventBackdating(proposedTimestamp: Date, transactionId: string, operationalLevel: number): Promise<boolean>;
    private generateFileHash;
    private storeFile;
    private getExtensionFromMimeType;
    private enhanceMetadata;
    deleteEvidence(evidenceId: string, tenantId: string): Promise<void>;
    private createAuditLog;
    getEvidenceStats(transactionId: string, tenantId: string): Promise<{
        totalCount: number;
        byType: Record<EvidenceType, number>;
        byLevel: Record<number, number>;
        totalSize: number;
    }>;
}
