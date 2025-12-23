import { Repository } from 'typeorm';
import { Transaction } from '../entities/transaction.entity';
import { Vehicle } from '../entities/vehicle.entity';
import { AuditLog } from '../entities/audit-log.entity';
export interface GatePassData {
    transactionId: string;
    vehicleNumber: string;
    qrCode: string;
    expiresAt: Date;
    generatedBy: string;
    generatedAt: Date;
}
export interface GatePassValidationResult {
    isValid: boolean;
    transaction?: Transaction;
    errors: string[];
    requiresSupervisorOverride?: boolean;
}
export declare class GatePassService {
    private transactionRepository;
    private vehicleRepository;
    private auditLogRepository;
    constructor(transactionRepository: Repository<Transaction>, vehicleRepository: Repository<Vehicle>, auditLogRepository: Repository<AuditLog>);
    generateGatePass(transactionId: string, userId: string, validityHours?: number): Promise<GatePassData>;
    validateGatePass(qrCodeData: string): Promise<GatePassValidationResult>;
    processVehicleExit(transactionId: string, userId: string, supervisorOverride?: boolean): Promise<void>;
    supervisorOverrideExpiredGatePass(transactionId: string, supervisorId: string, justification: string): Promise<void>;
}
