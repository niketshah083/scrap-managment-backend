"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const typeorm_1 = require("@nestjs/typeorm");
const fc = require("fast-check");
const analytics_service_1 = require("./analytics.service");
const transaction_entity_1 = require("../entities/transaction.entity");
const vendor_entity_1 = require("../entities/vendor.entity");
const vendor_service_1 = require("../vendor/vendor.service");
describe('Analytics Data Exclusion Property Tests', () => {
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
    it('should never include financial data in dashboard metrics', async () => {
        await fc.assert(fc.asyncProperty(fc.record({
            tenantId: fc.string({ minLength: 1, maxLength: 50 }),
            transactions: fc.array(fc.record({
                id: fc.string({ minLength: 1, maxLength: 50 }),
                tenantId: fc.string({ minLength: 1, maxLength: 50 }),
                factoryId: fc.string({ minLength: 1, maxLength: 50 }),
                vendorId: fc.string({ minLength: 1, maxLength: 50 }),
                vehicleId: fc.string({ minLength: 1, maxLength: 50 }),
                createdAt: fc.date(),
                weighbridgeData: fc.option(fc.record({
                    grossWeight: fc.integer({ min: 1000, max: 50000 }),
                    tareWeight: fc.integer({ min: 500, max: 10000 }),
                    netWeight: fc.integer({ min: 500, max: 45000 }),
                })),
                inspectionData: fc.option(fc.record({
                    grade: fc.constantFrom('A', 'B', 'C', 'REJECTED'),
                    contamination: fc.integer({ min: 0, max: 100 }),
                })),
                financialData: fc.option(fc.record({
                    amount: fc.integer({ min: 1000, max: 100000 }),
                    rate: fc.integer({ min: 10, max: 1000 }),
                    tax: fc.integer({ min: 100, max: 10000 }),
                    profit: fc.integer({ min: -5000, max: 20000 }),
                    revenue: fc.integer({ min: 1000, max: 150000 }),
                })),
                factory: fc.option(fc.record({
                    factoryName: fc.string({ minLength: 1, maxLength: 100 }),
                })),
            }), { minLength: 0, maxLength: 20 }),
        }), async ({ tenantId, transactions }) => {
            jest.spyOn(transactionRepository, 'find').mockResolvedValue(transactions);
            const metrics = await service.getDashboardMetrics(tenantId);
            const metricsString = JSON.stringify(metrics);
            const financialTerms = [
                'amount', 'rate', 'tax', 'profit', 'revenue', 'cost', 'price',
                'payment', 'invoice', 'billing', 'accounting', 'financial',
                'money', 'currency', 'rupee', 'dollar', 'inr', 'usd'
            ];
            for (const term of financialTerms) {
                expect(metricsString.toLowerCase()).not.toContain(term.toLowerCase());
            }
            expect(metrics).toHaveProperty('todayInward');
            expect(metrics).toHaveProperty('totalWeight');
            expect(metrics).toHaveProperty('pendingInspections');
            expect(metrics).toHaveProperty('rejectedMaterials');
            expect(typeof metrics.todayInward.weight).toBe('number');
            expect(typeof metrics.totalWeight.value).toBe('number');
            expect(Number.isInteger(metrics.todayInward.count)).toBe(true);
            expect(Number.isInteger(metrics.pendingInspections.count)).toBe(true);
            expect(Number.isInteger(metrics.rejectedMaterials.count)).toBe(true);
        }), { numRuns: 50 });
    });
    it('should exclude financial performance metrics from vendor risk ranking', async () => {
        await fc.assert(fc.asyncProperty(fc.record({
            tenantId: fc.string({ minLength: 1, maxLength: 50 }),
            vendorRanking: fc.record({
                worstPerformers: fc.array(fc.record({
                    vendorName: fc.string({ minLength: 1, maxLength: 100 }),
                    riskLevel: fc.constantFrom('HIGH', 'MEDIUM', 'LOW'),
                    performanceMetrics: fc.record({
                        rejectionPercentage: fc.integer({ min: 0, max: 100 }),
                        weightDeviationPercentage: fc.integer({ min: 0, max: 50 }),
                        profitability: fc.integer({ min: -50, max: 100 }),
                        paymentDelays: fc.integer({ min: 0, max: 90 }),
                    }),
                }), { minLength: 0, maxLength: 10 }),
                topPerformers: fc.array(fc.record({
                    vendorName: fc.string({ minLength: 1, maxLength: 100 }),
                    riskLevel: fc.constantFrom('HIGH', 'MEDIUM', 'LOW'),
                    performanceMetrics: fc.record({
                        rejectionPercentage: fc.integer({ min: 0, max: 100 }),
                        weightDeviationPercentage: fc.integer({ min: 0, max: 50 }),
                    }),
                }), { minLength: 0, maxLength: 10 }),
            }),
        }), async ({ tenantId, vendorRanking }) => {
            jest.spyOn(vendorService, 'getVendorPerformanceRanking').mockResolvedValue(vendorRanking);
            const ranking = await service.getVendorRiskRanking(tenantId);
            const allVendors = [
                ...ranking.highRisk,
                ...ranking.mediumRisk,
                ...ranking.lowRisk
            ];
            for (const vendor of allVendors) {
                const vendorString = JSON.stringify(vendor);
                const financialTerms = [
                    'profit', 'payment', 'delay', 'credit', 'debt', 'financial',
                    'accounting', 'billing', 'invoice', 'amount', 'cost'
                ];
                for (const term of financialTerms) {
                    expect(vendorString.toLowerCase()).not.toContain(term.toLowerCase());
                }
                expect(vendor).toHaveProperty('vendorName');
                expect(vendor).toHaveProperty('rejectionRate');
                expect(vendor).not.toHaveProperty('profitability');
                expect(vendor).not.toHaveProperty('paymentDelays');
                expect(vendor).not.toHaveProperty('financialScore');
                expect(typeof vendor.vendorName).toBe('string');
                expect(typeof vendor.rejectionRate).toBe('number');
                expect(vendor.rejectionRate).toBeGreaterThanOrEqual(0);
                expect(vendor.rejectionRate).toBeLessThanOrEqual(100);
            }
        }), { numRuns: 50 });
    });
    it('should never expose system or infrastructure data in executive dashboard', async () => {
        await fc.assert(fc.asyncProperty(fc.record({
            tenantId: fc.string({ minLength: 1, maxLength: 50 }),
        }), async ({ tenantId }) => {
            jest.spyOn(service, 'getDashboardMetrics').mockResolvedValue({
                todayInward: { count: 10, weight: 25.5 },
                totalWeight: { value: 25.5, trend: '+5%' },
                pendingInspections: { count: 3, urgent: 1 },
                rejectedMaterials: { count: 2, trend: '-2%' },
            });
            jest.spyOn(service, 'getFactoryComparison').mockResolvedValue([
                { factoryId: 'f1', factoryName: 'Factory A', todayCount: 5, todayWeight: 12.5, percentage: 50 }
            ]);
            jest.spyOn(service, 'getInspectionTrends').mockResolvedValue([
                { period: 'Jan', rejectionRate: 5.2, evidenceCompliance: 94.5 }
            ]);
            jest.spyOn(service, 'getVendorRiskRanking').mockResolvedValue({
                highRisk: [{ vendorName: 'Vendor A', rejectionRate: 18.5 }],
                mediumRisk: [{ vendorName: 'Vendor B', rejectionRate: 12.1 }],
                lowRisk: [{ vendorName: 'Vendor C', rejectionRate: 2.3 }],
            });
            const dashboard = await service.getExecutiveDashboard(tenantId);
            const dashboardString = JSON.stringify(dashboard);
            const systemTerms = [
                'server', 'database', 'cpu', 'memory', 'disk', 'network',
                'api', 'endpoint', 'response', 'request', 'latency', 'uptime',
                'error', 'exception', 'log', 'debug', 'trace', 'stack',
                'connection', 'timeout', 'retry', 'cache', 'redis', 'mysql',
                'docker', 'kubernetes', 'aws', 'cloud', 'infrastructure'
            ];
            for (const term of systemTerms) {
                expect(dashboardString.toLowerCase()).not.toContain(term.toLowerCase());
            }
            expect(dashboard).toHaveProperty('metrics');
            expect(dashboard).toHaveProperty('factoryComparison');
            expect(dashboard).toHaveProperty('inspectionTrends');
            expect(dashboard).toHaveProperty('vendorRiskRanking');
            expect(dashboard).not.toHaveProperty('systemInfo');
            expect(dashboard).not.toHaveProperty('serverStats');
            expect(dashboard).not.toHaveProperty('performanceMetrics');
            expect(dashboard).not.toHaveProperty('errorLogs');
        }), { numRuns: 50 });
    });
});
//# sourceMappingURL=analytics-data-exclusion.property.spec.js.map