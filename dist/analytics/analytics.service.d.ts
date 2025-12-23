import { Repository } from 'typeorm';
import { Transaction } from '../entities/transaction.entity';
import { Vendor } from '../entities/vendor.entity';
import { VendorService } from '../vendor/vendor.service';
export interface DashboardMetrics {
    todayInward: {
        count: number;
        weight: number;
    };
    totalWeight: {
        value: number;
        trend: string;
    };
    pendingInspections: {
        count: number;
        urgent: number;
    };
    rejectedMaterials: {
        count: number;
        trend: string;
    };
}
export interface FactoryComparison {
    factoryId: string;
    factoryName: string;
    todayCount: number;
    todayWeight: number;
    percentage: number;
}
export interface InspectionTrend {
    period: string;
    rejectionRate: number;
    evidenceCompliance: number;
}
export interface VendorRiskRanking {
    highRisk: Array<{
        vendorName: string;
        rejectionRate: number;
    }>;
    mediumRisk: Array<{
        vendorName: string;
        rejectionRate: number;
    }>;
    lowRisk: Array<{
        vendorName: string;
        rejectionRate: number;
    }>;
}
export declare class AnalyticsService {
    private transactionRepository;
    private vendorRepository;
    private vendorService;
    constructor(transactionRepository: Repository<Transaction>, vendorRepository: Repository<Vendor>, vendorService: VendorService);
    getDashboardMetrics(tenantId: string): Promise<DashboardMetrics>;
    getFactoryComparison(tenantId: string): Promise<FactoryComparison[]>;
    getInspectionTrends(tenantId: string, months?: number): Promise<InspectionTrend[]>;
    getVendorRiskRanking(tenantId: string): Promise<VendorRiskRanking>;
    getExecutiveDashboard(tenantId: string): Promise<{
        metrics: DashboardMetrics;
        factoryComparison: FactoryComparison[];
        inspectionTrends: InspectionTrend[];
        vendorRiskRanking: VendorRiskRanking;
    }>;
}
