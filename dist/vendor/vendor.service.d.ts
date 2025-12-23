import { Repository } from 'typeorm';
import { Vendor } from '../entities/vendor.entity';
import { Transaction } from '../entities/transaction.entity';
export interface VendorPerformanceMetrics {
    rejectionPercentage: number;
    weightDeviationPercentage: number;
    inspectionFailureCount: number;
    totalTransactions: number;
    qualityScore: number;
    avgDeliveryTime: number;
    lastUpdated: Date;
}
export interface VendorRiskScoring {
    vendorId: string;
    vendorName: string;
    riskScore: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    performanceMetrics: VendorPerformanceMetrics;
}
export interface VendorTrendAnalysis {
    vendorId: string;
    period: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    rejectionTrend: number[];
    weightDeviationTrend: number[];
    transactionVolumeTrend: number[];
}
export declare class VendorService {
    private vendorRepository;
    private transactionRepository;
    constructor(vendorRepository: Repository<Vendor>, transactionRepository: Repository<Transaction>);
    findAll(tenantId: string): Promise<Vendor[]>;
    findOne(id: string, tenantId: string): Promise<Vendor>;
    create(createVendorDto: any, tenantId: string): Promise<Vendor>;
    update(id: string, updateVendorDto: any, tenantId: string): Promise<Vendor>;
    toggleBlacklist(id: string, tenantId: string, reason?: string): Promise<Vendor>;
    delete(id: string, tenantId: string): Promise<void>;
    seedVendors(tenantId: string): Promise<Vendor[]>;
    calculateVendorPerformance(vendorId: string, tenantId: string): Promise<VendorPerformanceMetrics>;
    updateVendorPerformanceMetrics(vendorId: string, tenantId: string): Promise<void>;
    calculateVendorRiskScoring(vendorId: string, tenantId: string): Promise<VendorRiskScoring>;
    getVendorTrendAnalysis(vendorId: string, tenantId: string, period?: 'DAILY' | 'WEEKLY' | 'MONTHLY', periodCount?: number): Promise<VendorTrendAnalysis>;
    getVendorRealTimeMetrics(tenantId: string): Promise<{
        totalVendors: number;
        activeVendors: number;
        highRiskVendors: number;
        averageRejectionRate: number;
    }>;
    getVendorPerformanceRanking(tenantId: string, limit?: number): Promise<{
        topPerformers: VendorRiskScoring[];
        worstPerformers: VendorRiskScoring[];
    }>;
}
