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
exports.WeighbridgeService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const transaction_entity_1 = require("../entities/transaction.entity");
const evidence_entity_1 = require("../entities/evidence.entity");
const audit_log_entity_1 = require("../entities/audit-log.entity");
let WeighbridgeService = class WeighbridgeService {
    constructor(transactionRepository, evidenceRepository, auditLogRepository) {
        this.transactionRepository = transactionRepository;
        this.evidenceRepository = evidenceRepository;
        this.auditLogRepository = auditLogRepository;
    }
    async captureGrossWeight(transactionId, reading, photoEvidence) {
        const transaction = await this.getTransactionForWeighing(transactionId, transaction_entity_1.OperationalLevel.L3_WEIGHBRIDGE_GROSS);
        this.validateWeightReading(reading);
        transaction.weighbridgeData = {
            ...transaction.weighbridgeData,
            grossWeight: reading.weight,
            grossWeightTimestamp: reading.timestamp,
            grossWeightOperator: reading.operatorId,
            weighbridgeTicketUrl: photoEvidence ? await this.storeWeighbridgeTicket(photoEvidence, transactionId, 'gross') : undefined
        };
        transaction.currentLevel = transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION;
        transaction.levelData = {
            ...transaction.levelData,
            [transaction_entity_1.OperationalLevel.L3_WEIGHBRIDGE_GROSS]: {
                level: transaction_entity_1.OperationalLevel.L3_WEIGHBRIDGE_GROSS,
                fieldValues: {
                    grossWeight: reading.weight,
                    equipmentId: reading.equipmentId,
                    ticketNumber: reading.ticketNumber
                },
                completedBy: reading.operatorId,
                completedAt: reading.timestamp,
                evidenceIds: photoEvidence ? [await this.createEvidenceRecord(photoEvidence, transactionId, transaction_entity_1.OperationalLevel.L3_WEIGHBRIDGE_GROSS)] : [],
                validationStatus: 'APPROVED'
            }
        };
        await this.transactionRepository.save(transaction);
        await this.createAuditLog(transactionId, reading.operatorId, audit_log_entity_1.AuditAction.WEIGHBRIDGE_GROSS_CAPTURED, {
            weight: reading.weight,
            timestamp: reading.timestamp
        });
        return transaction;
    }
    async captureTareWeight(transactionId, reading, photoEvidence) {
        const transaction = await this.getTransactionForWeighing(transactionId, transaction_entity_1.OperationalLevel.L5_WEIGHBRIDGE_TARE);
        this.validateWeightReading(reading);
        if (!transaction.weighbridgeData?.grossWeight) {
            throw new common_1.BadRequestException('Gross weight must be captured before tare weight');
        }
        const result = this.calculateNetWeight(transaction.weighbridgeData.grossWeight, reading.weight, transaction.factory?.weighbridgeConfig?.discrepancyThreshold || 5);
        transaction.weighbridgeData = {
            ...transaction.weighbridgeData,
            tareWeight: reading.weight,
            netWeight: result.netWeight,
            tareWeightTimestamp: reading.timestamp,
            tareWeightOperator: reading.operatorId,
            weighbridgeTicketUrl: photoEvidence ? await this.storeWeighbridgeTicket(photoEvidence, transactionId, 'tare') : transaction.weighbridgeData.weighbridgeTicketUrl
        };
        transaction.currentLevel = transaction_entity_1.OperationalLevel.L6_GRN_GENERATION;
        transaction.levelData = {
            ...transaction.levelData,
            [transaction_entity_1.OperationalLevel.L5_WEIGHBRIDGE_TARE]: {
                level: transaction_entity_1.OperationalLevel.L5_WEIGHBRIDGE_TARE,
                fieldValues: {
                    tareWeight: reading.weight,
                    netWeight: result.netWeight,
                    discrepancyPercentage: result.discrepancyPercentage,
                    requiresSupervisorApproval: result.requiresSupervisorApproval
                },
                completedBy: reading.operatorId,
                completedAt: reading.timestamp,
                evidenceIds: photoEvidence ? [await this.createEvidenceRecord(photoEvidence, transactionId, transaction_entity_1.OperationalLevel.L5_WEIGHBRIDGE_TARE)] : [],
                validationStatus: result.requiresSupervisorApproval ? 'PENDING' : 'APPROVED'
            }
        };
        await this.transactionRepository.save(transaction);
        await this.createAuditLog(transactionId, reading.operatorId, audit_log_entity_1.AuditAction.WEIGHBRIDGE_TARE_CAPTURED, {
            tareWeight: reading.weight,
            netWeight: result.netWeight,
            discrepancyPercentage: result.discrepancyPercentage,
            requiresSupervisorApproval: result.requiresSupervisorApproval
        });
        return result;
    }
    calculateNetWeight(grossWeight, tareWeight, discrepancyThreshold) {
        if (!Number.isFinite(grossWeight) || !Number.isFinite(tareWeight) || !Number.isFinite(discrepancyThreshold)) {
            throw new common_1.BadRequestException('Weight values must be valid finite numbers');
        }
        if (grossWeight <= 0 || tareWeight <= 0) {
            throw new common_1.BadRequestException('Weight values must be positive numbers');
        }
        if (tareWeight >= grossWeight) {
            throw new common_1.BadRequestException('Tare weight cannot be greater than or equal to gross weight');
        }
        const netWeight = grossWeight - tareWeight;
        const weightRatio = tareWeight / grossWeight;
        const discrepancyPercentage = Math.abs(weightRatio - 0.5) * 100;
        const requiresSupervisorApproval = discrepancyPercentage > discrepancyThreshold;
        return {
            grossWeight,
            tareWeight,
            netWeight,
            isValid: netWeight > 0,
            discrepancyPercentage,
            requiresSupervisorApproval
        };
    }
    async readFromEquipment(equipmentConfig) {
        if (!equipmentConfig.isIntegrated) {
            throw new common_1.BadRequestException('Weighbridge equipment is not integrated');
        }
        throw new common_1.BadRequestException('Equipment integration not yet implemented. Please use manual entry with photo proof.');
    }
    async validateManualEntry(weight, photoEvidence, operatorId) {
        if (!photoEvidence) {
            throw new common_1.BadRequestException('Photo evidence is mandatory for manual weight entry');
        }
        if (weight <= 0) {
            throw new common_1.BadRequestException('Weight must be a positive number');
        }
        return true;
    }
    async getTransactionForWeighing(transactionId, expectedLevel) {
        const transaction = await this.transactionRepository.findOne({
            where: { id: transactionId },
            relations: ['factory']
        });
        if (!transaction) {
            throw new common_1.NotFoundException('Transaction not found');
        }
        if (transaction.status !== transaction_entity_1.TransactionStatus.ACTIVE) {
            throw new common_1.BadRequestException('Transaction is not active');
        }
        if (transaction.isLocked) {
            throw new common_1.BadRequestException('Transaction is locked and cannot be modified');
        }
        if (expectedLevel === transaction_entity_1.OperationalLevel.L3_WEIGHBRIDGE_GROSS && transaction.currentLevel !== transaction_entity_1.OperationalLevel.L2_GATE_ENTRY) {
            throw new common_1.BadRequestException('Must complete Gate Entry (L2) before Weighbridge Gross (L3)');
        }
        if (expectedLevel === transaction_entity_1.OperationalLevel.L5_WEIGHBRIDGE_TARE && transaction.currentLevel !== transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION) {
            throw new common_1.BadRequestException('Must complete Material Inspection (L4) before Weighbridge Tare (L5)');
        }
        return transaction;
    }
    validateWeightReading(reading) {
        if (!reading.weight || reading.weight <= 0) {
            throw new common_1.BadRequestException('Weight must be a positive number');
        }
        if (!reading.timestamp) {
            throw new common_1.BadRequestException('Timestamp is required');
        }
        if (!reading.operatorId) {
            throw new common_1.BadRequestException('Operator ID is required');
        }
        if (reading.weight > 100000) {
            throw new common_1.BadRequestException('Weight exceeds maximum allowed limit');
        }
    }
    async storeWeighbridgeTicket(file, transactionId, type) {
        return `weighbridge-tickets/${transactionId}-${type}-${Date.now()}.jpg`;
    }
    async createEvidenceRecord(file, transactionId, level) {
        const evidence = this.evidenceRepository.create({
            transactionId,
            operationalLevel: level,
            evidenceType: evidence_entity_1.EvidenceType.WEIGHBRIDGE_TICKET,
            filePath: await this.storeWeighbridgeTicket(file, transactionId, level === transaction_entity_1.OperationalLevel.L3_WEIGHBRIDGE_GROSS ? 'gross' : 'tare'),
            fileName: file.originalname,
            fileSize: file.size,
            mimeType: file.mimetype,
            capturedBy: 'system',
            metadata: {
                customFields: {
                    level: level,
                    type: level === transaction_entity_1.OperationalLevel.L3_WEIGHBRIDGE_GROSS ? 'gross_weight_ticket' : 'tare_weight_ticket'
                }
            }
        });
        const savedEvidence = await this.evidenceRepository.save(evidence);
        return savedEvidence.id;
    }
    async createAuditLog(transactionId, userId, action, details) {
        const auditLog = this.auditLogRepository.create({
            transactionId,
            userId,
            action,
            entityType: 'Transaction',
            entityId: transactionId,
            description: `Weighbridge operation: ${action}`,
            newValues: details,
            metadata: {
                ipAddress: '127.0.0.1',
                userAgent: 'WeighbridgeService',
                operationalLevel: action === audit_log_entity_1.AuditAction.WEIGHBRIDGE_GROSS_CAPTURED ? 3 : 5
            },
            severity: 'MEDIUM',
            timestamp: new Date()
        });
        await this.auditLogRepository.save(auditLog);
    }
};
exports.WeighbridgeService = WeighbridgeService;
exports.WeighbridgeService = WeighbridgeService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(transaction_entity_1.Transaction)),
    __param(1, (0, typeorm_1.InjectRepository)(evidence_entity_1.Evidence)),
    __param(2, (0, typeorm_1.InjectRepository)(audit_log_entity_1.AuditLog)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], WeighbridgeService);
//# sourceMappingURL=weighbridge.service.js.map