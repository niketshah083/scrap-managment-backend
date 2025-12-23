import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as fc from 'fast-check';
import { GatePassService } from './gate-pass.service';
import { Transaction, OperationalLevel, TransactionStatus } from '../entities/transaction.entity';
import { Vehicle } from '../entities/vehicle.entity';
import { AuditLog, AuditAction } from '../entities/audit-log.entity';

describe('GatePassService', () => {
  let service: GatePassService;
  let transactionRepository: Repository<Transaction>;
  let vehicleRepository: Repository<Vehicle>;
  let auditLogRepository: Repository<AuditLog>;

  const mockTransactionRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
    save: jest.fn(),
  };

  const mockVehicleRepository = {
    update: jest.fn(),
  };

  const mockAuditLogRepository = {
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GatePassService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: mockTransactionRepository,
        },
        {
          provide: getRepositoryToken(Vehicle),
          useValue: mockVehicleRepository,
        },
        {
          provide: getRepositoryToken(AuditLog),
          useValue: mockAuditLogRepository,
        },
      ],
    }).compile();

    service = module.get<GatePassService>(GatePassService);
    transactionRepository = module.get<Repository<Transaction>>(getRepositoryToken(Transaction));
    vehicleRepository = module.get<Repository<Vehicle>>(getRepositoryToken(Vehicle));
    auditLogRepository = module.get<Repository<AuditLog>>(getRepositoryToken(AuditLog));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property 14: Gate Pass Time-Bound Validation
   * 
   * For any gate pass, the system should generate time-bound QR codes, validate time limits 
   * during exit attempts, and prevent reuse of expired or used passes
   * 
   * Validates: Requirements 10.1, 10.2, 10.3
   */
  describe('Property 14: Gate Pass Time-Bound Validation', () => {
    it('should generate time-bound QR codes with correct expiration', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          transactionId: fc.uuid(),
          userId: fc.uuid(),
          validityHours: fc.integer({ min: 1, max: 72 }),
          vehicleNumber: fc.string({ minLength: 5, maxLength: 15 }).filter(s => /^[A-Z0-9\s]+$/.test(s)),
          tenantId: fc.uuid(),
          factoryId: fc.uuid(),
        }),
        async ({ transactionId, userId, validityHours, vehicleNumber, tenantId, factoryId }) => {
          // Setup: Create a transaction with completed and approved GRN (L6)
          const mockTransaction = {
            id: transactionId,
            tenantId,
            factoryId,
            currentLevel: OperationalLevel.L6_GRN_GENERATION,
            status: TransactionStatus.ACTIVE,
            levelData: {
              [OperationalLevel.L6_GRN_GENERATION]: {
                level: OperationalLevel.L6_GRN_GENERATION,
                fieldValues: { grn_number: 'GRN-001' },
                completedBy: userId,
                completedAt: new Date(),
                evidenceIds: [],
                validationStatus: 'APPROVED' as const
              }
            },
            gatePassQrCode: null,
            gatePassExpiresAt: null,
            vehicle: {
              id: fc.sample(fc.uuid(), 1)[0],
              vehicleNumber,
              visitHistory: []
            }
          };

          mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);
          mockTransactionRepository.update.mockResolvedValue({ affected: 1 });
          mockAuditLogRepository.save.mockResolvedValue({});

          // Act: Generate gate pass
          const startTime = new Date();
          const result = await service.generateGatePass(transactionId, userId, validityHours);
          const endTime = new Date();

          // Assert: Verify time-bound properties
          expect(result.transactionId).toBe(transactionId);
          expect(result.vehicleNumber).toBe(vehicleNumber);
          expect(result.qrCode).toBeDefined();
          expect(result.expiresAt).toBeInstanceOf(Date);
          expect(result.generatedBy).toBe(userId);

          // Verify expiration time is within expected range
          const expectedMinExpiry = new Date(startTime.getTime() + validityHours * 60 * 60 * 1000);
          const expectedMaxExpiry = new Date(endTime.getTime() + validityHours * 60 * 60 * 1000);
          
          expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMinExpiry.getTime());
          expect(result.expiresAt.getTime()).toBeLessThanOrEqual(expectedMaxExpiry.getTime());

          // Verify QR code contains required data
          expect(result.qrCode).toMatch(/^data:image\/png;base64,/);

          // Verify transaction was updated with gate pass data
          expect(mockTransactionRepository.update).toHaveBeenCalledWith(
            transactionId,
            expect.objectContaining({
              gatePassQrCode: expect.any(String),
              gatePassExpiresAt: expect.any(Date),
              currentLevel: OperationalLevel.L7_GATE_PASS_EXIT
            })
          );
        }
      ), { numRuns: 10, timeout: 10000 });
    }, 15000);

    it('should validate time limits during exit attempts', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          transactionId: fc.uuid(),
          vehicleNumber: fc.string({ minLength: 5, maxLength: 15 }).filter(s => /^[A-Z0-9\s]+$/.test(s)),
          isExpired: fc.boolean(),
          isAlreadyUsed: fc.boolean(),
        }),
        async ({ transactionId, vehicleNumber, isExpired, isAlreadyUsed }) => {
          // Setup: Create QR code data
          const now = new Date();
          const expiresAt = isExpired 
            ? new Date(now.getTime() - 60 * 60 * 1000) // 1 hour ago (expired)
            : new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now (valid)

          const qrData = {
            transactionId,
            vehicleNumber,
            generatedAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(), // 30 min ago
            expiresAt: expiresAt.toISOString(),
            nonce: fc.sample(fc.uuid(), 1)[0]
          };

          const qrCodeData = JSON.stringify(qrData);

          const mockTransaction = {
            id: transactionId,
            status: isAlreadyUsed ? TransactionStatus.COMPLETED : TransactionStatus.ACTIVE,
            gatePassQrCode: qrCodeData,
            gatePassExpiresAt: expiresAt,
            vehicle: {
              vehicleNumber
            }
          };

          mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);

          // Act: Validate gate pass
          const result = await service.validateGatePass(qrCodeData);

          // Assert: Verify validation logic
          if (isAlreadyUsed) {
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Gate pass already used - vehicle has exited');
          } else if (isExpired) {
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Gate pass has expired');
            expect(result.requiresSupervisorOverride).toBe(true);
          } else {
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.transaction).toBeDefined();
          }
        }
      ), { numRuns: 100 });
    });

    it('should prevent reuse of expired or used passes', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          transactionId: fc.uuid(),
          userId: fc.uuid(),
          vehicleNumber: fc.string({ minLength: 5, maxLength: 15 }).filter(s => /^[A-Z0-9\s]+$/.test(s)),
        }),
        async ({ transactionId, userId, vehicleNumber }) => {
          // Setup: Create a transaction that already has a valid gate pass
          const existingExpiry = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now
          
          const mockTransaction = {
            id: transactionId,
            currentLevel: OperationalLevel.L6_GRN_GENERATION,
            status: TransactionStatus.ACTIVE,
            levelData: {
              [OperationalLevel.L6_GRN_GENERATION]: {
                validationStatus: 'APPROVED' as const
              }
            },
            gatePassQrCode: 'existing-qr-code',
            gatePassExpiresAt: existingExpiry,
            vehicle: { vehicleNumber }
          };

          mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);

          // Act & Assert: Attempt to generate another gate pass should fail
          await expect(
            service.generateGatePass(transactionId, userId, 24)
          ).rejects.toThrow('Valid gate pass already exists for this transaction');

          // Verify no update was made
          expect(mockTransactionRepository.update).not.toHaveBeenCalled();
        }
      ), { numRuns: 30 });
    });

    it('should require GRN completion before gate pass generation', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          transactionId: fc.uuid(),
          userId: fc.uuid(),
          currentLevel: fc.constantFrom(
            OperationalLevel.L1_VENDOR_DISPATCH,
            OperationalLevel.L2_GATE_ENTRY,
            OperationalLevel.L3_WEIGHBRIDGE_GROSS,
            OperationalLevel.L4_MATERIAL_INSPECTION,
            OperationalLevel.L5_WEIGHBRIDGE_TARE
          ),
        }),
        async ({ transactionId, userId, currentLevel }) => {
          // Setup: Create transaction at level before GRN completion
          const mockTransaction = {
            id: transactionId,
            currentLevel,
            levelData: {},
            vehicle: { vehicleNumber: 'TEST123' }
          };

          mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);

          // Act & Assert: Should fail to generate gate pass
          await expect(
            service.generateGatePass(transactionId, userId, 24)
          ).rejects.toThrow('Gate pass cannot be generated without completed GRN');
        }
      ), { numRuns: 50 });
    });
  });

  /**
   * Property 15: Vehicle Record Management
   * 
   * For any completed vehicle exit, the system should lock the vehicle record, 
   * update visit history, and prevent further modifications to that transaction
   * 
   * Validates: Requirements 10.5
   */
  describe('Property 15: Vehicle Record Management', () => {
    it('should lock vehicle record and update visit history after exit', async () => {
      // Setup: Create valid gate pass scenario
      const transactionId = fc.sample(fc.uuid(), 1)[0];
      const userId = fc.sample(fc.uuid(), 1)[0];
      const vehicleId = fc.sample(fc.uuid(), 1)[0];
      const vehicleNumber = 'TEST123';
      const tenantId = fc.sample(fc.uuid(), 1)[0];
      const factoryId = fc.sample(fc.uuid(), 1)[0];
      const existingVisitHistory = [];

      const qrData = {
        transactionId,
        vehicleNumber,
        generatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        nonce: fc.sample(fc.uuid(), 1)[0]
      };

      const mockTransaction = {
        id: transactionId,
        tenantId,
        factoryId,
        status: TransactionStatus.ACTIVE,
        gatePassQrCode: JSON.stringify(qrData),
        gatePassExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
        isLocked: false,
        vehicle: {
          id: vehicleId,
          vehicleNumber,
          visitHistory: existingVisitHistory
        }
      };

      mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);
      mockTransactionRepository.update.mockResolvedValue({ affected: 1 });
      mockVehicleRepository.update.mockResolvedValue({ affected: 1 });
      mockAuditLogRepository.save.mockResolvedValue({});

      // Act: Process vehicle exit
      await service.processVehicleExit(transactionId, userId, false);

      // Assert: Verify transaction is locked and completed
      expect(mockTransactionRepository.update).toHaveBeenCalledWith(
        transactionId,
        expect.objectContaining({
          status: TransactionStatus.COMPLETED,
          isLocked: true,
          completedAt: expect.any(Date)
        })
      );

      // Verify visit history is updated
      expect(mockVehicleRepository.update).toHaveBeenCalledWith(
        vehicleId,
        expect.objectContaining({
          visitHistory: expect.arrayContaining([
            expect.objectContaining({
              transactionId,
              visitDate: expect.any(Date),
              factoryId,
              status: 'COMPLETED'
            })
          ])
        })
      );

      // Verify audit log is created
      expect(mockAuditLogRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          transactionId,
          action: AuditAction.VEHICLE_EXIT_COMPLETED,
          entityType: 'Transaction',
          entityId: transactionId,
          description: 'Vehicle exit completed',
          newValues: expect.objectContaining({
            vehicleNumber,
            supervisorOverride: false,
            status: TransactionStatus.COMPLETED
          }),
          metadata: expect.objectContaining({
            operationalLevel: OperationalLevel.L7_GATE_PASS_EXIT
          }),
          timestamp: expect.any(Date)
        })
      );
    });

    it('should prevent modifications to locked transactions', async () => {
      // Setup: Create already completed/locked transaction
      const transactionId = fc.sample(fc.uuid(), 1)[0];
      const vehicleNumber = 'TEST123';

      const mockTransaction = {
        id: transactionId,
        status: TransactionStatus.COMPLETED,
        isLocked: true,
        gatePassQrCode: 'some-qr-code',
        vehicle: { vehicleNumber }
      };

      mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);

      // Act: Attempt to validate gate pass for completed transaction
      const qrData = JSON.stringify({
        transactionId,
        vehicleNumber,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
      });

      const result = await service.validateGatePass(qrData);

      // Assert: Should indicate gate pass already used
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Gate pass already used - vehicle has exited');
    });

    it('should handle supervisor override with proper audit trail', async () => {
      // Setup: Create expired gate pass scenario
      const transactionId = fc.sample(fc.uuid(), 1)[0];
      const supervisorId = fc.sample(fc.uuid(), 1)[0];
      const justification = 'Emergency exit required due to operational needs';
      const vehicleNumber = 'TEST123';
      const tenantId = fc.sample(fc.uuid(), 1)[0];
      const factoryId = fc.sample(fc.uuid(), 1)[0];
      const expiredTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      
      const mockTransaction = {
        id: transactionId,
        tenantId,
        factoryId,
        status: TransactionStatus.ACTIVE,
        gatePassExpiresAt: expiredTime,
        isLocked: false,
        vehicle: {
          vehicleNumber,
          visitHistory: []
        }
      };

      mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);
      mockTransactionRepository.update.mockResolvedValue({ affected: 1 });
      mockVehicleRepository.update.mockResolvedValue({ affected: 1 });
      mockAuditLogRepository.save.mockResolvedValue({});

      // Act: Process supervisor override
      await service.supervisorOverrideExpiredGatePass(transactionId, supervisorId, justification);

      // Assert: Verify supervisor override audit log
      expect(mockAuditLogRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: supervisorId,
          transactionId,
          action: AuditAction.SUPERVISOR_OVERRIDE_EXPIRED_GATE_PASS,
          entityType: 'Transaction',
          entityId: transactionId,
          description: 'Supervisor override for expired gate pass',
          newValues: expect.objectContaining({
            justification,
            originalExpiryTime: expiredTime.toISOString()
          }),
          metadata: expect.objectContaining({
            operationalLevel: OperationalLevel.L7_GATE_PASS_EXIT
          }),
          timestamp: expect.any(Date)
        })
      );

      // Verify exit processing with supervisor override
      expect(mockAuditLogRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.VEHICLE_EXIT_SUPERVISOR_OVERRIDE,
          newValues: expect.objectContaining({
            supervisorOverride: true
          })
        })
      );
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle invalid QR code format', async () => {
      const invalidQrCodes = [
        'invalid-json',
        '{"incomplete": "data"}',
        '',
        'null',
        '[]'
      ];

      for (const invalidQr of invalidQrCodes) {
        const result = await service.validateGatePass(invalidQr);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid QR code format');
      }
    });

    it('should handle vehicle number mismatch', async () => {
      const qrData = JSON.stringify({
        transactionId: 'test-id',
        vehicleNumber: 'WRONG123',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
      });

      const mockTransaction = {
        id: 'test-id',
        vehicle: { vehicleNumber: 'CORRECT456' }
      };

      mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);

      const result = await service.validateGatePass(qrData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Vehicle number mismatch');
    });

    it('should handle non-existent transaction', async () => {
      const qrData = JSON.stringify({
        transactionId: 'non-existent',
        vehicleNumber: 'TEST123',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
      });

      mockTransactionRepository.findOne.mockResolvedValue(null);

      const result = await service.validateGatePass(qrData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Transaction not found');
    });
  });
});