"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const typeorm_1 = require("@nestjs/typeorm");
const fc = require("fast-check");
const gate_pass_service_1 = require("./gate-pass.service");
const transaction_entity_1 = require("../entities/transaction.entity");
const vehicle_entity_1 = require("../entities/vehicle.entity");
const audit_log_entity_1 = require("../entities/audit-log.entity");
describe('GatePassService', () => {
    let service;
    let transactionRepository;
    let vehicleRepository;
    let auditLogRepository;
    const mockTransactionRepository = {
        findOne: jest.fn(),
        update: jest.fn(),
        save: jest.fn(),
    };
    const mockVehicleRepository = {
        update: jest.fn(),
    };
    const mockAuditLogRepository = {
        save: jest.fn(),
    };
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                gate_pass_service_1.GatePassService,
                {
                    provide: (0, typeorm_1.getRepositoryToken)(transaction_entity_1.Transaction),
                    useValue: mockTransactionRepository,
                },
                {
                    provide: (0, typeorm_1.getRepositoryToken)(vehicle_entity_1.Vehicle),
                    useValue: mockVehicleRepository,
                },
                {
                    provide: (0, typeorm_1.getRepositoryToken)(audit_log_entity_1.AuditLog),
                    useValue: mockAuditLogRepository,
                },
            ],
        }).compile();
        service = module.get(gate_pass_service_1.GatePassService);
        transactionRepository = module.get((0, typeorm_1.getRepositoryToken)(transaction_entity_1.Transaction));
        vehicleRepository = module.get((0, typeorm_1.getRepositoryToken)(vehicle_entity_1.Vehicle));
        auditLogRepository = module.get((0, typeorm_1.getRepositoryToken)(audit_log_entity_1.AuditLog));
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    describe('Property 14: Gate Pass Time-Bound Validation', () => {
        it('should generate time-bound QR codes with correct expiration', async () => {
            await fc.assert(fc.asyncProperty(fc.record({
                transactionId: fc.uuid(),
                userId: fc.uuid(),
                validityHours: fc.integer({ min: 1, max: 72 }),
                vehicleNumber: fc.string({ minLength: 5, maxLength: 15 }).filter(s => /^[A-Z0-9\s]+$/.test(s)),
                tenantId: fc.uuid(),
                factoryId: fc.uuid(),
            }), async ({ transactionId, userId, validityHours, vehicleNumber, tenantId, factoryId }) => {
                const mockTransaction = {
                    id: transactionId,
                    tenantId,
                    factoryId,
                    currentLevel: transaction_entity_1.OperationalLevel.L6_GRN_GENERATION,
                    status: transaction_entity_1.TransactionStatus.ACTIVE,
                    levelData: {
                        [transaction_entity_1.OperationalLevel.L6_GRN_GENERATION]: {
                            level: transaction_entity_1.OperationalLevel.L6_GRN_GENERATION,
                            fieldValues: { grn_number: 'GRN-001' },
                            completedBy: userId,
                            completedAt: new Date(),
                            evidenceIds: [],
                            validationStatus: 'APPROVED'
                        }
                    },
                    gatePassQrCode: null,
                    gatePassExpiresAt: null,
                    vehicle: {
                        id: fc.sample(fc.uuid(), 1)[0],
                        vehicleNumber,
                        visitHistory: []
                    }
                };
                mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);
                mockTransactionRepository.update.mockResolvedValue({ affected: 1 });
                mockAuditLogRepository.save.mockResolvedValue({});
                const startTime = new Date();
                const result = await service.generateGatePass(transactionId, userId, validityHours);
                const endTime = new Date();
                expect(result.transactionId).toBe(transactionId);
                expect(result.vehicleNumber).toBe(vehicleNumber);
                expect(result.qrCode).toBeDefined();
                expect(result.expiresAt).toBeInstanceOf(Date);
                expect(result.generatedBy).toBe(userId);
                const expectedMinExpiry = new Date(startTime.getTime() + validityHours * 60 * 60 * 1000);
                const expectedMaxExpiry = new Date(endTime.getTime() + validityHours * 60 * 60 * 1000);
                expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMinExpiry.getTime());
                expect(result.expiresAt.getTime()).toBeLessThanOrEqual(expectedMaxExpiry.getTime());
                expect(result.qrCode).toMatch(/^data:image\/png;base64,/);
                expect(mockTransactionRepository.update).toHaveBeenCalledWith(transactionId, expect.objectContaining({
                    gatePassQrCode: expect.any(String),
                    gatePassExpiresAt: expect.any(Date),
                    currentLevel: transaction_entity_1.OperationalLevel.L7_GATE_PASS_EXIT
                }));
            }), { numRuns: 10, timeout: 10000 });
        }, 15000);
        it('should validate time limits during exit attempts', async () => {
            await fc.assert(fc.asyncProperty(fc.record({
                transactionId: fc.uuid(),
                vehicleNumber: fc.string({ minLength: 5, maxLength: 15 }).filter(s => /^[A-Z0-9\s]+$/.test(s)),
                isExpired: fc.boolean(),
                isAlreadyUsed: fc.boolean(),
            }), async ({ transactionId, vehicleNumber, isExpired, isAlreadyUsed }) => {
                const now = new Date();
                const expiresAt = isExpired
                    ? new Date(now.getTime() - 60 * 60 * 1000)
                    : new Date(now.getTime() + 60 * 60 * 1000);
                const qrData = {
                    transactionId,
                    vehicleNumber,
                    generatedAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
                    expiresAt: expiresAt.toISOString(),
                    nonce: fc.sample(fc.uuid(), 1)[0]
                };
                const qrCodeData = JSON.stringify(qrData);
                const mockTransaction = {
                    id: transactionId,
                    status: isAlreadyUsed ? transaction_entity_1.TransactionStatus.COMPLETED : transaction_entity_1.TransactionStatus.ACTIVE,
                    gatePassQrCode: qrCodeData,
                    gatePassExpiresAt: expiresAt,
                    vehicle: {
                        vehicleNumber
                    }
                };
                mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);
                const result = await service.validateGatePass(qrCodeData);
                if (isAlreadyUsed) {
                    expect(result.isValid).toBe(false);
                    expect(result.errors).toContain('Gate pass already used - vehicle has exited');
                }
                else if (isExpired) {
                    expect(result.isValid).toBe(false);
                    expect(result.errors).toContain('Gate pass has expired');
                    expect(result.requiresSupervisorOverride).toBe(true);
                }
                else {
                    expect(result.isValid).toBe(true);
                    expect(result.errors).toHaveLength(0);
                    expect(result.transaction).toBeDefined();
                }
            }), { numRuns: 100 });
        });
        it('should prevent reuse of expired or used passes', async () => {
            await fc.assert(fc.asyncProperty(fc.record({
                transactionId: fc.uuid(),
                userId: fc.uuid(),
                vehicleNumber: fc.string({ minLength: 5, maxLength: 15 }).filter(s => /^[A-Z0-9\s]+$/.test(s)),
            }), async ({ transactionId, userId, vehicleNumber }) => {
                const existingExpiry = new Date(Date.now() + 2 * 60 * 60 * 1000);
                const mockTransaction = {
                    id: transactionId,
                    currentLevel: transaction_entity_1.OperationalLevel.L6_GRN_GENERATION,
                    status: transaction_entity_1.TransactionStatus.ACTIVE,
                    levelData: {
                        [transaction_entity_1.OperationalLevel.L6_GRN_GENERATION]: {
                            validationStatus: 'APPROVED'
                        }
                    },
                    gatePassQrCode: 'existing-qr-code',
                    gatePassExpiresAt: existingExpiry,
                    vehicle: { vehicleNumber }
                };
                mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);
                await expect(service.generateGatePass(transactionId, userId, 24)).rejects.toThrow('Valid gate pass already exists for this transaction');
                expect(mockTransactionRepository.update).not.toHaveBeenCalled();
            }), { numRuns: 30 });
        });
        it('should require GRN completion before gate pass generation', async () => {
            await fc.assert(fc.asyncProperty(fc.record({
                transactionId: fc.uuid(),
                userId: fc.uuid(),
                currentLevel: fc.constantFrom(transaction_entity_1.OperationalLevel.L1_VENDOR_DISPATCH, transaction_entity_1.OperationalLevel.L2_GATE_ENTRY, transaction_entity_1.OperationalLevel.L3_WEIGHBRIDGE_GROSS, transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION, transaction_entity_1.OperationalLevel.L5_WEIGHBRIDGE_TARE),
            }), async ({ transactionId, userId, currentLevel }) => {
                const mockTransaction = {
                    id: transactionId,
                    currentLevel,
                    levelData: {},
                    vehicle: { vehicleNumber: 'TEST123' }
                };
                mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);
                await expect(service.generateGatePass(transactionId, userId, 24)).rejects.toThrow('Gate pass cannot be generated without completed GRN');
            }), { numRuns: 50 });
        });
    });
    describe('Property 15: Vehicle Record Management', () => {
        it('should lock vehicle record and update visit history after exit', async () => {
            const transactionId = fc.sample(fc.uuid(), 1)[0];
            const userId = fc.sample(fc.uuid(), 1)[0];
            const vehicleId = fc.sample(fc.uuid(), 1)[0];
            const vehicleNumber = 'TEST123';
            const tenantId = fc.sample(fc.uuid(), 1)[0];
            const factoryId = fc.sample(fc.uuid(), 1)[0];
            const existingVisitHistory = [];
            const qrData = {
                transactionId,
                vehicleNumber,
                generatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
                expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                nonce: fc.sample(fc.uuid(), 1)[0]
            };
            const mockTransaction = {
                id: transactionId,
                tenantId,
                factoryId,
                status: transaction_entity_1.TransactionStatus.ACTIVE,
                gatePassQrCode: JSON.stringify(qrData),
                gatePassExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
                isLocked: false,
                vehicle: {
                    id: vehicleId,
                    vehicleNumber,
                    visitHistory: existingVisitHistory
                }
            };
            mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);
            mockTransactionRepository.update.mockResolvedValue({ affected: 1 });
            mockVehicleRepository.update.mockResolvedValue({ affected: 1 });
            mockAuditLogRepository.save.mockResolvedValue({});
            await service.processVehicleExit(transactionId, userId, false);
            expect(mockTransactionRepository.update).toHaveBeenCalledWith(transactionId, expect.objectContaining({
                status: transaction_entity_1.TransactionStatus.COMPLETED,
                isLocked: true,
                completedAt: expect.any(Date)
            }));
            expect(mockVehicleRepository.update).toHaveBeenCalledWith(vehicleId, expect.objectContaining({
                visitHistory: expect.arrayContaining([
                    expect.objectContaining({
                        transactionId,
                        visitDate: expect.any(Date),
                        factoryId,
                        status: 'COMPLETED'
                    })
                ])
            }));
            expect(mockAuditLogRepository.save).toHaveBeenCalledWith(expect.objectContaining({
                userId,
                transactionId,
                action: audit_log_entity_1.AuditAction.VEHICLE_EXIT_COMPLETED,
                entityType: 'Transaction',
                entityId: transactionId,
                description: 'Vehicle exit completed',
                newValues: expect.objectContaining({
                    vehicleNumber,
                    supervisorOverride: false,
                    status: transaction_entity_1.TransactionStatus.COMPLETED
                }),
                metadata: expect.objectContaining({
                    operationalLevel: transaction_entity_1.OperationalLevel.L7_GATE_PASS_EXIT
                }),
                timestamp: expect.any(Date)
            }));
        });
        it('should prevent modifications to locked transactions', async () => {
            const transactionId = fc.sample(fc.uuid(), 1)[0];
            const vehicleNumber = 'TEST123';
            const mockTransaction = {
                id: transactionId,
                status: transaction_entity_1.TransactionStatus.COMPLETED,
                isLocked: true,
                gatePassQrCode: 'some-qr-code',
                vehicle: { vehicleNumber }
            };
            mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);
            const qrData = JSON.stringify({
                transactionId,
                vehicleNumber,
                expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
            });
            const result = await service.validateGatePass(qrData);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Gate pass already used - vehicle has exited');
        });
        it('should handle supervisor override with proper audit trail', async () => {
            const transactionId = fc.sample(fc.uuid(), 1)[0];
            const supervisorId = fc.sample(fc.uuid(), 1)[0];
            const justification = 'Emergency exit required due to operational needs';
            const vehicleNumber = 'TEST123';
            const tenantId = fc.sample(fc.uuid(), 1)[0];
            const factoryId = fc.sample(fc.uuid(), 1)[0];
            const expiredTime = new Date(Date.now() - 60 * 60 * 1000);
            const mockTransaction = {
                id: transactionId,
                tenantId,
                factoryId,
                status: transaction_entity_1.TransactionStatus.ACTIVE,
                gatePassExpiresAt: expiredTime,
                isLocked: false,
                vehicle: {
                    vehicleNumber,
                    visitHistory: []
                }
            };
            mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);
            mockTransactionRepository.update.mockResolvedValue({ affected: 1 });
            mockVehicleRepository.update.mockResolvedValue({ affected: 1 });
            mockAuditLogRepository.save.mockResolvedValue({});
            await service.supervisorOverrideExpiredGatePass(transactionId, supervisorId, justification);
            expect(mockAuditLogRepository.save).toHaveBeenCalledWith(expect.objectContaining({
                userId: supervisorId,
                transactionId,
                action: audit_log_entity_1.AuditAction.SUPERVISOR_OVERRIDE_EXPIRED_GATE_PASS,
                entityType: 'Transaction',
                entityId: transactionId,
                description: 'Supervisor override for expired gate pass',
                newValues: expect.objectContaining({
                    justification,
                    originalExpiryTime: expiredTime.toISOString()
                }),
                metadata: expect.objectContaining({
                    operationalLevel: transaction_entity_1.OperationalLevel.L7_GATE_PASS_EXIT
                }),
                timestamp: expect.any(Date)
            }));
            expect(mockAuditLogRepository.save).toHaveBeenCalledWith(expect.objectContaining({
                action: audit_log_entity_1.AuditAction.VEHICLE_EXIT_SUPERVISOR_OVERRIDE,
                newValues: expect.objectContaining({
                    supervisorOverride: true
                })
            }));
        });
    });
    describe('Edge Cases and Error Handling', () => {
        it('should handle invalid QR code format', async () => {
            const invalidQrCodes = [
                'invalid-json',
                '{"incomplete": "data"}',
                '',
                'null',
                '[]'
            ];
            for (const invalidQr of invalidQrCodes) {
                const result = await service.validateGatePass(invalidQr);
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('Invalid QR code format');
            }
        });
        it('should handle vehicle number mismatch', async () => {
            const qrData = JSON.stringify({
                transactionId: 'test-id',
                vehicleNumber: 'WRONG123',
                expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
            });
            const mockTransaction = {
                id: 'test-id',
                vehicle: { vehicleNumber: 'CORRECT456' }
            };
            mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);
            const result = await service.validateGatePass(qrData);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Vehicle number mismatch');
        });
        it('should handle non-existent transaction', async () => {
            const qrData = JSON.stringify({
                transactionId: 'non-existent',
                vehicleNumber: 'TEST123',
                expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
            });
            mockTransactionRepository.findOne.mockResolvedValue(null);
            const result = await service.validateGatePass(qrData);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Transaction not found');
        });
    });
});
//# sourceMappingURL=gate-pass.service.spec.js.map