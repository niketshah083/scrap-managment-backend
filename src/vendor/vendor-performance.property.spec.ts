import * as fc from 'fast-check';
import { VendorService } from './vendor.service';
import { TransactionStatus, OperationalLevel } from '../entities/transaction.entity';

/**
 * **Feature: scrap-operations-platform, Property 12: Vendor Performance Calculation**
 * 
 * For any vendor, performance metrics (rejection percentage, weight deviation, inspection failures) 
 * should be calculated accurately based on historical transaction data and updated in real-time
 * 
 * **Validates: Requirements 9.2**
 */

// Mock repositories for testing
const mockVendorRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  clear: jest.fn(),
};

const mockTransactionRepo = {
  find: jest.fn(),
  count: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  clear: jest.fn(),
};

describe('Vendor Performance Calculation Properties', () => {
  let vendorService: VendorService;

  beforeAll(async () => {
    vendorService = new VendorService(mockVendorRepo as any, mockTransactionRepo as any);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
  });

  /**
   * Property 12.1: Rejection Percentage Calculation
   * For any vendor with transactions, the rejection percentage should equal 
   * (number of rejected transactions / total transactions) * 100
   */
  it('should calculate rejection percentage accurately based on transaction data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // vendorId
        fc.uuid(), // tenantId
        fc.array(fc.boolean(), { minLength: 5, maxLength: 20 }), // Array of rejection flags
        async (vendorId, tenantId, rejectionFlags) => {
          // Mock transaction data based on rejection flags
          const mockTransactions = rejectionFlags.map((isRejected, index) => ({
            id: `tx-${index}`,
            vendorId,
            tenantId,
            status: TransactionStatus.COMPLETED,
            inspectionData: {
              grade: isRejected ? 'REJECTED' : 'A',
              rejectionReason: isRejected ? 'Quality issues detected' : undefined,
            },
            weighbridgeData: {
              grossWeight: 10000,
              tareWeight: 3000,
              netWeight: 7000,
            },
            currentLevel: OperationalLevel.L4_MATERIAL_INSPECTION,
          }));

          // Setup mock
          mockTransactionRepo.find.mockResolvedValue(mockTransactions);

          // Calculate expected rejection percentage
          const rejectedCount = rejectionFlags.filter(r => r).length;
          const expectedRejectionPercentage = (rejectedCount / rejectionFlags.length) * 100;

          // Test: Calculate performance metrics
          const metrics = await vendorService.calculateVendorPerformance(vendorId, tenantId);

          // Property: Rejection percentage should match expected calculation
          expect(metrics.rejectionPercentage).toBeCloseTo(expectedRejectionPercentage, 2);
          expect(metrics.totalTransactions).toBe(rejectionFlags.length);
          expect(metrics.inspectionFailureCount).toBe(rejectedCount);
        }
      ),
      { numRuns: 100, verbose: true }
    );
  });

  /**
   * Property 12.2: Weight Deviation Calculation
   * For any vendor with weighbridge data, the weight deviation percentage should be calculated 
   * as the average of |calculated_net - recorded_net| / calculated_net * 100 across all transactions
   */
  it('should calculate weight deviation percentage accurately', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // vendorId
        fc.uuid(), // tenantId
        fc.array(
          fc.record({
            grossWeight: fc.integer({ min: 10000, max: 50000 }),
            tareWeight: fc.integer({ min: 2000, max: 8000 }),
            deviationPercent: fc.float({ min: 0, max: 20, noNaN: true }), // 0-20% deviation, no NaN
          }),
          { minLength: 3, maxLength: 15 }
        ),
        async (vendorId, tenantId, weightData) => {
          // Create mock transactions with specified weight deviations
          const mockTransactions = weightData.map((data, index) => {
            const calculatedNet = data.grossWeight - data.tareWeight;
            const deviation = calculatedNet * (data.deviationPercent / 100);
            const recordedNet = Math.round(calculatedNet + deviation);

            return {
              id: `tx-${index}`,
              vendorId,
              tenantId,
              status: TransactionStatus.COMPLETED,
              weighbridgeData: {
                grossWeight: data.grossWeight,
                tareWeight: data.tareWeight,
                netWeight: recordedNet,
              },
              inspectionData: {
                grade: 'A', // Not rejected for this test
              },
            };
          });

          // Setup mock
          mockTransactionRepo.find.mockResolvedValue(mockTransactions);

          // Calculate expected weight deviation
          const expectedDeviation = weightData.reduce((sum, data) => sum + data.deviationPercent, 0) / weightData.length;

          // Test: Calculate performance metrics
          const metrics = await vendorService.calculateVendorPerformance(vendorId, tenantId);

          // Property: Weight deviation should be close to expected (within 1% tolerance due to rounding)
          expect(metrics.weightDeviationPercentage).toBeCloseTo(expectedDeviation, 0);
          expect(metrics.totalTransactions).toBe(weightData.length);
        }
      ),
      { numRuns: 100, verbose: true }
    );
  });

  /**
   * Property 12.3: Zero Transactions Handling
   * For any vendor with zero completed transactions, all performance metrics should be zero
   */
  it('should return zero metrics for vendors with no completed transactions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // vendorId
        fc.uuid(), // tenantId
        async (vendorId, tenantId) => {
          // Setup: Mock empty transaction array
          mockTransactionRepo.find.mockResolvedValue([]);

          // Test: Calculate performance metrics
          const metrics = await vendorService.calculateVendorPerformance(vendorId, tenantId);

          // Property: All metrics should be zero for vendors with no transactions
          expect(metrics.rejectionPercentage).toBe(0);
          expect(metrics.weightDeviationPercentage).toBe(0);
          expect(metrics.inspectionFailureCount).toBe(0);
          expect(metrics.totalTransactions).toBe(0);
          expect(metrics.lastUpdated).toBeInstanceOf(Date);
        }
      ),
      { numRuns: 100, verbose: true }
    );
  });

  /**
   * Property 12.4: Risk Score Calculation
   * For any vendor, the risk score should be a weighted combination of:
   * - 50% rejection percentage
   * - 30% weight deviation percentage  
   * - 20% inspection failure rate
   * And should be capped at 100
   */
  it('should calculate risk score as weighted combination of metrics', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // vendorId
        fc.uuid(), // tenantId
        fc.string({ minLength: 3, maxLength: 50 }), // vendorName
        fc.array(
          fc.record({
            isRejected: fc.boolean(),
            grossWeight: fc.integer({ min: 10000, max: 50000 }),
            tareWeight: fc.integer({ min: 2000, max: 8000 }),
            deviationPercent: fc.float({ min: 0, max: 15, noNaN: true }),
          }),
          { minLength: 10, maxLength: 20 }
        ),
        async (vendorId, tenantId, vendorName, transactionData) => {
          // Create mock transactions
          const mockTransactions = transactionData.map((data, index) => {
            const calculatedNet = data.grossWeight - data.tareWeight;
            const deviation = calculatedNet * (data.deviationPercent / 100);
            const recordedNet = Math.round(calculatedNet + deviation);

            return {
              id: `tx-${index}`,
              vendorId,
              tenantId,
              status: TransactionStatus.COMPLETED,
              weighbridgeData: {
                grossWeight: data.grossWeight,
                tareWeight: data.tareWeight,
                netWeight: recordedNet,
              },
              inspectionData: {
                grade: data.isRejected ? 'REJECTED' : 'A',
                rejectionReason: data.isRejected ? 'Quality issues' : undefined,
              },
              currentLevel: OperationalLevel.L4_MATERIAL_INSPECTION,
            };
          });

          // Setup mocks
          mockTransactionRepo.find.mockResolvedValue(mockTransactions);
          mockVendorRepo.findOne.mockResolvedValue({
            id: vendorId,
            vendorName,
            tenantId,
          });

          // Test: Calculate risk scoring
          const riskScoring = await vendorService.calculateVendorRiskScoring(vendorId, tenantId);

          // Calculate expected risk score
          const rejectionPercentage = riskScoring.performanceMetrics.rejectionPercentage;
          const weightDeviation = riskScoring.performanceMetrics.weightDeviationPercentage;
          const inspectionFailureRate = (riskScoring.performanceMetrics.inspectionFailureCount / 
                                         riskScoring.performanceMetrics.totalTransactions) * 100;

          const expectedRiskScore = Math.min(
            rejectionPercentage * 0.5 + weightDeviation * 0.3 + inspectionFailureRate * 0.2,
            100
          );

          // Property: Risk score should match weighted calculation
          expect(riskScoring.riskScore).toBeCloseTo(expectedRiskScore, 1);
          
          // Property: Risk score should be between 0 and 100
          expect(riskScoring.riskScore).toBeGreaterThanOrEqual(0);
          expect(riskScoring.riskScore).toBeLessThanOrEqual(100);

          // Property: Risk level should match risk score thresholds
          if (riskScoring.riskScore < 15) {
            expect(riskScoring.riskLevel).toBe('LOW');
          } else if (riskScoring.riskScore < 35) {
            expect(riskScoring.riskLevel).toBe('MEDIUM');
          } else {
            expect(riskScoring.riskLevel).toBe('HIGH');
          }
        }
      ),
      { numRuns: 50, verbose: true }
    );
  });

  /**
   * Property 12.5: Performance Metrics Consistency
   * For any set of transactions, the calculated metrics should be mathematically consistent
   */
  it('should maintain mathematical consistency in performance calculations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // vendorId
        fc.uuid(), // tenantId
        fc.array(
          fc.record({
            isRejected: fc.boolean(),
            hasWeightData: fc.boolean(),
            grossWeight: fc.integer({ min: 10000, max: 50000 }),
            tareWeight: fc.integer({ min: 2000, max: 8000 }),
          }),
          { minLength: 1, maxLength: 50 }
        ),
        async (vendorId, tenantId, transactionData) => {
          // Create mock transactions
          const mockTransactions = transactionData.map((data, index) => ({
            id: `tx-${index}`,
            vendorId,
            tenantId,
            status: TransactionStatus.COMPLETED,
            weighbridgeData: data.hasWeightData ? {
              grossWeight: data.grossWeight,
              tareWeight: data.tareWeight,
              netWeight: data.grossWeight - data.tareWeight, // Perfect calculation for consistency
            } : undefined,
            inspectionData: {
              grade: data.isRejected ? 'REJECTED' : 'A',
              rejectionReason: data.isRejected ? 'Quality issues' : undefined,
            },
            currentLevel: OperationalLevel.L4_MATERIAL_INSPECTION,
          }));

          // Setup mock
          mockTransactionRepo.find.mockResolvedValue(mockTransactions);

          // Test: Calculate performance metrics
          const metrics = await vendorService.calculateVendorPerformance(vendorId, tenantId);

          // Property: Total transactions should match input
          expect(metrics.totalTransactions).toBe(transactionData.length);

          // Property: Rejection count should be consistent
          const expectedRejectedCount = transactionData.filter(d => d.isRejected).length;
          const expectedRejectionPercentage = (expectedRejectedCount / transactionData.length) * 100;
          expect(metrics.rejectionPercentage).toBeCloseTo(expectedRejectionPercentage, 2);
          expect(metrics.inspectionFailureCount).toBe(expectedRejectedCount);

          // Property: Weight deviation should be zero for perfect calculations
          const transactionsWithWeight = transactionData.filter(d => d.hasWeightData).length;
          if (transactionsWithWeight > 0) {
            expect(metrics.weightDeviationPercentage).toBeCloseTo(0, 2);
          } else {
            expect(metrics.weightDeviationPercentage).toBe(0);
          }

          // Property: All percentages should be between 0 and 100
          expect(metrics.rejectionPercentage).toBeGreaterThanOrEqual(0);
          expect(metrics.rejectionPercentage).toBeLessThanOrEqual(100);
          expect(metrics.weightDeviationPercentage).toBeGreaterThanOrEqual(0);
          expect(metrics.weightDeviationPercentage).toBeLessThanOrEqual(100);
        }
      ),
      { numRuns: 100, verbose: true }
    );
  });
});
