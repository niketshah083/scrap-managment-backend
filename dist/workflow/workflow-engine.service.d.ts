import { Repository } from 'typeorm';
import { WorkflowConfiguration, FieldValidationType, FieldEditability } from '../entities/workflow-configuration.entity';
import { Transaction, OperationalLevel } from '../entities/transaction.entity';
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}
export interface FieldConfiguration {
    fieldName: string;
    fieldLabel: string;
    fieldType: string;
    captureType: string;
    validationType: FieldValidationType;
    editability: FieldEditability;
    minPhotoCount: number;
    maxPhotoCount: number;
    validationRules: any;
    rolePermissions: any;
    displayOrder: number;
    helpText?: string;
    placeholder?: string;
    conditionalLogic?: any;
}
export interface LevelData {
    level: OperationalLevel;
    fieldValues: Record<string, any>;
    completedBy: string;
    completedAt: Date;
    evidenceIds: string[];
    validationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
    notes?: string;
}
export interface ProcessingResult {
    success: boolean;
    transactionId: string;
    newLevel?: OperationalLevel;
    errors: string[];
    warnings: string[];
}
export declare class WorkflowEngineService {
    private workflowConfigRepo;
    private transactionRepo;
    constructor(workflowConfigRepo: Repository<WorkflowConfiguration>, transactionRepo: Repository<Transaction>);
    validateLevelProgression(transactionId: string, targetLevel: OperationalLevel): Promise<ValidationResult>;
    private validateSafetyGuardrails;
    getConfiguredFields(tenantId: string, level: OperationalLevel): Promise<FieldConfiguration[]>;
    processLevelCompletion(transactionId: string, levelData: LevelData): Promise<ProcessingResult>;
    private validateFieldData;
    private validateFieldRules;
    validateEvidenceFieldConfiguration(tenantId: string, level: OperationalLevel, fieldName: string): Promise<boolean>;
}
