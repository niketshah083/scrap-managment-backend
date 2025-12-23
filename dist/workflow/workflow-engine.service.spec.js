"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const typeorm_1 = require("@nestjs/typeorm");
const fc = require("fast-check");
const workflow_engine_service_1 = require("./workflow-engine.service");
const workflow_configuration_entity_1 = require("../entities/workflow-configuration.entity");
const transaction_entity_1 = require("../entities/transaction.entity");
describe('WorkflowEngineService', () => {
    let service;
    let transactionRepo;
    let workflowConfigRepo;
    const mockTransactionRepo = {
        findOne: jest.fn(),
        update: jest.fn(),
        save: jest.fn(),
        create: jest.fn(),
    };
    const mockWorkflowConfigRepo = {
        find: jest.fn(),
        findOne: jest.fn(),
        save: jest.fn(),
        create: jest.fn(),
    };
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                workflow_engine_service_1.WorkflowEngineService,
                {
                    provide: (0, typeorm_1.getRepositoryToken)(transaction_entity_1.Transaction),
                    useValue: mockTransactionRepo,
                },
                {
                    provide: (0, typeorm_1.getRepositoryToken)(workflow_configuration_entity_1.WorkflowConfiguration),
                    useValue: mockWorkflowConfigRepo,
                },
            ],
        }).compile();
        service = module.get(workflow_engine_service_1.WorkflowEngineService);
        transactionRepo = module.get((0, typeorm_1.getRepositoryToken)(transaction_entity_1.Transaction));
        workflowConfigRepo = module.get((0, typeorm_1.getRepositoryToken)(workflow_configuration_entity_1.WorkflowConfiguration));
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    describe('Property 4: Sequential Level Progression', () => {
        it('should enforce sequential level progression without skipping', async () => {
            await fc.assert(fc.asyncProperty(fc.integer({ min: 1, max: 6 }), fc.integer({ min: 1, max: 10 }), fc.record({
                id: fc.uuid(),
                tenantId: fc.uuid(),
                currentLevel: fc.integer({ min: 1, max: 7 }),
                status: fc.constantFrom(transaction_entity_1.TransactionStatus.ACTIVE, transaction_entity_1.TransactionStatus.COMPLETED, transaction_entity_1.TransactionStatus.REJECTED, transaction_entity_1.TransactionStatus.CANCELLED),
                isLocked: fc.boolean(),
                levelData: fc.option(fc.dictionary(fc.string(), fc.anything()), { nil: null })
            }), async (currentLevel, targetLevel, transactionData) => {
                const transaction = {
                    ...transactionData,
                    currentLevel: currentLevel,
                };
                const expectedNextLevel = currentLevel + 1;
                const isValidProgression = targetLevel === expectedNextLevel;
                const isValidLevel = targetLevel >= 1 && targetLevel <= 7;
                const isActiveTransaction = transaction.status === transaction_entity_1.TransactionStatus.ACTIVE;
                const isUnlocked = !transaction.isLocked;
                if (isValidProgression && isValidLevel && isActiveTransaction && isUnlocked) {
                    if (targetLevel === transaction_entity_1.OperationalLevel.L6_GRN_GENERATION) {
                        transaction.levelData = {
                            ...transaction.levelData,
                            [transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION]: {
                                level: transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION,
                                validationStatus: 'APPROVED',
                                fieldValues: {},
                                completedBy: 'inspector1',
                                completedAt: new Date(),
                                evidenceIds: []
                            }
                        };
                    }
                    else if (targetLevel === transaction_entity_1.OperationalLevel.L7_GATE_PASS_EXIT) {
                        transaction.levelData = {
                            ...transaction.levelData,
                            [transaction_entity_1.OperationalLevel.L6_GRN_GENERATION]: {
                                level: transaction_entity_1.OperationalLevel.L6_GRN_GENERATION,
                                validationStatus: 'APPROVED',
                                fieldValues: {},
                                completedBy: 'operator1',
                                completedAt: new Date(),
                                evidenceIds: []
                            }
                        };
                    }
                }
                mockTransactionRepo.findOne.mockResolvedValue(transaction);
                const result = await service.validateLevelProgression(transaction.id, targetLevel);
                if (isValidProgression && isValidLevel && isActiveTransaction && isUnlocked) {
                    expect(result.isValid).toBe(true);
                }
                else {
                    expect(result.isValid).toBe(false);
                    expect(result.errors.length).toBeGreaterThan(0);
                    if (!isUnlocked) {
                        expect(result.errors.some(error => error.includes('locked'))).toBe(true);
                    }
                    else if (!isActiveTransaction) {
                        expect(result.errors.some(error => error.includes('completed') || error.includes('cancelled') ||
                            error.includes('already') || error.includes('rejected'))).toBe(true);
                    }
                    else if (!isValidProgression) {
                        expect(result.errors.some(error => error.includes('Invalid level progression'))).toBe(true);
                    }
                    else if (!isValidLevel) {
                        expect(result.errors.some(error => error.includes('Invalid operational level'))).toBe(true);
                    }
                }
            }), { numRuns: 100 });
        });
        it('should prevent skipping levels in any sequence', async () => {
            await fc.assert(fc.asyncProperty(fc.integer({ min: 1, max: 6 }), fc.integer({ min: 2, max: 5 }), fc.uuid(), async (currentLevel, skipAmount, transactionId) => {
                const targetLevel = currentLevel + skipAmount;
                if (targetLevel > 7)
                    return;
                const transaction = {
                    id: transactionId,
                    tenantId: fc.sample(fc.uuid(), 1)[0],
                    currentLevel: currentLevel,
                    status: transaction_entity_1.TransactionStatus.ACTIVE,
                    isLocked: false,
                    levelData: {}
                };
                mockTransactionRepo.findOne.mockResolvedValue(transaction);
                const result = await service.validateLevelProgression(transactionId, targetLevel);
                expect(result.isValid).toBe(false);
                expect(result.errors.some(error => error.includes('Invalid level progression'))).toBe(true);
            }), { numRuns: 50 });
        });
        it('should allow only the immediate next level', async () => {
            await fc.assert(fc.asyncProperty(fc.integer({ min: 1, max: 6 }), fc.uuid(), async (currentLevel, transactionId) => {
                const expectedNextLevel = currentLevel + 1;
                const transaction = {
                    id: transactionId,
                    tenantId: fc.sample(fc.uuid(), 1)[0],
                    currentLevel: currentLevel,
                    status: transaction_entity_1.TransactionStatus.ACTIVE,
                    isLocked: false,
                    levelData: {}
                };
                mockTransactionRepo.findOne.mockResolvedValue(transaction);
                const result = await service.validateLevelProgression(transactionId, expectedNextLevel);
                if (result.isValid === false) {
                    const hasProgressionError = result.errors.some(error => error.includes('Invalid level progression'));
                    expect(hasProgressionError).toBe(false);
                }
            }), { numRuns: 50 });
        });
    });
    describe('Safety Guardrails', () => {
        it('should prevent GRN generation without approved inspection', async () => {
            const transactionId = fc.sample(fc.uuid(), 1)[0];
            const transaction = {
                id: transactionId,
                tenantId: fc.sample(fc.uuid(), 1)[0],
                currentLevel: transaction_entity_1.OperationalLevel.L5_WEIGHBRIDGE_TARE,
                status: transaction_entity_1.TransactionStatus.ACTIVE,
                isLocked: false,
                levelData: {
                    [transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION]: {
                        level: transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION,
                        validationStatus: 'REJECTED',
                        fieldValues: {},
                        completedBy: 'inspector1',
                        completedAt: new Date(),
                        evidenceIds: []
                    }
                }
            };
            mockTransactionRepo.findOne.mockResolvedValue(transaction);
            const result = await service.validateLevelProgression(transactionId, transaction_entity_1.OperationalLevel.L6_GRN_GENERATION);
            expect(result.isValid).toBe(false);
            expect(result.errors.some(error => error.includes('GRN cannot be generated without approved material inspection'))).toBe(true);
        });
        it('should prevent gate pass generation without approved GRN', async () => {
            const transactionId = fc.sample(fc.uuid(), 1)[0];
            const transaction = {
                id: transactionId,
                tenantId: fc.sample(fc.uuid(), 1)[0],
                currentLevel: transaction_entity_1.OperationalLevel.L6_GRN_GENERATION,
                status: transaction_entity_1.TransactionStatus.ACTIVE,
                isLocked: false,
                levelData: {
                    [transaction_entity_1.OperationalLevel.L6_GRN_GENERATION]: {
                        level: transaction_entity_1.OperationalLevel.L6_GRN_GENERATION,
                        validationStatus: 'PENDING',
                        fieldValues: {},
                        completedBy: 'operator1',
                        completedAt: new Date(),
                        evidenceIds: []
                    }
                }
            };
            mockTransactionRepo.findOne.mockResolvedValue(transaction);
            const result = await service.validateLevelProgression(transactionId, transaction_entity_1.OperationalLevel.L7_GATE_PASS_EXIT);
            expect(result.isValid).toBe(false);
            expect(result.errors.some(error => error.includes('Gate pass cannot be generated without approved GRN'))).toBe(true);
        });
    });
});
//# sourceMappingURL=workflow-engine.service.spec.js.map