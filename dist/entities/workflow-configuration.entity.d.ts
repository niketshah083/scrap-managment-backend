import { Tenant } from './tenant.entity';
import { Factory } from './factory.entity';
export declare enum FieldCaptureType {
    MANUAL = "MANUAL",
    OCR = "OCR",
    CAMERA = "CAMERA",
    AUTO = "AUTO"
}
export declare enum FieldValidationType {
    REQUIRED = "REQUIRED",
    OPTIONAL = "OPTIONAL"
}
export declare enum FieldEditability {
    EDITABLE = "EDITABLE",
    READ_ONLY = "READ_ONLY"
}
export declare class WorkflowConfiguration {
    id: string;
    tenantId: string;
    factoryId: string;
    operationalLevel: number;
    fieldName: string;
    fieldLabel: string;
    fieldType: string;
    captureType: FieldCaptureType;
    validationType: FieldValidationType;
    editability: FieldEditability;
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
    isActive: boolean;
    version: number;
    effectiveFrom: Date;
    effectiveTo: Date;
    createdAt: Date;
    updatedAt: Date;
    tenant: Tenant;
    factory: Factory;
}
