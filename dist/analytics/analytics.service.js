"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const transaction_entity_1 = require("../entities/transaction.entity");
const vendor_entity_1 = require("../entities/vendor.entity");
const vendor_service_1 = require("../vendor/vendor.service");
let AnalyticsService = class AnalyticsService {
    constructor(transactionRepository, vendorRepository, vendorService) {
        this.transactionRepository = transactionRepository;
        this.vendorRepository = vendorRepository;
        this.vendorService = vendorService;
    }
    async getDashboardMetrics(tenantId) {
        const today = new Date();
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const startOfYesterday = new Date(startOfToday);
        startOfYesterday.setDate(startOfYesterday.getDate() - 1);
        const todayTransactions = await this.transactionRepository.find({
            where: {
                tenantId,
                createdAt: {
                    $gte: startOfToday,
                },
            },
        });
        const yesterdayTransactions = await this.transactionRepository.find({
            where: {
                tenantId,
                createdAt: {
                    $gte: startOfYesterday,
                    $lt: startOfToday,
                },
            },
        });
        const todayWeight = todayTransactions.reduce((total, tx) => {
            if (tx.weighbridgeData?.netWeight) {
                return total + (tx.weighbridgeData.netWeight / 1000);
            }
            return total;
        }, 0);
        const yesterdayWeight = yesterdayTransactions.reduce((total, tx) => {
            if (tx.weighbridgeData?.netWeight) {
                return total + (tx.weighbridgeData.netWeight / 1000);
            }
            return total;
        }, 0);
        const weightTrendPercent = yesterdayWeight > 0
            ? ((todayWeight - yesterdayWeight) / yesterdayWeight * 100)
            : 0;
        const pendingInspections = await this.transactionRepository.find({
            where: {
                tenantId,
                currentLevel: transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION,
                status: transaction_entity_1.TransactionStatus.ACTIVE,
            },
        });
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        const urgentInspections = pendingInspections.filter(tx => tx.createdAt < twoHoursAgo);
        const todayRejected = todayTransactions.filter(tx => tx.inspectionData?.grade === 'REJECTED');
        const yesterdayRejected = yesterdayTransactions.filter(tx => tx.inspectionData?.grade === 'REJECTED');
        const rejectionTrendPercent = yesterdayRejected.length > 0
            ? ((todayRejected.length - yesterdayRejected.length) / yesterdayRejected.length * 100)
            : 0;
        return {
            todayInward: {
                count: todayTransactions.length,
                weight: Math.round(todayWeight * 100) / 100,
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
    async getFactoryComparison(tenantId) {
        const today = new Date();
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const todayTransactions = await this.transactionRepository.find({
            where: {
                tenantId,
                createdAt: {
                    $gte: startOfToday,
                },
            },
            relations: ['factory'],
        });
        const factoryGroups = new Map();
        for (const tx of todayTransactions) {
            if (!factoryGroups.has(tx.factoryId)) {
                factoryGroups.set(tx.factoryId, {
                    factoryId: tx.factoryId,
                    factoryName: tx.factory?.factoryName || `Factory ${tx.factoryId.slice(0, 8)}`,
                    transactions: [],
                });
            }
            factoryGroups.get(tx.factoryId).transactions.push(tx);
        }
        const totalTransactions = todayTransactions.length;
        const factoryComparisons = [];
        for (const [factoryId, group] of factoryGroups) {
            const todayCount = group.transactions.length;
            const todayWeight = group.transactions.reduce((total, tx) => {
                if (tx.weighbridgeData?.netWeight) {
                    return total + (tx.weighbridgeData.netWeight / 1000);
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
        return factoryComparisons.sort((a, b) => b.todayCount - a.todayCount);
    }
    async getInspectionTrends(tenantId, months = 12) {
        const trends = [];
        const now = new Date();
        for (let i = months - 1; i >= 0; i--) {
            const startDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
            const monthTransactions = await this.transactionRepository.find({
                where: {
                    tenantId,
                    status: transaction_entity_1.TransactionStatus.COMPLETED,
                    createdAt: {
                        $gte: startDate,
                        $lt: endDate,
                    },
                },
            });
            const rejectedCount = monthTransactions.filter(tx => tx.inspectionData?.grade === 'REJECTED').length;
            const rejectionRate = monthTransactions.length > 0
                ? (rejectedCount / monthTransactions.length * 100)
                : 0;
            const transactionsWithEvidence = monthTransactions.filter(tx => tx.levelData &&
                Object.values(tx.levelData).some((level) => level && level.evidenceIds && level.evidenceIds.length > 0)).length;
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
    async getVendorRiskRanking(tenantId) {
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
    async getExecutiveDashboard(tenantId) {
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
};
exports.AnalyticsService = AnalyticsService;
exports.AnalyticsService = AnalyticsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(transaction_entity_1.Transaction)),
    __param(1, (0, typeorm_1.InjectRepository)(vendor_entity_1.Vendor)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        vendor_service_1.VendorService])
], AnalyticsService);
//# sourceMappingURL=analytics.service.js.map