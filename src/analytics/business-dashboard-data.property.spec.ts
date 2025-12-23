import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fc from 'fast-check';
import { AnalyticsService } from './analytics.service';
import { VendorService } from '../vendor/vendor.service';
import { Transaction } from '../entities/transaction.entity';
import { Vendor } from '../entities/vendor.entity';

describe('Business Dashboard Data Property Tests', () => {
  let service: AnalyticsService;
  let transactionRepository: Repository<Transaction>;
  let vendorRepository: Repository<Vendor>;
  let vendorService: VendorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Vendor),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: VendorService,
          useValue: {
            getVendorPerformanceRanking: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    transactionRepository = module.get<Repository<Transaction>>(getRepositoryToken(Transaction));
    vendorRepository = module.get<Repository<Vendor>>(getRepositoryToken(Vendor));
    vendorService = module.get<VendorService>(VendorService);
  });

  /**
   * Property Test: Business-Only Dashboard Data
   * 
   * Ensures that dashboard data contains only business operational information
   * and excludes system/infrastructure data that should not be exposed to business users.
   * 
   * Business users should see:
   * - Operational metrics (counts, weights, percentages)
   * - Vendor performance data
   * - Quality trends
   * - Factory comparisons
   * 
   * Business users should NOT see:
   * - System performance metrics (CPU, memory, disk usage)
   * - Database query performance
   * - Infrastructure logs
   * - Technical error details
   * - Internal system IDs (except where necessary for business context)
   */
  describe('Business-Only Dashboard Data', () => {
    
    it('should only include business operational data in dashboard metrics', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          tenantId: fc.string({ minLength: 1, maxLength: 50 }),
          transactions: fc.array(fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            tenantId: fc.string({ minLength: 1, maxLength: 50 }),
            createdAt: fc.date(),
            weighbridgeData: fc.option(fc.record({
              netWeight: fc.float({ min: 100, max: 50000, noNaN: true }),
              grossWeight: fc.float({ min: 200, max: 60000, noNaN: true }),
              tareWeight: fc.float({ min: 50, max: 10000, noNaN: true }),
            })),
            inspectionData: fc.option(fc.record({
              grade: fc.constantFrom('A', 'B', 'C', 'REJECTED'),
            })),
            // System/infrastructure data that should NOT appear in business dashboard
            systemData: fc.option(fc.record({
              cpuUsage: fc.float({ min: 0, max: 100, noNaN: true }),
              memoryUsage: fc.float({ min: 0, max: 100, noNaN: true }),
              diskUsage: fc.float({ min: 0, max: 100, noNaN: true }),
              queryTime: fc.float({ min: Math.fround(0.1), max: Math.fround(5000), noNaN: true }),
              errorLogs: fc.array(fc.string(), { minLength: 0, maxLength: 5 }),
              internalId: fc.string(),
              databaseId: fc.integer(),
            })),
          }), { minLength: 0, maxLength: 20 }),
        }),
        async ({ tenantId, transactions }) => {
          jest.spyOn(transactionRepository, 'find').mockResolvedValue(transactions as any);

          const metrics = await service.getDashboardMetrics(tenantId);

          // Verify only business metrics are present
          expect(metrics).toHaveProperty('todayInward');
          expect(metrics).toHaveProperty('totalWeight');
          expect(metrics).toHaveProperty('pendingInspections');
          expect(metrics).toHaveProperty('rejectedMaterials');

          // Ensure business-relevant structure
          expect(metrics.todayInward).toHaveProperty('count');
          expect(metrics.todayInward).toHaveProperty('weight');
          expect(metrics.totalWeight).toHaveProperty('value');
          expect(metrics.totalWeight).toHaveProperty('trend');

          // Convert to JSON to check for system/infrastructure terms
          const responseJson = JSON.stringify(metrics);

          // Ensure no system/infrastructure data is exposed
          expect(responseJson).not.toMatch(/cpuUsage|memoryUsage|diskUsage|queryTime|errorLogs/i);
          expect(responseJson).not.toMatch(/cpu|memory|disk|query|database|server|infrastructure/i);
          expect(responseJson).not.toMatch(/internalId|databaseId|systemId|serverId/i);
          expect(responseJson).not.toMatch(/error|exception|stack|trace|debug/i);

          // Ensure only business-relevant terms are present
          expect(responseJson).toMatch(/count|weight|trend|inward|inspection|rejected/i);

          // Verify data types are business-appropriate
          expect(typeof metrics.todayInward.count).toBe('number');
          expect(typeof metrics.todayInward.weight).toBe('number');
          expect(typeof metrics.totalWeight.value).toBe('number');
          expect(typeof metrics.totalWeight.trend).toBe('string');
        }
      ), { numRuns: 50 });
    });

    it('should only include business data in factory comparison', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          tenantId: fc.string({ minLength: 1, maxLength: 50 }),
          transactions: fc.array(fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            tenantId: fc.string({ minLength: 1, maxLength: 50 }),
            factoryId: fc.string({ minLength: 1, maxLength: 50 }),
            createdAt: fc.date(),
            factory: fc.option(fc.record({
              factoryName: fc.string({ minLength: 1, maxLength: 100 }),
              // System data that should not be exposed
              serverId: fc.string(),
              databaseConnection: fc.string(),
              systemHealth: fc.record({
                status: fc.constantFrom('healthy', 'degraded', 'down'),
                uptime: fc.float({ min: 0, max: 86400, noNaN: true }),
              }),
            })),
            weighbridgeData: fc.option(fc.record({
              netWeight: fc.float({ min: 100, max: 50000, noNaN: true }),
            })),
          }), { minLength: 0, maxLength: 15 }),
        }),
        async ({ tenantId, transactions }) => {
          jest.spyOn(transactionRepository, 'find').mockResolvedValue(transactions as any);

          const comparison = await service.getFactoryComparison(tenantId);

          // Verify business-appropriate structure
          expect(Array.isArray(comparison)).toBe(true);

          for (const factory of comparison) {
            // Should have business-relevant properties
            expect(factory).toHaveProperty('factoryId');
            expect(factory).toHaveProperty('factoryName');
            expect(factory).toHaveProperty('todayCount');
            expect(factory).toHaveProperty('todayWeight');
            expect(factory).toHaveProperty('percentage');

            // Should NOT have system properties
            expect(factory).not.toHaveProperty('serverId');
            expect(factory).not.toHaveProperty('databaseConnection');
            expect(factory).not.toHaveProperty('systemHealth');
            expect(factory).not.toHaveProperty('uptime');

            // Verify business data types
            expect(typeof factory.factoryId).toBe('string');
            expect(typeof factory.factoryName).toBe('string');
            expect(typeof factory.todayCount).toBe('number');
            expect(typeof factory.todayWeight).toBe('number');
            expect(typeof factory.percentage).toBe('number');
          }

          // Check response for system terms
          const responseJson = JSON.stringify(comparison);
          expect(responseJson).not.toMatch(/serverId|databaseConnection|systemHealth|uptime/i);
          expect(responseJson).not.toMatch(/server|database|system|infrastructure|health|status/i);
          expect(responseJson).not.toMatch(/cpu|memory|disk|network|connection/i);

          // Ensure business terms are present (only if there are factories)
          if (comparison.length > 0) {
            expect(responseJson).toMatch(/factoryId|factoryName|todayCount|todayWeight|percentage/i);
          }
        }
      ), { numRuns: 50 });
    });

    it('should only include business data in vendor risk ranking', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          tenantId: fc.string({ minLength: 1, maxLength: 50 }),
          vendorRanking: fc.record({
            topPerformers: fc.array(fc.record({
              vendorName: fc.string({ minLength: 1, maxLength: 100 }),
              riskLevel: fc.constantFrom('LOW', 'MEDIUM', 'HIGH'),
              performanceMetrics: fc.record({
                rejectionPercentage: fc.float({ min: 0, max: 100, noNaN: true }),
              }),
              // System data that should not be exposed
              systemMetrics: fc.option(fc.record({
                apiResponseTime: fc.float({ min: 10, max: 5000, noNaN: true }),
                databaseQueries: fc.integer({ min: 1, max: 1000 }),
                cacheHitRate: fc.float({ min: 0, max: 100, noNaN: true }),
                errorRate: fc.float({ min: 0, max: 10, noNaN: true }),
              })),
            }), { minLength: 0, maxLength: 10 }),
            worstPerformers: fc.array(fc.record({
              vendorName: fc.string({ minLength: 1, maxLength: 100 }),
              riskLevel: fc.constantFrom('LOW', 'MEDIUM', 'HIGH'),
              performanceMetrics: fc.record({
                rejectionPercentage: fc.float({ min: 0, max: 100, noNaN: true }),
              }),
            }), { minLength: 0, maxLength: 10 }),
          }),
        }),
        async ({ tenantId, vendorRanking }) => {
          jest.spyOn(vendorService, 'getVendorPerformanceRanking').mockResolvedValue(vendorRanking as any);

          const ranking = await service.getVendorRiskRanking(tenantId);

          // Verify business structure
          expect(ranking).toHaveProperty('highRisk');
          expect(ranking).toHaveProperty('mediumRisk');
          expect(ranking).toHaveProperty('lowRisk');

          const allVendors = [
            ...ranking.highRisk,
            ...ranking.mediumRisk,
            ...ranking.lowRisk,
          ];

          for (const vendor of allVendors) {
            // Should have business properties
            expect(vendor).toHaveProperty('vendorName');
            expect(vendor).toHaveProperty('rejectionRate');

            // Should NOT have system properties
            expect(vendor).not.toHaveProperty('apiResponseTime');
            expect(vendor).not.toHaveProperty('databaseQueries');
            expect(vendor).not.toHaveProperty('cacheHitRate');
            expect(vendor).not.toHaveProperty('errorRate');
            expect(vendor).not.toHaveProperty('systemMetrics');

            // Verify business data types
            expect(typeof vendor.vendorName).toBe('string');
            expect(typeof vendor.rejectionRate).toBe('number');
            expect(vendor.rejectionRate).toBeGreaterThanOrEqual(0);
            expect(vendor.rejectionRate).toBeLessThanOrEqual(100);
          }

          // Check response for system terms
          const responseJson = JSON.stringify(ranking);
          expect(responseJson).not.toMatch(/apiResponseTime|databaseQueries|cacheHitRate|errorRate/i);
          expect(responseJson).not.toMatch(/api|database|cache|error|system|performance|response|query/i);

          // Ensure business terms
          expect(responseJson).toMatch(/vendorName|rejectionRate|highRisk|mediumRisk|lowRisk/i);
        }
      ), { numRuns: 50 });
    });

    it('should only include business data in inspection trends', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          tenantId: fc.string({ minLength: 1, maxLength: 50 }),
          months: fc.integer({ min: 1, max: 24 }),
          transactions: fc.array(fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            tenantId: fc.string({ minLength: 1, maxLength: 50 }),
            createdAt: fc.date(),
            status: fc.constant('COMPLETED'),
            inspectionData: fc.option(fc.record({
              grade: fc.constantFrom('A', 'B', 'C', 'REJECTED'),
            })),
            levelData: fc.option(fc.record({
              L4: fc.option(fc.record({
                evidenceIds: fc.array(fc.string(), { minLength: 0, maxLength: 5 }),
              })),
            })),
            // System data that should not be exposed
            systemData: fc.option(fc.record({
              processingTime: fc.float({ min: Math.fround(0.1), max: Math.fround(60), noNaN: true }),
              systemLoad: fc.float({ min: 0, max: 100, noNaN: true }),
              memoryUsage: fc.float({ min: 0, max: 100, noNaN: true }),
            })),
          }), { minLength: 0, maxLength: 50 }),
        }),
        async ({ tenantId, months, transactions }) => {
          jest.spyOn(transactionRepository, 'find').mockImplementation(() => {
            return Promise.resolve(transactions as any);
          });

          const trends = await service.getInspectionTrends(tenantId, months);

          // Verify business structure
          expect(Array.isArray(trends)).toBe(true);

          for (const trend of trends) {
            // Should have business properties
            expect(trend).toHaveProperty('period');
            expect(trend).toHaveProperty('rejectionRate');
            expect(trend).toHaveProperty('evidenceCompliance');

            // Should NOT have system properties
            expect(trend).not.toHaveProperty('processingTime');
            expect(trend).not.toHaveProperty('systemLoad');
            expect(trend).not.toHaveProperty('memoryUsage');

            // Verify business data types
            expect(typeof trend.period).toBe('string');
            expect(typeof trend.rejectionRate).toBe('number');
            expect(typeof trend.evidenceCompliance).toBe('number');
            expect(trend.rejectionRate).toBeGreaterThanOrEqual(0);
            expect(trend.evidenceCompliance).toBeGreaterThanOrEqual(0);
          }

          // Check response for system terms
          const responseJson = JSON.stringify(trends);
          expect(responseJson).not.toMatch(/processingTime|systemLoad|memoryUsage/i);
          expect(responseJson).not.toMatch(/processing|system|memory|load|cpu|disk/i);

          // Ensure business terms
          expect(responseJson).toMatch(/period|rejectionRate|evidenceCompliance/i);
        }
      ), { numRuns: 50 });
    });

    it('should only include business data in executive dashboard', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          tenantId: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        async ({ tenantId }) => {
          // Mock clean business data
          const mockMetrics = {
            todayInward: { count: 10, weight: 25.5 },
            totalWeight: { value: 25.5, trend: '+5% vs yesterday' },
            pendingInspections: { count: 3, urgent: 1 },
            rejectedMaterials: { count: 2, trend: '-2% vs yesterday' },
          };

          const mockFactoryComparison = [
            { factoryId: 'f1', factoryName: 'Factory A', todayCount: 5, todayWeight: 12.5, percentage: 50 },
          ];

          const mockInspectionTrends = [
            { period: 'Jan', rejectionRate: 5.2, evidenceCompliance: 95.5 },
          ];

          const mockVendorRanking = {
            highRisk: [{ vendorName: 'Vendor A', rejectionRate: 18.5 }],
            mediumRisk: [{ vendorName: 'Vendor B', rejectionRate: 12.1 }],
            lowRisk: [{ vendorName: 'Vendor C', rejectionRate: 2.3 }],
          };

          jest.spyOn(service, 'getDashboardMetrics').mockResolvedValue(mockMetrics);
          jest.spyOn(service, 'getFactoryComparison').mockResolvedValue(mockFactoryComparison);
          jest.spyOn(service, 'getInspectionTrends').mockResolvedValue(mockInspectionTrends);
          jest.spyOn(service, 'getVendorRiskRanking').mockResolvedValue(mockVendorRanking);

          const dashboard = await service.getExecutiveDashboard(tenantId);

          // Verify business structure
          expect(dashboard).toHaveProperty('metrics');
          expect(dashboard).toHaveProperty('factoryComparison');
          expect(dashboard).toHaveProperty('inspectionTrends');
          expect(dashboard).toHaveProperty('vendorRiskRanking');

          // Check entire response for system/infrastructure terms
          const responseJson = JSON.stringify(dashboard);
          expect(responseJson).not.toMatch(/cpu|memory|disk|server|database|system|infrastructure/i);
          expect(responseJson).not.toMatch(/api|cache|query|error|debug|trace|log/i);
          expect(responseJson).not.toMatch(/processing|load|usage|performance|response|latency/i);

          // Ensure only business terms are present
          expect(responseJson).toMatch(/count|weight|percentage|rejectionRate|evidenceCompliance/i);
          expect(responseJson).toMatch(/todayInward|totalWeight|pendingInspections|rejectedMaterials/i);
          expect(responseJson).toMatch(/factoryName|vendorName|period|trend/i);

          // Verify all data is business-appropriate
          expect(typeof dashboard.metrics.todayInward.count).toBe('number');
          expect(typeof dashboard.factoryComparison[0].factoryName).toBe('string');
          expect(typeof dashboard.inspectionTrends[0].rejectionRate).toBe('number');
          expect(typeof dashboard.vendorRiskRanking.highRisk[0].vendorName).toBe('string');
        }
      ), { numRuns: 50 });
    });
  });
});