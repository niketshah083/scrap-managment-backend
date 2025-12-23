"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const typeorm_1 = require("@nestjs/typeorm");
const common_1 = require("@nestjs/common");
const fc = require("fast-check");
const weighbridge_service_1 = require("./weighbridge.service");
const transaction_entity_1 = require("../entities/transaction.entity");
const evidence_entity_1 = require("../entities/evidence.entity");
const audit_log_entity_1 = require("../entities/audit-log.entity");
describe('WeighbridgeService', () => {
    let service;
    let transactionRepository;
    let evidenceRepository;
    let auditLogRepository;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                weighbridge_service_1.WeighbridgeService,
                {
                    provide: (0, typeorm_1.getRepositoryToken)(transaction_entity_1.Transaction),
                    useValue: {
                        findOne: jest.fn(),
                        save: jest.fn(),
                        create: jest.fn(),
                    },
                },
                {
                    provide: (0, typeorm_1.getRepositoryToken)(evidence_entity_1.Evidence),
                    useValue: {
                        create: jest.fn(),
                        save: jest.fn(),
                    },
                },
                {
                    provide: (0, typeorm_1.getRepositoryToken)(audit_log_entity_1.AuditLog),
                    useValue: {
                        create: jest.fn(),
                        save: jest.fn(),
                    },
                },
            ],
        }).compile();
        service = module.get(weighbridge_service_1.WeighbridgeService);
        transactionRepository = module.get((0, typeorm_1.getRepositoryToken)(transaction_entity_1.Transaction));
        evidenceRepository = module.get((0, typeorm_1.getRepositoryToken)(evidence_entity_1.Evidence));
        auditLogRepository = module.get((0, typeorm_1.getRepositoryToken)(audit_log_entity_1.AuditLog));
    });
    describe('calculateNetWeight', () => {
        it('should correctly calculate net weight and validate thresholds for all valid weight combinations', () => {
            fc.assert(fc.property(fc.float({ min: Math.fround(1), max: Math.fround(100000) }).filter(n => Number.isFinite(n) && n > 0), fc.float({ min: Math.fround(0.1), max: Math.fround(50000) }).filter(n => Number.isFinite(n) && n > 0), fc.float({ min: Math.fround(1), max: Math.fround(50) }).filter(n => Number.isFinite(n) && n > 0), (grossWeight, tareWeightRatio, discrepancyThreshold) => {
                const tareWeight = Math.min(tareWeightRatio, grossWeight * 0.9);
                if (!Number.isFinite(grossWeight) || !Number.isFinite(tareWeight) || !Number.isFinite(discrepancyThreshold)) {
                    return true;
                }
                if (tareWeight >= grossWeight || tareWeight <= 0 || grossWeight <= 0) {
                    return true;
                }
                const result = service.calculateNetWeight(grossWeight, tareWeight, discrepancyThreshold);
                expect(result.netWeight).toBeCloseTo(grossWeight - tareWeight, 2);
                expect(result.grossWeight).toBe(grossWeight);
                expect(result.tareWeight).toBe(tareWeight);
                expect(result.netWeight).toBeGreaterThan(0);
                expect(result.isValid).toBe(true);
                const expectedWeightRatio = tareWeight / grossWeight;
                const expectedDiscrepancy = Math.abs(expectedWeightRatio - 0.5) * 100;
                expect(result.discrepancyPercentage).toBeCloseTo(expectedDiscrepancy, 2);
                const shouldRequireApproval = expectedDiscrepancy > discrepancyThreshold;
                expect(result.requiresSupervisorApproval).toBe(shouldRequireApproval);
                expect(typeof result.grossWeight).toBe('number');
                expect(typeof result.tareWeight).toBe('number');
                expect(typeof result.netWeight).toBe('number');
                expect(typeof result.discrepancyPercentage).toBe('number');
                expect(typeof result.requiresSupervisorApproval).toBe('boolean');
            }), { numRuns: 100 });
        });
        it('should reject invalid weight combinations', () => {
            fc.assert(fc.property(fc.oneof(fc.float({ max: Math.fround(0) }).filter(n => Number.isFinite(n)), fc.float({ max: Math.fround(0) }).filter(n => Number.isFinite(n)), fc.record({
                gross: fc.float({ min: Math.fround(1), max: Math.fround(1000) }).filter(n => Number.isFinite(n) && n > 0),
                tare: fc.float({ min: Math.fround(1001), max: Math.fround(2000) }).filter(n => Number.isFinite(n) && n > 0)
            }).map(({ gross, tare }) => ({ grossWeight: gross, tareWeight: tare })), fc.constant(Number.NaN)), (invalidWeights) => {
                if (typeof invalidWeights === 'number') {
                    if (Number.isNaN(invalidWeights)) {
                        expect(() => service.calculateNetWeight(invalidWeights, 100, 5))
                            .toThrow(common_1.BadRequestException);
                        expect(() => service.calculateNetWeight(1000, invalidWeights, 5))
                            .toThrow(common_1.BadRequestException);
                    }
                    else {
                        expect(() => service.calculateNetWeight(invalidWeights, 100, 5))
                            .toThrow(common_1.BadRequestException);
                        expect(() => service.calculateNetWeight(1000, invalidWeights, 5))
                            .toThrow(common_1.BadRequestException);
                    }
                }
                else {
                    expect(() => service.calculateNetWeight(invalidWeights.grossWeight, invalidWeights.tareWeight, 5)).toThrow(common_1.BadRequestException);
                }
            }), { numRuns: 50 });
        });
    });
    describe('captureGrossWeight', () => {
        it('should capture gross weight and update transaction correctly', async () => {
            const mockTransaction = {
                id: 'test-transaction-id',
                tenantId: 'test-tenant-id',
                factoryId: 'test-factory-id',
                vendorId: 'test-vendor-id',
                vehicleId: 'test-vehicle-id',
                transactionNumber: 'TXN-001',
                currentLevel: transaction_entity_1.OperationalLevel.L2_GATE_ENTRY,
                status: transaction_entity_1.TransactionStatus.ACTIVE,
                isLocked: false,
                weighbridgeData: {},
                levelData: {},
                inspectionData: {},
                grnDocumentUrl: null,
                gatePassQrCode: null,
                gatePassExpiresAt: null,
                completedAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                factory: { weighbridgeConfig: { discrepancyThreshold: 5 } }
            };
            const mockReading = {
                weight: 15750,
                timestamp: new Date(),
                operatorId: 'operator-123',
                equipmentId: 'weighbridge-001',
                ticketNumber: 'WB-001'
            };
            transactionRepository.findOne.mockResolvedValue(mockTransaction);
            transactionRepository.save.mockResolvedValue(mockTransaction);
            evidenceRepository.create.mockReturnValue({});
            evidenceRepository.save.mockResolvedValue({ id: 'evidence-123' });
            auditLogRepository.create.mockReturnValue({});
            auditLogRepository.save.mockResolvedValue({});
            const result = await service.captureGrossWeight('test-transaction-id', mockReading);
            expect(result.weighbridgeData.grossWeight).toBe(15750);
            expect(result.weighbridgeData.grossWeightOperator).toBe('operator-123');
            expect(result.currentLevel).toBe(transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION);
            expect(transactionRepository.save).toHaveBeenCalled();
        });
        it('should reject gross weight capture for invalid transaction states', async () => {
            const mockReading = {
                weight: 15750,
                timestamp: new Date(),
                operatorId: 'operator-123'
            };
            transactionRepository.findOne.mockResolvedValue(null);
            await expect(service.captureGrossWeight('invalid-id', mockReading))
                .rejects.toThrow(common_1.NotFoundException);
            const completedTransaction = {
                id: 'test-id',
                tenantId: 'test-tenant-id',
                factoryId: 'test-factory-id',
                vendorId: 'test-vendor-id',
                vehicleId: 'test-vehicle-id',
                transactionNumber: 'TXN-002',
                status: transaction_entity_1.TransactionStatus.COMPLETED,
                currentLevel: transaction_entity_1.OperationalLevel.L2_GATE_ENTRY,
                isLocked: false,
                weighbridgeData: {},
                levelData: {},
                inspectionData: {},
                grnDocumentUrl: null,
                gatePassQrCode: null,
                gatePassExpiresAt: null,
                completedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            };
            transactionRepository.findOne.mockResolvedValue(completedTransaction);
            await expect(service.captureGrossWeight('test-id', mockReading))
                .rejects.toThrow(common_1.BadRequestException);
            const lockedTransaction = {
                id: 'test-id',
                tenantId: 'test-tenant-id',
                factoryId: 'test-factory-id',
                vendorId: 'test-vendor-id',
                vehicleId: 'test-vehicle-id',
                transactionNumber: 'TXN-003',
                status: transaction_entity_1.TransactionStatus.ACTIVE,
                currentLevel: transaction_entity_1.OperationalLevel.L2_GATE_ENTRY,
                isLocked: true,
                weighbridgeData: {},
                levelData: {},
                inspectionData: {},
                grnDocumentUrl: null,
                gatePassQrCode: null,
                gatePassExpiresAt: null,
                completedAt: null,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            transactionRepository.findOne.mockResolvedValue(lockedTransaction);
            await expect(service.captureGrossWeight('test-id', mockReading))
                .rejects.toThrow(common_1.BadRequestException);
            const wrongLevelTransaction = {
                id: 'test-id',
                tenantId: 'test-tenant-id',
                factoryId: 'test-factory-id',
                vendorId: 'test-vendor-id',
                vehicleId: 'test-vehicle-id',
                transactionNumber: 'TXN-004',
                status: transaction_entity_1.TransactionStatus.ACTIVE,
                currentLevel: transaction_entity_1.OperationalLevel.L1_VENDOR_DISPATCH,
                isLocked: false,
                weighbridgeData: {},
                levelData: {},
                inspectionData: {},
                grnDocumentUrl: null,
                gatePassQrCode: null,
                gatePassExpiresAt: null,
                completedAt: null,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            transactionRepository.findOne.mockResolvedValue(wrongLevelTransaction);
            await expect(service.captureGrossWeight('test-id', mockReading))
                .rejects.toThrow(common_1.BadRequestException);
        });
    });
    describe('captureTareWeight', () => {
        it('should capture tare weight and calculate net weight correctly', async () => {
            const mockTransaction = {
                id: 'test-transaction-id',
                tenantId: 'test-tenant-id',
                factoryId: 'test-factory-id',
                vendorId: 'test-vendor-id',
                vehicleId: 'test-vehicle-id',
                transactionNumber: 'TXN-001',
                currentLevel: transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION,
                status: transaction_entity_1.TransactionStatus.ACTIVE,
                isLocked: false,
                weighbridgeData: {
                    grossWeight: 15750,
                    grossWeightTimestamp: new Date(),
                    grossWeightOperator: 'operator-123'
                },
                levelData: {},
                inspectionData: {},
                grnDocumentUrl: null,
                gatePassQrCode: null,
                gatePassExpiresAt: null,
                completedAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                factory: { weighbridgeConfig: { discrepancyThreshold: 5 } }
            };
            const mockReading = {
                weight: 8250,
                timestamp: new Date(),
                operatorId: 'operator-456',
                equipmentId: 'weighbridge-001',
                ticketNumber: 'WB-002'
            };
            transactionRepository.findOne.mockResolvedValue(mockTransaction);
            transactionRepository.save.mockResolvedValue(mockTransaction);
            evidenceRepository.create.mockReturnValue({});
            evidenceRepository.save.mockResolvedValue({ id: 'evidence-456' });
            auditLogRepository.create.mockReturnValue({});
            auditLogRepository.save.mockResolvedValue({});
            const result = await service.captureTareWeight('test-transaction-id', mockReading);
            expect(result.grossWeight).toBe(15750);
            expect(result.tareWeight).toBe(8250);
            expect(result.netWeight).toBe(7500);
            expect(result.isValid).toBe(true);
            expect(typeof result.discrepancyPercentage).toBe('number');
            expect(typeof result.requiresSupervisorApproval).toBe('boolean');
        });
        it('should require gross weight before tare weight', async () => {
            const mockTransaction = {
                id: 'test-transaction-id',
                tenantId: 'test-tenant-id',
                factoryId: 'test-factory-id',
                vendorId: 'test-vendor-id',
                vehicleId: 'test-vehicle-id',
                transactionNumber: 'TXN-001',
                currentLevel: transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION,
                status: transaction_entity_1.TransactionStatus.ACTIVE,
                isLocked: false,
                weighbridgeData: {},
                levelData: {},
                inspectionData: {},
                grnDocumentUrl: null,
                gatePassQrCode: null,
                gatePassExpiresAt: null,
                completedAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                factory: { weighbridgeConfig: { discrepancyThreshold: 5 } }
            };
            const mockReading = {
                weight: 8250,
                timestamp: new Date(),
                operatorId: 'operator-456'
            };
            transactionRepository.findOne.mockResolvedValue(mockTransaction);
            await expect(service.captureTareWeight('test-transaction-id', mockReading))
                .rejects.toThrow(common_1.BadRequestException);
        });
    });
    describe('validateManualEntry', () => {
        it('should validate manual weight entry with photo evidence', async () => {
            const mockPhoto = {
                originalname: 'weight-ticket.jpg',
                size: 1024,
                mimetype: 'image/jpeg'
            };
            const result = await service.validateManualEntry(15750, mockPhoto, 'operator-123');
            expect(result).toBe(true);
        });
        it('should reject manual entry without photo evidence', async () => {
            await expect(service.validateManualEntry(15750, null, 'operator-123'))
                .rejects.toThrow(common_1.BadRequestException);
        });
        it('should reject invalid weight values', async () => {
            const mockPhoto = {
                originalname: 'weight-ticket.jpg',
                size: 1024,
                mimetype: 'image/jpeg'
            };
            await expect(service.validateManualEntry(0, mockPhoto, 'operator-123'))
                .rejects.toThrow(common_1.BadRequestException);
            await expect(service.validateManualEntry(-100, mockPhoto, 'operator-123'))
                .rejects.toThrow(common_1.BadRequestException);
        });
    });
});
//# sourceMappingURL=weighbridge.service.spec.js.map