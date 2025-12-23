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
exports.GatePassController = void 0;
const common_1 = require("@nestjs/common");
const gate_pass_service_1 = require("./gate-pass.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const role_guard_1 = require("../auth/guards/role.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const user_entity_1 = require("../entities/user.entity");
let GatePassController = class GatePassController {
    constructor(gatePassService) {
        this.gatePassService = gatePassService;
    }
    async generateGatePass(generateDto, req) {
        const { transactionId, validityHours = 24 } = generateDto;
        if (validityHours < 1 || validityHours > 72) {
            throw new common_1.BadRequestException('Validity hours must be between 1 and 72');
        }
        return await this.gatePassService.generateGatePass(transactionId, req.user.id, validityHours);
    }
    async validateGatePass(validateDto) {
        return await this.gatePassService.validateGatePass(validateDto.qrCodeData);
    }
    async processVehicleExit(processDto, req) {
        await this.gatePassService.processVehicleExit(processDto.transactionId, req.user.id, processDto.supervisorOverride || false);
        return {
            success: true,
            message: 'Vehicle exit processed successfully'
        };
    }
    async supervisorOverride(overrideDto, req) {
        if (!overrideDto.justification || overrideDto.justification.trim().length < 10) {
            throw new common_1.BadRequestException('Justification must be at least 10 characters long');
        }
        await this.gatePassService.supervisorOverrideExpiredGatePass(overrideDto.transactionId, req.user.id, overrideDto.justification);
        return {
            success: true,
            message: 'Supervisor override processed successfully'
        };
    }
    async getGatePassByTransaction(transactionId) {
        return null;
    }
};
exports.GatePassController = GatePassController;
__decorate([
    (0, common_1.Post)('generate'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.SUPERVISOR, user_entity_1.UserRole.MANAGER, user_entity_1.UserRole.OWNER),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], GatePassController.prototype, "generateGatePass", null);
__decorate([
    (0, common_1.Post)('validate'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.SECURITY, user_entity_1.UserRole.SUPERVISOR, user_entity_1.UserRole.MANAGER, user_entity_1.UserRole.OWNER),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], GatePassController.prototype, "validateGatePass", null);
__decorate([
    (0, common_1.Post)('process-exit'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.SECURITY, user_entity_1.UserRole.SUPERVISOR, user_entity_1.UserRole.MANAGER, user_entity_1.UserRole.OWNER),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], GatePassController.prototype, "processVehicleExit", null);
__decorate([
    (0, common_1.Post)('supervisor-override'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.SUPERVISOR, user_entity_1.UserRole.MANAGER, user_entity_1.UserRole.OWNER),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], GatePassController.prototype, "supervisorOverride", null);
__decorate([
    (0, common_1.Get)('transaction/:transactionId'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.SECURITY, user_entity_1.UserRole.INSPECTOR, user_entity_1.UserRole.SUPERVISOR, user_entity_1.UserRole.MANAGER, user_entity_1.UserRole.OWNER),
    __param(0, (0, common_1.Param)('transactionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], GatePassController.prototype, "getGatePassByTransaction", null);
exports.GatePassController = GatePassController = __decorate([
    (0, common_1.Controller)('gate-pass'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, role_guard_1.RoleGuard),
    __metadata("design:paramtypes", [gate_pass_service_1.GatePassService])
], GatePassController);
//# sourceMappingURL=gate-pass.controller.js.map