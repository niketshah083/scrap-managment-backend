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
exports.DocumentController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const role_guard_1 = require("../auth/guards/role.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const user_entity_1 = require("../entities/user.entity");
const document_processing_service_1 = require("./document-processing.service");
let DocumentController = class DocumentController {
    constructor(documentProcessingService) {
        this.documentProcessingService = documentProcessingService;
    }
    async uploadDocument(file, body, req) {
        if (!file) {
            throw new common_1.BadRequestException('No file uploaded');
        }
        const allowedMimeTypes = [
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/jpg',
        ];
        if (!allowedMimeTypes.includes(file.mimetype)) {
            throw new common_1.BadRequestException('Invalid file type. Only PDF, JPEG, and PNG files are allowed.');
        }
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            throw new common_1.BadRequestException('File size too large. Maximum 10MB allowed.');
        }
        const result = await this.documentProcessingService.processDocument({
            transactionId: body.transactionId,
            operationalLevel: parseInt(body.operationalLevel),
            file: file.buffer,
            fileName: file.originalname,
            mimeType: file.mimetype,
            documentType: body.documentType,
            extractFields: body.extractFields === 'true',
        }, req.user.id, req.user.tenantId);
        return {
            success: true,
            message: 'Document processed successfully. Manual confirmation required.',
            data: result,
        };
    }
    async confirmDocumentData(documentId, confirmationDto, req) {
        const result = await this.documentProcessingService.confirmDocumentData({
            documentId,
            confirmedData: confirmationDto.confirmedData,
            confirmedBy: req.user.id,
        }, req.user.tenantId);
        return {
            success: true,
            message: 'Document data confirmed successfully',
            data: result,
        };
    }
    async getDocumentsByTransaction(transactionId, req) {
        const documents = await this.documentProcessingService.getDocumentsByTransaction(transactionId, req.user.tenantId);
        return {
            success: true,
            data: documents,
        };
    }
    async getUnconfirmedDocuments(req) {
        const documents = await this.documentProcessingService.getUnconfirmedDocuments(req.user.tenantId);
        return {
            success: true,
            data: documents,
            count: documents.length,
        };
    }
    async linkDocumentToTransaction(documentId, transactionId, req) {
        await this.documentProcessingService.linkDocumentToTransaction(documentId, transactionId, req.user.tenantId);
        return {
            success: true,
            message: 'Document linked to transaction successfully',
        };
    }
};
exports.DocumentController = DocumentController;
__decorate([
    (0, common_1.Post)('upload'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.INSPECTOR, user_entity_1.UserRole.SUPERVISOR, user_entity_1.UserRole.MANAGER, user_entity_1.UserRole.OWNER),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], DocumentController.prototype, "uploadDocument", null);
__decorate([
    (0, common_1.Put)(':documentId/confirm'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.INSPECTOR, user_entity_1.UserRole.SUPERVISOR, user_entity_1.UserRole.MANAGER, user_entity_1.UserRole.OWNER),
    __param(0, (0, common_1.Param)('documentId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], DocumentController.prototype, "confirmDocumentData", null);
__decorate([
    (0, common_1.Get)('transaction/:transactionId'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.SECURITY, user_entity_1.UserRole.INSPECTOR, user_entity_1.UserRole.SUPERVISOR, user_entity_1.UserRole.MANAGER, user_entity_1.UserRole.OWNER),
    __param(0, (0, common_1.Param)('transactionId')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DocumentController.prototype, "getDocumentsByTransaction", null);
__decorate([
    (0, common_1.Get)('unconfirmed'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.INSPECTOR, user_entity_1.UserRole.SUPERVISOR, user_entity_1.UserRole.MANAGER, user_entity_1.UserRole.OWNER),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DocumentController.prototype, "getUnconfirmedDocuments", null);
__decorate([
    (0, common_1.Put)(':documentId/link/:transactionId'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.SUPERVISOR, user_entity_1.UserRole.MANAGER, user_entity_1.UserRole.OWNER),
    __param(0, (0, common_1.Param)('documentId')),
    __param(1, (0, common_1.Param)('transactionId')),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], DocumentController.prototype, "linkDocumentToTransaction", null);
exports.DocumentController = DocumentController = __decorate([
    (0, common_1.Controller)('documents'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, role_guard_1.RoleGuard),
    __metadata("design:paramtypes", [document_processing_service_1.DocumentProcessingService])
], DocumentController);
//# sourceMappingURL=document.controller.js.map