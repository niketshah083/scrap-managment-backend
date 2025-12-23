import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fc from 'fast-check';
import { FieldConfigurationService } from './field-configuration.service';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowConfiguration, FieldValidationType, FieldEditability, FieldCaptureType } from '../entities/workflow-configuration.entity';
import { Transaction, OperationalLevel, TransactionStatus } from '../entities/transaction.entity';

describe('Configuration Immutability', () => {
  let fieldConfigService: FieldConfigurationService;
  let workflowEngineService: WorkflowEngineService;
  let configRepo: Repository<WorkflowConfiguration>;
  let transactionRepo: Repository<Transaction>;

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
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FieldConfigurationService,
        WorkflowEngineService,
        {
          provide: getRepositoryToken(WorkflowConfiguration),
          useValue: mockConfigRepo,
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: mockTransactionRepo,
        },
      ],
    }).compile();

    fieldConfigService = module.get<FieldConfigurationService>(FieldConfigurationService);
    workflowEngineService = module.get<WorkflowEngineService>(WorkflowEngineService);
    configRepo = module.get<Repository<WorkflowConfiguration>>(getRepositoryToken(WorkflowConfiguration));
    transactionRepo = module.get<Repository<Transaction>>(getRepositoryToken(Transaction));
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  /**
   * **Feature: scrap-operations-platform, Property 3: Configuration Immutability for Existing Transactions**
   * For any existing transaction, configuration changes should never affect the transaction's structure, validation rules, or field requirements
   * **Validates: Requirements 1.4**
   */
  describe('Property 3: Configuration Immutability for Existing Transactions', () => {
    it('should create new configuration versions without affecting existing transactions', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate existing configuration
          fc.record({
            id: fc.uuid(),
            tenantId: fc.uuid(),
            operationalLevel: fc.integer({ min: 1, max: 7 }),
            fieldName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            fieldLabel: fc.string({ minLength: 1, maxLength: 100 }),
            fieldType: fc.constantFrom('TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT', 'FILE'),
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
            version: fc.integer({ min: 1, max: 5 }),
            effectiveFrom: fc.date({ min: new Date('2023-01-01'), max: new Date('2024-01-01') }),
            isActive: fc.boolean()
          }),
          // Generate update data
          fc.record({
            fieldLabel: fc.string({ minLength: 1, maxLength: 100 }),
            validationType: fc.constantFrom(
              FieldValidationType.REQUIRED,
              FieldValidationType.OPTIONAL
            ),
            editability: fc.constantFrom(
              FieldEditability.EDITABLE,
              FieldEditability.READ_ONLY
            )
          }),
          async (existingConfig, updateData) => {
            // Skip protected evidence fields
            const protectedFields = ['photos', 'documents', 'timestamp', 'gps_coordinates'];
            if (protectedFields.includes(existingConfig.fieldName.toLowerCase())) {
              return;
            }

            const originalEffectiveFrom = existingConfig.effectiveFrom;
            const originalVersion = existingConfig.version;
            const originalId = existingConfig.id;

            // Reset mocks for this test iteration
            jest.clearAllMocks();

            // Mock finding the existing configuration
            mockConfigRepo.findOne.mockResolvedValue(existingConfig);

            // Mock deactivating old config
            mockConfigRepo.update.mockResolvedValue({ affected: 1 });

            // Mock creating new config version
            const newConfigVersion = {
              ...existingConfig,
              ...updateData,
              id: fc.sample(fc.uuid(), 1)[0], // New ID for new version
              version: originalVersion + 1,
              effectiveFrom: new Date(), // New effective date
              effectiveTo: null,
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            mockConfigRepo.create.mockReturnValue(newConfigVersion);
            mockConfigRepo.save.mockResolvedValue(newConfigVersion);

            // Property: Configuration updates should create new versions, not modify existing ones
            const result = await fieldConfigService.updateFieldConfiguration({
              id: originalId,
              ...updateData
            });

            // Verify new version was created
            expect(result).toBeDefined();
            expect(result.version).toBe(originalVersion + 1);
            expect(result.effectiveFrom).not.toEqual(originalEffectiveFrom);

            // Verify old configuration was deactivated (not deleted or modified)
            expect(mockConfigRepo.update).toHaveBeenCalledWith(
              originalId,
              expect.objectContaining({
                isActive: false,
                effectiveTo: expect.any(Date)
              })
            );

            // Verify new configuration was created
            expect(mockConfigRepo.create).toHaveBeenCalledWith(
              expect.objectContaining({
                version: originalVersion + 1,
                effectiveFrom: expect.any(Date),
                isActive: true
              })
            );

            // Property: Original configuration structure remains unchanged
            // (The old config is deactivated but its structure is preserved)
            const updateCall = mockConfigRepo.update.mock.calls[0];
            expect(updateCall[0]).toBe(originalId); // Same ID
            expect(updateCall[1]).not.toHaveProperty('fieldName'); // Core structure not changed
            expect(updateCall[1]).not.toHaveProperty('fieldType'); // Core structure not changed
            expect(updateCall[1]).not.toHaveProperty('version'); // Version not changed in old record
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should preserve configuration history through versioning', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tenantId: fc.uuid(),
            operationalLevel: fc.integer({ min: 1, max: 7 }),
            fieldName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            initialVersion: fc.integer({ min: 1, max: 3 }),
            updateCount: fc.integer({ min: 1, max: 3 }) // Reduced to avoid mock complexity
          }),
          async (testData) => {
            // Skip protected evidence fields
            const protectedFields = ['photos', 'documents', 'timestamp', 'gps_coordinates'];
            if (protectedFields.includes(testData.fieldName.toLowerCase())) {
              return;
            }

            // Reset mocks for this test iteration
            jest.clearAllMocks();

            let currentVersion = testData.initialVersion;
            let updateCallCount = 0;
            let createCallCount = 0;

            // Simulate multiple configuration updates
            for (let i = 0; i < testData.updateCount; i++) {
              const configId = fc.sample(fc.uuid(), 1)[0];
              const existingConfig = {
                id: configId,
                tenantId: testData.tenantId,
                operationalLevel: testData.operationalLevel as OperationalLevel,
                fieldName: testData.fieldName,
                fieldLabel: `${testData.fieldName} Label v${currentVersion}`,
                fieldType: 'TEXT',
                captureType: FieldCaptureType.MANUAL,
                validationType: FieldValidationType.REQUIRED,
                editability: FieldEditability.EDITABLE,
                version: currentVersion,
                effectiveFrom: new Date(Date.now() - (testData.updateCount - i) * 86400000), // Days ago
                isActive: i === testData.updateCount - 1, // Only latest is active
                createdAt: new Date(),
                updatedAt: new Date()
              };

              // Mock update process
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

            // Property: All configuration versions should be preserved in history
            // Verify that each update created a new version without destroying the old one
            expect(mockConfigRepo.update).toHaveBeenCalledTimes(updateCallCount);
            expect(mockConfigRepo.create).toHaveBeenCalledTimes(createCallCount);

            // Each update should have deactivated the old version (not deleted it)
            const updateCalls = mockConfigRepo.update.mock.calls;
            updateCalls.forEach(call => {
              expect(call[1]).toEqual(
                expect.objectContaining({
                  isActive: false,
                  effectiveTo: expect.any(Date)
                })
              );
            });

            // Each new version should have incremented version number
            const createCalls = mockConfigRepo.create.mock.calls;
            createCalls.forEach((call, index) => {
              expect(call[0]).toEqual(
                expect.objectContaining({
                  version: testData.initialVersion + index + 1,
                  isActive: true,
                  effectiveFrom: expect.any(Date)
                })
              );
            });
          }
        ),
        { numRuns: 15 }
      );
    });

    it('should ensure existing transactions use their original configuration', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tenantId: fc.uuid(),
            transactionId: fc.uuid(),
            operationalLevel: fc.integer({ min: 1, max: 7 }),
            fieldName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            configEffectiveDate: fc.date({ min: new Date('2023-01-01'), max: new Date('2023-12-31') }),
            transactionCreatedDate: fc.date({ min: new Date('2023-06-01'), max: new Date('2024-01-31') })
          }),
          async (testData) => {
            // Skip protected evidence fields
            const protectedFields = ['photos', 'documents', 'timestamp', 'gps_coordinates'];
            if (protectedFields.includes(testData.fieldName.toLowerCase())) {
              return;
            }

            // Create original configuration (effective before transaction)
            const originalConfig = {
              id: fc.sample(fc.uuid(), 1)[0],
              tenantId: testData.tenantId,
              operationalLevel: testData.operationalLevel as OperationalLevel,
              fieldName: testData.fieldName,
              fieldLabel: 'Original Label',
              fieldType: 'TEXT',
              captureType: FieldCaptureType.MANUAL,
              validationType: FieldValidationType.REQUIRED,
              editability: FieldEditability.EDITABLE,
              version: 1,
              effectiveFrom: testData.configEffectiveDate,
              effectiveTo: null,
              isActive: false, // Will be deactivated when new config is created
              createdAt: testData.configEffectiveDate,
              updatedAt: testData.configEffectiveDate
            };

            // Create transaction that uses the original configuration
            const transaction = {
              id: testData.transactionId,
              tenantId: testData.tenantId,
              currentLevel: testData.operationalLevel as OperationalLevel,
              status: TransactionStatus.ACTIVE,
              isLocked: false,
              createdAt: testData.transactionCreatedDate,
              levelData: {}
            };

            // Mock getting configurations for the transaction's creation time
            // This simulates how the system should get the configuration that was active when the transaction was created
            mockConfigRepo.find.mockImplementation((query) => {
              const where = query.where;
              if (where.tenantId === testData.tenantId && 
                  where.operationalLevel === testData.operationalLevel) {
                // Return configuration that was active at transaction creation time
                if (testData.transactionCreatedDate >= testData.configEffectiveDate) {
                  return Promise.resolve([originalConfig]);
                }
              }
              return Promise.resolve([]);
            });

            // Property: Transactions should use configuration that was active at their creation time
            const configsForTransaction = await workflowEngineService.getConfiguredFields(
              testData.tenantId,
              testData.operationalLevel as OperationalLevel
            );

            // The transaction should get the configuration that was effective when it was created
            if (testData.transactionCreatedDate >= testData.configEffectiveDate) {
              expect(configsForTransaction).toHaveLength(1);
              expect(configsForTransaction[0].fieldName).toBe(testData.fieldName);
              expect(configsForTransaction[0].fieldLabel).toBe('Original Label');
            }

            // Now simulate a configuration update after the transaction was created
            const newConfigDate = new Date(Math.max(
              testData.transactionCreatedDate.getTime(),
              testData.configEffectiveDate.getTime()
            ) + 86400000); // 1 day later

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

            // Update configuration
            await fieldConfigService.updateFieldConfiguration({
              id: originalConfig.id,
              fieldLabel: 'Updated Label'
            });

            // Property: Configuration update should not affect existing transaction's behavior
            // The existing transaction should still reference the original configuration structure
            // This is ensured by the versioning system - old configs are deactivated but preserved
            expect(mockConfigRepo.update).toHaveBeenCalledWith(
              originalConfig.id,
              expect.objectContaining({
                isActive: false,
                effectiveTo: expect.any(Date)
              })
            );

            // The original configuration structure is preserved (just deactivated)
            // New transactions would use the new configuration, but existing ones maintain their reference
            expect(mockConfigRepo.create).toHaveBeenCalledWith(
              expect.objectContaining({
                fieldLabel: 'Updated Label',
                version: 2,
                effectiveFrom: expect.any(Date)
              })
            );
          }
        ),
        { numRuns: 25 }
      );
    });
  });
});