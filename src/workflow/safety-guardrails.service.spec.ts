import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fc from 'fast-check';
import { WorkflowEngineService } from './workflow-engine.service';
import { FieldConfigurationService } from './field-configuration.service';
import { WorkflowConfiguration, FieldCaptureType, FieldValidationType, FieldEditability } from '../entities/workflow-configuration.entity';
import { Transaction, OperationalLevel, TransactionStatus } from '../entities/transaction.entity';

describe('Safety Guardrails', () => {
  let workflowEngineService: WorkflowEngineService;
  let fieldConfigService: FieldConfigurationService;
  let transactionRepo: Repository<Transaction>;
  let configRepo: Repository<WorkflowConfiguration>;

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
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowEngineService,
        FieldConfigurationService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: mockTransactionRepo,
        },
        {
          provide: getRepositoryToken(WorkflowConfiguration),
          useValue: mockConfigRepo,
        },
      ],
    }).compile();

    workflowEngineService = module.get<WorkflowEngineService>(WorkflowEngineService);
    fieldConfigService = module.get<FieldConfigurationService>(FieldConfigurationService);
    transactionRepo = module.get<Repository<Transaction>>(getRepositoryToken(Transaction));
    configRepo = module.get<Repository<WorkflowConfiguration>>(getRepositoryToken(WorkflowConfiguration));
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  /**
   * **Feature: scrap-operations-platform, Property 20: Safety Guardrails Enforcement**
   * Ensure:
   * - GRN cannot be generated without inspection
   * - Gate pass cannot be generated without GRN
   * - Evidence fields cannot be disabled
   * **Protects audit and legal integrity**
   */
  describe('Property 20: Safety Guardrails Enforcement', () => {
    it('should prevent GRN generation without approved inspection', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            transactionId: fc.uuid(),
            tenantId: fc.uuid(),
            factoryId: fc.uuid(),
            inspectionStatus: fc.constantFrom('PENDING', 'REJECTED', 'APPROVED'),
            hasInspectionData: fc.boolean()
          }),
          async (testData) => {
            // Reset mocks for this iteration
            jest.clearAllMocks();

            const transaction = {
              id: testData.transactionId,
              tenantId: testData.tenantId,
              factoryId: testData.factoryId,
              currentLevel: OperationalLevel.L5_WEIGHBRIDGE_TARE,
              status: TransactionStatus.ACTIVE,
              isLocked: false,
              levelData: testData.hasInspectionData ? {
                [OperationalLevel.L4_MATERIAL_INSPECTION]: {
                  level: OperationalLevel.L4_MATERIAL_INSPECTION,
                  validationStatus: testData.inspectionStatus as 'PENDING' | 'APPROVED' | 'REJECTED',
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

            // Property: GRN generation (L6) should only be allowed if inspection (L4) is approved
            const result = await workflowEngineService.validateLevelProgression(
              testData.transactionId,
              OperationalLevel.L6_GRN_GENERATION
            );

            const hasApprovedInspection = testData.hasInspectionData && 
                                        testData.inspectionStatus === 'APPROVED';

            if (hasApprovedInspection) {
              // Should be allowed (subject to other validations)
              expect(result.isValid).toBe(true);
            } else {
              // Should be blocked by safety guardrail
              expect(result.isValid).toBe(false);
              expect(result.errors.some(error => 
                error.includes('GRN cannot be generated without approved material inspection')
              )).toBe(true);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should prevent gate pass generation without approved GRN', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            transactionId: fc.uuid(),
            tenantId: fc.uuid(),
            factoryId: fc.uuid(),
            grnStatus: fc.constantFrom('PENDING', 'REJECTED', 'APPROVED'),
            hasGrnData: fc.boolean()
          }),
          async (testData) => {
            // Reset mocks for this iteration
            jest.clearAllMocks();

            const transaction = {
              id: testData.transactionId,
              tenantId: testData.tenantId,
              factoryId: testData.factoryId,
              currentLevel: OperationalLevel.L6_GRN_GENERATION,
              status: TransactionStatus.ACTIVE,
              isLocked: false,
              levelData: testData.hasGrnData ? {
                [OperationalLevel.L6_GRN_GENERATION]: {
                  level: OperationalLevel.L6_GRN_GENERATION,
                  validationStatus: testData.grnStatus as 'PENDING' | 'APPROVED' | 'REJECTED',
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

            // Property: Gate pass generation (L7) should only be allowed if GRN (L6) is approved
            const result = await workflowEngineService.validateLevelProgression(
              testData.transactionId,
              OperationalLevel.L7_GATE_PASS_EXIT
            );

            const hasApprovedGrn = testData.hasGrnData && testData.grnStatus === 'APPROVED';

            if (hasApprovedGrn) {
              // Should be allowed (subject to other validations)
              expect(result.isValid).toBe(true);
            } else {
              // Should be blocked by safety guardrail
              expect(result.isValid).toBe(false);
              expect(result.errors.some(error => 
                error.includes('Gate pass cannot be generated without approved GRN')
              )).toBe(true);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should prevent disabling evidence fields for audit integrity', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tenantId: fc.uuid(),
            operationalLevel: fc.integer({ min: 1, max: 7 }),
            fieldName: fc.constantFrom(
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
            ),
            fieldLabel: fc.string({ minLength: 1, maxLength: 100 }),
            fieldType: fc.constantFrom('FILE', 'TEXT', 'TIMESTAMP')
          }),
          async (testData) => {
            // Reset mocks for this iteration
            jest.clearAllMocks();

            const fieldConfig = {
              tenantId: testData.tenantId,
              operationalLevel: testData.operationalLevel as OperationalLevel,
              fieldName: testData.fieldName,
              fieldLabel: testData.fieldLabel,
              fieldType: testData.fieldType,
              captureType: FieldCaptureType.CAMERA,
              validationType: FieldValidationType.REQUIRED,
              editability: FieldEditability.EDITABLE
            };

            // Property: Evidence fields cannot be disabled for audit integrity
            await expect(fieldConfigService.createFieldConfiguration(fieldConfig))
              .rejects
              .toThrow(`Evidence field '${testData.fieldName}' cannot be disabled for audit integrity`);

            // Verify no database operations were attempted
            expect(mockConfigRepo.create).not.toHaveBeenCalled();
            expect(mockConfigRepo.save).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should enforce safety guardrails regardless of configuration changes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            transactionId: fc.uuid(),
            tenantId: fc.uuid(),
            targetLevel: fc.constantFrom(
              OperationalLevel.L6_GRN_GENERATION,
              OperationalLevel.L7_GATE_PASS_EXIT
            ),
            // Simulate various configuration states
            hasCustomConfig: fc.boolean(),
            configVersion: fc.integer({ min: 1, max: 10 })
          }),
          async (testData) => {
            // Reset mocks for this iteration
            jest.clearAllMocks();

            // Create transaction with missing prerequisite approvals
            const transaction = {
              id: testData.transactionId,
              tenantId: testData.tenantId,
              currentLevel: testData.targetLevel === OperationalLevel.L6_GRN_GENERATION 
                ? OperationalLevel.L5_WEIGHBRIDGE_TARE 
                : OperationalLevel.L6_GRN_GENERATION,
              status: TransactionStatus.ACTIVE,
              isLocked: false,
              levelData: {
                // Intentionally missing or non-approved prerequisite data
                [OperationalLevel.L4_MATERIAL_INSPECTION]: testData.targetLevel === OperationalLevel.L6_GRN_GENERATION ? {
                  level: OperationalLevel.L4_MATERIAL_INSPECTION,
                  validationStatus: 'PENDING' as const, // Not approved
                  fieldValues: {},
                  completedBy: 'inspector1',
                  completedAt: new Date(),
                  evidenceIds: []
                } : undefined,
                [OperationalLevel.L6_GRN_GENERATION]: testData.targetLevel === OperationalLevel.L7_GATE_PASS_EXIT ? {
                  level: OperationalLevel.L6_GRN_GENERATION,
                  validationStatus: 'REJECTED' as const, // Not approved
                  fieldValues: {},
                  completedBy: 'operator1',
                  completedAt: new Date(),
                  evidenceIds: []
                } : undefined
              }
            };

            mockTransactionRepo.findOne.mockResolvedValue(transaction);

            // Mock various configuration scenarios
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
            } else {
              mockConfigRepo.find.mockResolvedValue([]);
            }

            // Property: Safety guardrails should be enforced regardless of configuration
            const result = await workflowEngineService.validateLevelProgression(
              testData.transactionId,
              testData.targetLevel
            );

            // Safety guardrails should always block invalid progressions
            expect(result.isValid).toBe(false);
            
            if (testData.targetLevel === OperationalLevel.L6_GRN_GENERATION) {
              expect(result.errors.some(error => 
                error.includes('GRN cannot be generated without approved material inspection')
              )).toBe(true);
            } else if (testData.targetLevel === OperationalLevel.L7_GATE_PASS_EXIT) {
              expect(result.errors.some(error => 
                error.includes('Gate pass cannot be generated without approved GRN')
              )).toBe(true);
            }

            // Property: Safety guardrails are not configurable
            // The validation should fail regardless of custom configuration presence
            // This ensures that even if tenants have custom workflows, 
            // core safety requirements cannot be bypassed
          }
        ),
        { numRuns: 40 }
      );
    });

    it('should validate evidence field protection at service level', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tenantId: fc.uuid(),
            operationalLevel: fc.integer({ min: 1, max: 7 }),
            evidenceFieldName: fc.constantFrom(
              'photos',
              'documents',
              'timestamp',
              'gps_coordinates',
              'operator_signature',
              'inspector_signature'
            )
          }),
          async (testData) => {
            // Property: Evidence field validation should be enforced at the service level
            const canDisable = await workflowEngineService.validateEvidenceFieldConfiguration(
              testData.tenantId,
              testData.operationalLevel as OperationalLevel,
              testData.evidenceFieldName
            );

            // Evidence fields should never be allowed to be disabled
            expect(canDisable).toBe(false);
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Safety Guardrail Edge Cases', () => {
    it('should handle missing level data gracefully', async () => {
      const transactionId = fc.sample(fc.uuid(), 1)[0];
      const transaction = {
        id: transactionId,
        tenantId: fc.sample(fc.uuid(), 1)[0],
        currentLevel: OperationalLevel.L5_WEIGHBRIDGE_TARE,
        status: TransactionStatus.ACTIVE,
        isLocked: false,
        levelData: null // No level data at all
      };

      mockTransactionRepo.findOne.mockResolvedValue(transaction);

      const result = await workflowEngineService.validateLevelProgression(
        transactionId,
        OperationalLevel.L6_GRN_GENERATION
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => 
        error.includes('GRN cannot be generated without approved material inspection')
      )).toBe(true);
    });

    it('should handle undefined level data gracefully', async () => {
      const transactionId = fc.sample(fc.uuid(), 1)[0];
      const transaction = {
        id: transactionId,
        tenantId: fc.sample(fc.uuid(), 1)[0],
        currentLevel: OperationalLevel.L6_GRN_GENERATION,
        status: TransactionStatus.ACTIVE,
        isLocked: false,
        levelData: {
          // L6 data exists but is not approved
          [OperationalLevel.L6_GRN_GENERATION]: {
            level: OperationalLevel.L6_GRN_GENERATION,
            validationStatus: 'PENDING' as const,
            fieldValues: {},
            completedBy: 'operator1',
            completedAt: new Date(),
            evidenceIds: []
          }
          // L4 data is missing entirely
        }
      };

      mockTransactionRepo.findOne.mockResolvedValue(transaction);

      const result = await workflowEngineService.validateLevelProgression(
        transactionId,
        OperationalLevel.L7_GATE_PASS_EXIT
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => 
        error.includes('Gate pass cannot be generated without approved GRN')
      )).toBe(true);
    });
  });
});