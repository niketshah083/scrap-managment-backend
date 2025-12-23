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
exports.AnalyticsController = void 0;
const common_1 = require("@nestjs/common");
const analytics_service_1 = require("./analytics.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const role_guard_1 = require("../auth/guards/role.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const user_entity_1 = require("../entities/user.entity");
let AnalyticsController = class AnalyticsController {
    constructor(analyticsService) {
        this.analyticsService = analyticsService;
    }
    async getDashboardMetrics(tenantId) {
        return this.analyticsService.getDashboardMetrics(tenantId);
    }
    async getFactoryComparison(tenantId) {
        return this.analyticsService.getFactoryComparison(tenantId);
    }
    async getInspectionTrends(tenantId, months = 12) {
        return this.analyticsService.getInspectionTrends(tenantId, months);
    }
    async getVendorRiskRanking(tenantId) {
        return this.analyticsService.getVendorRiskRanking(tenantId);
    }
    async getExecutiveDashboard(tenantId) {
        return this.analyticsService.getExecutiveDashboard(tenantId);
    }
};
exports.AnalyticsController = AnalyticsController;
__decorate([
    (0, common_1.Get)('dashboard/metrics'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.MANAGER, user_entity_1.UserRole.OWNER, user_entity_1.UserRole.SUPERVISOR),
    __param(0, (0, common_1.Query)('tenantId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getDashboardMetrics", null);
__decorate([
    (0, common_1.Get)('dashboard/factory-comparison'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.MANAGER, user_entity_1.UserRole.OWNER, user_entity_1.UserRole.SUPERVISOR),
    __param(0, (0, common_1.Query)('tenantId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getFactoryComparison", null);
__decorate([
    (0, common_1.Get)('dashboard/inspection-trends'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.MANAGER, user_entity_1.UserRole.OWNER, user_entity_1.UserRole.SUPERVISOR),
    __param(0, (0, common_1.Query)('tenantId')),
    __param(1, (0, common_1.Query)('months')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getInspectionTrends", null);
__decorate([
    (0, common_1.Get)('dashboard/vendor-risk-ranking'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.MANAGER, user_entity_1.UserRole.OWNER, user_entity_1.UserRole.SUPERVISOR),
    __param(0, (0, common_1.Query)('tenantId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getVendorRiskRanking", null);
__decorate([
    (0, common_1.Get)('dashboard/executive'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.MANAGER, user_entity_1.UserRole.OWNER),
    __param(0, (0, common_1.Query)('tenantId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getExecutiveDashboard", null);
exports.AnalyticsController = AnalyticsController = __decorate([
    (0, common_1.Controller)('analytics'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, role_guard_1.RoleGuard),
    __metadata("design:paramtypes", [analytics_service_1.AnalyticsService])
], AnalyticsController);
//# sourceMappingURL=analytics.controller.js.map