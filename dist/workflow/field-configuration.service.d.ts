import { Repository } from 'typeorm';
import { WorkflowConfiguration, FieldValidationType, FieldEditability, FieldCaptureType } from '../entities/workflow-configuration.entity';
import { OperationalLevel } from '../entities/transaction.entity';
export interface CreateFieldConfigDto {
    tenantId: string;
    factoryId?: string;
    operationalLevel: OperationalLevel;
    fieldName: string;
    fieldLabel: string;
    fieldType: string;
    captureType: FieldCaptureType;
    validationType: FieldValidationType;
    editability: FieldEditability;
    minPhotoCount?: number;
    maxPhotoCount?: number;
    validationRules?: any;
    rolePermissions?: any;
    displayOrder?: number;
    helpText?: string;
    placeholder?: string;
    conditionalLogic?: any;
}
export interface UpdateFieldConfigDto extends Partial<CreateFieldConfigDto> {
    id: string;
}
export declare class FieldConfigurationService {
    private configRepo;
    constructor(configRepo: Repository<WorkflowConfiguration>);
    createFieldConfiguration(dto: CreateFieldConfigDto): Promise<WorkflowConfiguration>;
    updateFieldConfiguration(dto: UpdateFieldConfigDto): Promise<WorkflowConfiguration>;
    getFieldConfigurations(tenantId: string, operationalLevel?: OperationalLevel): Promise<WorkflowConfiguration[]>;
    getFieldConfigurationsWithInheritance(tenantId: string, factoryId?: string, operationalLevel?: OperationalLevel): Promise<WorkflowConfiguration[]>;
    moveFieldToLevel(configId: string, newLevel: OperationalLevel): Promise<WorkflowConfiguration>;
    private validateFieldMove;
    private validateEvidenceFieldConfiguration;
    getDefaultFieldConfigurations(tenantId: string): Promise<CreateFieldConfigDto[]>;
}
