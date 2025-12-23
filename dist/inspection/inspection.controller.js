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
exports.InspectionController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const role_guard_1 = require("../auth/guards/role.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const user_entity_1 = require("../entities/user.entity");
const inspection_service_1 = require("./inspection.service");
let InspectionController = class InspectionController {
    constructor(inspectionService) {
        this.inspectionService = inspectionService;
    }
    async conductInspection(transactionId, conductInspectionDto, photos, req) {
        if (!photos || photos.length < 2) {
            throw new common_1.BadRequestException('At least 2 photos are required for inspection');
        }
        if (photos.length > 10) {
            throw new common_1.BadRequestException('Maximum 10 photos allowed');
        }
        for (const photo of photos) {
            if (!photo.mimetype.startsWith('image/')) {
                throw new common_1.BadRequestException(`File ${photo.originalname} is not an image`);
            }
        }
        const inspectionData = {
            ...conductInspectionDto,
            inspectorId: req.user.userId,
            photos: photos.map((photo, index) => ({
                file: photo.buffer,
                fileName: photo.originalname || `inspection-photo-${index + 1}.jpg`,
                mimeType: photo.mimetype,
                description: `Inspection photo ${index + 1}`,
            })),
        };
        return await this.inspectionService.conductInspection(transactionId, inspectionData, req.user.tenantId);
    }
    async getInspectionData(transactionId, req) {
        return await this.inspectionService.getInspectionData(transactionId, req.user.tenantId);
    }
    async getInspectionEvidence(transactionId, req) {
        return await this.inspectionService.getInspectionEvidence(transactionId, req.user.tenantId);
    }
    async validateInspectionRequirements(transactionId, req) {
        return await this.inspectionService.validateInspectionRequirements(transactionId, req.user.tenantId);
    }
    async getInspectionConfiguration(req) {
        return await this.inspectionService.getInspectionConfiguration(req.user.tenantId);
    }
};
exports.InspectionController = InspectionController;
__decorate([
    (0, common_1.Post)(':transactionId/conduct'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.INSPECTOR, user_entity_1.UserRole.SUPERVISOR, user_entity_1.UserRole.MANAGER, user_entity_1.UserRole.OWNER),
    (0, common_1.UseInterceptors)((0, platform_express_1.FilesInterceptor)('photos', 10)),
    __param(0, (0, common_1.Param)('transactionId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.UploadedFiles)()),
    __param(3, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Array, Object]),
    __metadata("design:returntype", Promise)
], InspectionController.prototype, "conductInspection", null);
__decorate([
    (0, common_1.Get)(':transactionId/data'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.INSPECTOR, user_entity_1.UserRole.SUPERVISOR, user_entity_1.UserRole.MANAGER, user_entity_1.UserRole.OWNER, user_entity_1.UserRole.SECURITY),
    __param(0, (0, common_1.Param)('transactionId')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], InspectionController.prototype, "getInspectionData", null);
__decorate([
    (0, common_1.Get)(':transactionId/evidence'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.INSPECTOR, user_entity_1.UserRole.SUPERVISOR, user_entity_1.UserRole.MANAGER, user_entity_1.UserRole.OWNER, user_entity_1.UserRole.SECURITY),
    __param(0, (0, common_1.Param)('transactionId')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], InspectionController.prototype, "getInspectionEvidence", null);
__decorate([
    (0, common_1.Get)(':transactionId/requirements'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.INSPECTOR, user_entity_1.UserRole.SUPERVISOR, user_entity_1.UserRole.MANAGER, user_entity_1.UserRole.OWNER, user_entity_1.UserRole.SECURITY),
    __param(0, (0, common_1.Param)('transactionId')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], InspectionController.prototype, "validateInspectionRequirements", null);
__decorate([
    (0, common_1.Get)('configuration'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.INSPECTOR, user_entity_1.UserRole.SUPERVISOR, user_entity_1.UserRole.MANAGER, user_entity_1.UserRole.OWNER),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], InspectionController.prototype, "getInspectionConfiguration", null);
exports.InspectionController = InspectionController = __decorate([
    (0, common_1.Controller)('inspection'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, role_guard_1.RoleGuard),
    __metadata("design:paramtypes", [inspection_service_1.InspectionService])
], InspectionController);
//# sourceMappingURL=inspection.controller.js.map