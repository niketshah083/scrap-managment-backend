import { AnalyticsService } from './analytics.service';
export declare class AnalyticsController {
    private readonly analyticsService;
    constructor(analyticsService: AnalyticsService);
    getDashboardMetrics(tenantId: string): Promise<import("./analytics.service").DashboardMetrics>;
    getFactoryComparison(tenantId: string): Promise<import("./analytics.service").FactoryComparison[]>;
    getInspectionTrends(tenantId: string, months?: number): Promise<import("./analytics.service").InspectionTrend[]>;
    getVendorRiskRanking(tenantId: string): Promise<import("./analytics.service").VendorRiskRanking>;
    getExecutiveDashboard(tenantId: string): Promise<{
        metrics: import("./analytics.service").DashboardMetrics;
        factoryComparison: import("./analytics.service").FactoryComparison[];
        inspectionTrends: import("./analytics.service").InspectionTrend[];
        vendorRiskRanking: import("./analytics.service").VendorRiskRanking;
    }>;
}
