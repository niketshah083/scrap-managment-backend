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
exports.QCService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const qc_report_entity_1 = require("../entities/qc-report.entity");
const debit_note_entity_1 = require("../entities/debit-note.entity");
const transaction_entity_1 = require("../entities/transaction.entity");
const audit_service_1 = require("../audit/audit.service");
let QCService = class QCService {
    constructor(qcReportRepository, debitNoteRepository, transactionRepository, auditService) {
        this.qcReportRepository = qcReportRepository;
        this.debitNoteRepository = debitNoteRepository;
        this.transactionRepository = transactionRepository;
        this.auditService = auditService;
    }
    calculateNetWeight(grossWeight, bardana, rejection) {
        return grossWeight - bardana - rejection;
    }
    calculateFinalQuantity(netWeight, expPercent, qualityDeductPercent) {
        return netWeight * (expPercent / 100) * (1 - qualityDeductPercent / 100);
    }
    calculateAmount(finalQuantity, rate) {
        return finalQuantity * rate;
    }
    calculateDeliveryDifference(finalQuantity, rate, deliveryRate) {
        return (deliveryRate - rate) * finalQuantity;
    }
    processLineItems(lineItems) {
        return lineItems.map((item, index) => {
            const netWeight = this.calculateNetWeight(item.grossWeight, item.bardana, item.rejection);
            const finalQuantity = this.calculateFinalQuantity(netWeight, item.expPercent, item.qualityDeductPercent);
            const amount = this.calculateAmount(finalQuantity, item.rate);
            const deliveryDifference = this.calculateDeliveryDifference(finalQuantity, item.rate, item.deliveryRate);
            return {
                ...item,
                id: item.id || index + 1,
                netWeight,
                finalQuantity,
                amount,
                deliveryDifference,
            };
        });
    }
    calculateTotals(lineItems) {
        return lineItems.reduce((totals, item) => ({
            grossWeight: totals.grossWeight + item.grossWeight,
            bardana: totals.bardana + item.bardana,
            rejection: totals.rejection + item.rejection,
            netWeight: totals.netWeight + item.netWeight,
            finalQuantity: totals.finalQuantity + item.finalQuantity,
            amount: totals.amount + item.amount,
            deliveryDifference: totals.deliveryDifference + item.deliveryDifference,
        }), {
            grossWeight: 0,
            bardana: 0,
            rejection: 0,
            netWeight: 0,
            finalQuantity: 0,
            amount: 0,
            deliveryDifference: 0,
        });
    }
    async createQCReport(dto) {
        const transaction = await this.transactionRepository.findOne({
            where: { id: dto.transactionId },
        });
        if (!transaction) {
            throw new common_1.NotFoundException(`Transaction ${dto.transactionId} not found`);
        }
        if (transaction.status !== transaction_entity_1.TransactionStatus.COMPLETED) {
            throw new common_1.BadRequestException('QC Report can only be created for completed transactions');
        }
        const existingReport = await this.qcReportRepository.findOne({
            where: { transactionId: dto.transactionId },
        });
        if (existingReport) {
            throw new common_1.BadRequestException('QC Report already exists for this transaction');
        }
        const processedLineItems = this.processLineItems(dto.lineItems);
        const totals = this.calculateTotals(processedLineItems);
        const qcReport = this.qcReportRepository.create({
            transactionId: dto.transactionId,
            tenantId: dto.tenantId,
            lineItems: processedLineItems,
            totals,
            remarks: dto.remarks,
            labTechnician: dto.labTechnician,
            verifiedBy: dto.verifiedBy,
            status: qc_report_entity_1.QCReportStatus.DRAFT,
        });
        const savedReport = await this.qcReportRepository.save(qcReport);
        const auditUserId = dto.userId || 'system';
        await this.auditService.logQCReportCreation(auditUserId, savedReport.id, dto.transactionId, {
            lineItemCount: processedLineItems.length,
            totals,
            status: savedReport.status,
            labTechnician: dto.labTechnician,
        });
        return savedReport;
    }
    async updateQCReport(id, dto, userId) {
        const qcReport = await this.qcReportRepository.findOne({ where: { id } });
        if (!qcReport) {
            throw new common_1.NotFoundException(`QC Report ${id} not found`);
        }
        if (qcReport.status === qc_report_entity_1.QCReportStatus.APPROVED) {
            throw new common_1.BadRequestException('Cannot update an approved QC Report');
        }
        const oldValues = {
            lineItems: qcReport.lineItems,
            totals: qcReport.totals,
            remarks: qcReport.remarks,
            labTechnician: qcReport.labTechnician,
            verifiedBy: qcReport.verifiedBy,
        };
        if (dto.lineItems) {
            const processedLineItems = this.processLineItems(dto.lineItems);
            qcReport.lineItems = processedLineItems;
            qcReport.totals = this.calculateTotals(processedLineItems);
        }
        if (dto.remarks !== undefined)
            qcReport.remarks = dto.remarks;
        if (dto.labTechnician)
            qcReport.labTechnician = dto.labTechnician;
        if (dto.verifiedBy !== undefined)
            qcReport.verifiedBy = dto.verifiedBy;
        const savedReport = await this.qcReportRepository.save(qcReport);
        await this.auditService.logQCReportUpdate(userId || dto.labTechnician || 'system', savedReport.id, savedReport.transactionId, oldValues, {
            lineItems: savedReport.lineItems,
            totals: savedReport.totals,
            remarks: savedReport.remarks,
            labTechnician: savedReport.labTechnician,
            verifiedBy: savedReport.verifiedBy,
        });
        return savedReport;
    }
    async getQCReportById(id) {
        const qcReport = await this.qcReportRepository.findOne({
            where: { id },
            relations: ['transaction'],
        });
        if (!qcReport) {
            throw new common_1.NotFoundException(`QC Report ${id} not found`);
        }
        return qcReport;
    }
    async getQCReportByTransaction(transactionId) {
        return this.qcReportRepository.findOne({
            where: { transactionId },
            relations: ['transaction'],
        });
    }
    async approveQCReport(id, approverUserId) {
        const qcReport = await this.qcReportRepository.findOne({ where: { id } });
        if (!qcReport) {
            throw new common_1.NotFoundException(`QC Report ${id} not found`);
        }
        if (qcReport.status === qc_report_entity_1.QCReportStatus.APPROVED) {
            throw new common_1.BadRequestException('QC Report is already approved');
        }
        qcReport.status = qc_report_entity_1.QCReportStatus.APPROVED;
        qcReport.approvedAt = new Date();
        qcReport.approvedBy = approverUserId;
        await this.qcReportRepository.save(qcReport);
        await this.transactionRepository.update({ id: qcReport.transactionId }, { qcStatus: 'COMPLETED', qcReportId: qcReport.id });
        await this.auditService.logQCReportApproval(approverUserId, qcReport.id, qcReport.transactionId, {
            status: qcReport.status,
            approvedAt: qcReport.approvedAt,
            totals: qcReport.totals,
        });
        return qcReport;
    }
    async generateDebitNote(qcReportId, userId) {
        const qcReport = await this.qcReportRepository.findOne({
            where: { id: qcReportId },
            relations: ['transaction'],
        });
        if (!qcReport) {
            throw new common_1.NotFoundException(`QC Report ${qcReportId} not found`);
        }
        if (qcReport.status !== qc_report_entity_1.QCReportStatus.APPROVED) {
            throw new common_1.BadRequestException('Debit Note can only be generated for approved QC Reports');
        }
        if (qcReport.debitNoteId) {
            const existingNote = await this.debitNoteRepository.findOne({
                where: { id: qcReport.debitNoteId },
            });
            if (existingNote) {
                return existingNote;
            }
        }
        const debitNoteNumber = await this.generateDebitNoteNumber(qcReport.tenantId);
        const bardanaDeduction = qcReport.totals.bardana * 50;
        const avgRate = qcReport.totals.finalQuantity > 0
            ? qcReport.totals.amount / qcReport.totals.finalQuantity
            : 0;
        const rejectionAmount = qcReport.totals.rejection * avgRate;
        const qualityDifference = Math.abs(qcReport.totals.deliveryDifference);
        const grandTotal = -(qualityDifference + bardanaDeduction + rejectionAmount);
        const debitNote = this.debitNoteRepository.create({
            debitNoteNumber,
            qcReportId: qcReport.id,
            transactionId: qcReport.transactionId,
            vendorId: qcReport.transaction?.vendorId || '',
            tenantId: qcReport.tenantId,
            weightDifference: 0,
            qualityDifference,
            bardanaDeduction,
            rejectionAmount,
            grandTotal,
            status: debit_note_entity_1.DebitNoteStatus.GENERATED,
        });
        const savedDebitNote = await this.debitNoteRepository.save(debitNote);
        qcReport.debitNoteId = savedDebitNote.id;
        await this.qcReportRepository.save(qcReport);
        await this.auditService.logDebitNoteGeneration(userId || qcReport.approvedBy || 'system', savedDebitNote.id, qcReport.id, qcReport.transactionId, {
            debitNoteNumber: savedDebitNote.debitNoteNumber,
            qualityDifference: savedDebitNote.qualityDifference,
            bardanaDeduction: savedDebitNote.bardanaDeduction,
            rejectionAmount: savedDebitNote.rejectionAmount,
            grandTotal: savedDebitNote.grandTotal,
            status: savedDebitNote.status,
        });
        return savedDebitNote;
    }
    async generateDebitNoteNumber(tenantId) {
        const year = new Date().getFullYear();
        const prefix = `DN-${year}`;
        const latestNote = await this.debitNoteRepository
            .createQueryBuilder('dn')
            .where('dn.tenantId = :tenantId', { tenantId })
            .andWhere('dn.debitNoteNumber LIKE :prefix', { prefix: `${prefix}%` })
            .orderBy('dn.createdAt', 'DESC')
            .getOne();
        let sequence = 1;
        if (latestNote) {
            const match = latestNote.debitNoteNumber.match(/DN-\d{4}-(\d+)/);
            if (match) {
                sequence = parseInt(match[1], 10) + 1;
            }
        }
        return `${prefix}-${sequence.toString().padStart(4, '0')}`;
    }
    async getQCReportsByTenant(tenantId, status) {
        const where = { tenantId };
        if (status) {
            where.status = status;
        }
        return this.qcReportRepository.find({
            where,
            relations: ['transaction'],
            order: { createdAt: 'DESC' },
        });
    }
    async getDebitNoteById(id) {
        const debitNote = await this.debitNoteRepository.findOne({
            where: { id },
            relations: ['qcReport'],
        });
        if (!debitNote) {
            throw new common_1.NotFoundException(`Debit Note ${id} not found`);
        }
        return debitNote;
    }
    async sendQCReportToVendor(qcReportId, sendMethod, userId) {
        const qcReport = await this.qcReportRepository.findOne({
            where: { id: qcReportId },
            relations: ['transaction'],
        });
        if (!qcReport) {
            throw new common_1.NotFoundException(`QC Report ${qcReportId} not found`);
        }
        if (qcReport.status !== qc_report_entity_1.QCReportStatus.APPROVED) {
            throw new common_1.BadRequestException('Only approved QC Reports can be sent to vendors');
        }
        const transaction = qcReport.transaction;
        if (!transaction?.vendorId) {
            throw new common_1.BadRequestException('No vendor associated with this QC Report');
        }
        const sentAt = new Date();
        await this.auditService.logQCReportSent(userId || 'system', qcReportId, qcReport.transactionId, {
            sendMethod,
            vendorId: transaction.vendorId,
            sentAt,
            debitNoteId: qcReport.debitNoteId,
        });
        if (qcReport.debitNoteId) {
            await this.debitNoteRepository.update({ id: qcReport.debitNoteId }, { status: debit_note_entity_1.DebitNoteStatus.SENT });
        }
        return {
            success: true,
            message: `QC Report sent successfully via ${sendMethod}`,
            sentAt,
        };
    }
};
exports.QCService = QCService;
exports.QCService = QCService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(qc_report_entity_1.QCReport)),
    __param(1, (0, typeorm_1.InjectRepository)(debit_note_entity_1.DebitNote)),
    __param(2, (0, typeorm_1.InjectRepository)(transaction_entity_1.Transaction)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        audit_service_1.AuditService])
], QCService);
//# sourceMappingURL=qc.service.js.map