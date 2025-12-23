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
exports.Evidence = exports.EvidenceType = void 0;
const typeorm_1 = require("typeorm");
const transaction_entity_1 = require("./transaction.entity");
const user_entity_1 = require("./user.entity");
var EvidenceType;
(function (EvidenceType) {
    EvidenceType["PHOTO"] = "PHOTO";
    EvidenceType["DOCUMENT"] = "DOCUMENT";
    EvidenceType["VIDEO"] = "VIDEO";
    EvidenceType["AUDIO"] = "AUDIO";
    EvidenceType["GPS_LOCATION"] = "GPS_LOCATION";
    EvidenceType["TIMESTAMP"] = "TIMESTAMP";
    EvidenceType["WEIGHBRIDGE_TICKET"] = "WEIGHBRIDGE_TICKET";
    EvidenceType["INSPECTION_REPORT"] = "INSPECTION_REPORT";
    EvidenceType["GRN_DOCUMENT"] = "GRN_DOCUMENT";
    EvidenceType["GATE_PASS"] = "GATE_PASS";
})(EvidenceType || (exports.EvidenceType = EvidenceType = {}));
let Evidence = class Evidence {
};
exports.Evidence = Evidence;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Evidence.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: false }),
    __metadata("design:type", String)
], Evidence.prototype, "transactionId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: false }),
    __metadata("design:type", String)
], Evidence.prototype, "capturedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: false }),
    __metadata("design:type", Number)
], Evidence.prototype, "operationalLevel", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: EvidenceType,
        nullable: false
    }),
    __metadata("design:type", String)
], Evidence.prototype, "evidenceType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 500, nullable: false }),
    __metadata("design:type", String)
], Evidence.prototype, "filePath", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], Evidence.prototype, "fileName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", String)
], Evidence.prototype, "mimeType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bigint', nullable: true }),
    __metadata("design:type", Number)
], Evidence.prototype, "fileSize", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], Evidence.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 64, nullable: true }),
    __metadata("design:type", String)
], Evidence.prototype, "fileHash", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], Evidence.prototype, "isProcessed", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Evidence.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Array)
], Evidence.prototype, "tags", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Evidence.prototype, "capturedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => transaction_entity_1.Transaction, transaction => transaction.evidence),
    (0, typeorm_1.JoinColumn)({ name: 'transactionId' }),
    __metadata("design:type", transaction_entity_1.Transaction)
], Evidence.prototype, "transaction", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, user => user.auditLogs),
    (0, typeorm_1.JoinColumn)({ name: 'capturedBy' }),
    __metadata("design:type", user_entity_1.User)
], Evidence.prototype, "user", void 0);
exports.Evidence = Evidence = __decorate([
    (0, typeorm_1.Entity)('evidence')
], Evidence);
//# sourceMappingURL=evidence.entity.js.map