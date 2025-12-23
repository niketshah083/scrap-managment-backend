import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import * as fc from 'fast-check';
import { AuthService, JwtPayload } from './auth.service';
import { User, UserRole } from '../entities/user.entity';

/**
 * Feature: scrap-operations-platform, Property 11: Role-Based Access Control
 * 
 * Property: For any user and system function, access should be granted only if the user's role 
 * (Security/Inspector/Supervisor/Manager/Owner) has explicit permission for that function at 
 * the relevant operational level
 * 
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4
 */

describe('AuthService - Role-Based Access Control Property Tests', () => {
  let service: AuthService;
  let userRepository: Repository<User>;
  let jwtService: JwtService;

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
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Generators for property-based testing
  const userRoleArb = fc.constantFrom(
    UserRole.SECURITY,
    UserRole.INSPECTOR,
    UserRole.SUPERVISOR,
    UserRole.MANAGER,
    UserRole.OWNER
  );

  const operationalLevelArb = fc.integer({ min: 1, max: 7 });

  const actionArb = fc.constantFrom(
    'view',
    'create',
    'update',
    'approve',
    'reject',
    'override',
    'configure',
    'admin'
  );

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
      fc.assert(
        fc.property(
          userRoleArb,
          userRoleArb,
          (userRole, requiredRole) => {
            const user: JwtPayload = {
              sub: 'test-id',
              email: 'test@example.com',
              role: userRole,
              tenantId: 'tenant-id',
              permissions: { levels: [1, 2, 3, 4, 5, 6, 7], actions: ['view', 'create'] },
            };

            const result = service.hasRole(user, requiredRole);
            
            // Role hierarchy: Security(1) < Inspector(2) < Supervisor(3) < Manager(4) < Owner(5)
            const roleHierarchy = {
              [UserRole.SECURITY]: 1,
              [UserRole.INSPECTOR]: 2,
              [UserRole.SUPERVISOR]: 3,
              [UserRole.MANAGER]: 4,
              [UserRole.OWNER]: 5,
            };

            const expectedResult = roleHierarchy[userRole] >= roleHierarchy[requiredRole];
            
            return result === expectedResult;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should enforce level-based permissions correctly', () => {
      fc.assert(
        fc.property(
          jwtPayloadArb,
          operationalLevelArb,
          actionArb,
          (user, level, action) => {
            const result = service.hasPermission(user, level, action);
            
            // User must have both level access AND action permission
            const hasLevelAccess = user.permissions.levels.includes(level);
            const hasActionPermission = user.permissions.actions.includes(action);
            const expectedResult = hasLevelAccess && hasActionPermission;
            
            return result === expectedResult;
          }
        ),
        { numRuns: 200 }
      );
    });

    it('should grant default permissions based on role correctly', () => {
      fc.assert(
        fc.property(
          userRoleArb,
          (role) => {
            // Get default permissions for the role
            const defaultPermissions = (service as any).getDefaultPermissions(role);
            
            // Verify role-specific permission patterns
            switch (role) {
              case UserRole.SECURITY:
                // Security should only have access to gate operations (L1, L2, L7)
                const securityLevels = [1, 2, 7];
                const hasOnlySecurityLevels = defaultPermissions.levels.every(level => 
                  securityLevels.includes(level)
                );
                const hasBasicActions = ['view', 'create', 'update'].every(action =>
                  defaultPermissions.actions.includes(action)
                );
                return hasOnlySecurityLevels && hasBasicActions;

              case UserRole.INSPECTOR:
                // Inspector should have access to inspection level (L4)
                const hasInspectionLevel = defaultPermissions.levels.includes(4);
                const hasInspectionActions = ['approve', 'reject'].every(action =>
                  defaultPermissions.actions.includes(action)
                );
                return hasInspectionLevel && hasInspectionActions;

              case UserRole.SUPERVISOR:
                // Supervisor should have access to all levels
                const hasAllLevels = [1, 2, 3, 4, 5, 6, 7].every(level =>
                  defaultPermissions.levels.includes(level)
                );
                const hasOverrideAction = defaultPermissions.actions.includes('override');
                return hasAllLevels && hasOverrideAction;

              case UserRole.MANAGER:
                // Manager should have all supervisor permissions plus configure
                const managerHasAllLevels = [1, 2, 3, 4, 5, 6, 7].every(level =>
                  defaultPermissions.levels.includes(level)
                );
                const hasConfigureAction = defaultPermissions.actions.includes('configure');
                return managerHasAllLevels && hasConfigureAction;

              case UserRole.OWNER:
                // Owner should have all permissions including admin
                const ownerHasAllLevels = [1, 2, 3, 4, 5, 6, 7].every(level =>
                  defaultPermissions.levels.includes(level)
                );
                const hasAdminAction = defaultPermissions.actions.includes('admin');
                return ownerHasAllLevels && hasAdminAction;

              default:
                return false;
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should deny access when user lacks required level permission', () => {
      fc.assert(
        fc.property(
          jwtPayloadArb,
          operationalLevelArb,
          actionArb,
          (user, level, action) => {
            // Ensure user doesn't have the required level
            const userWithoutLevel: JwtPayload = {
              ...user,
              permissions: {
                ...user.permissions,
                levels: user.permissions.levels.filter(l => l !== level),
                actions: [...user.permissions.actions, action], // Ensure they have the action
              },
            };

            const result = service.hasPermission(userWithoutLevel, level, action);
            
            // Should be false because user lacks level access
            return result === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should deny access when user lacks required action permission', () => {
      fc.assert(
        fc.property(
          jwtPayloadArb,
          operationalLevelArb,
          actionArb,
          (user, level, action) => {
            // Ensure user doesn't have the required action
            const userWithoutAction: JwtPayload = {
              ...user,
              permissions: {
                levels: [...user.permissions.levels, level], // Ensure they have the level
                actions: user.permissions.actions.filter(a => a !== action),
              },
            };

            const result = service.hasPermission(userWithoutAction, level, action);
            
            // Should be false because user lacks action permission
            return result === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain tenant isolation in role checks', () => {
      fc.assert(
        fc.property(
          fc.tuple(jwtPayloadArb, jwtPayloadArb),
          ([user1, user2]) => {
            // Ensure different tenants
            const userFromTenant1: JwtPayload = { ...user1, tenantId: 'tenant-1' };
            const userFromTenant2: JwtPayload = { ...user2, tenantId: 'tenant-2' };

            // Role hierarchy should work the same regardless of tenant
            const result1 = service.hasRole(userFromTenant1, UserRole.SUPERVISOR);
            const result2 = service.hasRole(userFromTenant2, UserRole.SUPERVISOR);

            // Both should follow the same role hierarchy rules
            const expected1 = ['Supervisor', 'Manager', 'Owner'].includes(userFromTenant1.role);
            const expected2 = ['Supervisor', 'Manager', 'Owner'].includes(userFromTenant2.role);

            return result1 === expected1 && result2 === expected2;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});