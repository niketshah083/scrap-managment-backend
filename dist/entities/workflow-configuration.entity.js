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
exports.WorkflowConfiguration = exports.FieldEditability = exports.FieldValidationType = exports.FieldCaptureType = void 0;
const typeorm_1 = require("typeorm");
const tenant_entity_1 = require("./tenant.entity");
const factory_entity_1 = require("./factory.entity");
var FieldCaptureType;
(function (FieldCaptureType) {
    FieldCaptureType["MANUAL"] = "MANUAL";
    FieldCaptureType["OCR"] = "OCR";
    FieldCaptureType["CAMERA"] = "CAMERA";
    FieldCaptureType["AUTO"] = "AUTO";
})(FieldCaptureType || (exports.FieldCaptureType = FieldCaptureType = {}));
var FieldValidationType;
(function (FieldValidationType) {
    FieldValidationType["REQUIRED"] = "REQUIRED";
    FieldValidationType["OPTIONAL"] = "OPTIONAL";
})(FieldValidationType || (exports.FieldValidationType = FieldValidationType = {}));
var FieldEditability;
(function (FieldEditability) {
    FieldEditability["EDITABLE"] = "EDITABLE";
    FieldEditability["READ_ONLY"] = "READ_ONLY";
})(FieldEditability || (exports.FieldEditability = FieldEditability = {}));
let WorkflowConfiguration = class WorkflowConfiguration {
};
exports.WorkflowConfiguration = WorkflowConfiguration;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], WorkflowConfiguration.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: false }),
    __metadata("design:type", String)
], WorkflowConfiguration.prototype, "tenantId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], WorkflowConfiguration.prototype, "factoryId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: false }),
    __metadata("design:type", Number)
], WorkflowConfiguration.prototype, "operationalLevel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: false }),
    __metadata("design:type", String)
], WorkflowConfiguration.prototype, "fieldName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], WorkflowConfiguration.prototype, "fieldLabel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: false }),
    __metadata("design:type", String)
], WorkflowConfiguration.prototype, "fieldType", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: FieldCaptureType,
        default: FieldCaptureType.MANUAL
    }),
    __metadata("design:type", String)
], WorkflowConfiguration.prototype, "captureType", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: FieldValidationType,
        default: FieldValidationType.REQUIRED
    }),
    __metadata("design:type", String)
], WorkflowConfiguration.prototype, "validationType", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: FieldEditability,
        default: FieldEditability.EDITABLE
    }),
    __metadata("design:type", String)
], WorkflowConfiguration.prototype, "editability", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], WorkflowConfiguration.prototype, "minPhotoCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 10 }),
    __metadata("design:type", Number)
], WorkflowConfiguration.prototype, "maxPhotoCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], WorkflowConfiguration.prototype, "validationRules", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], WorkflowConfiguration.prototype, "rolePermissions", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], WorkflowConfiguration.prototype, "displayOrder", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], WorkflowConfiguration.prototype, "helpText", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], WorkflowConfiguration.prototype, "placeholder", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], WorkflowConfiguration.prototype, "conditionalLogic", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], WorkflowConfiguration.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 1 }),
    __metadata("design:type", Number)
], WorkflowConfiguration.prototype, "version", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: false }),
    __metadata("design:type", Date)
], WorkflowConfiguration.prototype, "effectiveFrom", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], WorkflowConfiguration.prototype, "effectiveTo", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], WorkflowConfiguration.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], WorkflowConfiguration.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => tenant_entity_1.Tenant, tenant => tenant.factories),
    (0, typeorm_1.JoinColumn)({ name: 'tenantId' }),
    __metadata("design:type", tenant_entity_1.Tenant)
], WorkflowConfiguration.prototype, "tenant", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => factory_entity_1.Factory, factory => factory.workflowConfigurations, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'factoryId' }),
    __metadata("design:type", factory_entity_1.Factory)
], WorkflowConfiguration.prototype, "factory", void 0);
exports.WorkflowConfiguration = WorkflowConfiguration = __decorate([
    (0, typeorm_1.Entity)('workflow_configurations')
], WorkflowConfiguration);
//# sourceMappingURL=workflow-configuration.entity.js.map