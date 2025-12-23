import { EvidenceService, CreateEvidenceDto } from './evidence.service';
import { EvidenceType } from '../entities/evidence.entity';
export declare class EvidenceController {
    private evidenceService;
    constructor(evidenceService: EvidenceService);
    createEvidence(createEvidenceDto: Omit<CreateEvidenceDto, 'file'>, file: Express.Multer.File, req: any): Promise<import("../entities/evidence.entity").Evidence>;
    getEvidenceByTransaction(transactionId: string, req: any): Promise<import("../entities/evidence.entity").Evidence[]>;
    getEvidenceByLevel(transactionId: string, level: string, req: any): Promise<import("../entities/evidence.entity").Evidence[]>;
    getEvidenceStats(transactionId: string, req: any): Promise<{
        totalCount: number;
        byType: Record<EvidenceType, number>;
        byLevel: Record<number, number>;
        totalSize: number;
    }>;
    getEvidenceById(id: string, req: any): Promise<import("../entities/evidence.entity").Evidence>;
    verifyEvidenceIntegrity(id: string): Promise<{
        evidenceId: string;
        isValid: boolean;
    }>;
    validateChronologicalIntegrity(transactionId: string): Promise<{
        transactionId: string;
        chronologicalIntegrityValid: boolean;
    }>;
    validateTimestamp(body: {
        timestamp: string;
        transactionId: string;
        operationalLevel: number;
    }): Promise<{
        timestamp: string;
        isValid: boolean;
        serverTimestamp: string;
    }>;
    markAsProcessed(id: string): Promise<{
        message: string;
    }>;
}
