import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fc from 'fast-check';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowConfiguration } from '../entities/workflow-configuration.entity';
import { Transaction, OperationalLevel, TransactionStatus } from '../entities/transaction.entity';

describe('WorkflowEngineService', () => {
  let service: WorkflowEngineService;
  let transactionRepo: Repository<Transaction>;
  let workflowConfigRepo: Repository<WorkflowConfiguration>;

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
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowEngineService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: mockTransactionRepo,
        },
        {
          provide: getRepositoryToken(WorkflowConfiguration),
          useValue: mockWorkflowConfigRepo,
        },
      ],
    }).compile();

    service = module.get<WorkflowEngineService>(WorkflowEngineService);
    transactionRepo = module.get<Repository<Transaction>>(getRepositoryToken(Transaction));
    workflowConfigRepo = module.get<Repository<WorkflowConfiguration>>(getRepositoryToken(WorkflowConfiguration));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * **Feature: scrap-operations-platform, Property 4: Sequential Level Progression**
   * For any transaction, progression through operational levels must follow the exact sequence L1→L2→L3→L4→L5→L6→L7 without skipping any level
   * **Validates: Requirements 2.1, 2.2**
   */
  describe('Property 4: Sequential Level Progression', () => {
    it('should enforce sequential level progression without skipping', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate valid current levels (L1-L6, since L7 is the final level)
          fc.integer({ min: 1, max: 6 }),
          // Generate target levels that might be invalid
          fc.integer({ min: 1, max: 10 }),
          // Generate transaction data
          fc.record({
            id: fc.uuid(),
            tenantId: fc.uuid(),
            currentLevel: fc.integer({ min: 1, max: 7 }),
            status: fc.constantFrom(
              TransactionStatus.ACTIVE,
              TransactionStatus.COMPLETED,
              TransactionStatus.REJECTED,
              TransactionStatus.CANCELLED
            ),
            isLocked: fc.boolean(),
            levelData: fc.option(fc.dictionary(fc.string(), fc.anything()), { nil: null })
          }),
          async (currentLevel: number, targetLevel: number, transactionData) => {
            // Setup transaction with the generated current level
            const transaction = {
              ...transactionData,
              currentLevel: currentLevel as OperationalLevel,
            };

            // For valid progressions, set up required prerequisite data to pass safety guardrails
            const expectedNextLevel = currentLevel + 1;
            const isValidProgression = targetLevel === expectedNextLevel;
            const isValidLevel = targetLevel >= 1 && targetLevel <= 7;
            const isActiveTransaction = transaction.status === TransactionStatus.ACTIVE;
            const isUnlocked = !transaction.isLocked;

            if (isValidProgression && isValidLevel && isActiveTransaction && isUnlocked) {
              // Set up prerequisite data for safety guardrails
              if (targetLevel === OperationalLevel.L6_GRN_GENERATION) {
                // L6 requires approved L4 inspection
                transaction.levelData = {
                  ...transaction.levelData,
                  [OperationalLevel.L4_MATERIAL_INSPECTION]: {
                    level: OperationalLevel.L4_MATERIAL_INSPECTION,
                    validationStatus: 'APPROVED' as const,
                    fieldValues: {},
                    completedBy: 'inspector1',
                    completedAt: new Date(),
                    evidenceIds: []
                  }
                };
              } else if (targetLevel === OperationalLevel.L7_GATE_PASS_EXIT) {
                // L7 requires approved L6 GRN
                transaction.levelData = {
                  ...transaction.levelData,
                  [OperationalLevel.L6_GRN_GENERATION]: {
                    level: OperationalLevel.L6_GRN_GENERATION,
                    validationStatus: 'APPROVED' as const,
                    fieldValues: {},
                    completedBy: 'operator1',
                    completedAt: new Date(),
                    evidenceIds: []
                  }
                };
              }
            }

            mockTransactionRepo.findOne.mockResolvedValue(transaction);

            const result = await service.validateLevelProgression(
              transaction.id,
              targetLevel as OperationalLevel
            );

            // Property: Sequential progression must be enforced
            if (isValidProgression && isValidLevel && isActiveTransaction && isUnlocked) {
              // Valid progression should be allowed (subject to safety guardrails)
              expect(result.isValid).toBe(true);
            } else {
              // Invalid progression should be rejected
              expect(result.isValid).toBe(false);
              expect(result.errors.length).toBeGreaterThan(0);

              // Check specific error conditions in priority order (as per service logic)
              if (!isUnlocked) {
                expect(result.errors.some(error => 
                  error.includes('locked')
                )).toBe(true);
              } else if (!isActiveTransaction) {
                expect(result.errors.some(error => 
                  error.includes('completed') || error.includes('cancelled') || 
                  error.includes('already') || error.includes('rejected')
                )).toBe(true);
              } else if (!isValidProgression) {
                // Level progression is checked before level bounds
                expect(result.errors.some(error => 
                  error.includes('Invalid level progression')
                )).toBe(true);
              } else if (!isValidLevel) {
                expect(result.errors.some(error => 
                  error.includes('Invalid operational level')
                )).toBe(true);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should prevent skipping levels in any sequence', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate current level
          fc.integer({ min: 1, max: 6 }),
          // Generate a skip amount (2 or more levels ahead)
          fc.integer({ min: 2, max: 5 }),
          fc.uuid(),
          async (currentLevel: number, skipAmount: number, transactionId: string) => {
            const targetLevel = currentLevel + skipAmount;
            
            // Only test valid target levels
            if (targetLevel > 7) return;

            const transaction = {
              id: transactionId,
              tenantId: fc.sample(fc.uuid(), 1)[0],
              currentLevel: currentLevel as OperationalLevel,
              status: TransactionStatus.ACTIVE,
              isLocked: false,
              levelData: {}
            };

            mockTransactionRepo.findOne.mockResolvedValue(transaction);

            const result = await service.validateLevelProgression(
              transactionId,
              targetLevel as OperationalLevel
            );

            // Property: Skipping levels should always be invalid
            expect(result.isValid).toBe(false);
            expect(result.errors.some(error => 
              error.includes('Invalid level progression')
            )).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should allow only the immediate next level', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 6 }), // Current level (L1-L6)
          fc.uuid(),
          async (currentLevel: number, transactionId: string) => {
            const expectedNextLevel = currentLevel + 1;

            const transaction = {
              id: transactionId,
              tenantId: fc.sample(fc.uuid(), 1)[0],
              currentLevel: currentLevel as OperationalLevel,
              status: TransactionStatus.ACTIVE,
              isLocked: false,
              levelData: {}
            };

            mockTransactionRepo.findOne.mockResolvedValue(transaction);

            const result = await service.validateLevelProgression(
              transactionId,
              expectedNextLevel as OperationalLevel
            );

            // Property: The immediate next level should always be valid (subject to safety guardrails)
            // Note: Safety guardrails might still reject, but level progression logic should pass
            if (result.isValid === false) {
              // If rejected, it should be due to safety guardrails, not level progression
              const hasProgressionError = result.errors.some(error => 
                error.includes('Invalid level progression')
              );
              expect(hasProgressionError).toBe(false);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Safety Guardrails', () => {
    it('should prevent GRN generation without approved inspection', async () => {
      const transactionId = fc.sample(fc.uuid(), 1)[0];
      const transaction = {
        id: transactionId,
        tenantId: fc.sample(fc.uuid(), 1)[0],
        currentLevel: OperationalLevel.L5_WEIGHBRIDGE_TARE,
        status: TransactionStatus.ACTIVE,
        isLocked: false,
        levelData: {
          [OperationalLevel.L4_MATERIAL_INSPECTION]: {
            level: OperationalLevel.L4_MATERIAL_INSPECTION,
            validationStatus: 'REJECTED' as const, // Not approved
            fieldValues: {},
            completedBy: 'inspector1',
            completedAt: new Date(),
            evidenceIds: []
          }
        }
      };

      mockTransactionRepo.findOne.mockResolvedValue(transaction);

      const result = await service.validateLevelProgression(
        transactionId,
        OperationalLevel.L6_GRN_GENERATION
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => 
        error.includes('GRN cannot be generated without approved material inspection')
      )).toBe(true);
    });

    it('should prevent gate pass generation without approved GRN', async () => {
      const transactionId = fc.sample(fc.uuid(), 1)[0];
      const transaction = {
        id: transactionId,
        tenantId: fc.sample(fc.uuid(), 1)[0],
        currentLevel: OperationalLevel.L6_GRN_GENERATION,
        status: TransactionStatus.ACTIVE,
        isLocked: false,
        levelData: {
          [OperationalLevel.L6_GRN_GENERATION]: {
            level: OperationalLevel.L6_GRN_GENERATION,
            validationStatus: 'PENDING' as const, // Not approved
            fieldValues: {},
            completedBy: 'operator1',
            completedAt: new Date(),
            evidenceIds: []
          }
        }
      };

      mockTransactionRepo.findOne.mockResolvedValue(transaction);

      const result = await service.validateLevelProgression(
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