"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const typeorm_1 = require("@nestjs/typeorm");
const fc = require("fast-check");
const field_configuration_service_1 = require("./field-configuration.service");
const workflow_configuration_entity_1 = require("../entities/workflow-configuration.entity");
const transaction_entity_1 = require("../entities/transaction.entity");
describe('FieldConfigurationService', () => {
    let service;
    let configRepo;
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
                field_configuration_service_1.FieldConfigurationService,
                {
                    provide: (0, typeorm_1.getRepositoryToken)(workflow_configuration_entity_1.WorkflowConfiguration),
                    useValue: mockConfigRepo,
                },
            ],
        }).compile();
        service = module.get(field_configuration_service_1.FieldConfigurationService);
        configRepo = module.get((0, typeorm_1.getRepositoryToken)(workflow_configuration_entity_1.WorkflowConfiguration));
    });
    afterEach(() => {
        jest.clearAllMocks();
        jest.resetAllMocks();
    });
    describe('Property 5: Workflow Configuration Flexibility', () => {
        it('should allow flexible field configuration across all parameters', async () => {
            await fc.assert(fc.asyncProperty(fc.record({
                tenantId: fc.uuid(),
                fieldName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                fieldLabel: fc.string({ minLength: 1, maxLength: 100 }),
                fieldType: fc.constantFrom('TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT', 'FILE'),
                operationalLevel: fc.integer({ min: 1, max: 7 }),
                captureType: fc.constantFrom(workflow_configuration_entity_1.FieldCaptureType.MANUAL, workflow_configuration_entity_1.FieldCaptureType.OCR, workflow_configuration_entity_1.FieldCaptureType.CAMERA, workflow_configuration_entity_1.FieldCaptureType.AUTO),
                validationType: fc.constantFrom(workflow_configuration_entity_1.FieldValidationType.REQUIRED, workflow_configuration_entity_1.FieldValidationType.OPTIONAL),
                editability: fc.constantFrom(workflow_configuration_entity_1.FieldEditability.EDITABLE, workflow_configuration_entity_1.FieldEditability.READ_ONLY),
                minPhotoCount: fc.integer({ min: 0, max: 5 }),
                maxPhotoCount: fc.integer({ min: 1, max: 20 }),
                displayOrder: fc.integer({ min: 0, max: 100 })
            }), async (configData) => {
                const minPhotoCount = configData.minPhotoCount;
                const maxPhotoCount = Math.max(configData.maxPhotoCount, minPhotoCount);
                const fieldConfig = {
                    ...configData,
                    operationalLevel: configData.operationalLevel,
                    maxPhotoCount
                };
                mockConfigRepo.findOne.mockResolvedValue(null);
                const mockCreatedConfig = {
                    id: fc.sample(fc.uuid(), 1)[0],
                    ...fieldConfig,
                    effectiveFrom: new Date(),
                    version: 1,
                    isActive: true,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                mockConfigRepo.create.mockReturnValue(mockCreatedConfig);
                mockConfigRepo.save.mockResolvedValue(mockCreatedConfig);
                const result = await service.createFieldConfiguration(fieldConfig);
                expect(result).toBeDefined();
                expect(result.tenantId).toBe(fieldConfig.tenantId);
                expect(result.fieldName).toBe(fieldConfig.fieldName);
                expect(result.operationalLevel).toBe(fieldConfig.operationalLevel);
                expect(result.validationType).toBe(fieldConfig.validationType);
                expect(result.editability).toBe(fieldConfig.editability);
                expect(result.captureType).toBe(fieldConfig.captureType);
                expect(result.minPhotoCount).toBe(fieldConfig.minPhotoCount);
                expect(result.maxPhotoCount).toBe(fieldConfig.maxPhotoCount);
                expect(result.displayOrder).toBe(fieldConfig.displayOrder);
                expect(mockConfigRepo.create).toHaveBeenCalledWith(expect.objectContaining({
                    ...fieldConfig,
                    effectiveFrom: expect.any(Date),
                    version: 1,
                    isActive: true
                }));
                expect(mockConfigRepo.save).toHaveBeenCalled();
            }), { numRuns: 50 });
        });
        it('should allow fields to be moved between operational levels', async () => {
            await fc.assert(fc.asyncProperty(fc.uuid(), fc.integer({ min: 1, max: 7 }), fc.integer({ min: 1, max: 7 }), fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), async (configId, originalLevel, newLevel, fieldName) => {
                if (originalLevel === newLevel)
                    return;
                const protectedFields = ['vendor_details', 'po_number', 'vehicle_number', 'gross_weight', 'inspection_grade', 'grn_number', 'gate_pass_qr'];
                if (protectedFields.includes(fieldName.toLowerCase()))
                    return;
                const existingConfig = {
                    id: configId,
                    tenantId: fc.sample(fc.uuid(), 1)[0],
                    operationalLevel: originalLevel,
                    fieldName: fieldName,
                    fieldLabel: `${fieldName} Label`,
                    fieldType: 'TEXT',
                    captureType: workflow_configuration_entity_1.FieldCaptureType.MANUAL,
                    validationType: workflow_configuration_entity_1.FieldValidationType.REQUIRED,
                    editability: workflow_configuration_entity_1.FieldEditability.EDITABLE,
                    version: 1,
                    isActive: true,
                    effectiveFrom: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                mockConfigRepo.findOne.mockImplementation((query) => {
                    if (query.where.id === configId) {
                        return Promise.resolve(existingConfig);
                    }
                    return Promise.resolve(null);
                });
                mockConfigRepo.update.mockResolvedValue({ affected: 1 });
                const newConfig = {
                    ...existingConfig,
                    id: fc.sample(fc.uuid(), 1)[0],
                    operationalLevel: newLevel,
                    version: existingConfig.version + 1,
                    effectiveFrom: new Date()
                };
                mockConfigRepo.create.mockReturnValue(newConfig);
                mockConfigRepo.save.mockResolvedValue(newConfig);
                const result = await service.moveFieldToLevel(configId, newLevel);
                expect(result).toBeDefined();
                expect(result.operationalLevel).toBe(newLevel);
                expect(result.version).toBe(existingConfig.version + 1);
                expect(mockConfigRepo.update).toHaveBeenCalledWith(configId, expect.objectContaining({
                    isActive: false,
                    effectiveTo: expect.any(Date)
                }));
                expect(mockConfigRepo.create).toHaveBeenCalledWith(expect.objectContaining({
                    operationalLevel: newLevel,
                    version: existingConfig.version + 1
                }));
            }), { numRuns: 30 });
        });
        it('should support all field requirement combinations', async () => {
            await fc.assert(fc.asyncProperty(fc.record({
                tenantId: fc.uuid(),
                operationalLevel: fc.integer({ min: 1, max: 7 }),
                fieldName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                validationType: fc.constantFrom(workflow_configuration_entity_1.FieldValidationType.REQUIRED, workflow_configuration_entity_1.FieldValidationType.OPTIONAL),
                editability: fc.constantFrom(workflow_configuration_entity_1.FieldEditability.EDITABLE, workflow_configuration_entity_1.FieldEditability.READ_ONLY),
                captureType: fc.constantFrom(workflow_configuration_entity_1.FieldCaptureType.MANUAL, workflow_configuration_entity_1.FieldCaptureType.OCR, workflow_configuration_entity_1.FieldCaptureType.CAMERA, workflow_configuration_entity_1.FieldCaptureType.AUTO)
            }), async (configData) => {
                const fieldConfig = {
                    ...configData,
                    operationalLevel: configData.operationalLevel,
                    fieldLabel: `${configData.fieldName} Label`,
                    fieldType: 'TEXT'
                };
                mockConfigRepo.findOne.mockResolvedValue(null);
                const mockCreatedConfig = {
                    id: fc.sample(fc.uuid(), 1)[0],
                    ...fieldConfig,
                    effectiveFrom: new Date(),
                    version: 1,
                    isActive: true
                };
                mockConfigRepo.create.mockReturnValue(mockCreatedConfig);
                mockConfigRepo.save.mockResolvedValue(mockCreatedConfig);
                const result = await service.createFieldConfiguration(fieldConfig);
                expect(result.validationType).toBe(configData.validationType);
                expect(result.editability).toBe(configData.editability);
                expect(result.captureType).toBe(configData.captureType);
            }), { numRuns: 40 });
        });
        it('should support configurable photo count limits', async () => {
            await fc.assert(fc.asyncProperty(fc.record({
                tenantId: fc.uuid(),
                operationalLevel: fc.integer({ min: 1, max: 7 }),
                fieldName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                minPhotoCount: fc.integer({ min: 0, max: 10 }),
                maxPhotoCount: fc.integer({ min: 1, max: 50 })
            }), async (configData) => {
                const minPhotoCount = configData.minPhotoCount;
                const maxPhotoCount = Math.max(configData.maxPhotoCount, minPhotoCount);
                const fieldConfig = {
                    ...configData,
                    operationalLevel: configData.operationalLevel,
                    fieldLabel: `${configData.fieldName} Label`,
                    fieldType: 'FILE',
                    captureType: workflow_configuration_entity_1.FieldCaptureType.CAMERA,
                    validationType: workflow_configuration_entity_1.FieldValidationType.REQUIRED,
                    editability: workflow_configuration_entity_1.FieldEditability.EDITABLE,
                    minPhotoCount,
                    maxPhotoCount
                };
                mockConfigRepo.findOne.mockResolvedValue(null);
                const mockCreatedConfig = {
                    id: fc.sample(fc.uuid(), 1)[0],
                    ...fieldConfig,
                    effectiveFrom: new Date(),
                    version: 1,
                    isActive: true
                };
                mockConfigRepo.create.mockReturnValue(mockCreatedConfig);
                mockConfigRepo.save.mockResolvedValue(mockCreatedConfig);
                const result = await service.createFieldConfiguration(fieldConfig);
                expect(result.minPhotoCount).toBe(minPhotoCount);
                expect(result.maxPhotoCount).toBe(maxPhotoCount);
                expect(result.maxPhotoCount).toBeGreaterThanOrEqual(result.minPhotoCount);
            }), { numRuns: 30 });
        });
    });
    describe('Evidence Field Protection', () => {
        it('should prevent disabling evidence fields', async () => {
            const protectedFields = [
                'photos',
                'documents',
                'timestamp',
                'gps_coordinates',
                'operator_signature',
                'inspector_signature',
                'evidence_photos',
                'inspection_photos',
                'weight_slip_photo',
                'vehicle_photo'
            ];
            for (const fieldName of protectedFields) {
                const fieldConfig = {
                    tenantId: fc.sample(fc.uuid(), 1)[0],
                    operationalLevel: transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION,
                    fieldName: fieldName,
                    fieldLabel: `${fieldName} Label`,
                    fieldType: 'FILE',
                    captureType: workflow_configuration_entity_1.FieldCaptureType.CAMERA,
                    validationType: workflow_configuration_entity_1.FieldValidationType.REQUIRED,
                    editability: workflow_configuration_entity_1.FieldEditability.EDITABLE
                };
                await expect(service.createFieldConfiguration(fieldConfig))
                    .rejects
                    .toThrow(`Evidence field '${fieldName}' cannot be disabled for audit integrity`);
            }
        });
    });
});
//# sourceMappingURL=field-configuration.service.spec.js.map