import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fc from 'fast-check';
import { AnalyticsService } from './analytics.service';
import { Transaction } from '../entities/transaction.entity';
import { Vendor } from '../entities/vendor.entity';
import { VendorService } from '../vendor/vendor.service';

/**
 * **Feature: scrap-operations-platform, Property 13: Analytics Data Exclusion**
 * 
 * Property: Analytics Data Exclusion
 * For any dashboard or report, the system should never include accounting-related data 
 * (financial amounts, profit/loss, revenue calculations)
 * Validates: Requirements 9.4
 */

describe('Analytics Data Exclusion Property Tests', () => {
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
   * Property Test: Dashboard metrics should never contain financial data
   */
  it('should never include financial data in dashboard metrics', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tenantId: fc.string({ minLength: 1, maxLength: 50 }),
          transactions: fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 50 }),
              tenantId: fc.string({ minLength: 1, maxLength: 50 }),
              factoryId: fc.string({ minLength: 1, maxLength: 50 }),
              vendorId: fc.string({ minLength: 1, maxLength: 50 }),
              vehicleId: fc.string({ minLength: 1, maxLength: 50 }),
              createdAt: fc.date(),
              weighbridgeData: fc.option(fc.record({
                grossWeight: fc.integer({ min: 1000, max: 50000 }), // kg
                tareWeight: fc.integer({ min: 500, max: 10000 }), // kg
                netWeight: fc.integer({ min: 500, max: 45000 }), // kg
              })),
              inspectionData: fc.option(fc.record({
                grade: fc.constantFrom('A', 'B', 'C', 'REJECTED'),
                contamination: fc.integer({ min: 0, max: 100 }), // Use integer to avoid NaN
              })),
              // Intentionally include financial data that should be excluded
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
            }),
            { minLength: 0, maxLength: 20 }
          ),
        }),
        async ({ tenantId, transactions }) => {
          // Mock repository responses
          jest.spyOn(transactionRepository, 'find').mockResolvedValue(transactions as any);

          // Get dashboard metrics
          const metrics = await service.getDashboardMetrics(tenantId);

          // Verify no financial data is included in the response
          const metricsString = JSON.stringify(metrics);
          
          // Check that financial terms are not present in the response
          const financialTerms = [
            'amount', 'rate', 'tax', 'profit', 'revenue', 'cost', 'price', 
            'payment', 'invoice', 'billing', 'accounting', 'financial',
            'money', 'currency', 'rupee', 'dollar', 'inr', 'usd'
          ];

          for (const term of financialTerms) {
            expect(metricsString.toLowerCase()).not.toContain(term.toLowerCase());
          }

          // Verify only operational metrics are present
          expect(metrics).toHaveProperty('todayInward');
          expect(metrics).toHaveProperty('totalWeight');
          expect(metrics).toHaveProperty('pendingInspections');
          expect(metrics).toHaveProperty('rejectedMaterials');

          // Verify weight is in operational units (MT), not financial units
          expect(typeof metrics.todayInward.weight).toBe('number');
          expect(typeof metrics.totalWeight.value).toBe('number');
          
          // Verify counts are integers (operational data)
          expect(Number.isInteger(metrics.todayInward.count)).toBe(true);
          expect(Number.isInteger(metrics.pendingInspections.count)).toBe(true);
          expect(Number.isInteger(metrics.rejectedMaterials.count)).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property Test: Vendor risk ranking should exclude financial performance metrics
   */
  it('should exclude financial performance metrics from vendor risk ranking', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tenantId: fc.string({ minLength: 1, maxLength: 50 }),
          vendorRanking: fc.record({
            worstPerformers: fc.array(
              fc.record({
                vendorName: fc.string({ minLength: 1, maxLength: 100 }),
                riskLevel: fc.constantFrom('HIGH', 'MEDIUM', 'LOW'),
                performanceMetrics: fc.record({
                  rejectionPercentage: fc.integer({ min: 0, max: 100 }), // Use integer to avoid NaN
                  weightDeviationPercentage: fc.integer({ min: 0, max: 50 }),
                  // Financial data that should be excluded
                  profitability: fc.integer({ min: -50, max: 100 }),
                  paymentDelays: fc.integer({ min: 0, max: 90 }),
                }),
              }),
              { minLength: 0, maxLength: 10 }
            ),
            topPerformers: fc.array(
              fc.record({
                vendorName: fc.string({ minLength: 1, maxLength: 100 }),
                riskLevel: fc.constantFrom('HIGH', 'MEDIUM', 'LOW'),
                performanceMetrics: fc.record({
                  rejectionPercentage: fc.integer({ min: 0, max: 100 }), // Use integer to avoid NaN
                  weightDeviationPercentage: fc.integer({ min: 0, max: 50 }),
                }),
              }),
              { minLength: 0, maxLength: 10 }
            ),
          }),
        }),
        async ({ tenantId, vendorRanking }) => {
          // Mock vendor service response
          jest.spyOn(vendorService, 'getVendorPerformanceRanking').mockResolvedValue(vendorRanking as any);

          // Get vendor risk ranking
          const ranking = await service.getVendorRiskRanking(tenantId);

          // Verify no financial data in any risk category
          const allVendors = [
            ...ranking.highRisk,
            ...ranking.mediumRisk,
            ...ranking.lowRisk
          ];

          for (const vendor of allVendors) {
            const vendorString = JSON.stringify(vendor);
            
            // Check that financial terms are not present
            const financialTerms = [
              'profit', 'payment', 'delay', 'credit', 'debt', 'financial',
              'accounting', 'billing', 'invoice', 'amount', 'cost'
            ];

            for (const term of financialTerms) {
              expect(vendorString.toLowerCase()).not.toContain(term.toLowerCase());
            }

            // Verify only operational metrics are present
            expect(vendor).toHaveProperty('vendorName');
            expect(vendor).toHaveProperty('rejectionRate');
            expect(vendor).not.toHaveProperty('profitability');
            expect(vendor).not.toHaveProperty('paymentDelays');
            expect(vendor).not.toHaveProperty('financialScore');

            // Verify operational data types
            expect(typeof vendor.vendorName).toBe('string');
            expect(typeof vendor.rejectionRate).toBe('number');
            expect(vendor.rejectionRate).toBeGreaterThanOrEqual(0);
            expect(vendor.rejectionRate).toBeLessThanOrEqual(100);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property Test: Executive dashboard should never expose system/infrastructure data
   */
  it('should never expose system or infrastructure data in executive dashboard', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tenantId: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        async ({ tenantId }) => {
          // Mock all service methods
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

          // Get executive dashboard
          const dashboard = await service.getExecutiveDashboard(tenantId);
          const dashboardString = JSON.stringify(dashboard);

          // Check that system/infrastructure terms are not present
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

          // Verify only business operational data is present
          expect(dashboard).toHaveProperty('metrics');
          expect(dashboard).toHaveProperty('factoryComparison');
          expect(dashboard).toHaveProperty('inspectionTrends');
          expect(dashboard).toHaveProperty('vendorRiskRanking');

          // Verify no system metadata
          expect(dashboard).not.toHaveProperty('systemInfo');
          expect(dashboard).not.toHaveProperty('serverStats');
          expect(dashboard).not.toHaveProperty('performanceMetrics');
          expect(dashboard).not.toHaveProperty('errorLogs');
        }
      ),
      { numRuns: 50 }
    );
  });
});