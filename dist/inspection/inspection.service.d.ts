import { Repository } from 'typeorm';
import { Transaction } from '../entities/transaction.entity';
import { Evidence } from '../entities/evidence.entity';
import { User } from '../entities/user.entity';
import { Vendor } from '../entities/vendor.entity';
import { EvidenceService } from '../evidence/evidence.service';
import { NotificationService } from '../notification/notification.service';
export interface InspectionData {
    grade: 'A' | 'B' | 'C' | 'REJECTED';
    contaminationLevel: number;
    moistureLevel?: number;
    qualityNotes?: string;
    rejectionReason?: string;
    inspectorId: string;
    photos: {
        file: Buffer;
        fileName: string;
        mimeType: string;
        description?: string;
    }[];
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
}
export interface InspectionResult {
    transactionId: string;
    inspectionData: any;
    evidenceIds: string[];
    reportUrl?: string;
    isApproved: boolean;
}
export declare class InspectionService {
    private transactionRepository;
    private evidenceRepository;
    private userRepository;
    private vendorRepository;
    private evidenceService;
    private notificationService;
    constructor(transactionRepository: Repository<Transaction>, evidenceRepository: Repository<Evidence>, userRepository: Repository<User>, vendorRepository: Repository<Vendor>, evidenceService: EvidenceService, notificationService: NotificationService);
    conductInspection(transactionId: string, inspectionData: InspectionData, tenantId: string): Promise<InspectionResult>;
    getInspectionData(transactionId: string, tenantId: string): Promise<any>;
    getInspectionEvidence(transactionId: string, tenantId: string): Promise<Evidence[]>;
    private validateInspectionData;
    private generateInspectionReport;
    private updateVendorPerformance;
    validateInspectionRequirements(transactionId: string, tenantId: string): Promise<{
        canProceed: boolean;
        missingRequirements: string[];
    }>;
    getInspectionConfiguration(tenantId: string): Promise<{
        requiredPhotos: {
            min: number;
            max: number;
        };
        availableGrades: string[];
        contaminationThresholds: {
            [grade: string]: number;
        };
        requiredFields: string[];
    }>;
}
