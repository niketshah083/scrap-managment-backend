"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const typeorm_1 = require("@nestjs/typeorm");
const fc = require("fast-check");
const workflow_engine_service_1 = require("./workflow-engine.service");
const field_configuration_service_1 = require("./field-configuration.service");
const workflow_configuration_entity_1 = require("../entities/workflow-configuration.entity");
const transaction_entity_1 = require("../entities/transaction.entity");
describe('Safety Guardrails', () => {
    let workflowEngineService;
    let fieldConfigService;
    let transactionRepo;
    let configRepo;
    const mockTransactionRepo = {
        findOne: jest.fn(),
        find: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
    };
    const mockConfigRepo = {
        findOne: jest.fn(),
        find: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
    };
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                workflow_engine_service_1.WorkflowEngineService,
                field_configuration_service_1.FieldConfigurationService,
                {
                    provide: (0, typeorm_1.getRepositoryToken)(transaction_entity_1.Transaction),
                    useValue: mockTransactionRepo,
                },
                {
                    provide: (0, typeorm_1.getRepositoryToken)(workflow_configuration_entity_1.WorkflowConfiguration),
                    useValue: mockConfigRepo,
                },
            ],
        }).compile();
        workflowEngineService = module.get(workflow_engine_service_1.WorkflowEngineService);
        fieldConfigService = module.get(field_configuration_service_1.FieldConfigurationService);
        transactionRepo = module.get((0, typeorm_1.getRepositoryToken)(transaction_entity_1.Transaction));
        configRepo = module.get((0, typeorm_1.getRepositoryToken)(workflow_configuration_entity_1.WorkflowConfiguration));
    });
    afterEach(() => {
        jest.clearAllMocks();
        jest.resetAllMocks();
    });
    describe('Property 20: Safety Guardrails Enforcement', () => {
        it('should prevent GRN generation without approved inspection', async () => {
            await fc.assert(fc.asyncProperty(fc.record({
                transactionId: fc.uuid(),
                tenantId: fc.uuid(),
                factoryId: fc.uuid(),
                inspectionStatus: fc.constantFrom('PENDING', 'REJECTED', 'APPROVED'),
                hasInspectionData: fc.boolean()
            }), async (testData) => {
                jest.clearAllMocks();
                const transaction = {
                    id: testData.transactionId,
                    tenantId: testData.tenantId,
                    factoryId: testData.factoryId,
                    currentLevel: transaction_entity_1.OperationalLevel.L5_WEIGHBRIDGE_TARE,
                    status: transaction_entity_1.TransactionStatus.ACTIVE,
                    isLocked: false,
                    levelData: testData.hasInspectionData ? {
                        [transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION]: {
                            level: transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION,
                            validationStatus: testData.inspectionStatus,
                            fieldValues: {
                                inspection_grade: testData.inspectionStatus === 'APPROVED' ? 'A' : 'REJECTED',
                                contamination_level: 5
                            },
                            completedBy: 'inspector1',
                            completedAt: new Date(),
                            evidenceIds: ['evidence1', 'evidence2']
                        }
                    } : {}
                };
                mockTransactionRepo.findOne.mockResolvedValue(transaction);
                const result = await workflowEngineService.validateLevelProgression(testData.transactionId, transaction_entity_1.OperationalLevel.L6_GRN_GENERATION);
                const hasApprovedInspection = testData.hasInspectionData &&
                    testData.inspectionStatus === 'APPROVED';
                if (hasApprovedInspection) {
                    expect(result.isValid).toBe(true);
                }
                else {
                    expect(result.isValid).toBe(false);
                    expect(result.errors.some(error => error.includes('GRN cannot be generated without approved material inspection'))).toBe(true);
                }
            }), { numRuns: 50 });
        });
        it('should prevent gate pass generation without approved GRN', async () => {
            await fc.assert(fc.asyncProperty(fc.record({
                transactionId: fc.uuid(),
                tenantId: fc.uuid(),
                factoryId: fc.uuid(),
                grnStatus: fc.constantFrom('PENDING', 'REJECTED', 'APPROVED'),
                hasGrnData: fc.boolean()
            }), async (testData) => {
                jest.clearAllMocks();
                const transaction = {
                    id: testData.transactionId,
                    tenantId: testData.tenantId,
                    factoryId: testData.factoryId,
                    currentLevel: transaction_entity_1.OperationalLevel.L6_GRN_GENERATION,
                    status: transaction_entity_1.TransactionStatus.ACTIVE,
                    isLocked: false,
                    levelData: testData.hasGrnData ? {
                        [transaction_entity_1.OperationalLevel.L6_GRN_GENERATION]: {
                            level: transaction_entity_1.OperationalLevel.L6_GRN_GENERATION,
                            validationStatus: testData.grnStatus,
                            fieldValues: {
                                grn_number: testData.grnStatus === 'APPROVED' ? 'GRN-2024-001' : null,
                                grn_document_url: testData.grnStatus === 'APPROVED' ? 'https://s3.../grn.pdf' : null
                            },
                            completedBy: 'operator1',
                            completedAt: new Date(),
                            evidenceIds: ['evidence1']
                        }
                    } : {}
                };
                mockTransactionRepo.findOne.mockResolvedValue(transaction);
                const result = await workflowEngineService.validateLevelProgression(testData.transactionId, transaction_entity_1.OperationalLevel.L7_GATE_PASS_EXIT);
                const hasApprovedGrn = testData.hasGrnData && testData.grnStatus === 'APPROVED';
                if (hasApprovedGrn) {
                    expect(result.isValid).toBe(true);
                }
                else {
                    expect(result.isValid).toBe(false);
                    expect(result.errors.some(error => error.includes('Gate pass cannot be generated without approved GRN'))).toBe(true);
                }
            }), { numRuns: 50 });
        });
        it('should prevent disabling evidence fields for audit integrity', async () => {
            await fc.assert(fc.asyncProperty(fc.record({
                tenantId: fc.uuid(),
                operationalLevel: fc.integer({ min: 1, max: 7 }),
                fieldName: fc.constantFrom('photos', 'documents', 'timestamp', 'gps_coordinates', 'operator_signature', 'inspector_signature', 'evidence_photos', 'inspection_photos', 'weight_slip_photo', 'vehicle_photo'),
                fieldLabel: fc.string({ minLength: 1, maxLength: 100 }),
                fieldType: fc.constantFrom('FILE', 'TEXT', 'TIMESTAMP')
            }), async (testData) => {
                jest.clearAllMocks();
                const fieldConfig = {
                    tenantId: testData.tenantId,
                    operationalLevel: testData.operationalLevel,
                    fieldName: testData.fieldName,
                    fieldLabel: testData.fieldLabel,
                    fieldType: testData.fieldType,
                    captureType: workflow_configuration_entity_1.FieldCaptureType.CAMERA,
                    validationType: workflow_configuration_entity_1.FieldValidationType.REQUIRED,
                    editability: workflow_configuration_entity_1.FieldEditability.EDITABLE
                };
                await expect(fieldConfigService.createFieldConfiguration(fieldConfig))
                    .rejects
                    .toThrow(`Evidence field '${testData.fieldName}' cannot be disabled for audit integrity`);
                expect(mockConfigRepo.create).not.toHaveBeenCalled();
                expect(mockConfigRepo.save).not.toHaveBeenCalled();
            }), { numRuns: 30 });
        });
        it('should enforce safety guardrails regardless of configuration changes', async () => {
            await fc.assert(fc.asyncProperty(fc.record({
                transactionId: fc.uuid(),
                tenantId: fc.uuid(),
                targetLevel: fc.constantFrom(transaction_entity_1.OperationalLevel.L6_GRN_GENERATION, transaction_entity_1.OperationalLevel.L7_GATE_PASS_EXIT),
                hasCustomConfig: fc.boolean(),
                configVersion: fc.integer({ min: 1, max: 10 })
            }), async (testData) => {
                jest.clearAllMocks();
                const transaction = {
                    id: testData.transactionId,
                    tenantId: testData.tenantId,
                    currentLevel: testData.targetLevel === transaction_entity_1.OperationalLevel.L6_GRN_GENERATION
                        ? transaction_entity_1.OperationalLevel.L5_WEIGHBRIDGE_TARE
                        : transaction_entity_1.OperationalLevel.L6_GRN_GENERATION,
                    status: transaction_entity_1.TransactionStatus.ACTIVE,
                    isLocked: false,
                    levelData: {
                        [transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION]: testData.targetLevel === transaction_entity_1.OperationalLevel.L6_GRN_GENERATION ? {
                            level: transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION,
                            validationStatus: 'PENDING',
                            fieldValues: {},
                            completedBy: 'inspector1',
                            completedAt: new Date(),
                            evidenceIds: []
                        } : undefined,
                        [transaction_entity_1.OperationalLevel.L6_GRN_GENERATION]: testData.targetLevel === transaction_entity_1.OperationalLevel.L7_GATE_PASS_EXIT ? {
                            level: transaction_entity_1.OperationalLevel.L6_GRN_GENERATION,
                            validationStatus: 'REJECTED',
                            fieldValues: {},
                            completedBy: 'operator1',
                            completedAt: new Date(),
                            evidenceIds: []
                        } : undefined
                    }
                };
                mockTransactionRepo.findOne.mockResolvedValue(transaction);
                if (testData.hasCustomConfig) {
                    mockConfigRepo.find.mockResolvedValue([
                        {
                            id: fc.sample(fc.uuid(), 1)[0],
                            tenantId: testData.tenantId,
                            operationalLevel: testData.targetLevel,
                            fieldName: 'custom_field',
                            version: testData.configVersion,
                            isActive: true,
                            effectiveFrom: new Date()
                        }
                    ]);
                }
                else {
                    mockConfigRepo.find.mockResolvedValue([]);
                }
                const result = await workflowEngineService.validateLevelProgression(testData.transactionId, testData.targetLevel);
                expect(result.isValid).toBe(false);
                if (testData.targetLevel === transaction_entity_1.OperationalLevel.L6_GRN_GENERATION) {
                    expect(result.errors.some(error => error.includes('GRN cannot be generated without approved material inspection'))).toBe(true);
                }
                else if (testData.targetLevel === transaction_entity_1.OperationalLevel.L7_GATE_PASS_EXIT) {
                    expect(result.errors.some(error => error.includes('Gate pass cannot be generated without approved GRN'))).toBe(true);
                }
            }), { numRuns: 40 });
        });
        it('should validate evidence field protection at service level', async () => {
            await fc.assert(fc.asyncProperty(fc.record({
                tenantId: fc.uuid(),
                operationalLevel: fc.integer({ min: 1, max: 7 }),
                evidenceFieldName: fc.constantFrom('photos', 'documents', 'timestamp', 'gps_coordinates', 'operator_signature', 'inspector_signature')
            }), async (testData) => {
                const canDisable = await workflowEngineService.validateEvidenceFieldConfiguration(testData.tenantId, testData.operationalLevel, testData.evidenceFieldName);
                expect(canDisable).toBe(false);
            }), { numRuns: 30 });
        });
    });
    describe('Safety Guardrail Edge Cases', () => {
        it('should handle missing level data gracefully', async () => {
            const transactionId = fc.sample(fc.uuid(), 1)[0];
            const transaction = {
                id: transactionId,
                tenantId: fc.sample(fc.uuid(), 1)[0],
                currentLevel: transaction_entity_1.OperationalLevel.L5_WEIGHBRIDGE_TARE,
                status: transaction_entity_1.TransactionStatus.ACTIVE,
                isLocked: false,
                levelData: null
            };
            mockTransactionRepo.findOne.mockResolvedValue(transaction);
            const result = await workflowEngineService.validateLevelProgression(transactionId, transaction_entity_1.OperationalLevel.L6_GRN_GENERATION);
            expect(result.isValid).toBe(false);
            expect(result.errors.some(error => error.includes('GRN cannot be generated without approved material inspection'))).toBe(true);
        });
        it('should handle undefined level data gracefully', async () => {
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
            const result = await workflowEngineService.validateLevelProgression(transactionId, transaction_entity_1.OperationalLevel.L7_GATE_PASS_EXIT);
            expect(result.isValid).toBe(false);
            expect(result.errors.some(error => error.includes('Gate pass cannot be generated without approved GRN'))).toBe(true);
        });
    });
});
//# sourceMappingURL=safety-guardrails.service.spec.js.map