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
exports.EvidenceController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const evidence_service_1 = require("./evidence.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const permissions_decorator_1 = require("../auth/decorators/permissions.decorator");
let EvidenceController = class EvidenceController {
    constructor(evidenceService) {
        this.evidenceService = evidenceService;
    }
    async createEvidence(createEvidenceDto, file, req) {
        if (!createEvidenceDto.transactionId) {
            throw new common_1.BadRequestException('Transaction ID is required');
        }
        if (!createEvidenceDto.operationalLevel || createEvidenceDto.operationalLevel < 1 || createEvidenceDto.operationalLevel > 7) {
            throw new common_1.BadRequestException('Valid operational level (1-7) is required');
        }
        if (!createEvidenceDto.evidenceType) {
            throw new common_1.BadRequestException('Evidence type is required');
        }
        let metadata = createEvidenceDto.metadata;
        if (typeof metadata === 'string') {
            try {
                metadata = JSON.parse(metadata);
            }
            catch (error) {
                throw new common_1.BadRequestException('Invalid metadata format');
            }
        }
        let tags = createEvidenceDto.tags;
        if (typeof createEvidenceDto.tags === 'string') {
            try {
                tags = JSON.parse(createEvidenceDto.tags);
            }
            catch (error) {
                tags = [createEvidenceDto.tags];
            }
        }
        const evidenceData = {
            ...createEvidenceDto,
            metadata,
            tags,
            file: file?.buffer,
            fileName: file?.originalname,
            mimeType: file?.mimetype,
        };
        const evidence = await this.evidenceService.createEvidence(evidenceData, req.user.sub, req.user.tenantId);
        return evidence;
    }
    async getEvidenceByTransaction(transactionId, req) {
        return await this.evidenceService.getEvidenceByTransaction(transactionId, req.user.tenantId);
    }
    async getEvidenceByLevel(transactionId, level, req) {
        const operationalLevel = parseInt(level, 10);
        if (isNaN(operationalLevel) || operationalLevel < 1 || operationalLevel > 7) {
            throw new common_1.BadRequestException('Valid operational level (1-7) is required');
        }
        return await this.evidenceService.getEvidenceByLevel(transactionId, operationalLevel, req.user.tenantId);
    }
    async getEvidenceStats(transactionId, req) {
        return await this.evidenceService.getEvidenceStats(transactionId, req.user.tenantId);
    }
    async getEvidenceById(id, req) {
        return await this.evidenceService.getEvidenceById(id, req.user.tenantId);
    }
    async verifyEvidenceIntegrity(id) {
        const isValid = await this.evidenceService.verifyEvidenceIntegrity(id);
        return { evidenceId: id, isValid };
    }
    async validateChronologicalIntegrity(transactionId) {
        const isValid = await this.evidenceService.validateChronologicalIntegrity(transactionId);
        return { transactionId, chronologicalIntegrityValid: isValid };
    }
    async validateTimestamp(body) {
        const proposedTimestamp = new Date(body.timestamp);
        const isValid = await this.evidenceService.preventBackdating(proposedTimestamp, body.transactionId, body.operationalLevel);
        return {
            timestamp: body.timestamp,
            isValid,
            serverTimestamp: new Date().toISOString(),
        };
    }
    async markAsProcessed(id) {
        await this.evidenceService.markAsProcessed(id);
        return { message: 'Evidence marked as processed' };
    }
};
exports.EvidenceController = EvidenceController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    (0, permissions_decorator_1.RequirePermissions)({ level: 1, action: 'create' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], EvidenceController.prototype, "createEvidence", null);
__decorate([
    (0, common_1.Get)('transaction/:transactionId'),
    (0, permissions_decorator_1.RequirePermissions)({ level: 1, action: 'view' }),
    __param(0, (0, common_1.Param)('transactionId')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], EvidenceController.prototype, "getEvidenceByTransaction", null);
__decorate([
    (0, common_1.Get)('transaction/:transactionId/level/:level'),
    (0, permissions_decorator_1.RequirePermissions)({ level: 1, action: 'view' }),
    __param(0, (0, common_1.Param)('transactionId')),
    __param(1, (0, common_1.Param)('level')),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], EvidenceController.prototype, "getEvidenceByLevel", null);
__decorate([
    (0, common_1.Get)('transaction/:transactionId/stats'),
    (0, permissions_decorator_1.RequirePermissions)({ level: 1, action: 'view' }),
    __param(0, (0, common_1.Param)('transactionId')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], EvidenceController.prototype, "getEvidenceStats", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, permissions_decorator_1.RequirePermissions)({ level: 1, action: 'view' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], EvidenceController.prototype, "getEvidenceById", null);
__decorate([
    (0, common_1.Get)(':id/verify'),
    (0, permissions_decorator_1.RequirePermissions)({ level: 1, action: 'view' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EvidenceController.prototype, "verifyEvidenceIntegrity", null);
__decorate([
    (0, common_1.Get)('transaction/:transactionId/chronological-integrity'),
    (0, permissions_decorator_1.RequirePermissions)({ level: 1, action: 'view' }),
    __param(0, (0, common_1.Param)('transactionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EvidenceController.prototype, "validateChronologicalIntegrity", null);
__decorate([
    (0, common_1.Post)('validate-timestamp'),
    (0, permissions_decorator_1.RequirePermissions)({ level: 1, action: 'create' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], EvidenceController.prototype, "validateTimestamp", null);
__decorate([
    (0, common_1.Post)(':id/mark-processed'),
    (0, permissions_decorator_1.RequirePermissions)({ level: 4, action: 'update' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EvidenceController.prototype, "markAsProcessed", null);
exports.EvidenceController = EvidenceController = __decorate([
    (0, common_1.Controller)('evidence'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [evidence_service_1.EvidenceService])
], EvidenceController);
//# sourceMappingURL=evidence.controller.js.map