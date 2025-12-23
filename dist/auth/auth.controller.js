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
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("./auth.service");
const auth_demo_service_1 = require("./auth-demo.service");
const jwt_auth_guard_1 = require("./guards/jwt-auth.guard");
const role_guard_1 = require("./guards/role.guard");
const roles_decorator_1 = require("./decorators/roles.decorator");
const public_decorator_1 = require("./decorators/public.decorator");
const user_entity_1 = require("../entities/user.entity");
let AuthController = class AuthController {
    constructor(authService, authDemoService) {
        this.authService = authService;
        this.authDemoService = authDemoService;
    }
    async login(loginDto) {
        return await this.authService.login(loginDto);
    }
    async register(registerDto) {
        const user = await this.authService.register(registerDto);
        const { passwordHash, ...result } = user;
        return result;
    }
    async getProfile(req) {
        const user = await this.authService.findById(req.user.sub);
        if (!user) {
            return null;
        }
        const { passwordHash, ...result } = user;
        return result;
    }
    async updatePermissions(userId, permissions) {
        const user = await this.authService.updatePermissions(userId, permissions);
        const { passwordHash, ...result } = user;
        return result;
    }
    async setupDemoData() {
        await this.authDemoService.createDemoData();
        return {
            message: 'Demo data created successfully',
            users: [
                { email: 'owner@scrapindustries.com', password: 'owner123', role: 'Owner' },
                { email: 'manager@scrapindustries.com', password: 'manager123', role: 'Manager' },
                { email: 'supervisor@scrapindustries.com', password: 'supervisor123', role: 'Supervisor' },
                { email: 'inspector@scrapindustries.com', password: 'inspector123', role: 'Inspector' },
                { email: 'security@scrapindustries.com', password: 'security123', role: 'Security' },
            ]
        };
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)('login'),
    (0, public_decorator_1.Public)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Post)('register'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, role_guard_1.RoleGuard),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.OWNER, user_entity_1.UserRole.MANAGER),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "register", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "getProfile", null);
__decorate([
    (0, common_1.Patch)('users/:id/permissions'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, role_guard_1.RoleGuard),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.OWNER, user_entity_1.UserRole.MANAGER),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "updatePermissions", null);
__decorate([
    (0, common_1.Post)('demo/setup'),
    (0, public_decorator_1.Public)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "setupDemoData", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        auth_demo_service_1.AuthDemoService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map