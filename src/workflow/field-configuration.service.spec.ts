import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fc from 'fast-check';
import { FieldConfigurationService, CreateFieldConfigDto } from './field-configuration.service';
import { WorkflowConfiguration, FieldValidationType, FieldEditability, FieldCaptureType } from '../entities/workflow-configuration.entity';
import { OperationalLevel } from '../entities/transaction.entity';

describe('FieldConfigurationService', () => {
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

  /**
   * **Feature: scrap-operations-platform, Property 5: Workflow Configuration Flexibility**
   * For any tenant and operational level, the workflow engine should allow configuration of field requirements (required/optional), 
   * editability (editable/read-only), photo count limits (min/max), and field-to-level assignments
   * **Validates: Requirements 3.1, 3.3, 3.4, 3.5**
   */
  describe('Property 5: Workflow Configuration Flexibility', () => {
    it('should allow flexible field configuration across all parameters', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate tenant and field data
          fc.record({
            tenantId: fc.uuid(),
            fieldName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            fieldLabel: fc.string({ minLength: 1, maxLength: 100 }),
            fieldType: fc.constantFrom('TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT', 'FILE'),
            operationalLevel: fc.integer({ min: 1, max: 7 }),
            captureType: fc.constantFrom(
              FieldCaptureType.MANUAL,
              FieldCaptureType.OCR,
              FieldCaptureType.CAMERA,
              FieldCaptureType.AUTO
            ),
            validationType: fc.constantFrom(
              FieldValidationType.REQUIRED,
              FieldValidationType.OPTIONAL
            ),
            editability: fc.constantFrom(
              FieldEditability.EDITABLE,
              FieldEditability.READ_ONLY
            ),
            minPhotoCount: fc.integer({ min: 0, max: 5 }),
            maxPhotoCount: fc.integer({ min: 1, max: 20 }),
            displayOrder: fc.integer({ min: 0, max: 100 })
          }),
          async (configData) => {
            // Ensure maxPhotoCount >= minPhotoCount
            const minPhotoCount = configData.minPhotoCount;
            const maxPhotoCount = Math.max(configData.maxPhotoCount, minPhotoCount);

            const fieldConfig: CreateFieldConfigDto = {
              ...configData,
              operationalLevel: configData.operationalLevel as OperationalLevel,
              maxPhotoCount
            };

            // Mock no existing configuration
            mockConfigRepo.findOne.mockResolvedValue(null);
            
            // Mock successful creation
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

            // Property: All valid field configurations should be accepted
            const result = await service.createFieldConfiguration(fieldConfig);

            // Verify the configuration was created with all specified parameters
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

            // Verify repository interactions
            expect(mockConfigRepo.create).toHaveBeenCalledWith(
              expect.objectContaining({
                ...fieldConfig,
                effectiveFrom: expect.any(Date),
                version: 1,
                isActive: true
              })
            );
            expect(mockConfigRepo.save).toHaveBeenCalled();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should allow fields to be moved between operational levels', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // configId
          fc.integer({ min: 1, max: 7 }), // originalLevel
          fc.integer({ min: 1, max: 7 }), // newLevel
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), // fieldName
          async (configId, originalLevel, newLevel, fieldName) => {
            // Skip if levels are the same
            if (originalLevel === newLevel) return;

            // Skip protected fields that cannot be moved
            const protectedFields = ['vendor_details', 'po_number', 'vehicle_number', 'gross_weight', 'inspection_grade', 'grn_number', 'gate_pass_qr'];
            if (protectedFields.includes(fieldName.toLowerCase())) return;

            const existingConfig = {
              id: configId,
              tenantId: fc.sample(fc.uuid(), 1)[0],
              operationalLevel: originalLevel as OperationalLevel,
              fieldName: fieldName,
              fieldLabel: `${fieldName} Label`,
              fieldType: 'TEXT',
              captureType: FieldCaptureType.MANUAL,
              validationType: FieldValidationType.REQUIRED,
              editability: FieldEditability.EDITABLE,
              version: 1,
              isActive: true,
              effectiveFrom: new Date(),
              createdAt: new Date(),
              updatedAt: new Date()
            };

            // Mock finding the existing configuration for moveFieldToLevel
            mockConfigRepo.findOne.mockImplementation((query) => {
              if (query.where.id === configId) {
                return Promise.resolve(existingConfig);
              }
              // For checking if field exists at target level
              return Promise.resolve(null);
            });

            // Mock deactivating old config
            mockConfigRepo.update.mockResolvedValue({ affected: 1 });

            // Mock creating new config
            const newConfig = {
              ...existingConfig,
              id: fc.sample(fc.uuid(), 1)[0],
              operationalLevel: newLevel as OperationalLevel,
              version: existingConfig.version + 1,
              effectiveFrom: new Date()
            };
            mockConfigRepo.create.mockReturnValue(newConfig);
            mockConfigRepo.save.mockResolvedValue(newConfig);

            // Property: Fields should be movable between levels (except protected ones)
            const result = await service.moveFieldToLevel(configId, newLevel as OperationalLevel);

            expect(result).toBeDefined();
            expect(result.operationalLevel).toBe(newLevel);
            expect(result.version).toBe(existingConfig.version + 1);

            // Verify old config was deactivated
            expect(mockConfigRepo.update).toHaveBeenCalledWith(
              configId,
              expect.objectContaining({
                isActive: false,
                effectiveTo: expect.any(Date)
              })
            );

            // Verify new config was created
            expect(mockConfigRepo.create).toHaveBeenCalledWith(
              expect.objectContaining({
                operationalLevel: newLevel,
                version: existingConfig.version + 1
              })
            );
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should support all field requirement combinations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tenantId: fc.uuid(),
            operationalLevel: fc.integer({ min: 1, max: 7 }),
            fieldName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            // Test all combinations of field requirements
            validationType: fc.constantFrom(FieldValidationType.REQUIRED, FieldValidationType.OPTIONAL),
            editability: fc.constantFrom(FieldEditability.EDITABLE, FieldEditability.READ_ONLY),
            captureType: fc.constantFrom(
              FieldCaptureType.MANUAL,
              FieldCaptureType.OCR,
              FieldCaptureType.CAMERA,
              FieldCaptureType.AUTO
            )
          }),
          async (configData) => {
            const fieldConfig: CreateFieldConfigDto = {
              ...configData,
              operationalLevel: configData.operationalLevel as OperationalLevel,
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

            // Property: All valid combinations of field requirements should be supported
            const result = await service.createFieldConfiguration(fieldConfig);

            expect(result.validationType).toBe(configData.validationType);
            expect(result.editability).toBe(configData.editability);
            expect(result.captureType).toBe(configData.captureType);
          }
        ),
        { numRuns: 40 }
      );
    });

    it('should support configurable photo count limits', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tenantId: fc.uuid(),
            operationalLevel: fc.integer({ min: 1, max: 7 }),
            fieldName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            minPhotoCount: fc.integer({ min: 0, max: 10 }),
            maxPhotoCount: fc.integer({ min: 1, max: 50 })
          }),
          async (configData) => {
            // Ensure maxPhotoCount >= minPhotoCount
            const minPhotoCount = configData.minPhotoCount;
            const maxPhotoCount = Math.max(configData.maxPhotoCount, minPhotoCount);

            const fieldConfig: CreateFieldConfigDto = {
              ...configData,
              operationalLevel: configData.operationalLevel as OperationalLevel,
              fieldLabel: `${configData.fieldName} Label`,
              fieldType: 'FILE',
              captureType: FieldCaptureType.CAMERA,
              validationType: FieldValidationType.REQUIRED,
              editability: FieldEditability.EDITABLE,
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

            // Property: Photo count limits should be configurable within valid ranges
            const result = await service.createFieldConfiguration(fieldConfig);

            expect(result.minPhotoCount).toBe(minPhotoCount);
            expect(result.maxPhotoCount).toBe(maxPhotoCount);
            expect(result.maxPhotoCount).toBeGreaterThanOrEqual(result.minPhotoCount);
          }
        ),
        { numRuns: 30 }
      );
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
        const fieldConfig: CreateFieldConfigDto = {
          tenantId: fc.sample(fc.uuid(), 1)[0],
          operationalLevel: OperationalLevel.L4_MATERIAL_INSPECTION,
          fieldName: fieldName,
          fieldLabel: `${fieldName} Label`,
          fieldType: 'FILE',
          captureType: FieldCaptureType.CAMERA,
          validationType: FieldValidationType.REQUIRED,
          editability: FieldEditability.EDITABLE
        };

        // Property: Evidence fields cannot be disabled for audit integrity
        await expect(service.createFieldConfiguration(fieldConfig))
          .rejects
          .toThrow(`Evidence field '${fieldName}' cannot be disabled for audit integrity`);
      }
    });
  });
});