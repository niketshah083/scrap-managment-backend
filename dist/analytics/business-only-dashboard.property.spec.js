"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const typeorm_1 = require("@nestjs/typeorm");
const fc = require("fast-check");
const analytics_service_1 = require("./analytics.service");
const transaction_entity_1 = require("../entities/transaction.entity");
const vendor_entity_1 = require("../entities/vendor.entity");
const vendor_service_1 = require("../vendor/vendor.service");
describe('Business-Only Dashboard Data Property Tests', () => {
    let service;
    let transactionRepository;
    let vendorRepository;
    let vendorService;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                analytics_service_1.AnalyticsService,
                {
                    provide: (0, typeorm_1.getRepositoryToken)(transaction_entity_1.Transaction),
                    useValue: {
                        find: jest.fn(),
                        findOne: jest.fn(),
                        save: jest.fn(),
                        create: jest.fn(),
                    },
                },
                {
                    provide: (0, typeorm_1.getRepositoryToken)(vendor_entity_1.Vendor),
                    useValue: {
                        find: jest.fn(),
                        findOne: jest.fn(),
                        save: jest.fn(),
                        create: jest.fn(),
                    },
                },
                {
                    provide: vendor_service_1.VendorService,
                    useValue: {
                        getVendorPerformanceRanking: jest.fn(),
                    },
                },
            ],
        }).compile();
        service = module.get(analytics_service_1.AnalyticsService);
        transactionRepository = module.get((0, typeorm_1.getRepositoryToken)(transaction_entity_1.Transaction));
        vendorRepository = module.get((0, typeorm_1.getRepositoryToken)(vendor_entity_1.Vendor));
        vendorService = module.get(vendor_service_1.VendorService);
    });
    it('should only contain business operational metrics in dashboard', async () => {
        await fc.assert(fc.asyncProperty(fc.record({
            tenantId: fc.string({ minLength: 1, maxLength: 50 }),
            businessData: fc.record({
                transactions: fc.array(fc.record({
                    id: fc.string({ minLength: 1, maxLength: 50 }),
                    tenantId: fc.string({ minLength: 1, maxLength: 50 }),
                    factoryId: fc.string({ minLength: 1, maxLength: 50 }),
                    vendorId: fc.string({ minLength: 1, maxLength: 50 }),
                    vehicleNumber: fc.string({ minLength: 5, maxLength: 15 }),
                    createdAt: fc.date(),
                    weighbridgeData: fc.option(fc.record({
                        grossWeight: fc.integer({ min: 1000, max: 50000 }),
                        tareWeight: fc.integer({ min: 500, max: 10000 }),
                        netWeight: fc.integer({ min: 500, max: 45000 }),
                    })),
                    inspectionData: fc.option(fc.record({
                        grade: fc.constantFrom('A', 'B', 'C', 'REJECTED'),
                        contamination: fc.float({ min: 0, max: 100 }),
                        inspectorId: fc.string({ minLength: 1, maxLength: 50 }),
                    })),
                    factory: fc.option(fc.record({
                        factoryName: fc.string({ minLength: 1, maxLength: 100 }),
                    })),
                    systemData: fc.option(fc.record({
                        serverId: fc.string(),
                        processingTime: fc.integer({ min: 10, max: 5000 }),
                        memoryUsage: fc.float({ min: Math.fround(0.1), max: Math.fround(0.9) }),
                        cpuUsage: fc.float({ min: Math.fround(0.05), max: Math.fround(0.95) }),
                        databaseConnections: fc.integer({ min: 1, max: 100 }),
                        apiResponseTime: fc.integer({ min: 50, max: 2000 }),
                    })),
                }), { minLength: 0, maxLength: 20 }),
            }),
        }), async ({ tenantId, businessData }) => {
            jest.spyOn(transactionRepository, 'find').mockResolvedValue(businessData.transactions);
            const metrics = await service.getDashboardMetrics(tenantId);
            const allowedBusinessMetrics = [
                'todayInward', 'totalWeight', 'pendingInspections', 'rejectedMaterials',
                'count', 'weight', 'trend', 'urgent', 'value', 'trendValue'
            ];
            const metricsKeys = getAllKeys(metrics);
            for (const key of metricsKeys) {
                const keyLower = key.toLowerCase();
                const isBusinessMetric = allowedBusinessMetrics.some(allowed => keyLower.includes(allowed.toLowerCase()));
                const isStandardValue = typeof metrics[key] === 'string' ||
                    typeof metrics[key] === 'number' ||
                    typeof metrics[key] === 'boolean';
                expect(isBusinessMetric || isStandardValue).toBe(true);
            }
            const forbiddenSystemMetrics = [
                'server', 'cpu', 'memory', 'database', 'api', 'processing',
                'connection', 'response', 'latency', 'uptime', 'error',
                'exception', 'log', 'debug', 'trace', 'system', 'infrastructure'
            ];
            const metricsString = JSON.stringify(metrics).toLowerCase();
            for (const forbidden of forbiddenSystemMetrics) {
                expect(metricsString).not.toContain(forbidden.toLowerCase());
            }
        }), { numRuns: 100 });
    });
    it('should only show business operational data in factory comparison', async () => {
        await fc.assert(fc.asyncProperty(fc.record({
            tenantId: fc.string({ minLength: 1, maxLength: 50 }),
            factoryTransactions: fc.array(fc.record({
                id: fc.string({ minLength: 1, maxLength: 50 }),
                tenantId: fc.string({ minLength: 1, maxLength: 50 }),
                factoryId: fc.string({ minLength: 1, maxLength: 50 }),
                createdAt: fc.date(),
                weighbridgeData: fc.option(fc.record({
                    netWeight: fc.integer({ min: 500, max: 45000 }),
                })),
                factory: fc.option(fc.record({
                    factoryName: fc.string({ minLength: 1, maxLength: 100 }),
                    serverLocation: fc.string(),
                    databaseShardId: fc.string(),
                    loadBalancerId: fc.string(),
                })),
            }), { minLength: 0, maxLength: 15 }),
        }), async ({ tenantId, factoryTransactions }) => {
            jest.spyOn(transactionRepository, 'find').mockResolvedValue(factoryTransactions);
            const comparison = await service.getFactoryComparison(tenantId);
            for (const factory of comparison) {
                expect(factory).toHaveProperty('factoryId');
                expect(factory).toHaveProperty('factoryName');
                expect(factory).toHaveProperty('todayCount');
                expect(factory).toHaveProperty('todayWeight');
                expect(factory).toHaveProperty('percentage');
                expect(factory).not.toHaveProperty('serverLocation');
                expect(factory).not.toHaveProperty('databaseShardId');
                expect(factory).not.toHaveProperty('loadBalancerId');
                expect(factory).not.toHaveProperty('systemMetrics');
                expect(factory).not.toHaveProperty('performanceStats');
                expect(typeof factory.factoryId).toBe('string');
                expect(typeof factory.factoryName).toBe('string');
                expect(Number.isInteger(factory.todayCount)).toBe(true);
                expect(typeof factory.todayWeight).toBe('number');
                expect(typeof factory.percentage).toBe('number');
                expect(factory.todayCount).toBeGreaterThanOrEqual(0);
                expect(factory.todayWeight).toBeGreaterThanOrEqual(0);
                expect(factory.percentage).toBeGreaterThanOrEqual(0);
                expect(factory.percentage).toBeLessThanOrEqual(100);
            }
        }), { numRuns: 100 });
    });
    it('should only contain business quality metrics in inspection trends', async () => {
        await fc.assert(fc.asyncProperty(fc.record({
            tenantId: fc.string({ minLength: 1, maxLength: 50 }),
            months: fc.integer({ min: 1, max: 12 }),
        }), async ({ tenantId, months }) => {
            const mockTransactions = Array.from({ length: 15 }, (_, i) => ({
                id: `tx-${i}`,
                tenantId,
                status: 'COMPLETED',
                createdAt: new Date(),
                inspectionData: {
                    grade: i % 4 === 0 ? 'REJECTED' : 'A',
                    contamination: Math.random() * 20,
                    inspectorId: `inspector-${i % 3}`,
                },
                levelData: {
                    L4: { evidenceIds: ['ev1', 'ev2'] }
                },
                systemMetrics: {
                    processingTimeMs: 1500 + i * 100,
                    databaseQueryCount: 5 + i,
                    cacheHitRate: 0.85 + Math.random() * 0.1,
                }
            }));
            jest.spyOn(transactionRepository, 'find').mockResolvedValue(mockTransactions);
            const trends = await service.getInspectionTrends(tenantId, months);
            for (const trend of trends) {
                expect(trend).toHaveProperty('period');
                expect(trend).toHaveProperty('rejectionRate');
                expect(trend).toHaveProperty('evidenceCompliance');
                expect(trend).not.toHaveProperty('processingTime');
                expect(trend).not.toHaveProperty('databaseQueries');
                expect(trend).not.toHaveProperty('cacheHitRate');
                expect(trend).not.toHaveProperty('systemPerformance');
                expect(trend).not.toHaveProperty('serverMetrics');
                expect(typeof trend.period).toBe('string');
                expect(typeof trend.rejectionRate).toBe('number');
                expect(typeof trend.evidenceCompliance).toBe('number');
                expect(trend.rejectionRate).toBeGreaterThanOrEqual(0);
                expect(trend.rejectionRate).toBeLessThanOrEqual(100);
                expect(trend.evidenceCompliance).toBeGreaterThanOrEqual(0);
                expect(trend.evidenceCompliance).toBeLessThanOrEqual(100);
                expect(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']).toContain(trend.period);
            }
        }), { numRuns: 100 });
    });
    it('should only show business performance data in vendor risk ranking', async () => {
        await fc.assert(fc.asyncProperty(fc.record({
            tenantId: fc.string({ minLength: 1, maxLength: 50 }),
            vendorData: fc.record({
                worstPerformers: fc.array(fc.record({
                    vendorName: fc.string({ minLength: 1, maxLength: 100 }),
                    riskLevel: fc.constantFrom('HIGH', 'MEDIUM', 'LOW'),
                    performanceMetrics: fc.record({
                        rejectionPercentage: fc.float({ min: 0, max: 100 }),
                        weightDeviationPercentage: fc.float({ min: 0, max: 50 }),
                        inspectionFailureCount: fc.integer({ min: 0, max: 50 }),
                        totalTransactions: fc.integer({ min: 1, max: 1000 }),
                    }),
                    systemMetrics: fc.option(fc.record({
                        apiCallCount: fc.integer({ min: 100, max: 10000 }),
                        averageResponseTime: fc.integer({ min: 50, max: 2000 }),
                        errorRate: fc.float({ min: Math.fround(0), max: Math.fround(0.1) }),
                        databaseConnections: fc.integer({ min: 1, max: 20 }),
                    })),
                }), { minLength: 0, maxLength: 8 }),
                topPerformers: fc.array(fc.record({
                    vendorName: fc.string({ minLength: 1, maxLength: 100 }),
                    riskLevel: fc.constantFrom('HIGH', 'MEDIUM', 'LOW'),
                    performanceMetrics: fc.record({
                        rejectionPercentage: fc.float({ min: 0, max: 100 }),
                        weightDeviationPercentage: fc.float({ min: 0, max: 50 }),
                    }),
                }), { minLength: 0, maxLength: 8 }),
            }),
        }), async ({ tenantId, vendorData }) => {
            jest.spyOn(vendorService, 'getVendorPerformanceRanking').mockResolvedValue(vendorData);
            const ranking = await service.getVendorRiskRanking(tenantId);
            const allRiskCategories = [
                { name: 'highRisk', vendors: ranking.highRisk },
                { name: 'mediumRisk', vendors: ranking.mediumRisk },
                { name: 'lowRisk', vendors: ranking.lowRisk },
            ];
            for (const category of allRiskCategories) {
                for (const vendor of category.vendors) {
                    expect(vendor).toHaveProperty('vendorName');
                    expect(vendor).toHaveProperty('rejectionRate');
                    expect(vendor).not.toHaveProperty('apiCallCount');
                    expect(vendor).not.toHaveProperty('averageResponseTime');
                    expect(vendor).not.toHaveProperty('errorRate');
                    expect(vendor).not.toHaveProperty('databaseConnections');
                    expect(vendor).not.toHaveProperty('systemMetrics');
                    expect(vendor).not.toHaveProperty('performanceStats');
                    expect(typeof vendor.vendorName).toBe('string');
                    expect(typeof vendor.rejectionRate).toBe('number');
                    expect(vendor.vendorName.length).toBeGreaterThan(0);
                    expect(vendor.rejectionRate).toBeGreaterThanOrEqual(0);
                    expect(vendor.rejectionRate).toBeLessThanOrEqual(100);
                }
            }
        }), { numRuns: 100 });
    });
    it('should aggregate only business-relevant data in executive dashboard', async () => {
        await fc.assert(fc.asyncProperty(fc.record({
            tenantId: fc.string({ minLength: 1, maxLength: 50 }),
        }), async ({ tenantId }) => {
            const mockMetrics = {
                todayInward: { count: 15, weight: 45.2 },
                totalWeight: { value: 45.2, trend: '+8%' },
                pendingInspections: { count: 4, urgent: 1 },
                rejectedMaterials: { count: 2, trend: '-3%' },
            };
            const mockFactoryComparison = [
                { factoryId: 'f1', factoryName: 'Factory A', todayCount: 8, todayWeight: 25.1, percentage: 53 },
                { factoryId: 'f2', factoryName: 'Factory B', todayCount: 7, todayWeight: 20.1, percentage: 47 },
            ];
            const mockInspectionTrends = [
                { period: 'Jan', rejectionRate: 4.2, evidenceCompliance: 96.5 },
                { period: 'Feb', rejectionRate: 3.8, evidenceCompliance: 97.1 },
            ];
            const mockVendorRanking = {
                highRisk: [{ vendorName: 'Vendor A', rejectionRate: 22.5 }],
                mediumRisk: [{ vendorName: 'Vendor B', rejectionRate: 8.3 }],
                lowRisk: [{ vendorName: 'Vendor C', rejectionRate: 1.9 }],
            };
            jest.spyOn(service, 'getDashboardMetrics').mockResolvedValue(mockMetrics);
            jest.spyOn(service, 'getFactoryComparison').mockResolvedValue(mockFactoryComparison);
            jest.spyOn(service, 'getInspectionTrends').mockResolvedValue(mockInspectionTrends);
            jest.spyOn(service, 'getVendorRiskRanking').mockResolvedValue(mockVendorRanking);
            const dashboard = await service.getExecutiveDashboard(tenantId);
            expect(dashboard).toHaveProperty('metrics');
            expect(dashboard).toHaveProperty('factoryComparison');
            expect(dashboard).toHaveProperty('inspectionTrends');
            expect(dashboard).toHaveProperty('vendorRiskRanking');
            expect(dashboard).not.toHaveProperty('systemHealth');
            expect(dashboard).not.toHaveProperty('serverMetrics');
            expect(dashboard).not.toHaveProperty('databaseStats');
            expect(dashboard).not.toHaveProperty('apiPerformance');
            expect(dashboard).not.toHaveProperty('errorLogs');
            expect(dashboard).not.toHaveProperty('infrastructureStatus');
            const dashboardString = JSON.stringify(dashboard);
            const businessTerms = [
                'inward', 'weight', 'inspection', 'rejection', 'vendor', 'factory',
                'material', 'grade', 'contamination', 'evidence', 'compliance'
            ];
            let businessTermsFound = 0;
            for (const term of businessTerms) {
                if (dashboardString.toLowerCase().includes(term.toLowerCase())) {
                    businessTermsFound++;
                }
            }
            expect(businessTermsFound).toBeGreaterThan(0);
            const systemTerms = [
                'server', 'database', 'api', 'cpu', 'memory', 'disk', 'network',
                'latency', 'throughput', 'connection', 'query', 'cache', 'redis'
            ];
            for (const term of systemTerms) {
                expect(dashboardString.toLowerCase()).not.toContain(term.toLowerCase());
            }
        }), { numRuns: 100 });
    });
    function getAllKeys(obj, prefix = '') {
        let keys = [];
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const fullKey = prefix ? `${prefix}.${key}` : key;
                keys.push(fullKey);
                if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                    keys = keys.concat(getAllKeys(obj[key], fullKey));
                }
            }
        }
        return keys;
    }
});
//# sourceMappingURL=business-only-dashboard.property.spec.js.map