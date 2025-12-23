import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { User, UserRole } from '../entities/user.entity';
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
export declare class AuthService {
    private userRepository;
    private jwtService;
    constructor(userRepository: Repository<User>, jwtService: JwtService);
    validateUser(email: string, password: string): Promise<User | null>;
    login(loginDto: LoginDto): Promise<AuthResponse>;
    register(registerDto: RegisterDto): Promise<User>;
    findById(id: string): Promise<User | null>;
    updatePermissions(userId: string, permissions: {
        levels: number[];
        actions: string[];
    }): Promise<User>;
    private getDefaultPermissions;
    hasPermission(user: JwtPayload, level: number, action: string): boolean;
    hasRole(user: JwtPayload, requiredRole: UserRole): boolean;
}
