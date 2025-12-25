import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Tenant } from "../entities/tenant.entity";
import { AuthService } from "../auth/auth.service";

export interface CreateTenantDto {
  companyName: string;
  gstNumber: string;
  panNumber: string;
  email: string;
  phone?: string;
  address?: string;
  subscriptionPlan?: string;
}

export interface TenantWithAdmin {
  tenant: Tenant;
  adminCredentials: {
    email: string;
    defaultPassword: string;
    message: string;
  };
}

@Injectable()
export class TenantService {
  constructor(
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
    private authService: AuthService
  ) {}

  /**
   * Create a new tenant and automatically create a tenant admin user
   */
  async createTenant(dto: CreateTenantDto): Promise<TenantWithAdmin> {
    // Check if tenant with same GST or PAN already exists
    const existingTenant = await this.tenantRepository.findOne({
      where: [
        { gstNumber: dto.gstNumber },
        { panNumber: dto.panNumber },
        { email: dto.email },
      ],
    });

    if (existingTenant) {
      if (existingTenant.gstNumber === dto.gstNumber) {
        throw new BadRequestException(
          "Tenant with this GST number already exists"
        );
      }
      if (existingTenant.panNumber === dto.panNumber) {
        throw new BadRequestException(
          "Tenant with this PAN number already exists"
        );
      }
      if (existingTenant.email === dto.email) {
        throw new BadRequestException("Tenant with this email already exists");
      }
    }

    // Create the tenant
    const tenant = this.tenantRepository.create({
      ...dto,
      subscriptionPlan: dto.subscriptionPlan || "TRIAL",
      isActive: true,
    });

    const savedTenant = await this.tenantRepository.save(tenant);

    // Auto-create tenant admin user
    await this.authService.createTenantAdmin(
      savedTenant.id,
      savedTenant.email,
      savedTenant.companyName
    );

    return {
      tenant: savedTenant,
      adminCredentials: {
        email: savedTenant.email,
        defaultPassword: "TenantAdmin@123",
        message: "Please change the default password on first login",
      },
    };
  }

  async findById(id: string): Promise<Tenant | null> {
    return await this.tenantRepository.findOne({
      where: { id },
      relations: ["factories", "users"],
    });
  }

  async findAll(): Promise<Tenant[]> {
    return await this.tenantRepository.find({
      where: { isActive: true },
      order: { createdAt: "DESC" },
    });
  }

  async updateTenant(
    id: string,
    dto: Partial<CreateTenantDto>
  ): Promise<Tenant> {
    const tenant = await this.findById(id);
    if (!tenant) {
      throw new NotFoundException("Tenant not found");
    }

    await this.tenantRepository.update(id, dto);
    return (await this.findById(id)) as Tenant;
  }

  async deactivateTenant(id: string): Promise<void> {
    const tenant = await this.findById(id);
    if (!tenant) {
      throw new NotFoundException("Tenant not found");
    }

    await this.tenantRepository.update(id, { isActive: false });
  }
}
