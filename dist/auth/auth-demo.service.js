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
exports.AuthDemoService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const bcrypt = require("bcryptjs");
const user_entity_1 = require("../entities/user.entity");
const tenant_entity_1 = require("../entities/tenant.entity");
const factory_entity_1 = require("../entities/factory.entity");
let AuthDemoService = class AuthDemoService {
    constructor(userRepository, tenantRepository, factoryRepository) {
        this.userRepository = userRepository;
        this.tenantRepository = tenantRepository;
        this.factoryRepository = factoryRepository;
    }
    async createDemoData() {
        const tenant = this.tenantRepository.create({
            companyName: 'Demo Scrap Industries',
            gstNumber: '27ABCDE1234F1Z5',
            panNumber: 'ABCDE1234F',
            email: 'demo@scrapindustries.com',
            phone: '+91-9876543210',
            address: '123 Industrial Area, Mumbai, Maharashtra 400001',
            subscriptionPlan: 'PREMIUM',
        });
        const savedTenant = await this.tenantRepository.save(tenant);
        const factory = this.factoryRepository.create({
            tenantId: savedTenant.id,
            factoryName: 'Main Processing Unit',
            factoryCode: 'MPU001',
            address: '456 Factory Road, Mumbai, Maharashtra 400002',
            latitude: 19.0760,
            longitude: 72.8777,
            weighbridgeConfig: {
                isIntegrated: true,
                equipmentModel: 'WeighMax Pro 5000',
                connectionType: 'TCP',
                connectionString: '192.168.1.100:502',
            },
        });
        const savedFactory = await this.factoryRepository.save(factory);
        const users = [
            {
                email: 'owner@scrapindustries.com',
                password: 'owner123',
                name: 'John Owner',
                role: user_entity_1.UserRole.OWNER,
                phone: '+91-9876543211',
            },
            {
                email: 'manager@scrapindustries.com',
                password: 'manager123',
                name: 'Jane Manager',
                role: user_entity_1.UserRole.MANAGER,
                phone: '+91-9876543212',
            },
            {
                email: 'supervisor@scrapindustries.com',
                password: 'supervisor123',
                name: 'Bob Supervisor',
                role: user_entity_1.UserRole.SUPERVISOR,
                phone: '+91-9876543213',
            },
            {
                email: 'inspector@scrapindustries.com',
                password: 'inspector123',
                name: 'Alice Inspector',
                role: user_entity_1.UserRole.INSPECTOR,
                phone: '+91-9876543214',
            },
            {
                email: 'security@scrapindustries.com',
                password: 'security123',
                name: 'Mike Security',
                role: user_entity_1.UserRole.SECURITY,
                phone: '+91-9876543215',
            },
        ];
        for (const userData of users) {
            const existingUser = await this.userRepository.findOne({
                where: { email: userData.email },
            });
            if (!existingUser) {
                const passwordHash = await bcrypt.hash(userData.password, 12);
                const user = this.userRepository.create({
                    ...userData,
                    passwordHash,
                    tenantId: savedTenant.id,
                    factoryId: savedFactory.id,
                    permissions: this.getDefaultPermissions(userData.role),
                });
                await this.userRepository.save(user);
            }
        }
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
};
exports.AuthDemoService = AuthDemoService;
exports.AuthDemoService = AuthDemoService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(tenant_entity_1.Tenant)),
    __param(2, (0, typeorm_1.InjectRepository)(factory_entity_1.Factory)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], AuthDemoService);
//# sourceMappingURL=auth-demo.service.js.map