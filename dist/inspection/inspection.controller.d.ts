import { InspectionService } from './inspection.service';
export interface ConductInspectionDto {
    grade: 'A' | 'B' | 'C' | 'REJECTED';
    contaminationLevel: number;
    moistureLevel?: number;
    qualityNotes?: string;
    rejectionReason?: string;
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
export declare class InspectionController {
    private readonly inspectionService;
    constructor(inspectionService: InspectionService);
    conductInspection(transactionId: string, conductInspectionDto: ConductInspectionDto, photos: Express.Multer.File[], req: any): Promise<import("./inspection.service").InspectionResult>;
    getInspectionData(transactionId: string, req: any): Promise<any>;
    getInspectionEvidence(transactionId: string, req: any): Promise<import("../entities").Evidence[]>;
    validateInspectionRequirements(transactionId: string, req: any): Promise<{
        canProceed: boolean;
        missingRequirements: string[];
    }>;
    getInspectionConfiguration(req: any): Promise<{
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
