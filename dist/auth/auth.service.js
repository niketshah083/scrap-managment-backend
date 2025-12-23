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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = require("bcryptjs");
const user_entity_1 = require("../entities/user.entity");
let AuthService = class AuthService {
    constructor(userRepository, jwtService) {
        this.userRepository = userRepository;
        this.jwtService = jwtService;
    }
    async validateUser(email, password) {
        const user = await this.userRepository.findOne({
            where: { email, isActive: true },
        });
        if (user && await bcrypt.compare(password, user.passwordHash)) {
            return user;
        }
        return null;
    }
    async login(loginDto) {
        const user = await this.validateUser(loginDto.email, loginDto.password);
        if (!user) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        await this.userRepository.update(user.id, {
            lastLoginAt: new Date(),
            lastLoginIp: '127.0.0.1',
        });
        const payload = {
            sub: user.id,
            email: user.email,
            role: user.role,
            tenantId: user.tenantId,
            factoryId: user.factoryId,
            permissions: user.permissions || { levels: [], actions: [] },
        };
        const token = this.jwtService.sign(payload);
        return {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                tenantId: user.tenantId,
                factoryId: user.factoryId,
                permissions: user.permissions || { levels: [], actions: [] },
            },
            token,
            expiresIn: '24h',
        };
    }
    async register(registerDto) {
        const existingUser = await this.userRepository.findOne({
            where: { email: registerDto.email },
        });
        if (existingUser) {
            throw new common_1.BadRequestException('User with this email already exists');
        }
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(registerDto.password, saltRounds);
        const defaultPermissions = this.getDefaultPermissions(registerDto.role);
        const user = this.userRepository.create({
            ...registerDto,
            passwordHash,
            permissions: registerDto.permissions || defaultPermissions,
        });
        return await this.userRepository.save(user);
    }
    async findById(id) {
        return await this.userRepository.findOne({
            where: { id, isActive: true },
        });
    }
    async updatePermissions(userId, permissions) {
        await this.userRepository.update(userId, { permissions });
        const user = await this.findById(userId);
        if (!user) {
            throw new common_1.BadRequestException('User not found');
        }
        return user;
    }
    getDefaultPermissions(role) {
        switch (role) {
            case user_entity_1.UserRole.SECURITY:
                return {
                    levels: [1, 2, 7],
                    actions: ['view', 'create', 'update'],
                };
            case user_entity_1.UserRole.INSPECTOR:
                return {
                    levels: [4],
                    actions: ['view', 'create', 'update', 'approve', 'reject'],
                };
            case user_entity_1.UserRole.SUPERVISOR:
                return {
                    levels: [1, 2, 3, 4, 5, 6, 7],
                    actions: ['view', 'create', 'update', 'approve', 'reject', 'override'],
                };
            case user_entity_1.UserRole.MANAGER:
                return {
                    levels: [1, 2, 3, 4, 5, 6, 7],
                    actions: ['view', 'create', 'update', 'approve', 'reject', 'override', 'configure'],
                };
            case user_entity_1.UserRole.OWNER:
                return {
                    levels: [1, 2, 3, 4, 5, 6, 7],
                    actions: ['view', 'create', 'update', 'approve', 'reject', 'override', 'configure', 'admin'],
                };
            default:
                return { levels: [], actions: ['view'] };
        }
    }
    hasPermission(user, level, action) {
        if (!user.permissions.levels.includes(level)) {
            return false;
        }
        if (!user.permissions.actions.includes(action)) {
            return false;
        }
        return true;
    }
    hasRole(user, requiredRole) {
        const roleHierarchy = {
            [user_entity_1.UserRole.SECURITY]: 1,
            [user_entity_1.UserRole.INSPECTOR]: 2,
            [user_entity_1.UserRole.SUPERVISOR]: 3,
            [user_entity_1.UserRole.MANAGER]: 4,
            [user_entity_1.UserRole.OWNER]: 5,
        };
        return roleHierarchy[user.role] >= roleHierarchy[requiredRole];
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map