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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLog = exports.AuditAction = void 0;
const typeorm_1 = require("typeorm");
const user_entity_1 = require("./user.entity");
const transaction_entity_1 = require("./transaction.entity");
var AuditAction;
(function (AuditAction) {
    AuditAction["CREATE"] = "CREATE";
    AuditAction["UPDATE"] = "UPDATE";
    AuditAction["DELETE"] = "DELETE";
    AuditAction["LOGIN"] = "LOGIN";
    AuditAction["LOGOUT"] = "LOGOUT";
    AuditAction["LEVEL_COMPLETE"] = "LEVEL_COMPLETE";
    AuditAction["EVIDENCE_CAPTURE"] = "EVIDENCE_CAPTURE";
    AuditAction["APPROVAL"] = "APPROVAL";
    AuditAction["REJECTION"] = "REJECTION";
    AuditAction["CONFIGURATION_CHANGE"] = "CONFIGURATION_CHANGE";
    AuditAction["EXPORT"] = "EXPORT";
    AuditAction["PRINT"] = "PRINT";
    AuditAction["WEIGHBRIDGE_GROSS_CAPTURED"] = "WEIGHBRIDGE_GROSS_CAPTURED";
    AuditAction["WEIGHBRIDGE_TARE_CAPTURED"] = "WEIGHBRIDGE_TARE_CAPTURED";
    AuditAction["WEIGHT_DISCREPANCY_FLAGGED"] = "WEIGHT_DISCREPANCY_FLAGGED";
    AuditAction["GATE_PASS_GENERATED"] = "GATE_PASS_GENERATED";
    AuditAction["VEHICLE_EXIT_COMPLETED"] = "VEHICLE_EXIT_COMPLETED";
    AuditAction["VEHICLE_EXIT_SUPERVISOR_OVERRIDE"] = "VEHICLE_EXIT_SUPERVISOR_OVERRIDE";
    AuditAction["SUPERVISOR_OVERRIDE_EXPIRED_GATE_PASS"] = "SUPERVISOR_OVERRIDE_EXPIRED_GATE_PASS";
    AuditAction["PO_CREATED"] = "PO_CREATED";
    AuditAction["PO_UPDATED"] = "PO_UPDATED";
    AuditAction["PO_CANCELLED"] = "PO_CANCELLED";
    AuditAction["PO_DOCUMENT_UPLOADED"] = "PO_DOCUMENT_UPLOADED";
    AuditAction["GRN_STEP_SAVED"] = "GRN_STEP_SAVED";
    AuditAction["GRN_COMPLETED"] = "GRN_COMPLETED";
    AuditAction["TRANSACTION_CREATED"] = "TRANSACTION_CREATED";
    AuditAction["QC_REPORT_CREATED"] = "QC_REPORT_CREATED";
    AuditAction["QC_REPORT_UPDATED"] = "QC_REPORT_UPDATED";
    AuditAction["QC_REPORT_APPROVED"] = "QC_REPORT_APPROVED";
    AuditAction["QC_REPORT_SENT"] = "QC_REPORT_SENT";
    AuditAction["DEBIT_NOTE_GENERATED"] = "DEBIT_NOTE_GENERATED";
})(AuditAction || (exports.AuditAction = AuditAction = {}));
let AuditLog = class AuditLog {
};
exports.AuditLog = AuditLog;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], AuditLog.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: false }),
    __metadata("design:type", String)
], AuditLog.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], AuditLog.prototype, "transactionId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: AuditAction,
        nullable: false
    }),
    __metadata("design:type", String)
], AuditLog.prototype, "action", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: false }),
    __metadata("design:type", String)
], AuditLog.prototype, "entityType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], AuditLog.prototype, "entityId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], AuditLog.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], AuditLog.prototype, "oldValues", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], AuditLog.prototype, "newValues", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], AuditLog.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], AuditLog.prototype, "isSensitive", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", String)
], AuditLog.prototype, "severity", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], AuditLog.prototype, "timestamp", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, user => user.auditLogs),
    (0, typeorm_1.JoinColumn)({ name: 'userId' }),
    __metadata("design:type", user_entity_1.User)
], AuditLog.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => transaction_entity_1.Transaction, transaction => transaction.auditLogs),
    (0, typeorm_1.JoinColumn)({ name: 'transactionId' }),
    __metadata("design:type", transaction_entity_1.Transaction)
], AuditLog.prototype, "transaction", void 0);
exports.AuditLog = AuditLog = __decorate([
    (0, typeorm_1.Entity)('audit_logs')
], AuditLog);
//# sourceMappingURL=audit-log.entity.js.map