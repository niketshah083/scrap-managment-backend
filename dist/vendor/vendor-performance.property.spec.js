"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fc = require("fast-check");
const vendor_service_1 = require("./vendor.service");
const transaction_entity_1 = require("../entities/transaction.entity");
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
    let vendorService;
    beforeAll(async () => {
        vendorService = new vendor_service_1.VendorService(mockVendorRepo, mockTransactionRepo);
    });
    beforeEach(async () => {
        jest.clearAllMocks();
    });
    it('should calculate rejection percentage accurately based on transaction data', async () => {
        await fc.assert(fc.asyncProperty(fc.uuid(), fc.uuid(), fc.array(fc.boolean(), { minLength: 5, maxLength: 20 }), async (vendorId, tenantId, rejectionFlags) => {
            const mockTransactions = rejectionFlags.map((isRejected, index) => ({
                id: `tx-${index}`,
                vendorId,
                tenantId,
                status: transaction_entity_1.TransactionStatus.COMPLETED,
                inspectionData: {
                    grade: isRejected ? 'REJECTED' : 'A',
                    rejectionReason: isRejected ? 'Quality issues detected' : undefined,
                },
                weighbridgeData: {
                    grossWeight: 10000,
                    tareWeight: 3000,
                    netWeight: 7000,
                },
                currentLevel: transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION,
            }));
            mockTransactionRepo.find.mockResolvedValue(mockTransactions);
            const rejectedCount = rejectionFlags.filter(r => r).length;
            const expectedRejectionPercentage = (rejectedCount / rejectionFlags.length) * 100;
            const metrics = await vendorService.calculateVendorPerformance(vendorId, tenantId);
            expect(metrics.rejectionPercentage).toBeCloseTo(expectedRejectionPercentage, 2);
            expect(metrics.totalTransactions).toBe(rejectionFlags.length);
            expect(metrics.inspectionFailureCount).toBe(rejectedCount);
        }), { numRuns: 100, verbose: true });
    });
    it('should calculate weight deviation percentage accurately', async () => {
        await fc.assert(fc.asyncProperty(fc.uuid(), fc.uuid(), fc.array(fc.record({
            grossWeight: fc.integer({ min: 10000, max: 50000 }),
            tareWeight: fc.integer({ min: 2000, max: 8000 }),
            deviationPercent: fc.float({ min: 0, max: 20, noNaN: true }),
        }), { minLength: 3, maxLength: 15 }), async (vendorId, tenantId, weightData) => {
            const mockTransactions = weightData.map((data, index) => {
                const calculatedNet = data.grossWeight - data.tareWeight;
                const deviation = calculatedNet * (data.deviationPercent / 100);
                const recordedNet = Math.round(calculatedNet + deviation);
                return {
                    id: `tx-${index}`,
                    vendorId,
                    tenantId,
                    status: transaction_entity_1.TransactionStatus.COMPLETED,
                    weighbridgeData: {
                        grossWeight: data.grossWeight,
                        tareWeight: data.tareWeight,
                        netWeight: recordedNet,
                    },
                    inspectionData: {
                        grade: 'A',
                    },
                };
            });
            mockTransactionRepo.find.mockResolvedValue(mockTransactions);
            const expectedDeviation = weightData.reduce((sum, data) => sum + data.deviationPercent, 0) / weightData.length;
            const metrics = await vendorService.calculateVendorPerformance(vendorId, tenantId);
            expect(metrics.weightDeviationPercentage).toBeCloseTo(expectedDeviation, 0);
            expect(metrics.totalTransactions).toBe(weightData.length);
        }), { numRuns: 100, verbose: true });
    });
    it('should return zero metrics for vendors with no completed transactions', async () => {
        await fc.assert(fc.asyncProperty(fc.uuid(), fc.uuid(), async (vendorId, tenantId) => {
            mockTransactionRepo.find.mockResolvedValue([]);
            const metrics = await vendorService.calculateVendorPerformance(vendorId, tenantId);
            expect(metrics.rejectionPercentage).toBe(0);
            expect(metrics.weightDeviationPercentage).toBe(0);
            expect(metrics.inspectionFailureCount).toBe(0);
            expect(metrics.totalTransactions).toBe(0);
            expect(metrics.lastUpdated).toBeInstanceOf(Date);
        }), { numRuns: 100, verbose: true });
    });
    it('should calculate risk score as weighted combination of metrics', async () => {
        await fc.assert(fc.asyncProperty(fc.uuid(), fc.uuid(), fc.string({ minLength: 3, maxLength: 50 }), fc.array(fc.record({
            isRejected: fc.boolean(),
            grossWeight: fc.integer({ min: 10000, max: 50000 }),
            tareWeight: fc.integer({ min: 2000, max: 8000 }),
            deviationPercent: fc.float({ min: 0, max: 15, noNaN: true }),
        }), { minLength: 10, maxLength: 20 }), async (vendorId, tenantId, vendorName, transactionData) => {
            const mockTransactions = transactionData.map((data, index) => {
                const calculatedNet = data.grossWeight - data.tareWeight;
                const deviation = calculatedNet * (data.deviationPercent / 100);
                const recordedNet = Math.round(calculatedNet + deviation);
                return {
                    id: `tx-${index}`,
                    vendorId,
                    tenantId,
                    status: transaction_entity_1.TransactionStatus.COMPLETED,
                    weighbridgeData: {
                        grossWeight: data.grossWeight,
                        tareWeight: data.tareWeight,
                        netWeight: recordedNet,
                    },
                    inspectionData: {
                        grade: data.isRejected ? 'REJECTED' : 'A',
                        rejectionReason: data.isRejected ? 'Quality issues' : undefined,
                    },
                    currentLevel: transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION,
                };
            });
            mockTransactionRepo.find.mockResolvedValue(mockTransactions);
            mockVendorRepo.findOne.mockResolvedValue({
                id: vendorId,
                vendorName,
                tenantId,
            });
            const riskScoring = await vendorService.calculateVendorRiskScoring(vendorId, tenantId);
            const rejectionPercentage = riskScoring.performanceMetrics.rejectionPercentage;
            const weightDeviation = riskScoring.performanceMetrics.weightDeviationPercentage;
            const inspectionFailureRate = (riskScoring.performanceMetrics.inspectionFailureCount /
                riskScoring.performanceMetrics.totalTransactions) * 100;
            const expectedRiskScore = Math.min(rejectionPercentage * 0.5 + weightDeviation * 0.3 + inspectionFailureRate * 0.2, 100);
            expect(riskScoring.riskScore).toBeCloseTo(expectedRiskScore, 1);
            expect(riskScoring.riskScore).toBeGreaterThanOrEqual(0);
            expect(riskScoring.riskScore).toBeLessThanOrEqual(100);
            if (riskScoring.riskScore < 15) {
                expect(riskScoring.riskLevel).toBe('LOW');
            }
            else if (riskScoring.riskScore < 35) {
                expect(riskScoring.riskLevel).toBe('MEDIUM');
            }
            else {
                expect(riskScoring.riskLevel).toBe('HIGH');
            }
        }), { numRuns: 50, verbose: true });
    });
    it('should maintain mathematical consistency in performance calculations', async () => {
        await fc.assert(fc.asyncProperty(fc.uuid(), fc.uuid(), fc.array(fc.record({
            isRejected: fc.boolean(),
            hasWeightData: fc.boolean(),
            grossWeight: fc.integer({ min: 10000, max: 50000 }),
            tareWeight: fc.integer({ min: 2000, max: 8000 }),
        }), { minLength: 1, maxLength: 50 }), async (vendorId, tenantId, transactionData) => {
            const mockTransactions = transactionData.map((data, index) => ({
                id: `tx-${index}`,
                vendorId,
                tenantId,
                status: transaction_entity_1.TransactionStatus.COMPLETED,
                weighbridgeData: data.hasWeightData ? {
                    grossWeight: data.grossWeight,
                    tareWeight: data.tareWeight,
                    netWeight: data.grossWeight - data.tareWeight,
                } : undefined,
                inspectionData: {
                    grade: data.isRejected ? 'REJECTED' : 'A',
                    rejectionReason: data.isRejected ? 'Quality issues' : undefined,
                },
                currentLevel: transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION,
            }));
            mockTransactionRepo.find.mockResolvedValue(mockTransactions);
            const metrics = await vendorService.calculateVendorPerformance(vendorId, tenantId);
            expect(metrics.totalTransactions).toBe(transactionData.length);
            const expectedRejectedCount = transactionData.filter(d => d.isRejected).length;
            const expectedRejectionPercentage = (expectedRejectedCount / transactionData.length) * 100;
            expect(metrics.rejectionPercentage).toBeCloseTo(expectedRejectionPercentage, 2);
            expect(metrics.inspectionFailureCount).toBe(expectedRejectedCount);
            const transactionsWithWeight = transactionData.filter(d => d.hasWeightData).length;
            if (transactionsWithWeight > 0) {
                expect(metrics.weightDeviationPercentage).toBeCloseTo(0, 2);
            }
            else {
                expect(metrics.weightDeviationPercentage).toBe(0);
            }
            expect(metrics.rejectionPercentage).toBeGreaterThanOrEqual(0);
            expect(metrics.rejectionPercentage).toBeLessThanOrEqual(100);
            expect(metrics.weightDeviationPercentage).toBeGreaterThanOrEqual(0);
            expect(metrics.weightDeviationPercentage).toBeLessThanOrEqual(100);
        }), { numRuns: 100, verbose: true });
    });
});
//# sourceMappingURL=vendor-performance.property.spec.js.map