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
exports.FieldConfigurationService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const workflow_configuration_entity_1 = require("../entities/workflow-configuration.entity");
const transaction_entity_1 = require("../entities/transaction.entity");
let FieldConfigurationService = class FieldConfigurationService {
    constructor(configRepo) {
        this.configRepo = configRepo;
    }
    async createFieldConfiguration(dto) {
        if (!await this.validateEvidenceFieldConfiguration(dto.fieldName)) {
            throw new common_1.BadRequestException(`Evidence field '${dto.fieldName}' cannot be disabled for audit integrity`);
        }
        const whereCondition = {
            tenantId: dto.tenantId,
            operationalLevel: dto.operationalLevel,
            fieldName: dto.fieldName,
            isActive: true
        };
        if (dto.factoryId) {
            whereCondition.factoryId = dto.factoryId;
        }
        else {
            whereCondition.factoryId = null;
        }
        const existing = await this.configRepo.findOne({
            where: whereCondition
        });
        if (existing) {
            const scope = dto.factoryId ? `factory ${dto.factoryId}` : 'tenant';
            throw new common_1.BadRequestException(`Field configuration already exists for '${dto.fieldName}' at level L${dto.operationalLevel} for ${scope}`);
        }
        const config = this.configRepo.create({
            ...dto,
            effectiveFrom: new Date(),
            version: 1,
            isActive: true
        });
        return await this.configRepo.save(config);
    }
    async updateFieldConfiguration(dto) {
        const existing = await this.configRepo.findOne({
            where: { id: dto.id }
        });
        if (!existing) {
            throw new common_1.BadRequestException('Field configuration not found');
        }
        if (dto.fieldName && !await this.validateEvidenceFieldConfiguration(dto.fieldName)) {
            throw new common_1.BadRequestException(`Evidence field '${dto.fieldName}' cannot be disabled for audit integrity`);
        }
        await this.configRepo.update(existing.id, {
            isActive: false,
            effectiveTo: new Date()
        });
        const newConfig = this.configRepo.create({
            ...existing,
            ...dto,
            id: undefined,
            version: existing.version + 1,
            effectiveFrom: new Date(),
            effectiveTo: null,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        return await this.configRepo.save(newConfig);
    }
    async getFieldConfigurations(tenantId, operationalLevel) {
        const where = {
            tenantId,
            isActive: true
        };
        if (operationalLevel !== undefined) {
            where.operationalLevel = operationalLevel;
        }
        return await this.configRepo.find({
            where,
            order: {
                operationalLevel: 'ASC',
                displayOrder: 'ASC'
            }
        });
    }
    async getFieldConfigurationsWithInheritance(tenantId, factoryId, operationalLevel) {
        const tenantConfigs = await this.getFieldConfigurations(tenantId, operationalLevel);
        if (!factoryId) {
            return tenantConfigs;
        }
        const factoryWhere = {
            tenantId,
            factoryId,
            isActive: true
        };
        if (operationalLevel !== undefined) {
            factoryWhere.operationalLevel = operationalLevel;
        }
        const factoryConfigs = await this.configRepo.find({
            where: factoryWhere,
            order: {
                operationalLevel: 'ASC',
                displayOrder: 'ASC'
            }
        });
        const configMap = new Map();
        tenantConfigs.forEach(config => {
            const key = `${config.operationalLevel}-${config.fieldName}`;
            configMap.set(key, config);
        });
        factoryConfigs.forEach(config => {
            const key = `${config.operationalLevel}-${config.fieldName}`;
            configMap.set(key, config);
        });
        return Array.from(configMap.values()).sort((a, b) => {
            if (a.operationalLevel !== b.operationalLevel) {
                return a.operationalLevel - b.operationalLevel;
            }
            return a.displayOrder - b.displayOrder;
        });
    }
    async moveFieldToLevel(configId, newLevel) {
        const config = await this.configRepo.findOne({
            where: { id: configId }
        });
        if (!config) {
            throw new common_1.BadRequestException('Field configuration not found');
        }
        await this.validateFieldMove(config, newLevel);
        return await this.updateFieldConfiguration({
            id: configId,
            operationalLevel: newLevel
        });
    }
    async validateFieldMove(config, newLevel) {
        const levelRestrictedFields = {
            [transaction_entity_1.OperationalLevel.L1_VENDOR_DISPATCH]: ['vendor_details', 'po_number', 'invoice_number'],
            [transaction_entity_1.OperationalLevel.L2_GATE_ENTRY]: ['vehicle_number', 'driver_details', 'entry_time'],
            [transaction_entity_1.OperationalLevel.L3_WEIGHBRIDGE_GROSS]: ['gross_weight'],
            [transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION]: ['inspection_grade', 'contamination_level'],
            [transaction_entity_1.OperationalLevel.L5_WEIGHBRIDGE_TARE]: ['tare_weight', 'net_weight'],
            [transaction_entity_1.OperationalLevel.L6_GRN_GENERATION]: ['grn_number'],
            [transaction_entity_1.OperationalLevel.L7_GATE_PASS_EXIT]: ['gate_pass_qr', 'exit_time']
        };
        const restrictedFields = levelRestrictedFields[config.operationalLevel] || [];
        if (restrictedFields.includes(config.fieldName)) {
            throw new common_1.BadRequestException(`Field '${config.fieldName}' cannot be moved from level L${config.operationalLevel} ` +
                `as it is critical for that operational stage`);
        }
        const existingAtTarget = await this.configRepo.findOne({
            where: {
                tenantId: config.tenantId,
                operationalLevel: newLevel,
                fieldName: config.fieldName,
                isActive: true
            }
        });
        if (existingAtTarget) {
            throw new common_1.BadRequestException(`Field '${config.fieldName}' already exists at level L${newLevel}`);
        }
    }
    async validateEvidenceFieldConfiguration(fieldName) {
        const protectedEvidenceFields = [
            'photos',
            'documents',
            'timestamp',
            'gps_coordinates',
            'operator_signature',
            'inspector_signature',
            'evidence_photos',
            'inspection_photos',
            'weight_slip_photo',
            'vehicle_photo'
        ];
        return !protectedEvidenceFields.includes(fieldName.toLowerCase());
    }
    async getDefaultFieldConfigurations(tenantId) {
        return [
            {
                tenantId,
                operationalLevel: transaction_entity_1.OperationalLevel.L1_VENDOR_DISPATCH,
                fieldName: 'vendor_details',
                fieldLabel: 'Vendor Details',
                fieldType: 'TEXT',
                captureType: workflow_configuration_entity_1.FieldCaptureType.OCR,
                validationType: workflow_configuration_entity_1.FieldValidationType.REQUIRED,
                editability: workflow_configuration_entity_1.FieldEditability.EDITABLE,
                displayOrder: 1
            },
            {
                tenantId,
                operationalLevel: transaction_entity_1.OperationalLevel.L1_VENDOR_DISPATCH,
                fieldName: 'po_number',
                fieldLabel: 'PO Number',
                fieldType: 'TEXT',
                captureType: workflow_configuration_entity_1.FieldCaptureType.OCR,
                validationType: workflow_configuration_entity_1.FieldValidationType.REQUIRED,
                editability: workflow_configuration_entity_1.FieldEditability.EDITABLE,
                displayOrder: 2
            },
            {
                tenantId,
                operationalLevel: transaction_entity_1.OperationalLevel.L2_GATE_ENTRY,
                fieldName: 'vehicle_number',
                fieldLabel: 'Vehicle Number',
                fieldType: 'TEXT',
                captureType: workflow_configuration_entity_1.FieldCaptureType.CAMERA,
                validationType: workflow_configuration_entity_1.FieldValidationType.REQUIRED,
                editability: workflow_configuration_entity_1.FieldEditability.EDITABLE,
                displayOrder: 1
            },
            {
                tenantId,
                operationalLevel: transaction_entity_1.OperationalLevel.L2_GATE_ENTRY,
                fieldName: 'driver_mobile',
                fieldLabel: 'Driver Mobile',
                fieldType: 'TEXT',
                captureType: workflow_configuration_entity_1.FieldCaptureType.MANUAL,
                validationType: workflow_configuration_entity_1.FieldValidationType.REQUIRED,
                editability: workflow_configuration_entity_1.FieldEditability.EDITABLE,
                displayOrder: 2
            },
            {
                tenantId,
                operationalLevel: transaction_entity_1.OperationalLevel.L3_WEIGHBRIDGE_GROSS,
                fieldName: 'gross_weight',
                fieldLabel: 'Gross Weight (KG)',
                fieldType: 'NUMBER',
                captureType: workflow_configuration_entity_1.FieldCaptureType.AUTO,
                validationType: workflow_configuration_entity_1.FieldValidationType.REQUIRED,
                editability: workflow_configuration_entity_1.FieldEditability.READ_ONLY,
                displayOrder: 1
            },
            {
                tenantId,
                operationalLevel: transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION,
                fieldName: 'inspection_grade',
                fieldLabel: 'Material Grade',
                fieldType: 'SELECT',
                captureType: workflow_configuration_entity_1.FieldCaptureType.MANUAL,
                validationType: workflow_configuration_entity_1.FieldValidationType.REQUIRED,
                editability: workflow_configuration_entity_1.FieldEditability.EDITABLE,
                displayOrder: 1,
                validationRules: {
                    allowedValues: ['A', 'B', 'C', 'REJECTED']
                }
            },
            {
                tenantId,
                operationalLevel: transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION,
                fieldName: 'inspection_photos',
                fieldLabel: 'Inspection Photos',
                fieldType: 'FILE',
                captureType: workflow_configuration_entity_1.FieldCaptureType.CAMERA,
                validationType: workflow_configuration_entity_1.FieldValidationType.REQUIRED,
                editability: workflow_configuration_entity_1.FieldEditability.EDITABLE,
                minPhotoCount: 2,
                maxPhotoCount: 10,
                displayOrder: 2
            }
        ];
    }
};
exports.FieldConfigurationService = FieldConfigurationService;
exports.FieldConfigurationService = FieldConfigurationService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(workflow_configuration_entity_1.WorkflowConfiguration)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], FieldConfigurationService);
//# sourceMappingURL=field-configuration.service.js.map