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
exports.WorkflowEngineService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const workflow_configuration_entity_1 = require("../entities/workflow-configuration.entity");
const transaction_entity_1 = require("../entities/transaction.entity");
let WorkflowEngineService = class WorkflowEngineService {
    constructor(workflowConfigRepo, transactionRepo) {
        this.workflowConfigRepo = workflowConfigRepo;
        this.transactionRepo = transactionRepo;
    }
    async validateLevelProgression(transactionId, targetLevel) {
        const transaction = await this.transactionRepo.findOne({
            where: { id: transactionId }
        });
        if (!transaction) {
            return {
                isValid: false,
                errors: ['Transaction not found'],
                warnings: []
            };
        }
        if (transaction.isLocked) {
            return {
                isValid: false,
                errors: ['Transaction is locked and cannot be modified'],
                warnings: []
            };
        }
        if (transaction.status === transaction_entity_1.TransactionStatus.COMPLETED ||
            transaction.status === transaction_entity_1.TransactionStatus.CANCELLED ||
            transaction.status === transaction_entity_1.TransactionStatus.REJECTED) {
            return {
                isValid: false,
                errors: ['Transaction is already completed, cancelled, or rejected'],
                warnings: []
            };
        }
        const currentLevel = transaction.currentLevel;
        const expectedNextLevel = currentLevel + 1;
        if (targetLevel !== expectedNextLevel) {
            return {
                isValid: false,
                errors: [
                    `Invalid level progression. Current level: L${currentLevel}, ` +
                        `Expected next level: L${expectedNextLevel}, ` +
                        `Requested level: L${targetLevel}`
                ],
                warnings: []
            };
        }
        if (targetLevel < transaction_entity_1.OperationalLevel.L1_VENDOR_DISPATCH ||
            targetLevel > transaction_entity_1.OperationalLevel.L7_GATE_PASS_EXIT) {
            return {
                isValid: false,
                errors: [`Invalid operational level: L${targetLevel}. Must be between L1 and L7`],
                warnings: []
            };
        }
        const safetyValidation = await this.validateSafetyGuardrails(transaction, targetLevel);
        if (!safetyValidation.isValid) {
            return safetyValidation;
        }
        return {
            isValid: true,
            errors: [],
            warnings: []
        };
    }
    async validateSafetyGuardrails(transaction, targetLevel) {
        const errors = [];
        if (targetLevel === transaction_entity_1.OperationalLevel.L6_GRN_GENERATION) {
            const l4Data = transaction.levelData?.[transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION];
            if (!l4Data || l4Data.validationStatus !== 'APPROVED') {
                errors.push('GRN cannot be generated without approved material inspection');
            }
        }
        if (targetLevel === transaction_entity_1.OperationalLevel.L7_GATE_PASS_EXIT) {
            const l6Data = transaction.levelData?.[transaction_entity_1.OperationalLevel.L6_GRN_GENERATION];
            if (!l6Data || l6Data.validationStatus !== 'APPROVED') {
                errors.push('Gate pass cannot be generated without approved GRN');
            }
        }
        return {
            isValid: errors.length === 0,
            errors,
            warnings: []
        };
    }
    async getConfiguredFields(tenantId, level) {
        const configs = await this.workflowConfigRepo.find({
            where: {
                tenantId,
                operationalLevel: level,
                isActive: true,
                effectiveFrom: { $lte: new Date() },
                effectiveTo: { $gte: new Date() }
            },
            order: {
                displayOrder: 'ASC'
            }
        });
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
            conditionalLogic: config.conditionalLogic
        }));
    }
    async processLevelCompletion(transactionId, levelData) {
        const transaction = await this.transactionRepo.findOne({
            where: { id: transactionId }
        });
        if (!transaction) {
            return {
                success: false,
                transactionId,
                errors: ['Transaction not found'],
                warnings: []
            };
        }
        const validation = await this.validateLevelProgression(transactionId, levelData.level);
        if (!validation.isValid) {
            return {
                success: false,
                transactionId,
                errors: validation.errors,
                warnings: validation.warnings
            };
        }
        const fieldValidation = await this.validateFieldData(transaction.tenantId, levelData.level, levelData.fieldValues);
        if (!fieldValidation.isValid) {
            return {
                success: false,
                transactionId,
                errors: fieldValidation.errors,
                warnings: fieldValidation.warnings
            };
        }
        const updatedLevelData = {
            ...transaction.levelData,
            [levelData.level]: levelData
        };
        const newLevel = levelData.level === transaction_entity_1.OperationalLevel.L7_GATE_PASS_EXIT
            ? levelData.level
            : (levelData.level + 1);
        const updateData = {
            levelData: updatedLevelData,
            currentLevel: newLevel,
            updatedAt: new Date()
        };
        if (levelData.level === transaction_entity_1.OperationalLevel.L7_GATE_PASS_EXIT) {
            updateData.status = transaction_entity_1.TransactionStatus.COMPLETED;
            updateData.completedAt = new Date();
            updateData.isLocked = true;
        }
        await this.transactionRepo.update(transactionId, updateData);
        return {
            success: true,
            transactionId,
            newLevel: newLevel,
            errors: [],
            warnings: []
        };
    }
    async validateFieldData(tenantId, level, fieldValues) {
        const configs = await this.getConfiguredFields(tenantId, level);
        const errors = [];
        const warnings = [];
        for (const config of configs) {
            const value = fieldValues[config.fieldName];
            if (config.validationType === workflow_configuration_entity_1.FieldValidationType.REQUIRED) {
                if (value === undefined || value === null || value === '') {
                    errors.push(`Field '${config.fieldLabel}' is required`);
                    continue;
                }
            }
            if (value !== undefined && value !== null && config.validationRules) {
                const fieldValidation = this.validateFieldRules(config, value);
                errors.push(...fieldValidation.errors);
                warnings.push(...fieldValidation.warnings);
            }
        }
        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }
    validateFieldRules(config, value) {
        const errors = [];
        const warnings = [];
        const rules = config.validationRules;
        if (!rules) {
            return { isValid: true, errors, warnings };
        }
        if (typeof value === 'string') {
            if (rules.minLength && value.length < rules.minLength) {
                errors.push(`${config.fieldLabel} must be at least ${rules.minLength} characters`);
            }
            if (rules.maxLength && value.length > rules.maxLength) {
                errors.push(`${config.fieldLabel} must not exceed ${rules.maxLength} characters`);
            }
            if (rules.pattern && !new RegExp(rules.pattern).test(value)) {
                errors.push(`${config.fieldLabel} format is invalid`);
            }
        }
        if (typeof value === 'number') {
            if (rules.minValue !== undefined && value < rules.minValue) {
                errors.push(`${config.fieldLabel} must be at least ${rules.minValue}`);
            }
            if (rules.maxValue !== undefined && value > rules.maxValue) {
                errors.push(`${config.fieldLabel} must not exceed ${rules.maxValue}`);
            }
        }
        if (rules.allowedValues && Array.isArray(rules.allowedValues)) {
            if (!rules.allowedValues.includes(value)) {
                errors.push(`${config.fieldLabel} must be one of: ${rules.allowedValues.join(', ')}`);
            }
        }
        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }
    async validateEvidenceFieldConfiguration(tenantId, level, fieldName) {
        const protectedEvidenceFields = [
            'photos',
            'documents',
            'timestamp',
            'gps_coordinates',
            'operator_signature',
            'inspector_signature'
        ];
        return !protectedEvidenceFields.includes(fieldName.toLowerCase());
    }
};
exports.WorkflowEngineService = WorkflowEngineService;
exports.WorkflowEngineService = WorkflowEngineService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(workflow_configuration_entity_1.WorkflowConfiguration)),
    __param(1, (0, typeorm_1.InjectRepository)(transaction_entity_1.Transaction)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], WorkflowEngineService);
//# sourceMappingURL=workflow-engine.service.js.map