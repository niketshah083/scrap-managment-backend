import { Repository } from 'typeorm';
import { Transaction } from '../entities/transaction.entity';
import { Evidence } from '../entities/evidence.entity';
import { AuditLog } from '../entities/audit-log.entity';
export interface WeighbridgeReading {
    weight: number;
    timestamp: Date;
    operatorId: string;
    equipmentId?: string;
    ticketNumber?: string;
}
export interface WeightCalculationResult {
    grossWeight: number;
    tareWeight: number;
    netWeight: number;
    isValid: boolean;
    discrepancyPercentage?: number;
    requiresSupervisorApproval: boolean;
}
export interface WeighbridgeIntegrationConfig {
    isIntegrated: boolean;
    equipmentModel?: string;
    ipAddress?: string;
    port?: number;
    timeout?: number;
    discrepancyThreshold: number;
}
export declare class WeighbridgeService {
    private transactionRepository;
    private evidenceRepository;
    private auditLogRepository;
    constructor(transactionRepository: Repository<Transaction>, evidenceRepository: Repository<Evidence>, auditLogRepository: Repository<AuditLog>);
    captureGrossWeight(transactionId: string, reading: WeighbridgeReading, photoEvidence?: Express.Multer.File): Promise<Transaction>;
    captureTareWeight(transactionId: string, reading: WeighbridgeReading, photoEvidence?: Express.Multer.File): Promise<WeightCalculationResult>;
    calculateNetWeight(grossWeight: number, tareWeight: number, discrepancyThreshold: number): WeightCalculationResult;
    readFromEquipment(equipmentConfig: WeighbridgeIntegrationConfig): Promise<number>;
    validateManualEntry(weight: number, photoEvidence: Express.Multer.File, operatorId: string): Promise<boolean>;
    private getTransactionForWeighing;
    private validateWeightReading;
    private storeWeighbridgeTicket;
    private createEvidenceRecord;
    private createAuditLog;
}
