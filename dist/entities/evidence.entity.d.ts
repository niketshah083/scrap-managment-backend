import { Transaction } from './transaction.entity';
import { User } from './user.entity';
export declare enum EvidenceType {
    PHOTO = "PHOTO",
    DOCUMENT = "DOCUMENT",
    VIDEO = "VIDEO",
    AUDIO = "AUDIO",
    GPS_LOCATION = "GPS_LOCATION",
    TIMESTAMP = "TIMESTAMP",
    WEIGHBRIDGE_TICKET = "WEIGHBRIDGE_TICKET",
    INSPECTION_REPORT = "INSPECTION_REPORT",
    GRN_DOCUMENT = "GRN_DOCUMENT",
    GATE_PASS = "GATE_PASS"
}
export declare class Evidence {
    id: string;
    transactionId: string;
    capturedBy: string;
    operationalLevel: number;
    evidenceType: EvidenceType;
    filePath: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    metadata: {
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
    fileHash: string;
    isProcessed: boolean;
    description: string;
    tags: string[];
    capturedAt: Date;
    transaction: Transaction;
    user: User;
}
