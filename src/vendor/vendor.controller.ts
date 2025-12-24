import { Controller, Get, Post, Put, Delete, Param, Query, Body } from '@nestjs/common';
import { VendorService, VendorRiskScoring, VendorTrendAnalysis } from './vendor.service';
import { Vendor } from '../entities/vendor.entity';

export class CreateVendorDto {
  vendorName: string;
  gstNumber: string;
  panNumber: string;
  contactPersonName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  bankName?: string;
  bankAccount?: string;
  ifscCode?: string;
  scrapTypesSupplied?: string[];
  isActive?: boolean;
  isBlacklisted?: boolean;
}

export class UpdateVendorDto extends CreateVendorDto {
  rating?: number;
}

@Controller('vendors')
export class VendorController {
  constructor(private readonly vendorService: VendorService) {}

  @Get()
  async getAllVendors(@Query('tenantId') tenantId: string): Promise<Vendor[]> {
    return this.vendorService.findAll(tenantId || 'test-tenant-1');
  }

  @Get('real-time-metrics')
  async getRealTimeMetrics(@Query('tenantId') tenantId: string) {
    return this.vendorService.getVendorRealTimeMetrics(tenantId || 'test-tenant-1');
  }

  @Get('performance-ranking')
  async getPerformanceRanking(
    @Query('tenantId') tenantId: string,
    @Query('limit') limit?: string,
  ) {
    return this.vendorService.getVendorPerformanceRanking(tenantId || 'test-tenant-1', limit ? parseInt(limit, 10) : 10);
  }

  @Get(':id')
  async getVendorById(
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
  ): Promise<Vendor> {
    return this.vendorService.findOne(id, tenantId || 'test-tenant-1');
  }

  @Get(':id/risk-scoring')
  async getVendorRiskScoring(
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
  ): Promise<VendorRiskScoring> {
    return this.vendorService.calculateVendorRiskScoring(id, tenantId || 'test-tenant-1');
  }

  @Get(':id/trends')
  async getVendorTrends(
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
    @Query('period') period?: 'DAILY' | 'WEEKLY' | 'MONTHLY',
  ): Promise<VendorTrendAnalysis> {
    return this.vendorService.getVendorTrendAnalysis(id, tenantId || 'test-tenant-1', period || 'MONTHLY');
  }

  @Post()
  async createVendor(
    @Body() createVendorDto: CreateVendorDto,
    @Query('tenantId') tenantId: string,
  ): Promise<Vendor> {
    return this.vendorService.create(createVendorDto, tenantId || 'test-tenant-1');
  }

  @Put(':id')
  async updateVendor(
    @Param('id') id: string,
    @Body() updateVendorDto: UpdateVendorDto,
    @Query('tenantId') tenantId: string,
  ): Promise<Vendor> {
    return this.vendorService.update(id, updateVendorDto, tenantId || 'test-tenant-1');
  }

  @Put(':id/toggle-blacklist')
  async toggleBlacklist(
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
    @Body() body: { reason?: string },
  ): Promise<Vendor> {
    return this.vendorService.toggleBlacklist(id, tenantId || 'test-tenant-1', body.reason);
  }

  @Delete(':id')
  async deleteVendor(
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
  ): Promise<void> {
    return this.vendorService.delete(id, tenantId || 'test-tenant-1');
  }

  @Post('seed')
  async seedVendors(@Query('tenantId') tenantId: string): Promise<Vendor[]> {
    return this.vendorService.seedVendors(tenantId || 'test-tenant-1');
  }
}
