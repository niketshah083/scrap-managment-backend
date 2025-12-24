import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../entities/user.entity';
import { Tenant } from '../entities/tenant.entity';
import { Factory } from '../entities/factory.entity';

@Injectable()
export class AuthDemoService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
    @InjectRepository(Factory)
    private factoryRepository: Repository<Factory>,
  ) {}

  async createDemoData(): Promise<void> {
    // Create demo tenant
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

    // Create demo factory
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

    // Create demo users with different roles
    const users = [
      {
        email: 'owner@scrapindustries.com',
        password: 'owner123',
        name: 'John Owner',
        role: UserRole.OWNER,
        phone: '+91-9876543211',
      },
      {
        email: 'manager@scrapindustries.com',
        password: 'manager123',
        name: 'Jane Manager',
        role: UserRole.MANAGER,
        phone: '+91-9876543212',
      },
      {
        email: 'supervisor@scrapindustries.com',
        password: 'supervisor123',
        name: 'Bob Supervisor',
        role: UserRole.SUPERVISOR,
        phone: '+91-9876543213',
      },
      {
        email: 'inspector@scrapindustries.com',
        password: 'inspector123',
        name: 'Alice Inspector',
        role: UserRole.INSPECTOR,
        phone: '+91-9876543214',
      },
      {
        email: 'security@scrapindustries.com',
        password: 'security123',
        name: 'Mike Security',
        role: UserRole.SECURITY,
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

  private getDefaultPermissions(role: UserRole): { levels: number[]; actions: string[] } {
    switch (role) {
      case UserRole.SECURITY:
        return {
          levels: [1, 2, 7], // Gate Entry, Gate Pass/Exit
          actions: ['view', 'create', 'update'],
        };
      case UserRole.INSPECTOR:
        return {
          levels: [4], // Material Inspection
          actions: ['view', 'create', 'update', 'approve', 'reject'],
        };
      case UserRole.SUPERVISOR:
        return {
          levels: [1, 2, 3, 4, 5, 6, 7], // All levels
          actions: ['view', 'create', 'update', 'approve', 'reject', 'override'],
        };
      case UserRole.MANAGER:
        return {
          levels: [1, 2, 3, 4, 5, 6, 7], // All levels
          actions: ['view', 'create', 'update', 'approve', 'reject', 'override', 'configure'],
        };
      case UserRole.OWNER:
        return {
          levels: [1, 2, 3, 4, 5, 6, 7], // All levels
          actions: ['view', 'create', 'update', 'approve', 'reject', 'override', 'configure', 'admin'],
        };
      default:
        return { levels: [], actions: ['view'] };
    }
  }
}