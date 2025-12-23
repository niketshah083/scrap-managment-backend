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
exports.WeighbridgeController = exports.CaptureWeightDto = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const weighbridge_service_1 = require("./weighbridge.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const role_guard_1 = require("../auth/guards/role.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const user_entity_1 = require("../entities/user.entity");
class CaptureWeightDto {
}
exports.CaptureWeightDto = CaptureWeightDto;
let WeighbridgeController = class WeighbridgeController {
    constructor(weighbridgeService) {
        this.weighbridgeService = weighbridgeService;
    }
    async captureGrossWeight(transactionId, captureWeightDto, photo) {
        const reading = {
            weight: captureWeightDto.weight,
            timestamp: new Date(),
            operatorId: captureWeightDto.operatorId,
            equipmentId: captureWeightDto.equipmentId,
            ticketNumber: captureWeightDto.ticketNumber
        };
        if (!captureWeightDto.equipmentId && !photo) {
            throw new common_1.BadRequestException('Photo evidence is required for manual weight entry');
        }
        return await this.weighbridgeService.captureGrossWeight(transactionId, reading, photo);
    }
    async captureTareWeight(transactionId, captureWeightDto, photo) {
        const reading = {
            weight: captureWeightDto.weight,
            timestamp: new Date(),
            operatorId: captureWeightDto.operatorId,
            equipmentId: captureWeightDto.equipmentId,
            ticketNumber: captureWeightDto.ticketNumber
        };
        if (!captureWeightDto.equipmentId && !photo) {
            throw new common_1.BadRequestException('Photo evidence is required for manual weight entry');
        }
        return await this.weighbridgeService.captureTareWeight(transactionId, reading, photo);
    }
};
exports.WeighbridgeController = WeighbridgeController;
__decorate([
    (0, common_1.Post)(':transactionId/gross-weight'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.SECURITY, user_entity_1.UserRole.INSPECTOR, user_entity_1.UserRole.SUPERVISOR, user_entity_1.UserRole.MANAGER, user_entity_1.UserRole.OWNER),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('photo')),
    __param(0, (0, common_1.Param)('transactionId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, CaptureWeightDto, Object]),
    __metadata("design:returntype", Promise)
], WeighbridgeController.prototype, "captureGrossWeight", null);
__decorate([
    (0, common_1.Post)(':transactionId/tare-weight'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.SECURITY, user_entity_1.UserRole.INSPECTOR, user_entity_1.UserRole.SUPERVISOR, user_entity_1.UserRole.MANAGER, user_entity_1.UserRole.OWNER),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('photo')),
    __param(0, (0, common_1.Param)('transactionId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, CaptureWeightDto, Object]),
    __metadata("design:returntype", Promise)
], WeighbridgeController.prototype, "captureTareWeight", null);
exports.WeighbridgeController = WeighbridgeController = __decorate([
    (0, common_1.Controller)('weighbridge'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, role_guard_1.RoleGuard),
    __metadata("design:paramtypes", [weighbridge_service_1.WeighbridgeService])
], WeighbridgeController);
//# sourceMappingURL=weighbridge.controller.js.map