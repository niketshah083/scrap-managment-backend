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
exports.DebitNote = exports.DebitNoteStatus = void 0;
const typeorm_1 = require("typeorm");
const qc_report_entity_1 = require("./qc-report.entity");
var DebitNoteStatus;
(function (DebitNoteStatus) {
    DebitNoteStatus["GENERATED"] = "GENERATED";
    DebitNoteStatus["SENT"] = "SENT";
    DebitNoteStatus["ACKNOWLEDGED"] = "ACKNOWLEDGED";
})(DebitNoteStatus || (exports.DebitNoteStatus = DebitNoteStatus = {}));
let DebitNote = class DebitNote {
};
exports.DebitNote = DebitNote;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], DebitNote.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, unique: true, nullable: false }),
    __metadata("design:type", String)
], DebitNote.prototype, "debitNoteNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: false }),
    __metadata("design:type", String)
], DebitNote.prototype, "qcReportId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: false }),
    __metadata("design:type", String)
], DebitNote.prototype, "transactionId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: false }),
    __metadata("design:type", String)
], DebitNote.prototype, "vendorId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: false }),
    __metadata("design:type", String)
], DebitNote.prototype, "tenantId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], DebitNote.prototype, "weightDifference", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], DebitNote.prototype, "qualityDifference", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], DebitNote.prototype, "bardanaDeduction", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], DebitNote.prototype, "rejectionAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], DebitNote.prototype, "grandTotal", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: DebitNoteStatus,
        default: DebitNoteStatus.GENERATED
    }),
    __metadata("design:type", String)
], DebitNote.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], DebitNote.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], DebitNote.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => qc_report_entity_1.QCReport),
    (0, typeorm_1.JoinColumn)({ name: 'qcReportId' }),
    __metadata("design:type", qc_report_entity_1.QCReport)
], DebitNote.prototype, "qcReport", void 0);
exports.DebitNote = DebitNote = __decorate([
    (0, typeorm_1.Entity)('debit_notes')
], DebitNote);
//# sourceMappingURL=debit-note.entity.js.map