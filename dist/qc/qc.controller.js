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
exports.QCController = void 0;
const common_1 = require("@nestjs/common");
const qc_service_1 = require("./qc.service");
const qc_report_entity_1 = require("../entities/qc-report.entity");
let QCController = class QCController {
    constructor(qcService) {
        this.qcService = qcService;
    }
    async createQCReport(dto) {
        return this.qcService.createQCReport(dto);
    }
    async getQCReportById(id) {
        return this.qcService.getQCReportById(id);
    }
    async getQCReportByTransaction(transactionId) {
        return this.qcService.getQCReportByTransaction(transactionId);
    }
    async getQCReports(tenantId, status) {
        return this.qcService.getQCReportsByTenant(tenantId, status);
    }
    async updateQCReport(id, dto) {
        return this.qcService.updateQCReport(id, dto);
    }
    async approveQCReport(id, approverUserId) {
        return this.qcService.approveQCReport(id, approverUserId);
    }
    async generateDebitNote(id) {
        return this.qcService.generateDebitNote(id);
    }
    async getDebitNoteById(id) {
        return this.qcService.getDebitNoteById(id);
    }
    async sendQCReportToVendor(id, sendMethod, userId) {
        return this.qcService.sendQCReportToVendor(id, sendMethod, userId);
    }
};
exports.QCController = QCController;
__decorate([
    (0, common_1.Post)('reports'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], QCController.prototype, "createQCReport", null);
__decorate([
    (0, common_1.Get)('reports/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], QCController.prototype, "getQCReportById", null);
__decorate([
    (0, common_1.Get)('reports/transaction/:transactionId'),
    __param(0, (0, common_1.Param)('transactionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], QCController.prototype, "getQCReportByTransaction", null);
__decorate([
    (0, common_1.Get)('reports'),
    __param(0, (0, common_1.Query)('tenantId')),
    __param(1, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], QCController.prototype, "getQCReports", null);
__decorate([
    (0, common_1.Put)('reports/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], QCController.prototype, "updateQCReport", null);
__decorate([
    (0, common_1.Post)('reports/:id/approve'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('approverUserId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], QCController.prototype, "approveQCReport", null);
__decorate([
    (0, common_1.Post)('reports/:id/debit-note'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], QCController.prototype, "generateDebitNote", null);
__decorate([
    (0, common_1.Get)('debit-notes/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], QCController.prototype, "getDebitNoteById", null);
__decorate([
    (0, common_1.Post)('reports/:id/send'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('sendMethod')),
    __param(2, (0, common_1.Body)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], QCController.prototype, "sendQCReportToVendor", null);
exports.QCController = QCController = __decorate([
    (0, common_1.Controller)('qc'),
    __metadata("design:paramtypes", [qc_service_1.QCService])
], QCController);
//# sourceMappingURL=qc.controller.js.map