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
exports.AuditService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const audit_log_entity_1 = require("../entities/audit-log.entity");
let AuditService = class AuditService {
    constructor(auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }
    async createAuditLog(dto) {
        const auditLog = this.auditLogRepository.create({
            ...dto,
            timestamp: new Date(),
        });
        return this.auditLogRepository.save(auditLog);
    }
    async logPOCreation(userId, poId, poData) {
        return this.createAuditLog({
            userId,
            action: audit_log_entity_1.AuditAction.PO_CREATED,
            entityType: 'PurchaseOrder',
            entityId: poId,
            description: `Purchase Order ${poData.poNumber || poId} created`,
            newValues: poData,
            severity: 'MEDIUM',
        });
    }
    async logPOUpdate(userId, poId, oldValues, newValues) {
        return this.createAuditLog({
            userId,
            action: audit_log_entity_1.AuditAction.PO_UPDATED,
            entityType: 'PurchaseOrder',
            entityId: poId,
            description: `Purchase Order ${poId} updated`,
            oldValues,
            newValues,
            severity: 'MEDIUM',
        });
    }
    async logPOCancellation(userId, poId, reason) {
        return this.createAuditLog({
            userId,
            action: audit_log_entity_1.AuditAction.PO_CANCELLED,
            entityType: 'PurchaseOrder',
            entityId: poId,
            description: `Purchase Order ${poId} cancelled${reason ? `: ${reason}` : ''}`,
            newValues: { status: 'CANCELLED', reason },
            severity: 'HIGH',
        });
    }
    async logPODocumentUpload(userId, poId, documentInfo) {
        return this.createAuditLog({
            userId,
            action: audit_log_entity_1.AuditAction.PO_DOCUMENT_UPLOADED,
            entityType: 'PurchaseOrder',
            entityId: poId,
            description: `Document uploaded to Purchase Order ${poId}`,
            newValues: documentInfo,
            severity: 'LOW',
        });
    }
    async logGRNStepSave(userId, transactionId, stepNumber, stepData) {
        return this.createAuditLog({
            userId,
            action: audit_log_entity_1.AuditAction.GRN_STEP_SAVED,
            entityType: 'Transaction',
            entityId: transactionId,
            transactionId,
            description: `GRN Step ${stepNumber} saved for transaction ${transactionId}`,
            newValues: { stepNumber, ...stepData },
            metadata: {
                operationalLevel: stepNumber + 1,
            },
            severity: 'LOW',
        });
    }
    async logTransactionCreation(userId, transactionId, transactionData) {
        return this.createAuditLog({
            userId,
            action: audit_log_entity_1.AuditAction.TRANSACTION_CREATED,
            entityType: 'Transaction',
            entityId: transactionId,
            transactionId,
            description: `Transaction ${transactionData.transactionNumber || transactionId} created`,
            newValues: transactionData,
            severity: 'MEDIUM',
        });
    }
    async logGRNCompletion(userId, transactionId, transactionData) {
        return this.createAuditLog({
            userId,
            action: audit_log_entity_1.AuditAction.GRN_COMPLETED,
            entityType: 'Transaction',
            entityId: transactionId,
            transactionId,
            description: `GRN completed for transaction ${transactionId}`,
            newValues: transactionData,
            severity: 'HIGH',
        });
    }
    async logQCReportCreation(userId, qcReportId, transactionId, qcData) {
        return this.createAuditLog({
            userId,
            action: audit_log_entity_1.AuditAction.QC_REPORT_CREATED,
            entityType: 'QCReport',
            entityId: qcReportId,
            transactionId,
            description: `QC Report created for transaction ${transactionId}`,
            newValues: qcData,
            severity: 'MEDIUM',
        });
    }
    async logQCReportUpdate(userId, qcReportId, transactionId, oldValues, newValues) {
        return this.createAuditLog({
            userId,
            action: audit_log_entity_1.AuditAction.QC_REPORT_UPDATED,
            entityType: 'QCReport',
            entityId: qcReportId,
            transactionId,
            description: `QC Report ${qcReportId} updated`,
            oldValues,
            newValues,
            severity: 'MEDIUM',
        });
    }
    async logQCReportApproval(userId, qcReportId, transactionId, approvalData) {
        return this.createAuditLog({
            userId,
            action: audit_log_entity_1.AuditAction.QC_REPORT_APPROVED,
            entityType: 'QCReport',
            entityId: qcReportId,
            transactionId,
            description: `QC Report ${qcReportId} approved`,
            newValues: approvalData,
            severity: 'HIGH',
        });
    }
    async logDebitNoteGeneration(userId, debitNoteId, qcReportId, transactionId, debitNoteData) {
        return this.createAuditLog({
            userId,
            action: audit_log_entity_1.AuditAction.DEBIT_NOTE_GENERATED,
            entityType: 'DebitNote',
            entityId: debitNoteId,
            transactionId,
            description: `Debit Note ${debitNoteData.debitNoteNumber || debitNoteId} generated for QC Report ${qcReportId}`,
            newValues: debitNoteData,
            severity: 'HIGH',
        });
    }
    async logQCReportSent(userId, qcReportId, transactionId, sendData) {
        return this.createAuditLog({
            userId,
            action: audit_log_entity_1.AuditAction.QC_REPORT_SENT,
            entityType: 'QCReport',
            entityId: qcReportId,
            transactionId,
            description: `QC Report ${qcReportId} sent to vendor via ${sendData.sendMethod}`,
            newValues: sendData,
            severity: 'MEDIUM',
        });
    }
    async getAuditLogsForEntity(entityType, entityId) {
        return this.auditLogRepository.find({
            where: { entityType, entityId },
            order: { timestamp: 'DESC' },
        });
    }
    async getAuditLogsForTransaction(transactionId) {
        return this.auditLogRepository.find({
            where: { transactionId },
            order: { timestamp: 'DESC' },
        });
    }
    async getAuditLogsByUser(userId, limit = 100) {
        return this.auditLogRepository.find({
            where: { userId },
            order: { timestamp: 'DESC' },
            take: limit,
        });
    }
};
exports.AuditService = AuditService;
exports.AuditService = AuditService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(audit_log_entity_1.AuditLog)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], AuditService);
//# sourceMappingURL=audit.service.js.map