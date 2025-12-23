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
exports.Transaction = exports.OperationalLevel = exports.TransactionStatus = void 0;
const typeorm_1 = require("typeorm");
const tenant_entity_1 = require("./tenant.entity");
const factory_entity_1 = require("./factory.entity");
const vendor_entity_1 = require("./vendor.entity");
const vehicle_entity_1 = require("./vehicle.entity");
const evidence_entity_1 = require("./evidence.entity");
const audit_log_entity_1 = require("./audit-log.entity");
const purchase_order_entity_1 = require("./purchase-order.entity");
var TransactionStatus;
(function (TransactionStatus) {
    TransactionStatus["ACTIVE"] = "ACTIVE";
    TransactionStatus["COMPLETED"] = "COMPLETED";
    TransactionStatus["REJECTED"] = "REJECTED";
    TransactionStatus["CANCELLED"] = "CANCELLED";
})(TransactionStatus || (exports.TransactionStatus = TransactionStatus = {}));
var OperationalLevel;
(function (OperationalLevel) {
    OperationalLevel[OperationalLevel["L1_VENDOR_DISPATCH"] = 1] = "L1_VENDOR_DISPATCH";
    OperationalLevel[OperationalLevel["L2_GATE_ENTRY"] = 2] = "L2_GATE_ENTRY";
    OperationalLevel[OperationalLevel["L3_WEIGHBRIDGE_GROSS"] = 3] = "L3_WEIGHBRIDGE_GROSS";
    OperationalLevel[OperationalLevel["L4_MATERIAL_INSPECTION"] = 4] = "L4_MATERIAL_INSPECTION";
    OperationalLevel[OperationalLevel["L5_WEIGHBRIDGE_TARE"] = 5] = "L5_WEIGHBRIDGE_TARE";
    OperationalLevel[OperationalLevel["L6_GRN_GENERATION"] = 6] = "L6_GRN_GENERATION";
    OperationalLevel[OperationalLevel["L7_GATE_PASS_EXIT"] = 7] = "L7_GATE_PASS_EXIT";
})(OperationalLevel || (exports.OperationalLevel = OperationalLevel = {}));
let Transaction = class Transaction {
};
exports.Transaction = Transaction;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Transaction.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: false }),
    __metadata("design:type", String)
], Transaction.prototype, "tenantId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: false }),
    __metadata("design:type", String)
], Transaction.prototype, "factoryId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: false }),
    __metadata("design:type", String)
], Transaction.prototype, "vendorId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: false }),
    __metadata("design:type", String)
], Transaction.prototype, "vehicleId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, unique: true, nullable: false }),
    __metadata("design:type", String)
], Transaction.prototype, "transactionNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'int',
        default: OperationalLevel.L1_VENDOR_DISPATCH
    }),
    __metadata("design:type", Number)
], Transaction.prototype, "currentLevel", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: TransactionStatus,
        default: TransactionStatus.ACTIVE
    }),
    __metadata("design:type", String)
], Transaction.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], Transaction.prototype, "levelData", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], Transaction.prototype, "weighbridgeData", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], Transaction.prototype, "inspectionData", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 500, nullable: true }),
    __metadata("design:type", String)
], Transaction.prototype, "grnDocumentUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 500, nullable: true }),
    __metadata("design:type", String)
], Transaction.prototype, "gatePassQrCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Transaction.prototype, "gatePassExpiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], Transaction.prototype, "isLocked", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Transaction.prototype, "completedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], Transaction.prototype, "purchaseOrderId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], Transaction.prototype, "stepData", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], Transaction.prototype, "requiresSupervisorApproval", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 500, nullable: true }),
    __metadata("design:type", String)
], Transaction.prototype, "approvalReason", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", String)
], Transaction.prototype, "qcStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], Transaction.prototype, "qcReportId", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Transaction.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Transaction.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => tenant_entity_1.Tenant, tenant => tenant.transactions),
    (0, typeorm_1.JoinColumn)({ name: 'tenantId' }),
    __metadata("design:type", tenant_entity_1.Tenant)
], Transaction.prototype, "tenant", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => factory_entity_1.Factory, factory => factory.transactions),
    (0, typeorm_1.JoinColumn)({ name: 'factoryId' }),
    __metadata("design:type", factory_entity_1.Factory)
], Transaction.prototype, "factory", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => vendor_entity_1.Vendor),
    (0, typeorm_1.JoinColumn)({ name: 'vendorId' }),
    __metadata("design:type", vendor_entity_1.Vendor)
], Transaction.prototype, "vendor", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => vehicle_entity_1.Vehicle, vehicle => vehicle.transactions),
    (0, typeorm_1.JoinColumn)({ name: 'vehicleId' }),
    __metadata("design:type", vehicle_entity_1.Vehicle)
], Transaction.prototype, "vehicle", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => evidence_entity_1.Evidence, evidence => evidence.transaction),
    __metadata("design:type", Array)
], Transaction.prototype, "evidence", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => audit_log_entity_1.AuditLog, auditLog => auditLog.transaction),
    __metadata("design:type", Array)
], Transaction.prototype, "auditLogs", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => purchase_order_entity_1.PurchaseOrder, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'purchaseOrderId' }),
    __metadata("design:type", purchase_order_entity_1.PurchaseOrder)
], Transaction.prototype, "purchaseOrder", void 0);
exports.Transaction = Transaction = __decorate([
    (0, typeorm_1.Entity)('transactions')
], Transaction);
//# sourceMappingURL=transaction.entity.js.map