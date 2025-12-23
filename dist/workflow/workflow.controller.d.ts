import { WorkflowEngineService, LevelData } from './workflow-engine.service';
import { FieldConfigurationService, CreateFieldConfigDto } from './field-configuration.service';
export declare class WorkflowController {
    private workflowEngine;
    private fieldConfigService;
    constructor(workflowEngine: WorkflowEngineService, fieldConfigService: FieldConfigurationService);
    getWorkflowLevels(tenantId?: string): Promise<({
        fields: any[];
        operationalLevel: number;
        levelName: string;
        description: string;
    } | {
        fields: any[];
        operationalLevel: number;
        levelName: string;
        description: string;
    } | {
        fields: any[];
        operationalLevel: number;
        levelName: string;
        description: string;
    } | {
        fields: any[];
        operationalLevel: number;
        levelName: string;
        description: string;
    } | {
        fields: any[];
        operationalLevel: number;
        levelName: string;
        description: string;
    })[]>;
    getFieldConfigurations(tenantId: string, level?: number): Promise<import("../entities").WorkflowConfiguration[]>;
    createFieldConfiguration(dto: CreateFieldConfigDto): Promise<import("../entities").WorkflowConfiguration>;
    updateFieldConfiguration(configId: string, dto: Partial<CreateFieldConfigDto>): Promise<import("../entities").WorkflowConfiguration>;
    moveFieldToLevel(configId: string, newLevel: number): Promise<import("../entities").WorkflowConfiguration>;
    validateLevelProgression(transactionId: string, targetLevel: number): Promise<import("./workflow-engine.service").ValidationResult>;
    completeLevelData(transactionId: string, levelData: LevelData): Promise<import("./workflow-engine.service").ProcessingResult>;
    getConfiguredFields(tenantId: string, level: number): Promise<import("./workflow-engine.service").FieldConfiguration[]>;
    getConfiguredFieldsWithInheritance(tenantId: string, level: number, factoryId: string): Promise<{
        fieldName: string;
        fieldLabel: string;
        fieldType: string;
        captureType: import("../entities").FieldCaptureType;
        validationType: import("../entities").FieldValidationType;
        editability: import("../entities").FieldEditability;
        minPhotoCount: number;
        maxPhotoCount: number;
        validationRules: {
            minLength?: number;
            maxLength?: number;
            pattern?: string;
            minValue?: number;
            maxValue?: number;
            allowedValues?: string[];
            customValidation?: string;
        };
        rolePermissions: {
            [key: string]: {
                canView: boolean;
                canEdit: boolean;
                canApprove: boolean;
            };
        };
        displayOrder: number;
        helpText: string;
        placeholder: string;
        conditionalLogic: {
            showIf?: {
                fieldName: string;
                operator: string;
                value: any;
            };
            requiredIf?: {
                fieldName: string;
                operator: string;
                value: any;
            };
        };
        isFactorySpecific: boolean;
    }[]>;
    initializeDefaultConfiguration(tenantId: string): Promise<{
        message: string;
        configurationsCreated: number;
        configurations: any[];
    }>;
    createFactorySpecificConfiguration(factoryId: string, dto: CreateFieldConfigDto): Promise<import("../entities").WorkflowConfiguration>;
}
