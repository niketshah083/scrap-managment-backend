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
exports.GatePassService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const transaction_entity_1 = require("../entities/transaction.entity");
const vehicle_entity_1 = require("../entities/vehicle.entity");
const audit_log_entity_1 = require("../entities/audit-log.entity");
const QRCode = require("qrcode");
const uuid_1 = require("uuid");
let GatePassService = class GatePassService {
    constructor(transactionRepository, vehicleRepository, auditLogRepository) {
        this.transactionRepository = transactionRepository;
        this.vehicleRepository = vehicleRepository;
        this.auditLogRepository = auditLogRepository;
    }
    async generateGatePass(transactionId, userId, validityHours = 24) {
        const transaction = await this.transactionRepository.findOne({
            where: { id: transactionId },
            relations: ['vehicle']
        });
        if (!transaction) {
            throw new common_1.NotFoundException('Transaction not found');
        }
        if (transaction.currentLevel < transaction_entity_1.OperationalLevel.L6_GRN_GENERATION) {
            throw new common_1.BadRequestException('Gate pass cannot be generated without completed GRN');
        }
        const l6Data = transaction.levelData?.[transaction_entity_1.OperationalLevel.L6_GRN_GENERATION];
        if (!l6Data || l6Data.validationStatus !== 'APPROVED') {
            throw new common_1.BadRequestException('Gate pass cannot be generated without approved GRN');
        }
        if (transaction.gatePassQrCode && transaction.gatePassExpiresAt) {
            if (new Date() < transaction.gatePassExpiresAt) {
                throw new common_1.BadRequestException('Valid gate pass already exists for this transaction');
            }
        }
        const qrData = {
            transactionId: transaction.id,
            vehicleNumber: transaction.vehicle.vehicleNumber,
            generatedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + validityHours * 60 * 60 * 1000).toISOString(),
            nonce: (0, uuid_1.v4)()
        };
        const qrCodeString = await QRCode.toDataURL(JSON.stringify(qrData));
        const expiresAt = new Date(Date.now() + validityHours * 60 * 60 * 1000);
        await this.transactionRepository.update(transaction.id, {
            gatePassQrCode: qrCodeString,
            gatePassExpiresAt: expiresAt,
            currentLevel: transaction_entity_1.OperationalLevel.L7_GATE_PASS_EXIT
        });
        await this.auditLogRepository.save({
            userId,
            transactionId: transaction.id,
            action: audit_log_entity_1.AuditAction.GATE_PASS_GENERATED,
            entityType: 'Transaction',
            entityId: transaction.id,
            description: 'Gate pass generated for vehicle exit',
            newValues: {
                expiresAt: expiresAt.toISOString(),
                validityHours
            },
            metadata: {
                operationalLevel: transaction_entity_1.OperationalLevel.L7_GATE_PASS_EXIT
            },
            timestamp: new Date()
        });
        return {
            transactionId: transaction.id,
            vehicleNumber: transaction.vehicle.vehicleNumber,
            qrCode: qrCodeString,
            expiresAt,
            generatedBy: userId,
            generatedAt: new Date()
        };
    }
    async validateGatePass(qrCodeData) {
        try {
            const qrData = JSON.parse(qrCodeData);
            if (!qrData.transactionId || !qrData.vehicleNumber || !qrData.expiresAt) {
                return {
                    isValid: false,
                    errors: ['Invalid QR code format']
                };
            }
            const { transactionId, vehicleNumber, expiresAt } = qrData;
            const transaction = await this.transactionRepository.findOne({
                where: { id: transactionId },
                relations: ['vehicle']
            });
            if (!transaction) {
                return {
                    isValid: false,
                    errors: ['Transaction not found']
                };
            }
            if (transaction.vehicle.vehicleNumber !== vehicleNumber) {
                return {
                    isValid: false,
                    errors: ['Vehicle number mismatch']
                };
            }
            if (transaction.status === transaction_entity_1.TransactionStatus.COMPLETED) {
                return {
                    isValid: false,
                    errors: ['Gate pass already used - vehicle has exited']
                };
            }
            const now = new Date();
            const expirationDate = new Date(expiresAt);
            if (now > expirationDate) {
                return {
                    isValid: false,
                    transaction,
                    errors: ['Gate pass has expired'],
                    requiresSupervisorOverride: true
                };
            }
            if (transaction.gatePassQrCode !== qrCodeData) {
                return {
                    isValid: false,
                    errors: ['Invalid QR code']
                };
            }
            return {
                isValid: true,
                transaction,
                errors: []
            };
        }
        catch (error) {
            return {
                isValid: false,
                errors: ['Invalid QR code format']
            };
        }
    }
    async processVehicleExit(transactionId, userId, supervisorOverride = false) {
        const transaction = await this.transactionRepository.findOne({
            where: { id: transactionId },
            relations: ['vehicle']
        });
        if (!transaction) {
            throw new common_1.NotFoundException('Transaction not found');
        }
        if (!supervisorOverride) {
            const validation = await this.validateGatePass(transaction.gatePassQrCode);
            if (!validation.isValid) {
                throw new common_1.BadRequestException(`Gate pass validation failed: ${validation.errors.join(', ')}`);
            }
        }
        await this.transactionRepository.update(transaction.id, {
            status: transaction_entity_1.TransactionStatus.COMPLETED,
            isLocked: true,
            completedAt: new Date()
        });
        const vehicle = transaction.vehicle;
        const visitHistory = vehicle.visitHistory || [];
        visitHistory.push({
            transactionId: transaction.id,
            visitDate: new Date(),
            factoryId: transaction.factoryId,
            status: 'COMPLETED'
        });
        await this.vehicleRepository.update(vehicle.id, {
            visitHistory
        });
        await this.auditLogRepository.save({
            userId,
            transactionId: transaction.id,
            action: supervisorOverride ? audit_log_entity_1.AuditAction.VEHICLE_EXIT_SUPERVISOR_OVERRIDE : audit_log_entity_1.AuditAction.VEHICLE_EXIT_COMPLETED,
            entityType: 'Transaction',
            entityId: transaction.id,
            description: supervisorOverride ? 'Vehicle exit with supervisor override' : 'Vehicle exit completed',
            newValues: {
                vehicleNumber: vehicle.vehicleNumber,
                supervisorOverride,
                status: transaction_entity_1.TransactionStatus.COMPLETED
            },
            metadata: {
                operationalLevel: transaction_entity_1.OperationalLevel.L7_GATE_PASS_EXIT
            },
            timestamp: new Date()
        });
    }
    async supervisorOverrideExpiredGatePass(transactionId, supervisorId, justification) {
        const transaction = await this.transactionRepository.findOne({
            where: { id: transactionId }
        });
        if (!transaction) {
            throw new common_1.NotFoundException('Transaction not found');
        }
        await this.auditLogRepository.save({
            userId: supervisorId,
            transactionId: transaction.id,
            action: audit_log_entity_1.AuditAction.SUPERVISOR_OVERRIDE_EXPIRED_GATE_PASS,
            entityType: 'Transaction',
            entityId: transaction.id,
            description: 'Supervisor override for expired gate pass',
            newValues: {
                justification,
                originalExpiryTime: transaction.gatePassExpiresAt?.toISOString()
            },
            metadata: {
                operationalLevel: transaction_entity_1.OperationalLevel.L7_GATE_PASS_EXIT
            },
            timestamp: new Date()
        });
        await this.processVehicleExit(transactionId, supervisorId, true);
    }
};
exports.GatePassService = GatePassService;
exports.GatePassService = GatePassService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(transaction_entity_1.Transaction)),
    __param(1, (0, typeorm_1.InjectRepository)(vehicle_entity_1.Vehicle)),
    __param(2, (0, typeorm_1.InjectRepository)(audit_log_entity_1.AuditLog)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], GatePassService);
//# sourceMappingURL=gate-pass.service.js.map