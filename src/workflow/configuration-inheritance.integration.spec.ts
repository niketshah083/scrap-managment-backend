import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FieldConfigurationService, CreateFieldConfigDto } from './field-configuration.service';
import { WorkflowConfiguration, FieldValidationType, FieldEditability, FieldCaptureType } from '../entities/workflow-configuration.entity';
import { OperationalLevel } from '../entities/transaction.entity';

describe('Configuration Inheritance Integration', () => {
  let service: FieldConfigurationService;
  let configRepo: Repository<WorkflowConfiguration>;

  const mockConfigRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FieldConfigurationService,
        {
          provide: getRepositoryToken(WorkflowConfiguration),
          useValue: mockConfigRepo,
        },
      ],
    }).compile();

    service = module.get<FieldConfigurationService>(FieldConfigurationService);
    configRepo = module.get<Repository<WorkflowConfiguration>>(getRepositoryToken(WorkflowConfiguration));
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
          operationalLevel: OperationalLevel.L2_GATE_ENTRY,
          fieldName: 'vehicle_number',
          fieldLabel: 'Vehicle Number',
          fieldType: 'TEXT',
          captureType: FieldCaptureType.CAMERA,
          validationType: FieldValidationType.REQUIRED,
          editability: FieldEditability.EDITABLE,
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

      // Mock tenant configurations
      const tenantConfigs = [
        {
          id: 'config-1',
          tenantId,
          factoryId: null,
          operationalLevel: OperationalLevel.L2_GATE_ENTRY,
          fieldName: 'vehicle_number',
          fieldLabel: 'Vehicle Number (Tenant)',
          fieldType: 'TEXT',
          captureType: FieldCaptureType.CAMERA,
          validationType: FieldValidationType.REQUIRED,
          editability: FieldEditability.EDITABLE,
          displayOrder: 1,
          isActive: true
        },
        {
          id: 'config-2',
          tenantId,
          factoryId: null,
          operationalLevel: OperationalLevel.L2_GATE_ENTRY,
          fieldName: 'driver_mobile',
          fieldLabel: 'Driver Mobile (Tenant)',
          fieldType: 'TEXT',
          captureType: FieldCaptureType.MANUAL,
          validationType: FieldValidationType.REQUIRED,
          editability: FieldEditability.EDITABLE,
          displayOrder: 2,
          isActive: true
        }
      ];

      // Mock factory configurations (overrides vehicle_number)
      const factoryConfigs = [
        {
          id: 'config-3',
          tenantId,
          factoryId,
          operationalLevel: OperationalLevel.L2_GATE_ENTRY,
          fieldName: 'vehicle_number',
          fieldLabel: 'Vehicle Number (Factory Override)',
          fieldType: 'TEXT',
          captureType: FieldCaptureType.OCR, // Different capture type
          validationType: FieldValidationType.REQUIRED,
          editability: FieldEditability.READ_ONLY, // Different editability
          displayOrder: 1,
          isActive: true
        }
      ];

      // Mock the repository calls
      mockConfigRepo.find
        .mockResolvedValueOnce(tenantConfigs) // First call for tenant configs
        .mockResolvedValueOnce(factoryConfigs); // Second call for factory configs

      const result = await service.getFieldConfigurationsWithInheritance(
        tenantId,
        factoryId,
        OperationalLevel.L2_GATE_ENTRY
      );

      expect(result).toHaveLength(2);
      
      // Vehicle number should be overridden by factory config
      const vehicleConfig = result.find(c => c.fieldName === 'vehicle_number');
      expect(vehicleConfig).toBeDefined();
      expect(vehicleConfig.fieldLabel).toBe('Vehicle Number (Factory Override)');
      expect(vehicleConfig.captureType).toBe(FieldCaptureType.OCR);
      expect(vehicleConfig.editability).toBe(FieldEditability.READ_ONLY);
      expect(vehicleConfig.factoryId).toBe(factoryId);

      // Driver mobile should remain from tenant config
      const driverConfig = result.find(c => c.fieldName === 'driver_mobile');
      expect(driverConfig).toBeDefined();
      expect(driverConfig.fieldLabel).toBe('Driver Mobile (Tenant)');
      expect(driverConfig.captureType).toBe(FieldCaptureType.MANUAL);
      expect(driverConfig.factoryId).toBeNull();
    });

    it('should handle factory-specific field creation', async () => {
      const tenantId = 'tenant-123';
      const factoryId = 'factory-456';

      const factoryConfig: CreateFieldConfigDto = {
        tenantId,
        factoryId,
        operationalLevel: OperationalLevel.L2_GATE_ENTRY,
        fieldName: 'special_gate_field',
        fieldLabel: 'Special Gate Field',
        fieldType: 'TEXT',
        captureType: FieldCaptureType.MANUAL,
        validationType: FieldValidationType.OPTIONAL,
        editability: FieldEditability.EDITABLE
      };

      // Mock no existing configuration
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

      // Verify the uniqueness check included factoryId
      expect(mockConfigRepo.findOne).toHaveBeenCalledWith({
        where: {
          tenantId,
          operationalLevel: OperationalLevel.L2_GATE_ENTRY,
          fieldName: 'special_gate_field',
          factoryId,
          isActive: true
        }
      });
    });

    it('should prevent duplicate factory-specific configurations', async () => {
      const tenantId = 'tenant-123';
      const factoryId = 'factory-456';

      const factoryConfig: CreateFieldConfigDto = {
        tenantId,
        factoryId,
        operationalLevel: OperationalLevel.L2_GATE_ENTRY,
        fieldName: 'existing_field',
        fieldLabel: 'Existing Field',
        fieldType: 'TEXT',
        captureType: FieldCaptureType.MANUAL,
        validationType: FieldValidationType.REQUIRED,
        editability: FieldEditability.EDITABLE
      };

      // Mock existing configuration
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

      const factory1Config: CreateFieldConfigDto = {
        tenantId,
        factoryId: factory1Id,
        operationalLevel: OperationalLevel.L2_GATE_ENTRY,
        fieldName: 'gate_field',
        fieldLabel: 'Gate Field Factory 1',
        fieldType: 'TEXT',
        captureType: FieldCaptureType.MANUAL,
        validationType: FieldValidationType.REQUIRED,
        editability: FieldEditability.EDITABLE
      };

      const factory2Config: CreateFieldConfigDto = {
        tenantId,
        factoryId: factory2Id,
        operationalLevel: OperationalLevel.L2_GATE_ENTRY,
        fieldName: 'gate_field', // Same field name, different factory
        fieldLabel: 'Gate Field Factory 2',
        fieldType: 'TEXT',
        captureType: FieldCaptureType.CAMERA, // Different configuration
        validationType: FieldValidationType.OPTIONAL,
        editability: FieldEditability.READ_ONLY
      };

      // Mock no existing configurations for either factory
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

      // Both configurations should be created successfully
      const result1 = await service.createFieldConfiguration(factory1Config);
      const result2 = await service.createFieldConfiguration(factory2Config);

      expect(result1.factoryId).toBe(factory1Id);
      expect(result1.fieldLabel).toBe('Gate Field Factory 1');
      expect(result2.factoryId).toBe(factory2Id);
      expect(result2.fieldLabel).toBe('Gate Field Factory 2');
    });
  });
});