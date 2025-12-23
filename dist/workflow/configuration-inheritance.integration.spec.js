"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const typeorm_1 = require("@nestjs/typeorm");
const field_configuration_service_1 = require("./field-configuration.service");
const workflow_configuration_entity_1 = require("../entities/workflow-configuration.entity");
const transaction_entity_1 = require("../entities/transaction.entity");
describe('Configuration Inheritance Integration', () => {
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
    describe('Configuration Inheritance', () => {
        it('should return tenant configurations when no factory specified', async () => {
            const tenantId = 'tenant-123';
            const tenantConfigs = [
                {
                    id: 'config-1',
                    tenantId,
                    factoryId: null,
                    operationalLevel: transaction_entity_1.OperationalLevel.L2_GATE_ENTRY,
                    fieldName: 'vehicle_number',
                    fieldLabel: 'Vehicle Number',
                    fieldType: 'TEXT',
                    captureType: workflow_configuration_entity_1.FieldCaptureType.CAMERA,
                    validationType: workflow_configuration_entity_1.FieldValidationType.REQUIRED,
                    editability: workflow_configuration_entity_1.FieldEditability.EDITABLE,
                    displayOrder: 1,
                    isActive: true
                }
            ];
            mockConfigRepo.find.mockResolvedValue(tenantConfigs);
            const result = await service.getFieldConfigurationsWithInheritance(tenantId);
            expect(result).toHaveLength(1);
            expect(result[0].fieldName).toBe('vehicle_number');
            expect(result[0].factoryId).toBeNull();
        });
        it('should merge tenant and factory configurations with factory override', async () => {
            const tenantId = 'tenant-123';
            const factoryId = 'factory-456';
            const tenantConfigs = [
                {
                    id: 'config-1',
                    tenantId,
                    factoryId: null,
                    operationalLevel: transaction_entity_1.OperationalLevel.L2_GATE_ENTRY,
                    fieldName: 'vehicle_number',
                    fieldLabel: 'Vehicle Number (Tenant)',
                    fieldType: 'TEXT',
                    captureType: workflow_configuration_entity_1.FieldCaptureType.CAMERA,
                    validationType: workflow_configuration_entity_1.FieldValidationType.REQUIRED,
                    editability: workflow_configuration_entity_1.FieldEditability.EDITABLE,
                    displayOrder: 1,
                    isActive: true
                },
                {
                    id: 'config-2',
                    tenantId,
                    factoryId: null,
                    operationalLevel: transaction_entity_1.OperationalLevel.L2_GATE_ENTRY,
                    fieldName: 'driver_mobile',
                    fieldLabel: 'Driver Mobile (Tenant)',
                    fieldType: 'TEXT',
                    captureType: workflow_configuration_entity_1.FieldCaptureType.MANUAL,
                    validationType: workflow_configuration_entity_1.FieldValidationType.REQUIRED,
                    editability: workflow_configuration_entity_1.FieldEditability.EDITABLE,
                    displayOrder: 2,
                    isActive: true
                }
            ];
            const factoryConfigs = [
                {
                    id: 'config-3',
                    tenantId,
                    factoryId,
                    operationalLevel: transaction_entity_1.OperationalLevel.L2_GATE_ENTRY,
                    fieldName: 'vehicle_number',
                    fieldLabel: 'Vehicle Number (Factory Override)',
                    fieldType: 'TEXT',
                    captureType: workflow_configuration_entity_1.FieldCaptureType.OCR,
                    validationType: workflow_configuration_entity_1.FieldValidationType.REQUIRED,
                    editability: workflow_configuration_entity_1.FieldEditability.READ_ONLY,
                    displayOrder: 1,
                    isActive: true
                }
            ];
            mockConfigRepo.find
                .mockResolvedValueOnce(tenantConfigs)
                .mockResolvedValueOnce(factoryConfigs);
            const result = await service.getFieldConfigurationsWithInheritance(tenantId, factoryId, transaction_entity_1.OperationalLevel.L2_GATE_ENTRY);
            expect(result).toHaveLength(2);
            const vehicleConfig = result.find(c => c.fieldName === 'vehicle_number');
            expect(vehicleConfig).toBeDefined();
            expect(vehicleConfig.fieldLabel).toBe('Vehicle Number (Factory Override)');
            expect(vehicleConfig.captureType).toBe(workflow_configuration_entity_1.FieldCaptureType.OCR);
            expect(vehicleConfig.editability).toBe(workflow_configuration_entity_1.FieldEditability.READ_ONLY);
            expect(vehicleConfig.factoryId).toBe(factoryId);
            const driverConfig = result.find(c => c.fieldName === 'driver_mobile');
            expect(driverConfig).toBeDefined();
            expect(driverConfig.fieldLabel).toBe('Driver Mobile (Tenant)');
            expect(driverConfig.captureType).toBe(workflow_configuration_entity_1.FieldCaptureType.MANUAL);
            expect(driverConfig.factoryId).toBeNull();
        });
        it('should handle factory-specific field creation', async () => {
            const tenantId = 'tenant-123';
            const factoryId = 'factory-456';
            const factoryConfig = {
                tenantId,
                factoryId,
                operationalLevel: transaction_entity_1.OperationalLevel.L2_GATE_ENTRY,
                fieldName: 'special_gate_field',
                fieldLabel: 'Special Gate Field',
                fieldType: 'TEXT',
                captureType: workflow_configuration_entity_1.FieldCaptureType.MANUAL,
                validationType: workflow_configuration_entity_1.FieldValidationType.OPTIONAL,
                editability: workflow_configuration_entity_1.FieldEditability.EDITABLE
            };
            mockConfigRepo.findOne.mockResolvedValue(null);
            const mockCreatedConfig = {
                id: 'config-new',
                ...factoryConfig,
                effectiveFrom: new Date(),
                version: 1,
                isActive: true
            };
            mockConfigRepo.create.mockReturnValue(mockCreatedConfig);
            mockConfigRepo.save.mockResolvedValue(mockCreatedConfig);
            const result = await service.createFieldConfiguration(factoryConfig);
            expect(result).toBeDefined();
            expect(result.tenantId).toBe(tenantId);
            expect(result.factoryId).toBe(factoryId);
            expect(result.fieldName).toBe('special_gate_field');
            expect(mockConfigRepo.findOne).toHaveBeenCalledWith({
                where: {
                    tenantId,
                    operationalLevel: transaction_entity_1.OperationalLevel.L2_GATE_ENTRY,
                    fieldName: 'special_gate_field',
                    factoryId,
                    isActive: true
                }
            });
        });
        it('should prevent duplicate factory-specific configurations', async () => {
            const tenantId = 'tenant-123';
            const factoryId = 'factory-456';
            const factoryConfig = {
                tenantId,
                factoryId,
                operationalLevel: transaction_entity_1.OperationalLevel.L2_GATE_ENTRY,
                fieldName: 'existing_field',
                fieldLabel: 'Existing Field',
                fieldType: 'TEXT',
                captureType: workflow_configuration_entity_1.FieldCaptureType.MANUAL,
                validationType: workflow_configuration_entity_1.FieldValidationType.REQUIRED,
                editability: workflow_configuration_entity_1.FieldEditability.EDITABLE
            };
            const existingConfig = {
                id: 'existing-config',
                ...factoryConfig,
                isActive: true
            };
            mockConfigRepo.findOne.mockResolvedValue(existingConfig);
            await expect(service.createFieldConfiguration(factoryConfig))
                .rejects
                .toThrow(`Field configuration already exists for 'existing_field' at level L2 for factory ${factoryId}`);
        });
        it('should allow same field name for different factories', async () => {
            const tenantId = 'tenant-123';
            const factory1Id = 'factory-456';
            const factory2Id = 'factory-789';
            const factory1Config = {
                tenantId,
                factoryId: factory1Id,
                operationalLevel: transaction_entity_1.OperationalLevel.L2_GATE_ENTRY,
                fieldName: 'gate_field',
                fieldLabel: 'Gate Field Factory 1',
                fieldType: 'TEXT',
                captureType: workflow_configuration_entity_1.FieldCaptureType.MANUAL,
                validationType: workflow_configuration_entity_1.FieldValidationType.REQUIRED,
                editability: workflow_configuration_entity_1.FieldEditability.EDITABLE
            };
            const factory2Config = {
                tenantId,
                factoryId: factory2Id,
                operationalLevel: transaction_entity_1.OperationalLevel.L2_GATE_ENTRY,
                fieldName: 'gate_field',
                fieldLabel: 'Gate Field Factory 2',
                fieldType: 'TEXT',
                captureType: workflow_configuration_entity_1.FieldCaptureType.CAMERA,
                validationType: workflow_configuration_entity_1.FieldValidationType.OPTIONAL,
                editability: workflow_configuration_entity_1.FieldEditability.READ_ONLY
            };
            mockConfigRepo.findOne.mockResolvedValue(null);
            const mockCreatedConfig1 = {
                id: 'config-factory1',
                ...factory1Config,
                effectiveFrom: new Date(),
                version: 1,
                isActive: true
            };
            const mockCreatedConfig2 = {
                id: 'config-factory2',
                ...factory2Config,
                effectiveFrom: new Date(),
                version: 1,
                isActive: true
            };
            mockConfigRepo.create
                .mockReturnValueOnce(mockCreatedConfig1)
                .mockReturnValueOnce(mockCreatedConfig2);
            mockConfigRepo.save
                .mockResolvedValueOnce(mockCreatedConfig1)
                .mockResolvedValueOnce(mockCreatedConfig2);
            const result1 = await service.createFieldConfiguration(factory1Config);
            const result2 = await service.createFieldConfiguration(factory2Config);
            expect(result1.factoryId).toBe(factory1Id);
            expect(result1.fieldLabel).toBe('Gate Field Factory 1');
            expect(result2.factoryId).toBe(factory2Id);
            expect(result2.fieldLabel).toBe('Gate Field Factory 2');
        });
    });
});
//# sourceMappingURL=configuration-inheritance.integration.spec.js.map