import { AuthService, LoginDto, RegisterDto } from './auth.service';
import { AuthDemoService } from './auth-demo.service';
import { UserRole } from '../entities/user.entity';
export declare class AuthController {
    private authService;
    private authDemoService;
    constructor(authService: AuthService, authDemoService: AuthDemoService);
    login(loginDto: LoginDto): Promise<import("./auth.service").AuthResponse>;
    register(registerDto: RegisterDto): Promise<{
        id: string;
        tenantId: string;
        factoryId: string;
        email: string;
        name: string;
        phone: string;
        role: UserRole;
        permissions: {
            levels: number[];
            actions: string[];
        };
        isActive: boolean;
        lastLoginAt: Date;
        lastLoginIp: string;
        createdAt: Date;
        updatedAt: Date;
        tenant: import("../entities").Tenant;
        factory: import("../entities").Factory;
        auditLogs: import("../entities").AuditLog[];
    }>;
    getProfile(req: any): Promise<{
        id: string;
        tenantId: string;
        factoryId: string;
        email: string;
        name: string;
        phone: string;
        role: UserRole;
        permissions: {
            levels: number[];
            actions: string[];
        };
        isActive: boolean;
        lastLoginAt: Date;
        lastLoginIp: string;
        createdAt: Date;
        updatedAt: Date;
        tenant: import("../entities").Tenant;
        factory: import("../entities").Factory;
        auditLogs: import("../entities").AuditLog[];
    }>;
    updatePermissions(userId: string, permissions: {
        levels: number[];
        actions: string[];
    }): Promise<{
        id: string;
        tenantId: string;
        factoryId: string;
        email: string;
        name: string;
        phone: string;
        role: UserRole;
        permissions: {
            levels: number[];
            actions: string[];
        };
        isActive: boolean;
        lastLoginAt: Date;
        lastLoginIp: string;
        createdAt: Date;
        updatedAt: Date;
        tenant: import("../entities").Tenant;
        factory: import("../entities").Factory;
        auditLogs: import("../entities").AuditLog[];
    }>;
    setupDemoData(): Promise<{
        message: string;
        users: {
            email: string;
            password: string;
            role: string;
        }[];
    }>;
}
