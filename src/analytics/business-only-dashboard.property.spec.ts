import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fc from 'fast-check';
import { AnalyticsService } from './analytics.service';
import { Transaction } from '../entities/transaction.entity';
import { Vendor } from '../entities/vendor.entity';
import { VendorService } from '../vendor/vendor.service';

/**
 * **Feature: scrap-operations-platform, Property: Business-Only Dashboard Data**
 * 
 * Property: Business-Only Dashboard Data
 * For any dashboard data, the system should only expose business operational metrics
 * and never include system, infrastructure, or technical implementation details
 * Validates: Requirements 9.1, 9.3, 9.4
 */

describe('Business-Only Dashboard Data Property Tests', () => {
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
   * Property Test: Dashboard should only contain business operational metrics
   */
  it('should only contain business operational metrics in dashboard', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tenantId: fc.string({ minLength: 1, maxLength: 50 }),
          businessData: fc.record({
            transactions: fc.array(
              fc.record({
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
                // System data that should NOT be exposed
                systemData: fc.option(fc.record({
                  serverId: fc.string(),
                  processingTime: fc.integer({ min: 10, max: 5000 }),
                  memoryUsage: fc.float({ min: Math.fround(0.1), max: Math.fround(0.9) }),
                  cpuUsage: fc.float({ min: Math.fround(0.05), max: Math.fround(0.95) }),
                  databaseConnections: fc.integer({ min: 1, max: 100 }),
                  apiResponseTime: fc.integer({ min: 50, max: 2000 }),
                })),
              }),
              { minLength: 0, maxLength: 20 }
            ),
          }),
        }),
        async ({ tenantId, businessData }) => {
          // Mock repository responses with business data
          jest.spyOn(transactionRepository, 'find').mockResolvedValue(businessData.transactions as any);

          // Get dashboard metrics
          const metrics = await service.getDashboardMetrics(tenantId);

          // Verify only business operational metrics are present
          const allowedBusinessMetrics = [
            'todayInward', 'totalWeight', 'pendingInspections', 'rejectedMaterials',
            'count', 'weight', 'trend', 'urgent', 'value', 'trendValue'
          ];

          const metricsKeys = getAllKeys(metrics);
          
          for (const key of metricsKeys) {
            const keyLower = key.toLowerCase();
            
            // Verify key is a business metric
            const isBusinessMetric = allowedBusinessMetrics.some(allowed => 
              keyLower.includes(allowed.toLowerCase())
            );
            
            // Or is a standard data type (string, number, boolean values)
            const isStandardValue = typeof metrics[key] === 'string' || 
                                   typeof metrics[key] === 'number' || 
                                   typeof metrics[key] === 'boolean';

            expect(isBusinessMetric || isStandardValue).toBe(true);
          }

          // Verify no system/technical metrics are present
          const forbiddenSystemMetrics = [
            'server', 'cpu', 'memory', 'database', 'api', 'processing',
            'connection', 'response', 'latency', 'uptime', 'error',
            'exception', 'log', 'debug', 'trace', 'system', 'infrastructure'
          ];

          const metricsString = JSON.stringify(metrics).toLowerCase();
          
          for (const forbidden of forbiddenSystemMetrics) {
            expect(metricsString).not.toContain(forbidden.toLowerCase());
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property Test: Factory comparison should only show business operational data
   */
  it('should only show business operational data in factory comparison', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tenantId: fc.string({ minLength: 1, maxLength: 50 }),
          factoryTransactions: fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 50 }),
              tenantId: fc.string({ minLength: 1, maxLength: 50 }),
              factoryId: fc.string({ minLength: 1, maxLength: 50 }),
              createdAt: fc.date(),
              weighbridgeData: fc.option(fc.record({
                netWeight: fc.integer({ min: 500, max: 45000 }),
              })),
              factory: fc.option(fc.record({
                factoryName: fc.string({ minLength: 1, maxLength: 100 }),
                // System data that should NOT be exposed
                serverLocation: fc.string(),
                databaseShardId: fc.string(),
                loadBalancerId: fc.string(),
              })),
            }),
            { minLength: 0, maxLength: 15 }
          ),
        }),
        async ({ tenantId, factoryTransactions }) => {
          // Mock repository responses
          jest.spyOn(transactionRepository, 'find').mockResolvedValue(factoryTransactions as any);

          // Get factory comparison
          const comparison = await service.getFactoryComparison(tenantId);

          // Verify only business operational data for each factory
          for (const factory of comparison) {
            // Verify required business fields are present
            expect(factory).toHaveProperty('factoryId');
            expect(factory).toHaveProperty('factoryName');
            expect(factory).toHaveProperty('todayCount');
            expect(factory).toHaveProperty('todayWeight');
            expect(factory).toHaveProperty('percentage');

            // Verify no system/infrastructure fields are present
            expect(factory).not.toHaveProperty('serverLocation');
            expect(factory).not.toHaveProperty('databaseShardId');
            expect(factory).not.toHaveProperty('loadBalancerId');
            expect(factory).not.toHaveProperty('systemMetrics');
            expect(factory).not.toHaveProperty('performanceStats');

            // Verify data types are business-appropriate
            expect(typeof factory.factoryId).toBe('string');
            expect(typeof factory.factoryName).toBe('string');
            expect(Number.isInteger(factory.todayCount)).toBe(true);
            expect(typeof factory.todayWeight).toBe('number');
            expect(typeof factory.percentage).toBe('number');

            // Verify business value ranges
            expect(factory.todayCount).toBeGreaterThanOrEqual(0);
            expect(factory.todayWeight).toBeGreaterThanOrEqual(0);
            expect(factory.percentage).toBeGreaterThanOrEqual(0);
            expect(factory.percentage).toBeLessThanOrEqual(100);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property Test: Inspection trends should only contain business quality metrics
   */
  it('should only contain business quality metrics in inspection trends', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tenantId: fc.string({ minLength: 1, maxLength: 50 }),
          months: fc.integer({ min: 1, max: 12 }),
        }),
        async ({ tenantId, months }) => {
          // Mock transactions with mixed business and system data
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
            // System data that should NOT be exposed
            systemMetrics: {
              processingTimeMs: 1500 + i * 100,
              databaseQueryCount: 5 + i,
              cacheHitRate: 0.85 + Math.random() * 0.1,
            }
          }));

          jest.spyOn(transactionRepository, 'find').mockResolvedValue(mockTransactions as any);

          // Get inspection trends
          const trends = await service.getInspectionTrends(tenantId, months);

          // Verify only business quality metrics for each trend period
          for (const trend of trends) {
            // Verify required business fields are present
            expect(trend).toHaveProperty('period');
            expect(trend).toHaveProperty('rejectionRate');
            expect(trend).toHaveProperty('evidenceCompliance');

            // Verify no system metrics are present
            expect(trend).not.toHaveProperty('processingTime');
            expect(trend).not.toHaveProperty('databaseQueries');
            expect(trend).not.toHaveProperty('cacheHitRate');
            expect(trend).not.toHaveProperty('systemPerformance');
            expect(trend).not.toHaveProperty('serverMetrics');

            // Verify business data types and ranges
            expect(typeof trend.period).toBe('string');
            expect(typeof trend.rejectionRate).toBe('number');
            expect(typeof trend.evidenceCompliance).toBe('number');

            // Verify business value ranges (percentages)
            expect(trend.rejectionRate).toBeGreaterThanOrEqual(0);
            expect(trend.rejectionRate).toBeLessThanOrEqual(100);
            expect(trend.evidenceCompliance).toBeGreaterThanOrEqual(0);
            expect(trend.evidenceCompliance).toBeLessThanOrEqual(100);

            // Verify period format is business-friendly (month names)
            expect(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']).toContain(trend.period);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property Test: Vendor risk ranking should only show business performance data
   */
  it('should only show business performance data in vendor risk ranking', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tenantId: fc.string({ minLength: 1, maxLength: 50 }),
          vendorData: fc.record({
            worstPerformers: fc.array(
              fc.record({
                vendorName: fc.string({ minLength: 1, maxLength: 100 }),
                riskLevel: fc.constantFrom('HIGH', 'MEDIUM', 'LOW'),
                performanceMetrics: fc.record({
                  rejectionPercentage: fc.float({ min: 0, max: 100 }),
                  weightDeviationPercentage: fc.float({ min: 0, max: 50 }),
                  inspectionFailureCount: fc.integer({ min: 0, max: 50 }),
                  totalTransactions: fc.integer({ min: 1, max: 1000 }),
                }),
                // System data that should NOT be exposed
                systemMetrics: fc.option(fc.record({
                  apiCallCount: fc.integer({ min: 100, max: 10000 }),
                  averageResponseTime: fc.integer({ min: 50, max: 2000 }),
                  errorRate: fc.float({ min: Math.fround(0), max: Math.fround(0.1) }),
                  databaseConnections: fc.integer({ min: 1, max: 20 }),
                })),
              }),
              { minLength: 0, maxLength: 8 }
            ),
            topPerformers: fc.array(
              fc.record({
                vendorName: fc.string({ minLength: 1, maxLength: 100 }),
                riskLevel: fc.constantFrom('HIGH', 'MEDIUM', 'LOW'),
                performanceMetrics: fc.record({
                  rejectionPercentage: fc.float({ min: 0, max: 100 }),
                  weightDeviationPercentage: fc.float({ min: 0, max: 50 }),
                }),
              }),
              { minLength: 0, maxLength: 8 }
            ),
          }),
        }),
        async ({ tenantId, vendorData }) => {
          // Mock vendor service response
          jest.spyOn(vendorService, 'getVendorPerformanceRanking').mockResolvedValue(vendorData as any);

          // Get vendor risk ranking
          const ranking = await service.getVendorRiskRanking(tenantId);

          // Verify only business performance data for all risk categories
          const allRiskCategories = [
            { name: 'highRisk', vendors: ranking.highRisk },
            { name: 'mediumRisk', vendors: ranking.mediumRisk },
            { name: 'lowRisk', vendors: ranking.lowRisk },
          ];

          for (const category of allRiskCategories) {
            for (const vendor of category.vendors) {
              // Verify required business fields are present
              expect(vendor).toHaveProperty('vendorName');
              expect(vendor).toHaveProperty('rejectionRate');

              // Verify no system metrics are present
              expect(vendor).not.toHaveProperty('apiCallCount');
              expect(vendor).not.toHaveProperty('averageResponseTime');
              expect(vendor).not.toHaveProperty('errorRate');
              expect(vendor).not.toHaveProperty('databaseConnections');
              expect(vendor).not.toHaveProperty('systemMetrics');
              expect(vendor).not.toHaveProperty('performanceStats');

              // Verify business data types
              expect(typeof vendor.vendorName).toBe('string');
              expect(typeof vendor.rejectionRate).toBe('number');

              // Verify business value ranges
              expect(vendor.vendorName.length).toBeGreaterThan(0);
              expect(vendor.rejectionRate).toBeGreaterThanOrEqual(0);
              expect(vendor.rejectionRate).toBeLessThanOrEqual(100);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property Test: Executive dashboard should aggregate only business-relevant data
   */
  it('should aggregate only business-relevant data in executive dashboard', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tenantId: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        async ({ tenantId }) => {
          // Mock all service methods with business data only
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

          // Get executive dashboard
          const dashboard = await service.getExecutiveDashboard(tenantId);

          // Verify structure contains only business sections
          expect(dashboard).toHaveProperty('metrics');
          expect(dashboard).toHaveProperty('factoryComparison');
          expect(dashboard).toHaveProperty('inspectionTrends');
          expect(dashboard).toHaveProperty('vendorRiskRanking');

          // Verify no system/infrastructure sections
          expect(dashboard).not.toHaveProperty('systemHealth');
          expect(dashboard).not.toHaveProperty('serverMetrics');
          expect(dashboard).not.toHaveProperty('databaseStats');
          expect(dashboard).not.toHaveProperty('apiPerformance');
          expect(dashboard).not.toHaveProperty('errorLogs');
          expect(dashboard).not.toHaveProperty('infrastructureStatus');

          // Verify all data is business-focused
          const dashboardString = JSON.stringify(dashboard);
          
          // Business terms that should be present
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

          // System terms that should NOT be present
          const systemTerms = [
            'server', 'database', 'api', 'cpu', 'memory', 'disk', 'network',
            'latency', 'throughput', 'connection', 'query', 'cache', 'redis'
          ];

          for (const term of systemTerms) {
            expect(dashboardString.toLowerCase()).not.toContain(term.toLowerCase());
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Helper function to get all keys from nested object
   */
  function getAllKeys(obj: any, prefix = ''): string[] {
    let keys: string[] = [];
    
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