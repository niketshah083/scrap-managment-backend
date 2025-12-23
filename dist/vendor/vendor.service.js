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
exports.VendorService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const vendor_entity_1 = require("../entities/vendor.entity");
const transaction_entity_1 = require("../entities/transaction.entity");
let VendorService = class VendorService {
    constructor(vendorRepository, transactionRepository) {
        this.vendorRepository = vendorRepository;
        this.transactionRepository = transactionRepository;
    }
    async findAll(tenantId) {
        return this.vendorRepository.find({
            where: { tenantId },
            order: { createdAt: 'DESC' },
        });
    }
    async findOne(id, tenantId) {
        const vendor = await this.vendorRepository.findOne({
            where: { id, tenantId },
        });
        if (!vendor) {
            throw new common_1.NotFoundException(`Vendor with ID ${id} not found`);
        }
        return vendor;
    }
    async create(createVendorDto, tenantId) {
        const vendorData = {
            ...createVendorDto,
            tenantId,
            rating: 0,
            performanceMetrics: {
                rejectionPercentage: 0,
                weightDeviationPercentage: 0,
                inspectionFailureCount: 0,
                totalTransactions: 0,
                qualityScore: 100,
                avgDeliveryTime: 0,
                lastUpdated: new Date(),
            },
            poSummary: {
                totalPOs: 0,
                pendingPOs: 0,
                completedPOs: 0,
                totalValue: 0,
                pendingValue: 0,
            },
        };
        const vendor = this.vendorRepository.create(vendorData);
        const savedVendor = await this.vendorRepository.save(vendor);
        return Array.isArray(savedVendor) ? savedVendor[0] : savedVendor;
    }
    async update(id, updateVendorDto, tenantId) {
        const vendor = await this.findOne(id, tenantId);
        Object.assign(vendor, updateVendorDto);
        return this.vendorRepository.save(vendor);
    }
    async toggleBlacklist(id, tenantId, reason) {
        const vendor = await this.findOne(id, tenantId);
        vendor.isBlacklisted = !vendor.isBlacklisted;
        vendor.blacklistReason = vendor.isBlacklisted ? reason || 'Blacklisted by admin' : null;
        return this.vendorRepository.save(vendor);
    }
    async delete(id, tenantId) {
        const vendor = await this.findOne(id, tenantId);
        await this.vendorRepository.remove(vendor);
    }
    async seedVendors(tenantId) {
        const existingVendors = await this.vendorRepository.find({ where: { tenantId } });
        if (existingVendors.length > 0) {
            return existingVendors;
        }
        const vendorsData = [
            {
                vendorName: 'Delhi Scrap Suppliers',
                gstNumber: '07AABCU9603R1ZM',
                panNumber: 'AABCU9603R',
                contactPersonName: 'Rajesh Kumar',
                contactEmail: 'rajesh@delhiscrap.com',
                contactPhone: '+91 98765 43210',
                address: '123 Industrial Area, Phase 2',
                city: 'Delhi',
                state: 'Delhi',
                pincode: '110001',
                bankName: 'HDFC Bank',
                bankAccount: '1234567890123',
                ifscCode: 'HDFC0001234',
                scrapTypesSupplied: ['Copper', 'Aluminum', 'Steel', 'Brass'],
                rating: 4.5,
                performanceMetrics: {
                    rejectionPercentage: 5,
                    weightDeviationPercentage: 2,
                    inspectionFailureCount: 3,
                    totalTransactions: 156,
                    qualityScore: 92,
                    avgDeliveryTime: 3,
                    lastUpdated: new Date(),
                },
                poSummary: {
                    totalPOs: 45,
                    pendingPOs: 8,
                    completedPOs: 37,
                    totalValue: 125,
                    pendingValue: 28,
                },
                isBlacklisted: false,
                isActive: true,
            },
            {
                vendorName: 'Mumbai Metal Works',
                gstNumber: '27AABCU9603R1ZM',
                panNumber: 'AABCU9603R',
                contactPersonName: 'Amit Shah',
                contactEmail: 'amit@mumbaimetal.com',
                contactPhone: '+91 98765 43211',
                address: '456 MIDC Industrial Estate',
                city: 'Mumbai',
                state: 'Maharashtra',
                pincode: '400001',
                bankName: 'ICICI Bank',
                bankAccount: '9876543210123',
                ifscCode: 'ICIC0001234',
                scrapTypesSupplied: ['Steel', 'Iron', 'Stainless Steel'],
                rating: 4.2,
                performanceMetrics: {
                    rejectionPercentage: 8,
                    weightDeviationPercentage: 3,
                    inspectionFailureCount: 5,
                    totalTransactions: 89,
                    qualityScore: 85,
                    avgDeliveryTime: 4,
                    lastUpdated: new Date(),
                },
                poSummary: {
                    totalPOs: 32,
                    pendingPOs: 5,
                    completedPOs: 27,
                    totalValue: 89,
                    pendingValue: 15,
                },
                isBlacklisted: false,
                isActive: true,
            },
            {
                vendorName: 'Jaipur Recyclers',
                gstNumber: '08AABCU9603R1ZM',
                panNumber: 'AABCU9603R',
                contactPersonName: 'Suresh Sharma',
                contactEmail: 'suresh@jaipurrecycle.com',
                contactPhone: '+91 98765 43212',
                address: '789 Sitapura Industrial Area',
                city: 'Jaipur',
                state: 'Rajasthan',
                pincode: '302022',
                bankName: 'SBI',
                bankAccount: '5678901234567',
                ifscCode: 'SBIN0001234',
                scrapTypesSupplied: ['Copper', 'Brass', 'Bronze'],
                rating: 3.2,
                performanceMetrics: {
                    rejectionPercentage: 12,
                    weightDeviationPercentage: 5,
                    inspectionFailureCount: 8,
                    totalTransactions: 45,
                    qualityScore: 78,
                    avgDeliveryTime: 5,
                    lastUpdated: new Date(),
                },
                poSummary: {
                    totalPOs: 18,
                    pendingPOs: 3,
                    completedPOs: 15,
                    totalValue: 45,
                    pendingValue: 8,
                },
                isBlacklisted: true,
                isActive: false,
            },
            {
                vendorName: 'Chennai Scrap Traders',
                gstNumber: '33AABCU9603R1ZM',
                panNumber: 'AABCU9603R',
                contactPersonName: 'Venkat Raman',
                contactEmail: 'venkat@chennaiscrap.com',
                contactPhone: '+91 98765 43213',
                address: '321 Ambattur Industrial Estate',
                city: 'Chennai',
                state: 'Tamil Nadu',
                pincode: '600058',
                bankName: 'Axis Bank',
                bankAccount: '3456789012345',
                ifscCode: 'UTIB0001234',
                scrapTypesSupplied: ['Aluminum', 'Steel', 'Zinc'],
                rating: 4.8,
                performanceMetrics: {
                    rejectionPercentage: 3,
                    weightDeviationPercentage: 1,
                    inspectionFailureCount: 2,
                    totalTransactions: 234,
                    qualityScore: 96,
                    avgDeliveryTime: 2,
                    lastUpdated: new Date(),
                },
                poSummary: {
                    totalPOs: 67,
                    pendingPOs: 12,
                    completedPOs: 55,
                    totalValue: 198,
                    pendingValue: 42,
                },
                isBlacklisted: false,
                isActive: true,
            },
        ];
        const vendors = [];
        for (const data of vendorsData) {
            const vendor = this.vendorRepository.create({ ...data, tenantId });
            vendors.push(await this.vendorRepository.save(vendor));
        }
        return vendors;
    }
    async calculateVendorPerformance(vendorId, tenantId) {
        const transactions = await this.transactionRepository.find({
            where: { vendorId, tenantId, status: transaction_entity_1.TransactionStatus.COMPLETED },
            order: { createdAt: 'DESC' },
        });
        if (transactions.length === 0) {
            return {
                rejectionPercentage: 0,
                weightDeviationPercentage: 0,
                inspectionFailureCount: 0,
                totalTransactions: 0,
                qualityScore: 100,
                avgDeliveryTime: 0,
                lastUpdated: new Date(),
            };
        }
        const rejectedTransactions = transactions.filter(tx => tx.inspectionData?.grade === 'REJECTED');
        const rejectionPercentage = (rejectedTransactions.length / transactions.length) * 100;
        let totalWeightDeviation = 0;
        let transactionsWithWeightData = 0;
        for (const transaction of transactions) {
            if (transaction.weighbridgeData?.grossWeight && transaction.weighbridgeData?.tareWeight && transaction.weighbridgeData?.netWeight) {
                const calculatedNet = transaction.weighbridgeData.grossWeight - transaction.weighbridgeData.tareWeight;
                const recordedNet = transaction.weighbridgeData.netWeight;
                if (calculatedNet > 0) {
                    const deviation = Math.abs(calculatedNet - recordedNet) / calculatedNet * 100;
                    totalWeightDeviation += deviation;
                    transactionsWithWeightData++;
                }
            }
        }
        const weightDeviationPercentage = transactionsWithWeightData > 0 ? totalWeightDeviation / transactionsWithWeightData : 0;
        const inspectionFailureCount = rejectedTransactions.filter(tx => tx.inspectionData?.rejectionReason && tx.currentLevel >= transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION).length;
        return {
            rejectionPercentage: Math.round(rejectionPercentage * 100) / 100,
            weightDeviationPercentage: Math.round(weightDeviationPercentage * 100) / 100,
            inspectionFailureCount,
            totalTransactions: transactions.length,
            qualityScore: Math.round((100 - rejectionPercentage) * 100) / 100,
            avgDeliveryTime: 3,
            lastUpdated: new Date(),
        };
    }
    async updateVendorPerformanceMetrics(vendorId, tenantId) {
        const metrics = await this.calculateVendorPerformance(vendorId, tenantId);
        await this.vendorRepository.update({ id: vendorId, tenantId }, { performanceMetrics: metrics });
    }
    async calculateVendorRiskScoring(vendorId, tenantId) {
        const vendor = await this.vendorRepository.findOne({ where: { id: vendorId, tenantId } });
        if (!vendor) {
            throw new common_1.NotFoundException(`Vendor with ID ${vendorId} not found`);
        }
        const performanceMetrics = await this.calculateVendorPerformance(vendorId, tenantId);
        let riskScore = 0;
        riskScore += performanceMetrics.rejectionPercentage * 0.5;
        riskScore += performanceMetrics.weightDeviationPercentage * 0.3;
        const inspectionFailureRate = performanceMetrics.totalTransactions > 0
            ? (performanceMetrics.inspectionFailureCount / performanceMetrics.totalTransactions) * 100 : 0;
        riskScore += inspectionFailureRate * 0.2;
        riskScore = Math.min(riskScore, 100);
        let riskLevel;
        if (riskScore < 15)
            riskLevel = 'LOW';
        else if (riskScore < 35)
            riskLevel = 'MEDIUM';
        else
            riskLevel = 'HIGH';
        return { vendorId, vendorName: vendor.vendorName, riskScore: Math.round(riskScore * 100) / 100, riskLevel, performanceMetrics };
    }
    async getVendorTrendAnalysis(vendorId, tenantId, period = 'MONTHLY', periodCount = 12) {
        const vendor = await this.vendorRepository.findOne({ where: { id: vendorId, tenantId } });
        if (!vendor) {
            throw new common_1.NotFoundException(`Vendor with ID ${vendorId} not found`);
        }
        return { vendorId, period, rejectionTrend: [], weightDeviationTrend: [], transactionVolumeTrend: [] };
    }
    async getVendorRealTimeMetrics(tenantId) {
        const allVendors = await this.vendorRepository.find({ where: { tenantId } });
        const activeVendors = allVendors.filter(v => v.isActive && !v.isBlacklisted);
        return {
            totalVendors: allVendors.length,
            activeVendors: activeVendors.length,
            highRiskVendors: 0,
            averageRejectionRate: 0,
        };
    }
    async getVendorPerformanceRanking(tenantId, limit = 10) {
        return { topPerformers: [], worstPerformers: [] };
    }
};
exports.VendorService = VendorService;
exports.VendorService = VendorService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(vendor_entity_1.Vendor)),
    __param(1, (0, typeorm_1.InjectRepository)(transaction_entity_1.Transaction)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], VendorService);
//# sourceMappingURL=vendor.service.js.map