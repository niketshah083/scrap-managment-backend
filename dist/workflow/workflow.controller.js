"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const workflow_engine_service_1 = require("./workflow-engine.service");
const field_configuration_service_1 = require("./field-configuration.service");
let WorkflowController = class WorkflowController {
    constructor(workflowEngine, fieldConfigService) {
        this.workflowEngine = workflowEngine;
        this.fieldConfigService = fieldConfigService;
    }
    async getWorkflowLevels(tenantId) {
        const defaultLevelConfigs = [
            {
                operationalLevel: 1,
                levelName: 'Gate Entry',
                description: 'Upload PO/Invoice and enter truck details',
                fields: [
                    { fieldName: 'po_document', fieldLabel: 'PO Document', fieldType: 'FILE', captureType: 'CAMERA', validationType: 'REQUIRED', editability: 'EDITABLE', helpText: 'Upload PO document photo', minPhotoCount: 1, maxPhotoCount: 3, displayOrder: 1 },
                    { fieldName: 'invoice_document', fieldLabel: 'Invoice Copy', fieldType: 'FILE', captureType: 'CAMERA', validationType: 'REQUIRED', editability: 'EDITABLE', helpText: 'Upload invoice photo', minPhotoCount: 1, maxPhotoCount: 3, displayOrder: 2 },
                    { fieldName: 'truck_number', fieldLabel: 'Truck Number', fieldType: 'TEXT', captureType: 'MANUAL', validationType: 'REQUIRED', editability: 'EDITABLE', placeholder: 'MH12AB1234', helpText: 'Enter vehicle registration', displayOrder: 3 },
                    { fieldName: 'driver_name', fieldLabel: 'Driver Name', fieldType: 'TEXT', captureType: 'MANUAL', validationType: 'REQUIRED', editability: 'EDITABLE', placeholder: 'Enter driver name', displayOrder: 4 },
                    { fieldName: 'driver_mobile', fieldLabel: 'Driver Mobile', fieldType: 'TEXT', captureType: 'MANUAL', validationType: 'REQUIRED', editability: 'EDITABLE', placeholder: '+91 98765 43210', displayOrder: 5 }
                ]
            },
            {
                operationalLevel: 2,
                levelName: 'Initial Weighing',
                description: 'Record loaded truck weight on weighbridge',
                fields: [
                    { fieldName: 'gross_weight', fieldLabel: 'Gross Weight (KG)', fieldType: 'NUMBER', captureType: 'AUTO', validationType: 'REQUIRED', editability: 'EDITABLE', placeholder: 'Enter weight in KG', helpText: 'Loaded truck weight', displayOrder: 1 },
                    { fieldName: 'weighbridge_photo', fieldLabel: 'Weighbridge Display', fieldType: 'FILE', captureType: 'CAMERA', validationType: 'REQUIRED', editability: 'EDITABLE', helpText: 'Photo of weighbridge display', minPhotoCount: 1, maxPhotoCount: 2, displayOrder: 2 }
                ]
            },
            {
                operationalLevel: 3,
                levelName: 'Unloading',
                description: 'Capture driver photos, license & unloading process',
                fields: [
                    { fieldName: 'driver_photo', fieldLabel: 'Driver Photo', fieldType: 'FILE', captureType: 'CAMERA', validationType: 'REQUIRED', editability: 'EDITABLE', helpText: 'Clear photo of driver', minPhotoCount: 1, maxPhotoCount: 1, displayOrder: 1 },
                    { fieldName: 'driver_license', fieldLabel: 'Driver License', fieldType: 'FILE', captureType: 'CAMERA', validationType: 'REQUIRED', editability: 'EDITABLE', helpText: 'Photo of driving license', minPhotoCount: 1, maxPhotoCount: 2, displayOrder: 2 },
                    { fieldName: 'unloading_photos', fieldLabel: 'Unloading Photos', fieldType: 'FILE', captureType: 'CAMERA', validationType: 'REQUIRED', editability: 'EDITABLE', helpText: 'Photos during unloading', minPhotoCount: 3, maxPhotoCount: 10, displayOrder: 3 },
                    { fieldName: 'unloading_notes', fieldLabel: 'Notes', fieldType: 'TEXT', captureType: 'MANUAL', validationType: 'OPTIONAL', editability: 'EDITABLE', placeholder: 'Any observations...', displayOrder: 4 }
                ]
            },
            {
                operationalLevel: 4,
                levelName: 'Final Weighing',
                description: 'Record empty weight and final material count',
                fields: [
                    { fieldName: 'tare_weight', fieldLabel: 'Tare Weight (KG)', fieldType: 'NUMBER', captureType: 'AUTO', validationType: 'REQUIRED', editability: 'EDITABLE', placeholder: 'Empty truck weight', helpText: 'Weight after unloading', displayOrder: 1 },
                    { fieldName: 'empty_weighbridge_photo', fieldLabel: 'Empty Weight Display', fieldType: 'FILE', captureType: 'CAMERA', validationType: 'REQUIRED', editability: 'EDITABLE', minPhotoCount: 1, maxPhotoCount: 2, displayOrder: 2 },
                    { fieldName: 'material_count', fieldLabel: 'Material Count', fieldType: 'NUMBER', captureType: 'MANUAL', validationType: 'OPTIONAL', editability: 'EDITABLE', placeholder: 'Piece count if applicable', displayOrder: 3 }
                ]
            },
            {
                operationalLevel: 5,
                levelName: 'Supervisor Review',
                description: 'Document verification and approval',
                fields: [
                    { fieldName: 'review_notes', fieldLabel: 'Review Notes', fieldType: 'TEXT', captureType: 'MANUAL', validationType: 'REQUIRED', editability: 'EDITABLE', placeholder: 'Supervisor comments', displayOrder: 1 },
                    { fieldName: 'verification_status', fieldLabel: 'Verification Status', fieldType: 'SELECT', captureType: 'MANUAL', validationType: 'REQUIRED', editability: 'EDITABLE', validationRules: { allowedValues: ['VERIFIED', 'NEEDS_CORRECTION', 'REJECTED'] }, displayOrder: 2 },
                    { fieldName: 'approval_status', fieldLabel: 'Approval', fieldType: 'SELECT', captureType: 'MANUAL', validationType: 'REQUIRED', editability: 'EDITABLE', validationRules: { allowedValues: ['APPROVED', 'REJECTED', 'HOLD'] }, displayOrder: 3 }
                ]
            },
            {
                operationalLevel: 6,
                levelName: 'Gate Pass',
                description: 'Generate exit gate pass with QR code',
                fields: [
                    { fieldName: 'gate_pass_number', fieldLabel: 'Gate Pass Number', fieldType: 'TEXT', captureType: 'AUTO', validationType: 'REQUIRED', editability: 'EDITABLE', displayOrder: 1 },
                    { fieldName: 'exit_time', fieldLabel: 'Exit Time', fieldType: 'DATE', captureType: 'AUTO', validationType: 'REQUIRED', editability: 'EDITABLE', displayOrder: 2 }
                ]
            },
            {
                operationalLevel: 7,
                levelName: 'Inspection Report',
                description: 'Vendor quality inspection report',
                fields: [
                    { fieldName: 'inspection_report', fieldLabel: 'Inspection Report', fieldType: 'FILE', captureType: 'MANUAL', validationType: 'REQUIRED', editability: 'EDITABLE', minPhotoCount: 1, maxPhotoCount: 5, displayOrder: 1 },
                    { fieldName: 'quality_grade', fieldLabel: 'Quality Grade', fieldType: 'SELECT', captureType: 'MANUAL', validationType: 'REQUIRED', editability: 'EDITABLE', validationRules: { allowedValues: ['A', 'B', 'C', 'REJECT'] }, displayOrder: 2 }
                ]
            }
        ];
        if (tenantId) {
            try {
                const dbConfigs = await this.fieldConfigService.getFieldConfigurations(tenantId);
                if (dbConfigs && dbConfigs.length > 0) {
                    const configsByLevel = new Map();
                    dbConfigs.forEach(config => {
                        const level = config.operationalLevel;
                        if (!configsByLevel.has(level)) {
                            configsByLevel.set(level, []);
                        }
                        configsByLevel.get(level).push({
                            fieldName: config.fieldName,
                            fieldLabel: config.fieldLabel,
                            fieldType: config.fieldType,
                            captureType: config.captureType,
                            validationType: config.validationType,
                            editability: config.editability,
                            minPhotoCount: config.minPhotoCount,
                            maxPhotoCount: config.maxPhotoCount,
                            validationRules: config.validationRules,
                            helpText: config.helpText,
                            placeholder: config.placeholder,
                            displayOrder: config.displayOrder
                        });
                    });
                    return defaultLevelConfigs.map(level => {
                        const dbFields = configsByLevel.get(level.operationalLevel);
                        return {
                            ...level,
                            fields: dbFields && dbFields.length > 0 ? dbFields : level.fields
                        };
                    });
                }
            }
            catch (error) {
                console.error('Error fetching tenant configurations:', error);
            }
        }
        return defaultLevelConfigs;
    }
    async getFieldConfigurations(tenantId, level) {
        const operationalLevel = level;
        return await this.fieldConfigService.getFieldConfigurations(tenantId, operationalLevel);
    }
    async createFieldConfiguration(dto) {
        return await this.fieldConfigService.createFieldConfiguration(dto);
    }
    async updateFieldConfiguration(configId, dto) {
        return await this.fieldConfigService.updateFieldConfiguration({
            id: configId,
            ...dto
        });
    }
    async moveFieldToLevel(configId, newLevel) {
        if (newLevel < 1 || newLevel > 7) {
            throw new common_1.BadRequestException('Operational level must be between 1 and 7');
        }
        return await this.fieldConfigService.moveFieldToLevel(configId, newLevel);
    }
    async validateLevelProgression(transactionId, targetLevel) {
        if (targetLevel < 1 || targetLevel > 7) {
            throw new common_1.BadRequestException('Target level must be between 1 and 7');
        }
        return await this.workflowEngine.validateLevelProgression(transactionId, targetLevel);
    }
    async completeLevelData(transactionId, levelData) {
        return await this.workflowEngine.processLevelCompletion(transactionId, levelData);
    }
    async getConfiguredFields(tenantId, level) {
        if (level < 1 || level > 7) {
            throw new common_1.BadRequestException('Level must be between 1 and 7');
        }
        return await this.workflowEngine.getConfiguredFields(tenantId, level);
    }
    async getConfiguredFieldsWithInheritance(tenantId, level, factoryId) {
        if (level < 1 || level > 7) {
            throw new common_1.BadRequestException('Level must be between 1 and 7');
        }
        const configs = await this.fieldConfigService.getFieldConfigurationsWithInheritance(tenantId, factoryId, level);
        return configs.map(config => ({
            fieldName: config.fieldName,
            fieldLabel: config.fieldLabel,
            fieldType: config.fieldType,
            captureType: config.captureType,
            validationType: config.validationType,
            editability: config.editability,
            minPhotoCount: config.minPhotoCount,
            maxPhotoCount: config.maxPhotoCount,
            validationRules: config.validationRules,
            rolePermissions: config.rolePermissions,
            displayOrder: config.displayOrder,
            helpText: config.helpText,
            placeholder: config.placeholder,
            conditionalLogic: config.conditionalLogic,
            isFactorySpecific: !!config.factoryId
        }));
    }
    async initializeDefaultConfiguration(tenantId) {
        const defaultConfigs = await this.fieldConfigService.getDefaultFieldConfigurations(tenantId);
        const results = [];
        for (const config of defaultConfigs) {
            try {
                const created = await this.fieldConfigService.createFieldConfiguration(config);
                results.push(created);
            }
            catch (error) {
                if (!error.message.includes('already exists')) {
                    throw error;
                }
            }
        }
        return {
            message: 'Default configuration initialized',
            configurationsCreated: results.length,
            configurations: results
        };
    }
    async createFactorySpecificConfiguration(factoryId, dto) {
        return await this.fieldConfigService.createFieldConfiguration({
            ...dto,
            factoryId
        });
    }
};
exports.WorkflowController = WorkflowController;
__decorate([
    (0, common_1.Get)('levels'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all workflow levels with their configurations and fields' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Returns all workflow levels with field configurations' }),
    __param(0, (0, common_1.Query)('tenantId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WorkflowController.prototype, "getWorkflowLevels", null);
__decorate([
    (0, common_1.Get)('fields/:tenantId'),
    (0, swagger_1.ApiOperation)({ summary: 'Get field configurations for a tenant' }),
    (0, swagger_1.ApiParam)({ name: 'tenantId', description: 'Tenant UUID' }),
    (0, swagger_1.ApiQuery)({ name: 'level', description: 'Operational Level (1-7)', required: false }),
    __param(0, (0, common_1.Param)('tenantId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)('level', new common_1.ParseIntPipe({ optional: true }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number]),
    __metadata("design:returntype", Promise)
], WorkflowController.prototype, "getFieldConfigurations", null);
__decorate([
    (0, common_1.Post)('fields'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new field configuration' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Field configuration created successfully' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WorkflowController.prototype, "createFieldConfiguration", null);
__decorate([
    (0, common_1.Put)('fields/:configId'),
    (0, swagger_1.ApiOperation)({ summary: 'Update field configuration' }),
    (0, swagger_1.ApiParam)({ name: 'configId', description: 'Configuration UUID' }),
    __param(0, (0, common_1.Param)('configId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], WorkflowController.prototype, "updateFieldConfiguration", null);
__decorate([
    (0, common_1.Put)('fields/:configId/move/:newLevel'),
    (0, swagger_1.ApiOperation)({ summary: 'Move field to different operational level' }),
    (0, swagger_1.ApiParam)({ name: 'configId', description: 'Configuration UUID' }),
    (0, swagger_1.ApiParam)({ name: 'newLevel', description: 'New operational level (1-7)' }),
    __param(0, (0, common_1.Param)('configId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Param)('newLevel', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number]),
    __metadata("design:returntype", Promise)
], WorkflowController.prototype, "moveFieldToLevel", null);
__decorate([
    (0, common_1.Post)('transaction/:transactionId/validate-progression/:targetLevel'),
    (0, swagger_1.ApiOperation)({ summary: 'Validate if transaction can progress to target level' }),
    (0, swagger_1.ApiParam)({ name: 'transactionId', description: 'Transaction UUID' }),
    (0, swagger_1.ApiParam)({ name: 'targetLevel', description: 'Target operational level (1-7)' }),
    __param(0, (0, common_1.Param)('transactionId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Param)('targetLevel', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number]),
    __metadata("design:returntype", Promise)
], WorkflowController.prototype, "validateLevelProgression", null);
__decorate([
    (0, common_1.Post)('transaction/:transactionId/complete-level'),
    (0, swagger_1.ApiOperation)({ summary: 'Complete an operational level for a transaction' }),
    (0, swagger_1.ApiParam)({ name: 'transactionId', description: 'Transaction UUID' }),
    __param(0, (0, common_1.Param)('transactionId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], WorkflowController.prototype, "completeLevelData", null);
__decorate([
    (0, common_1.Get)('configured-fields/:tenantId/:level'),
    (0, swagger_1.ApiOperation)({ summary: 'Get configured fields for specific tenant and level' }),
    (0, swagger_1.ApiParam)({ name: 'tenantId', description: 'Tenant UUID' }),
    (0, swagger_1.ApiParam)({ name: 'level', description: 'Operational level (1-7)' }),
    __param(0, (0, common_1.Param)('tenantId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Param)('level', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number]),
    __metadata("design:returntype", Promise)
], WorkflowController.prototype, "getConfiguredFields", null);
__decorate([
    (0, common_1.Get)('configured-fields/:tenantId/:level/factory/:factoryId'),
    (0, swagger_1.ApiOperation)({ summary: 'Get configured fields with factory inheritance' }),
    (0, swagger_1.ApiParam)({ name: 'tenantId', description: 'Tenant UUID' }),
    (0, swagger_1.ApiParam)({ name: 'level', description: 'Operational level (1-7)' }),
    (0, swagger_1.ApiParam)({ name: 'factoryId', description: 'Factory UUID' }),
    __param(0, (0, common_1.Param)('tenantId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Param)('level', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Param)('factoryId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, String]),
    __metadata("design:returntype", Promise)
], WorkflowController.prototype, "getConfiguredFieldsWithInheritance", null);
__decorate([
    (0, common_1.Post)('tenant/:tenantId/initialize-default-config'),
    (0, swagger_1.ApiOperation)({ summary: 'Initialize default field configurations for a new tenant' }),
    (0, swagger_1.ApiParam)({ name: 'tenantId', description: 'Tenant UUID' }),
    __param(0, (0, common_1.Param)('tenantId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WorkflowController.prototype, "initializeDefaultConfiguration", null);
__decorate([
    (0, common_1.Post)('factory/:factoryId/create-specific-config'),
    (0, swagger_1.ApiOperation)({ summary: 'Create factory-specific field configuration' }),
    (0, swagger_1.ApiParam)({ name: 'factoryId', description: 'Factory UUID' }),
    __param(0, (0, common_1.Param)('factoryId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], WorkflowController.prototype, "createFactorySpecificConfiguration", null);
exports.WorkflowController = WorkflowController = __decorate([
    (0, swagger_1.ApiTags)('Workflow Management'),
    (0, common_1.Controller)('workflow'),
    __metadata("design:paramtypes", [workflow_engine_service_1.WorkflowEngineService,
        field_configuration_service_1.FieldConfigurationService])
], WorkflowController);
//# sourceMappingURL=workflow.controller.js.map