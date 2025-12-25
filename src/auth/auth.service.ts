import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { User, UserRole } from "../entities/user.entity";

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  name: string;
  phone?: string;
  role: UserRole;
  tenantId: string;
  factoryId?: string;
  permissions?: {
    levels: number[];
    actions: string[];
  };
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  tenantId: string;
  factoryId?: string;
  permissions: {
    levels: number[];
    actions: string[];
  };
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    tenantId: string;
    factoryId?: string;
    permissions: {
      levels: number[];
      actions: string[];
    };
  };
  token: string;
  expiresIn: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: { email, isActive: true },
    });

    if (user && (await bcrypt.compare(password, user.passwordHash))) {
      return user;
    }
    return null;
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    // Update last login info
    await this.userRepository.update(user.id, {
      lastLoginAt: new Date(),
      // Note: In a real app, you'd get the IP from the request
      lastLoginIp: "127.0.0.1",
    });

    const payload: JwtPayload = {
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
      expiresIn: "24h",
    };
  }

  async register(registerDto: RegisterDto): Promise<User> {
    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new BadRequestException("User with this email already exists");
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(registerDto.password, saltRounds);

    // Set default permissions based on role
    const defaultPermissions = this.getDefaultPermissions(registerDto.role);

    const user = this.userRepository.create({
      ...registerDto,
      passwordHash,
      permissions: registerDto.permissions || defaultPermissions,
    });

    return await this.userRepository.save(user);
  }

  async findById(id: string): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { id, isActive: true },
    });
  }

  async updatePermissions(
    userId: string,
    permissions: { levels: number[]; actions: string[] }
  ): Promise<User> {
    await this.userRepository.update(userId, { permissions });
    const user = await this.findById(userId);
    if (!user) {
      throw new BadRequestException("User not found");
    }
    return user;
  }

  private getDefaultPermissions(role: UserRole): {
    levels: number[];
    actions: string[];
  } {
    switch (role) {
      case UserRole.TENANT_ADMIN:
        return {
          levels: [1, 2, 3, 4, 5, 6, 7], // All levels
          actions: [
            "view",
            "create",
            "update",
            "delete",
            "approve",
            "reject",
            "override",
            "configure",
            "admin",
            "manage_users",
            "manage_settings",
          ],
        };
      case UserRole.SECURITY:
        return {
          levels: [1, 2, 7], // Gate Entry, Gate Pass/Exit
          actions: ["view", "create", "update"],
        };
      case UserRole.INSPECTOR:
        return {
          levels: [4], // Material Inspection
          actions: ["view", "create", "update", "approve", "reject"],
        };
      case UserRole.SUPERVISOR:
        return {
          levels: [1, 2, 3, 4, 5, 6, 7], // All levels
          actions: [
            "view",
            "create",
            "update",
            "approve",
            "reject",
            "override",
          ],
        };
      case UserRole.MANAGER:
        return {
          levels: [1, 2, 3, 4, 5, 6, 7], // All levels
          actions: [
            "view",
            "create",
            "update",
            "approve",
            "reject",
            "override",
            "configure",
          ],
        };
      case UserRole.OWNER:
        return {
          levels: [1, 2, 3, 4, 5, 6, 7], // All levels
          actions: [
            "view",
            "create",
            "update",
            "approve",
            "reject",
            "override",
            "configure",
            "admin",
          ],
        };
      default:
        return { levels: [], actions: ["view"] };
    }
  }

  /**
   * Create a default tenant admin user when a new tenant is created
   * @param tenantId - The ID of the newly created tenant
   * @param tenantEmail - The email of the tenant (used as admin email)
   * @param companyName - The company name for generating admin name
   * @returns The created tenant admin user
   */
  async createTenantAdmin(
    tenantId: string,
    tenantEmail: string,
    companyName: string
  ): Promise<User> {
    // Check if tenant admin already exists for this tenant
    const existingAdmin = await this.userRepository.findOne({
      where: { tenantId, role: UserRole.TENANT_ADMIN },
    });

    if (existingAdmin) {
      return existingAdmin;
    }

    // Default password for tenant admin (should be changed on first login)
    const defaultPassword = "TenantAdmin@123";
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(defaultPassword, saltRounds);

    const tenantAdmin = this.userRepository.create({
      tenantId,
      email: tenantEmail,
      passwordHash,
      name: `${companyName} Admin`,
      role: UserRole.TENANT_ADMIN,
      permissions: this.getDefaultPermissions(UserRole.TENANT_ADMIN),
      isActive: true,
    });

    return await this.userRepository.save(tenantAdmin);
  }

  hasPermission(user: JwtPayload, level: number, action: string): boolean {
    // Check if user has access to the operational level
    if (!user.permissions.levels.includes(level)) {
      return false;
    }

    // Check if user has the required action permission
    if (!user.permissions.actions.includes(action)) {
      return false;
    }

    return true;
  }

  hasRole(user: JwtPayload, requiredRole: UserRole): boolean {
    const roleHierarchy = {
      [UserRole.SECURITY]: 1,
      [UserRole.INSPECTOR]: 2,
      [UserRole.SUPERVISOR]: 3,
      [UserRole.MANAGER]: 4,
      [UserRole.OWNER]: 5,
      [UserRole.TENANT_ADMIN]: 6, // Highest role for tenant
    };

    return roleHierarchy[user.role] >= roleHierarchy[requiredRole];
  }
}
