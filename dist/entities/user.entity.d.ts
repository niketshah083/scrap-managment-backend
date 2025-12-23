import { Tenant } from './tenant.entity';
import { Factory } from './factory.entity';
import { AuditLog } from './audit-log.entity';
export declare enum UserRole {
    SECURITY = "Security",
    INSPECTOR = "Inspector",
    SUPERVISOR = "Supervisor",
    MANAGER = "Manager",
    OWNER = "Owner"
}
export declare class User {
    id: string;
    tenantId: string;
    factoryId: string;
    email: string;
    passwordHash: string;
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
    tenant: Tenant;
    factory: Factory;
    auditLogs: AuditLog[];
}
