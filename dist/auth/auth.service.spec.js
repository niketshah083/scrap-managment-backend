"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const typeorm_1 = require("@nestjs/typeorm");
const jwt_1 = require("@nestjs/jwt");
const fc = require("fast-check");
const auth_service_1 = require("./auth.service");
const user_entity_1 = require("../entities/user.entity");
describe('AuthService - Role-Based Access Control Property Tests', () => {
    let service;
    let userRepository;
    let jwtService;
    const mockUserRepository = {
        findOne: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
    };
    const mockJwtService = {
        sign: jest.fn(),
    };
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                auth_service_1.AuthService,
                {
                    provide: (0, typeorm_1.getRepositoryToken)(user_entity_1.User),
                    useValue: mockUserRepository,
                },
                {
                    provide: jwt_1.JwtService,
                    useValue: mockJwtService,
                },
            ],
        }).compile();
        service = module.get(auth_service_1.AuthService);
        userRepository = module.get((0, typeorm_1.getRepositoryToken)(user_entity_1.User));
        jwtService = module.get(jwt_1.JwtService);
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    const userRoleArb = fc.constantFrom(user_entity_1.UserRole.SECURITY, user_entity_1.UserRole.INSPECTOR, user_entity_1.UserRole.SUPERVISOR, user_entity_1.UserRole.MANAGER, user_entity_1.UserRole.OWNER);
    const operationalLevelArb = fc.integer({ min: 1, max: 7 });
    const actionArb = fc.constantFrom('view', 'create', 'update', 'approve', 'reject', 'override', 'configure', 'admin');
    const jwtPayloadArb = fc.record({
        sub: fc.uuid(),
        email: fc.emailAddress(),
        role: userRoleArb,
        tenantId: fc.uuid(),
        factoryId: fc.option(fc.uuid()),
        permissions: fc.record({
            levels: fc.array(operationalLevelArb, { minLength: 0, maxLength: 7 }),
            actions: fc.array(actionArb, { minLength: 0, maxLength: 8 }),
        }),
    });
    describe('Property 11: Role-Based Access Control', () => {
        it('should enforce role hierarchy correctly', () => {
            fc.assert(fc.property(userRoleArb, userRoleArb, (userRole, requiredRole) => {
                const user = {
                    sub: 'test-id',
                    email: 'test@example.com',
                    role: userRole,
                    tenantId: 'tenant-id',
                    permissions: { levels: [1, 2, 3, 4, 5, 6, 7], actions: ['view', 'create'] },
                };
                const result = service.hasRole(user, requiredRole);
                const roleHierarchy = {
                    [user_entity_1.UserRole.SECURITY]: 1,
                    [user_entity_1.UserRole.INSPECTOR]: 2,
                    [user_entity_1.UserRole.SUPERVISOR]: 3,
                    [user_entity_1.UserRole.MANAGER]: 4,
                    [user_entity_1.UserRole.OWNER]: 5,
                };
                const expectedResult = roleHierarchy[userRole] >= roleHierarchy[requiredRole];
                return result === expectedResult;
            }), { numRuns: 100 });
        });
        it('should enforce level-based permissions correctly', () => {
            fc.assert(fc.property(jwtPayloadArb, operationalLevelArb, actionArb, (user, level, action) => {
                const result = service.hasPermission(user, level, action);
                const hasLevelAccess = user.permissions.levels.includes(level);
                const hasActionPermission = user.permissions.actions.includes(action);
                const expectedResult = hasLevelAccess && hasActionPermission;
                return result === expectedResult;
            }), { numRuns: 200 });
        });
        it('should grant default permissions based on role correctly', () => {
            fc.assert(fc.property(userRoleArb, (role) => {
                const defaultPermissions = service.getDefaultPermissions(role);
                switch (role) {
                    case user_entity_1.UserRole.SECURITY:
                        const securityLevels = [1, 2, 7];
                        const hasOnlySecurityLevels = defaultPermissions.levels.every(level => securityLevels.includes(level));
                        const hasBasicActions = ['view', 'create', 'update'].every(action => defaultPermissions.actions.includes(action));
                        return hasOnlySecurityLevels && hasBasicActions;
                    case user_entity_1.UserRole.INSPECTOR:
                        const hasInspectionLevel = defaultPermissions.levels.includes(4);
                        const hasInspectionActions = ['approve', 'reject'].every(action => defaultPermissions.actions.includes(action));
                        return hasInspectionLevel && hasInspectionActions;
                    case user_entity_1.UserRole.SUPERVISOR:
                        const hasAllLevels = [1, 2, 3, 4, 5, 6, 7].every(level => defaultPermissions.levels.includes(level));
                        const hasOverrideAction = defaultPermissions.actions.includes('override');
                        return hasAllLevels && hasOverrideAction;
                    case user_entity_1.UserRole.MANAGER:
                        const managerHasAllLevels = [1, 2, 3, 4, 5, 6, 7].every(level => defaultPermissions.levels.includes(level));
                        const hasConfigureAction = defaultPermissions.actions.includes('configure');
                        return managerHasAllLevels && hasConfigureAction;
                    case user_entity_1.UserRole.OWNER:
                        const ownerHasAllLevels = [1, 2, 3, 4, 5, 6, 7].every(level => defaultPermissions.levels.includes(level));
                        const hasAdminAction = defaultPermissions.actions.includes('admin');
                        return ownerHasAllLevels && hasAdminAction;
                    default:
                        return false;
                }
            }), { numRuns: 50 });
        });
        it('should deny access when user lacks required level permission', () => {
            fc.assert(fc.property(jwtPayloadArb, operationalLevelArb, actionArb, (user, level, action) => {
                const userWithoutLevel = {
                    ...user,
                    permissions: {
                        ...user.permissions,
                        levels: user.permissions.levels.filter(l => l !== level),
                        actions: [...user.permissions.actions, action],
                    },
                };
                const result = service.hasPermission(userWithoutLevel, level, action);
                return result === false;
            }), { numRuns: 100 });
        });
        it('should deny access when user lacks required action permission', () => {
            fc.assert(fc.property(jwtPayloadArb, operationalLevelArb, actionArb, (user, level, action) => {
                const userWithoutAction = {
                    ...user,
                    permissions: {
                        levels: [...user.permissions.levels, level],
                        actions: user.permissions.actions.filter(a => a !== action),
                    },
                };
                const result = service.hasPermission(userWithoutAction, level, action);
                return result === false;
            }), { numRuns: 100 });
        });
        it('should maintain tenant isolation in role checks', () => {
            fc.assert(fc.property(fc.tuple(jwtPayloadArb, jwtPayloadArb), ([user1, user2]) => {
                const userFromTenant1 = { ...user1, tenantId: 'tenant-1' };
                const userFromTenant2 = { ...user2, tenantId: 'tenant-2' };
                const result1 = service.hasRole(userFromTenant1, user_entity_1.UserRole.SUPERVISOR);
                const result2 = service.hasRole(userFromTenant2, user_entity_1.UserRole.SUPERVISOR);
                const expected1 = ['Supervisor', 'Manager', 'Owner'].includes(userFromTenant1.role);
                const expected2 = ['Supervisor', 'Manager', 'Owner'].includes(userFromTenant2.role);
                return result1 === expected1 && result2 === expected2;
            }), { numRuns: 100 });
        });
    });
});
//# sourceMappingURL=auth.service.spec.js.map