"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const typeorm_1 = require("@nestjs/typeorm");
const fc = require("fast-check");
const field_configuration_service_1 = require("./field-configuration.service");
const workflow_engine_service_1 = require("./workflow-engine.service");
const workflow_configuration_entity_1 = require("../entities/workflow-configuration.entity");
const transaction_entity_1 = require("../entities/transaction.entity");
describe('Configuration Immutability', () => {
    let fieldConfigService;
    let workflowEngineService;
    let configRepo;
    let transactionRepo;
    const mockConfigRepo = {
        findOne: jest.fn(),
        find: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
    };
    const mockTransactionRepo = {
        findOne: jest.fn(),
        find: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
    };
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                field_configuration_service_1.FieldConfigurationService,
                workflow_engine_service_1.WorkflowEngineService,
                {
                    provide: (0, typeorm_1.getRepositoryToken)(workflow_configuration_entity_1.WorkflowConfiguration),
                    useValue: mockConfigRepo,
                },
                {
                    provide: (0, typeorm_1.getRepositoryToken)(transaction_entity_1.Transaction),
                    useValue: mockTransactionRepo,
                },
            ],
        }).compile();
        fieldConfigService = module.get(field_configuration_service_1.FieldConfigurationService);
        workflowEngineService = module.get(workflow_engine_service_1.WorkflowEngineService);
        configRepo = module.get((0, typeorm_1.getRepositoryToken)(workflow_configuration_entity_1.WorkflowConfiguration));
        transactionRepo = module.get((0, typeorm_1.getRepositoryToken)(transaction_entity_1.Transaction));
    });
    afterEach(() => {
        jest.clearAllMocks();
        jest.resetAllMocks();
    });
    describe('Property 3: Configuration Immutability for Existing Transactions', () => {
        it('should create new configuration versions without affecting existing transactions', async () => {
            await fc.assert(fc.asyncProperty(fc.record({
                id: fc.uuid(),
                tenantId: fc.uuid(),
                operationalLevel: fc.integer({ min: 1, max: 7 }),
                fieldName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                fieldLabel: fc.string({ minLength: 1, maxLength: 100 }),
                fieldType: fc.constantFrom('TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT', 'FILE'),
                captureType: fc.constantFrom(workflow_configuration_entity_1.FieldCaptureType.MANUAL, workflow_configuration_entity_1.FieldCaptureType.OCR, workflow_configuration_entity_1.FieldCaptureType.CAMERA, workflow_configuration_entity_1.FieldCaptureType.AUTO),
                validationType: fc.constantFrom(workflow_configuration_entity_1.FieldValidationType.REQUIRED, workflow_configuration_entity_1.FieldValidationType.OPTIONAL),
                editability: fc.constantFrom(workflow_configuration_entity_1.FieldEditability.EDITABLE, workflow_configuration_entity_1.FieldEditability.READ_ONLY),
                version: fc.integer({ min: 1, max: 5 }),
                effectiveFrom: fc.date({ min: new Date('2023-01-01'), max: new Date('2024-01-01') }),
                isActive: fc.boolean()
            }), fc.record({
                fieldLabel: fc.string({ minLength: 1, maxLength: 100 }),
                validationType: fc.constantFrom(workflow_configuration_entity_1.FieldValidationType.REQUIRED, workflow_configuration_entity_1.FieldValidationType.OPTIONAL),
                editability: fc.constantFrom(workflow_configuration_entity_1.FieldEditability.EDITABLE, workflow_configuration_entity_1.FieldEditability.READ_ONLY)
            }), async (existingConfig, updateData) => {
                const protectedFields = ['photos', 'documents', 'timestamp', 'gps_coordinates'];
                if (protectedFields.includes(existingConfig.fieldName.toLowerCase())) {
                    return;
                }
                const originalEffectiveFrom = existingConfig.effectiveFrom;
                const originalVersion = existingConfig.version;
                const originalId = existingConfig.id;
                jest.clearAllMocks();
                mockConfigRepo.findOne.mockResolvedValue(existingConfig);
                mockConfigRepo.update.mockResolvedValue({ affected: 1 });
                const newConfigVersion = {
                    ...existingConfig,
                    ...updateData,
                    id: fc.sample(fc.uuid(), 1)[0],
                    version: originalVersion + 1,
                    effectiveFrom: new Date(),
                    effectiveTo: null,
                    isActive: true,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                mockConfigRepo.create.mockReturnValue(newConfigVersion);
                mockConfigRepo.save.mockResolvedValue(newConfigVersion);
                const result = await fieldConfigService.updateFieldConfiguration({
                    id: originalId,
                    ...updateData
                });
                expect(result).toBeDefined();
                expect(result.version).toBe(originalVersion + 1);
                expect(result.effectiveFrom).not.toEqual(originalEffectiveFrom);
                expect(mockConfigRepo.update).toHaveBeenCalledWith(originalId, expect.objectContaining({
                    isActive: false,
                    effectiveTo: expect.any(Date)
                }));
                expect(mockConfigRepo.create).toHaveBeenCalledWith(expect.objectContaining({
                    version: originalVersion + 1,
                    effectiveFrom: expect.any(Date),
                    isActive: true
                }));
                const updateCall = mockConfigRepo.update.mock.calls[0];
                expect(updateCall[0]).toBe(originalId);
                expect(updateCall[1]).not.toHaveProperty('fieldName');
                expect(updateCall[1]).not.toHaveProperty('fieldType');
                expect(updateCall[1]).not.toHaveProperty('version');
            }), { numRuns: 30 });
        });
        it('should preserve configuration history through versioning', async () => {
            await fc.assert(fc.asyncProperty(fc.record({
                tenantId: fc.uuid(),
                operationalLevel: fc.integer({ min: 1, max: 7 }),
                fieldName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                initialVersion: fc.integer({ min: 1, max: 3 }),
                updateCount: fc.integer({ min: 1, max: 3 })
            }), async (testData) => {
                const protectedFields = ['photos', 'documents', 'timestamp', 'gps_coordinates'];
                if (protectedFields.includes(testData.fieldName.toLowerCase())) {
                    return;
                }
                jest.clearAllMocks();
                let currentVersion = testData.initialVersion;
                let updateCallCount = 0;
                let createCallCount = 0;
                for (let i = 0; i < testData.updateCount; i++) {
                    const configId = fc.sample(fc.uuid(), 1)[0];
                    const existingConfig = {
                        id: configId,
                        tenantId: testData.tenantId,
                        operationalLevel: testData.operationalLevel,
                        fieldName: testData.fieldName,
                        fieldLabel: `${testData.fieldName} Label v${currentVersion}`,
                        fieldType: 'TEXT',
                        captureType: workflow_configuration_entity_1.FieldCaptureType.MANUAL,
                        validationType: workflow_configuration_entity_1.FieldValidationType.REQUIRED,
                        editability: workflow_configuration_entity_1.FieldEditability.EDITABLE,
                        version: currentVersion,
                        effectiveFrom: new Date(Date.now() - (testData.updateCount - i) * 86400000),
                        isActive: i === testData.updateCount - 1,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    };
                    mockConfigRepo.findOne.mockResolvedValueOnce(existingConfig);
                    mockConfigRepo.update.mockResolvedValueOnce({ affected: 1 });
                    const newVersion = {
                        ...existingConfig,
                        id: fc.sample(fc.uuid(), 1)[0],
                        version: currentVersion + 1,
                        fieldLabel: `${testData.fieldName} Label v${currentVersion + 1}`,
                        effectiveFrom: new Date(),
                        isActive: true
                    };
                    mockConfigRepo.create.mockReturnValueOnce(newVersion);
                    mockConfigRepo.save.mockResolvedValueOnce(newVersion);
                    await fieldConfigService.updateFieldConfiguration({
                        id: configId,
                        fieldLabel: `${testData.fieldName} Label v${currentVersion + 1}`
                    });
                    updateCallCount++;
                    createCallCount++;
                    currentVersion++;
                }
                expect(mockConfigRepo.update).toHaveBeenCalledTimes(updateCallCount);
                expect(mockConfigRepo.create).toHaveBeenCalledTimes(createCallCount);
                const updateCalls = mockConfigRepo.update.mock.calls;
                updateCalls.forEach(call => {
                    expect(call[1]).toEqual(expect.objectContaining({
                        isActive: false,
                        effectiveTo: expect.any(Date)
                    }));
                });
                const createCalls = mockConfigRepo.create.mock.calls;
                createCalls.forEach((call, index) => {
                    expect(call[0]).toEqual(expect.objectContaining({
                        version: testData.initialVersion + index + 1,
                        isActive: true,
                        effectiveFrom: expect.any(Date)
                    }));
                });
            }), { numRuns: 15 });
        });
        it('should ensure existing transactions use their original configuration', async () => {
            await fc.assert(fc.asyncProperty(fc.record({
                tenantId: fc.uuid(),
                transactionId: fc.uuid(),
                operationalLevel: fc.integer({ min: 1, max: 7 }),
                fieldName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                configEffectiveDate: fc.date({ min: new Date('2023-01-01'), max: new Date('2023-12-31') }),
                transactionCreatedDate: fc.date({ min: new Date('2023-06-01'), max: new Date('2024-01-31') })
            }), async (testData) => {
                const protectedFields = ['photos', 'documents', 'timestamp', 'gps_coordinates'];
                if (protectedFields.includes(testData.fieldName.toLowerCase())) {
                    return;
                }
                const originalConfig = {
                    id: fc.sample(fc.uuid(), 1)[0],
                    tenantId: testData.tenantId,
                    operationalLevel: testData.operationalLevel,
                    fieldName: testData.fieldName,
                    fieldLabel: 'Original Label',
                    fieldType: 'TEXT',
                    captureType: workflow_configuration_entity_1.FieldCaptureType.MANUAL,
                    validationType: workflow_configuration_entity_1.FieldValidationType.REQUIRED,
                    editability: workflow_configuration_entity_1.FieldEditability.EDITABLE,
                    version: 1,
                    effectiveFrom: testData.configEffectiveDate,
                    effectiveTo: null,
                    isActive: false,
                    createdAt: testData.configEffectiveDate,
                    updatedAt: testData.configEffectiveDate
                };
                const transaction = {
                    id: testData.transactionId,
                    tenantId: testData.tenantId,
                    currentLevel: testData.operationalLevel,
                    status: transaction_entity_1.TransactionStatus.ACTIVE,
                    isLocked: false,
                    createdAt: testData.transactionCreatedDate,
                    levelData: {}
                };
                mockConfigRepo.find.mockImplementation((query) => {
                    const where = query.where;
                    if (where.tenantId === testData.tenantId &&
                        where.operationalLevel === testData.operationalLevel) {
                        if (testData.transactionCreatedDate >= testData.configEffectiveDate) {
                            return Promise.resolve([originalConfig]);
                        }
                    }
                    return Promise.resolve([]);
                });
                const configsForTransaction = await workflowEngineService.getConfiguredFields(testData.tenantId, testData.operationalLevel);
                if (testData.transactionCreatedDate >= testData.configEffectiveDate) {
                    expect(configsForTransaction).toHaveLength(1);
                    expect(configsForTransaction[0].fieldName).toBe(testData.fieldName);
                    expect(configsForTransaction[0].fieldLabel).toBe('Original Label');
                }
                const newConfigDate = new Date(Math.max(testData.transactionCreatedDate.getTime(), testData.configEffectiveDate.getTime()) + 86400000);
                mockConfigRepo.findOne.mockResolvedValue(originalConfig);
                mockConfigRepo.update.mockResolvedValue({ affected: 1 });
                const updatedConfig = {
                    ...originalConfig,
                    id: fc.sample(fc.uuid(), 1)[0],
                    fieldLabel: 'Updated Label',
                    version: 2,
                    effectiveFrom: newConfigDate,
                    isActive: true
                };
                mockConfigRepo.create.mockReturnValue(updatedConfig);
                mockConfigRepo.save.mockResolvedValue(updatedConfig);
                await fieldConfigService.updateFieldConfiguration({
                    id: originalConfig.id,
                    fieldLabel: 'Updated Label'
                });
                expect(mockConfigRepo.update).toHaveBeenCalledWith(originalConfig.id, expect.objectContaining({
                    isActive: false,
                    effectiveTo: expect.any(Date)
                }));
                expect(mockConfigRepo.create).toHaveBeenCalledWith(expect.objectContaining({
                    fieldLabel: 'Updated Label',
                    version: 2,
                    effectiveFrom: expect.any(Date)
                }));
            }), { numRuns: 25 });
        });
    });
});
//# sourceMappingURL=configuration-immutability.service.spec.js.map