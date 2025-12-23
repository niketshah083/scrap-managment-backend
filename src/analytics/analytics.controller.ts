import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../auth/guards/role.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RoleGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard/metrics')
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.SUPERVISOR)
  async getDashboardMetrics(@Query('tenantId') tenantId: string) {
    return this.analyticsService.getDashboardMetrics(tenantId);
  }

  @Get('dashboard/factory-comparison')
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.SUPERVISOR)
  async getFactoryComparison(@Query('tenantId') tenantId: string) {
    return this.analyticsService.getFactoryComparison(tenantId);
  }

  @Get('dashboard/inspection-trends')
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.SUPERVISOR)
  async getInspectionTrends(
    @Query('tenantId') tenantId: string,
    @Query('months') months: number = 12,
  ) {
    return this.analyticsService.getInspectionTrends(tenantId, months);
  }

  @Get('dashboard/vendor-risk-ranking')
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.SUPERVISOR)
  async getVendorRiskRanking(@Query('tenantId') tenantId: string) {
    return this.analyticsService.getVendorRiskRanking(tenantId);
  }

  @Get('dashboard/executive')
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  async getExecutiveDashboard(@Query('tenantId') tenantId: string) {
    return this.analyticsService.getExecutiveDashboard(tenantId);
  }
}