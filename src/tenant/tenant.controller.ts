import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from "@nestjs/common";
import {
  TenantService,
  CreateTenantDto,
  TenantWithAdmin,
} from "./tenant.service";
import { Tenant } from "../entities/tenant.entity";

@Controller("tenants")
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  /**
   * Create a new tenant with auto-generated tenant admin
   * POST /tenants
   */
  @Post()
  async createTenant(@Body() dto: CreateTenantDto): Promise<TenantWithAdmin> {
    return await this.tenantService.createTenant(dto);
  }

  /**
   * Get all active tenants
   * GET /tenants
   */
  @Get()
  async findAll(): Promise<Tenant[]> {
    return await this.tenantService.findAll();
  }

  /**
   * Get tenant by ID
   * GET /tenants/:id
   */
  @Get(":id")
  async findById(@Param("id") id: string): Promise<Tenant | null> {
    return await this.tenantService.findById(id);
  }

  /**
   * Update tenant
   * PUT /tenants/:id
   */
  @Put(":id")
  async updateTenant(
    @Param("id") id: string,
    @Body() dto: Partial<CreateTenantDto>
  ): Promise<Tenant> {
    return await this.tenantService.updateTenant(id, dto);
  }

  /**
   * Deactivate tenant
   * DELETE /tenants/:id
   */
  @Delete(":id")
  async deactivateTenant(
    @Param("id") id: string
  ): Promise<{ message: string }> {
    await this.tenantService.deactivateTenant(id);
    return { message: "Tenant deactivated successfully" };
  }
}
