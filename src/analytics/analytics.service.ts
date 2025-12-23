import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction, TransactionStatus, OperationalLevel } from '../entities/transaction.entity';
import { Vendor } from '../entities/vendor.entity';
import { VendorService } from '../vendor/vendor.service';

export interface DashboardMetrics {
  todayInward: {
    count: number;
    weight: number; // in MT (metric tons)
  };
  totalWeight: {
    value: number; // in MT
    trend: string; // e.g., "+12% vs yesterday"
  };
  pendingInspections: {
    count: number;
    urgent: number; // count of urgent inspections
  };
  rejectedMaterials: {
    count: number;
    trend: string; // e.g., "-5% vs yesterday"
  };
}

export interface FactoryComparison {
  factoryId: string;
  factoryName: string;
  todayCount: number;
  todayWeight: number; // in MT
  percentage: number; // percentage of total
}

export interface InspectionTrend {
  period: string; // e.g., "Jan", "Feb", etc.
  rejectionRate: number; // percentage
  evidenceCompliance: number; // percentage
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

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(Vendor)
    private vendorRepository: Repository<Vendor>,
    private vendorService: VendorService,
  ) {}

  /**
   * Get real-time dashboard metrics for executive dashboard
   */
  async getDashboardMetrics(tenantId: string): Promise<DashboardMetrics> {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    // Today's inward transactions
    const todayTransactions = await this.transactionRepository.find({
      where: {
        tenantId,
        createdAt: {
          $gte: startOfToday,
        } as any,
      },
    });

    // Yesterday's transactions for comparison
    const yesterdayTransactions = await this.transactionRepository.find({
      where: {
        tenantId,
        createdAt: {
          $gte: startOfYesterday,
          $lt: startOfToday,
        } as any,
      },
    });

    // Calculate today's weight
    const todayWeight = todayTransactions.reduce((total, tx) => {
      if (tx.weighbridgeData?.netWeight) {
        return total + (tx.weighbridgeData.netWeight / 1000); // Convert kg to MT
      }
      return total;
    }, 0);

    // Calculate yesterday's weight for trend
    const yesterdayWeight = yesterdayTransactions.reduce((total, tx) => {
      if (tx.weighbridgeData?.netWeight) {
        return total + (tx.weighbridgeData.netWeight / 1000); // Convert kg to MT
      }
      return total;
    }, 0);

    const weightTrendPercent = yesterdayWeight > 0 
      ? ((todayWeight - yesterdayWeight) / yesterdayWeight * 100)
      : 0;

    // Pending inspections (transactions at L4 level)
    const pendingInspections = await this.transactionRepository.find({
      where: {
        tenantId,
        currentLevel: OperationalLevel.L4_MATERIAL_INSPECTION,
        status: TransactionStatus.ACTIVE,
      },
    });

    // Urgent inspections (pending for more than 2 hours)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const urgentInspections = pendingInspections.filter(tx => 
      tx.createdAt < twoHoursAgo
    );

    // Today's rejected materials
    const todayRejected = todayTransactions.filter(tx => 
      tx.inspectionData?.grade === 'REJECTED'
    );

    // Yesterday's rejected materials for trend
    const yesterdayRejected = yesterdayTransactions.filter(tx => 
      tx.inspectionData?.grade === 'REJECTED'
    );

    const rejectionTrendPercent = yesterdayRejected.length > 0 
      ? ((todayRejected.length - yesterdayRejected.length) / yesterdayRejected.length * 100)
      : 0;

    return {
      todayInward: {
        count: todayTransactions.length,
        weight: Math.round(todayWeight * 100) / 100, // Round to 2 decimal places
      },
      totalWeight: {
        value: Math.round(todayWeight * 100) / 100,
        trend: `${weightTrendPercent >= 0 ? '+' : ''}${Math.round(weightTrendPercent)}% vs yesterday`,
      },
      pendingInspections: {
        count: pendingInspections.length,
        urgent: urgentInspections.length,
      },
      rejectedMaterials: {
        count: todayRejected.length,
        trend: `${rejectionTrendPercent >= 0 ? '+' : ''}${Math.round(rejectionTrendPercent)}% vs yesterday`,
      },
    };
  }

  /**
   * Get factory-wise comparison for today's operations
   */
  async getFactoryComparison(tenantId: string): Promise<FactoryComparison[]> {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    // Get today's transactions grouped by factory
    const todayTransactions = await this.transactionRepository.find({
      where: {
        tenantId,
        createdAt: {
          $gte: startOfToday,
        } as any,
      },
      relations: ['factory'],
    });

    // Group by factory
    const factoryGroups = new Map<string, {
      factoryId: string;
      factoryName: string;
      transactions: typeof todayTransactions;
    }>();

    for (const tx of todayTransactions) {
      if (!factoryGroups.has(tx.factoryId)) {
        factoryGroups.set(tx.factoryId, {
          factoryId: tx.factoryId,
          factoryName: tx.factory?.factoryName || `Factory ${tx.factoryId.slice(0, 8)}`,
          transactions: [],
        });
      }
      factoryGroups.get(tx.factoryId)!.transactions.push(tx);
    }

    // Calculate metrics for each factory
    const totalTransactions = todayTransactions.length;
    const factoryComparisons: FactoryComparison[] = [];

    for (const [factoryId, group] of factoryGroups) {
      const todayCount = group.transactions.length;
      const todayWeight = group.transactions.reduce((total, tx) => {
        if (tx.weighbridgeData?.netWeight) {
          return total + (tx.weighbridgeData.netWeight / 1000); // Convert kg to MT
        }
        return total;
      }, 0);

      const percentage = totalTransactions > 0 
        ? (todayCount / totalTransactions * 100)
        : 0;

      factoryComparisons.push({
        factoryId,
        factoryName: group.factoryName,
        todayCount,
        todayWeight: Math.round(todayWeight * 100) / 100,
        percentage: Math.round(percentage),
      });
    }

    // Sort by count descending
    return factoryComparisons.sort((a, b) => b.todayCount - a.todayCount);
  }

  /**
   * Get inspection failure trends over the last 12 months
   */
  async getInspectionTrends(tenantId: string, months: number = 12): Promise<InspectionTrend[]> {
    const trends: InspectionTrend[] = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const startDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

      // Get transactions for this month
      const monthTransactions = await this.transactionRepository.find({
        where: {
          tenantId,
          status: TransactionStatus.COMPLETED,
          createdAt: {
            $gte: startDate,
            $lt: endDate,
          } as any,
        },
      });

      // Calculate rejection rate
      const rejectedCount = monthTransactions.filter(tx => 
        tx.inspectionData?.grade === 'REJECTED'
      ).length;

      const rejectionRate = monthTransactions.length > 0 
        ? (rejectedCount / monthTransactions.length * 100)
        : 0;

      // Calculate evidence compliance (transactions with complete evidence)
      const transactionsWithEvidence = monthTransactions.filter(tx => 
        tx.levelData && 
        Object.values(tx.levelData).some((level: any) => 
          level && level.evidenceIds && level.evidenceIds.length > 0
        )
      ).length;

      const evidenceCompliance = monthTransactions.length > 0 
        ? (transactionsWithEvidence / monthTransactions.length * 100)
        : 0;

      trends.push({
        period: startDate.toLocaleDateString('en-US', { month: 'short' }),
        rejectionRate: Math.round(rejectionRate * 100) / 100,
        evidenceCompliance: Math.round(evidenceCompliance * 100) / 100,
      });
    }

    return trends;
  }

  /**
   * Get vendor risk ranking for dashboard display
   */
  async getVendorRiskRanking(tenantId: string): Promise<VendorRiskRanking> {
    const vendorRanking = await this.vendorService.getVendorPerformanceRanking(tenantId, 20);

    const highRisk = vendorRanking.worstPerformers
      .filter(v => v.riskLevel === 'HIGH')
      .slice(0, 5)
      .map(v => ({
        vendorName: v.vendorName,
        rejectionRate: v.performanceMetrics.rejectionPercentage,
      }));

    const mediumRisk = vendorRanking.worstPerformers
      .filter(v => v.riskLevel === 'MEDIUM')
      .slice(0, 5)
      .map(v => ({
        vendorName: v.vendorName,
        rejectionRate: v.performanceMetrics.rejectionPercentage,
      }));

    const lowRisk = vendorRanking.topPerformers
      .filter(v => v.riskLevel === 'LOW')
      .slice(0, 5)
      .map(v => ({
        vendorName: v.vendorName,
        rejectionRate: v.performanceMetrics.rejectionPercentage,
      }));

    return {
      highRisk,
      mediumRisk,
      lowRisk,
    };
  }

  /**
   * Get comprehensive analytics data for executive dashboard
   */
  async getExecutiveDashboard(tenantId: string): Promise<{
    metrics: DashboardMetrics;
    factoryComparison: FactoryComparison[];
    inspectionTrends: InspectionTrend[];
    vendorRiskRanking: VendorRiskRanking;
  }> {
    const [metrics, factoryComparison, inspectionTrends, vendorRiskRanking] = await Promise.all([
      this.getDashboardMetrics(tenantId),
      this.getFactoryComparison(tenantId),
      this.getInspectionTrends(tenantId),
      this.getVendorRiskRanking(tenantId),
    ]);

    return {
      metrics,
      factoryComparison,
      inspectionTrends,
      vendorRiskRanking,
    };
  }
}