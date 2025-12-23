import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as fc from 'fast-check';
import { WeighbridgeService, WeighbridgeReading, WeightCalculationResult } from './weighbridge.service';
import { Transaction, OperationalLevel, TransactionStatus } from '../entities/transaction.entity';
import { Evidence, EvidenceType } from '../entities/evidence.entity';
import { AuditLog, AuditAction } from '../entities/audit-log.entity';

describe('WeighbridgeService', () => {
  let service: WeighbridgeService;
  let transactionRepository: jest.Mocked<Repository<Transaction>>;
  let evidenceRepository: jest.Mocked<Repository<Evidence>>;
  let auditLogRepository: jest.Mocked<Repository<AuditLog>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WeighbridgeService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Evidence),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AuditLog),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WeighbridgeService>(WeighbridgeService);
    transactionRepository = module.get(getRepositoryToken(Transaction));
    evidenceRepository = module.get(getRepositoryToken(Evidence));
    auditLogRepository = module.get(getRepositoryToken(AuditLog));
  });

  describe('calculateNetWeight', () => {
    /**
     * **Feature: scrap-operations-platform, Property 7: Weight Calculation and Validation**
     * For any weighbridge operation, the system should correctly calculate net weight (gross - tare), 
     * validate against configured thresholds, and store all weight values with complete metadata
     * **Validates: Requirements 5.3, 5.4, 5.5**
     */
    it('should correctly calculate net weight and validate thresholds for all valid weight combinations', () => {
      fc.assert(
        fc.property(
          // Generate valid gross weights (1kg to 100 tons)
          fc.float({ min: Math.fround(1), max: Math.fround(100000) }).filter(n => Number.isFinite(n) && n > 0),
          // Generate valid tare weights (always less than gross weight)
          fc.float({ min: Math.fround(0.1), max: Math.fround(50000) }).filter(n => Number.isFinite(n) && n > 0),
          // Generate discrepancy thresholds (1% to 50%)
          fc.float({ min: Math.fround(1), max: Math.fround(50) }).filter(n => Number.isFinite(n) && n > 0),
          (grossWeight, tareWeightRatio, discrepancyThreshold) => {
            // Ensure tare weight is always less than gross weight
            const tareWeight = Math.min(tareWeightRatio, grossWeight * 0.9);
            
            // Skip if any values are invalid
            if (!Number.isFinite(grossWeight) || !Number.isFinite(tareWeight) || !Number.isFinite(discrepancyThreshold)) {
              return true; // Skip this test case
            }
            
            if (tareWeight >= grossWeight || tareWeight <= 0 || grossWeight <= 0) {
              return true; // Skip this test case
            }
            
            const result: WeightCalculationResult = service.calculateNetWeight(
              grossWeight, 
              tareWeight, 
              discrepancyThreshold
            );

            // Property 1: Net weight calculation must be correct
            expect(result.netWeight).toBeCloseTo(grossWeight - tareWeight, 2);
            expect(result.grossWeight).toBe(grossWeight);
            expect(result.tareWeight).toBe(tareWeight);

            // Property 2: Net weight must always be positive for valid inputs
            expect(result.netWeight).toBeGreaterThan(0);
            expect(result.isValid).toBe(true);

            // Property 3: Discrepancy calculation must be consistent
            const expectedWeightRatio = tareWeight / grossWeight;
            const expectedDiscrepancy = Math.abs(expectedWeightRatio - 0.5) * 100;
            expect(result.discrepancyPercentage).toBeCloseTo(expectedDiscrepancy, 2);

            // Property 4: Supervisor approval requirement must be consistent with threshold
            const shouldRequireApproval = expectedDiscrepancy > discrepancyThreshold;
            expect(result.requiresSupervisorApproval).toBe(shouldRequireApproval);

            // Property 5: All weight values must be preserved in result
            expect(typeof result.grossWeight).toBe('number');
            expect(typeof result.tareWeight).toBe('number');
            expect(typeof result.netWeight).toBe('number');
            expect(typeof result.discrepancyPercentage).toBe('number');
            expect(typeof result.requiresSupervisorApproval).toBe('boolean');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid weight combinations', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // Zero or negative gross weights
            fc.float({ max: Math.fround(0) }).filter(n => Number.isFinite(n)),
            // Zero or negative tare weights  
            fc.float({ max: Math.fround(0) }).filter(n => Number.isFinite(n)),
            // Tare weight greater than gross weight
            fc.record({
              gross: fc.float({ min: Math.fround(1), max: Math.fround(1000) }).filter(n => Number.isFinite(n) && n > 0),
              tare: fc.float({ min: Math.fround(1001), max: Math.fround(2000) }).filter(n => Number.isFinite(n) && n > 0)
            }).map(({ gross, tare }) => ({ grossWeight: gross, tareWeight: tare })),
            // NaN values
            fc.constant(Number.NaN)
          ),
          (invalidWeights) => {
            if (typeof invalidWeights === 'number') {
              if (Number.isNaN(invalidWeights)) {
                // Test with NaN values
                expect(() => service.calculateNetWeight(invalidWeights, 100, 5))
                  .toThrow(BadRequestException);
                expect(() => service.calculateNetWeight(1000, invalidWeights, 5))
                  .toThrow(BadRequestException);
              } else {
                // Test with invalid gross weight (positive tare)
                expect(() => service.calculateNetWeight(invalidWeights, 100, 5))
                  .toThrow(BadRequestException);
                
                // Test with invalid tare weight (positive gross)
                expect(() => service.calculateNetWeight(1000, invalidWeights, 5))
                  .toThrow(BadRequestException);
              }
            } else {
              // Test with tare >= gross
              expect(() => service.calculateNetWeight(
                invalidWeights.grossWeight, 
                invalidWeights.tareWeight, 
                5
              )).toThrow(BadRequestException);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('captureGrossWeight', () => {
    it('should capture gross weight and update transaction correctly', async () => {
      const mockTransaction: Partial<Transaction> = {
        id: 'test-transaction-id',
        tenantId: 'test-tenant-id',
        factoryId: 'test-factory-id',
        vendorId: 'test-vendor-id',
        vehicleId: 'test-vehicle-id',
        transactionNumber: 'TXN-001',
        currentLevel: OperationalLevel.L2_GATE_ENTRY,
        status: TransactionStatus.ACTIVE,
        isLocked: false,
        weighbridgeData: {},
        levelData: {},
        inspectionData: {},
        grnDocumentUrl: null,
        gatePassQrCode: null,
        gatePassExpiresAt: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        factory: { weighbridgeConfig: { discrepancyThreshold: 5 } } as any
      };

      const mockReading: WeighbridgeReading = {
        weight: 15750,
        timestamp: new Date(),
        operatorId: 'operator-123',
        equipmentId: 'weighbridge-001',
        ticketNumber: 'WB-001'
      };

      transactionRepository.findOne.mockResolvedValue(mockTransaction as Transaction);
      transactionRepository.save.mockResolvedValue(mockTransaction as Transaction);
      evidenceRepository.create.mockReturnValue({} as Evidence);
      evidenceRepository.save.mockResolvedValue({ id: 'evidence-123' } as Evidence);
      auditLogRepository.create.mockReturnValue({} as AuditLog);
      auditLogRepository.save.mockResolvedValue({} as AuditLog);

      const result = await service.captureGrossWeight('test-transaction-id', mockReading);

      expect(result.weighbridgeData.grossWeight).toBe(15750);
      expect(result.weighbridgeData.grossWeightOperator).toBe('operator-123');
      expect(result.currentLevel).toBe(OperationalLevel.L4_MATERIAL_INSPECTION);
      expect(transactionRepository.save).toHaveBeenCalled();
    });

    it('should reject gross weight capture for invalid transaction states', async () => {
      const mockReading: WeighbridgeReading = {
        weight: 15750,
        timestamp: new Date(),
        operatorId: 'operator-123'
      };

      // Test with non-existent transaction
      transactionRepository.findOne.mockResolvedValue(null);
      await expect(service.captureGrossWeight('invalid-id', mockReading))
        .rejects.toThrow(NotFoundException);

      // Test with completed transaction
      const completedTransaction: Partial<Transaction> = {
        id: 'test-id',
        tenantId: 'test-tenant-id',
        factoryId: 'test-factory-id',
        vendorId: 'test-vendor-id',
        vehicleId: 'test-vehicle-id',
        transactionNumber: 'TXN-002',
        status: TransactionStatus.COMPLETED,
        currentLevel: OperationalLevel.L2_GATE_ENTRY,
        isLocked: false,
        weighbridgeData: {},
        levelData: {},
        inspectionData: {},
        grnDocumentUrl: null,
        gatePassQrCode: null,
        gatePassExpiresAt: null,
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      transactionRepository.findOne.mockResolvedValue(completedTransaction as Transaction);
      await expect(service.captureGrossWeight('test-id', mockReading))
        .rejects.toThrow(BadRequestException);

      // Test with locked transaction
      const lockedTransaction: Partial<Transaction> = {
        id: 'test-id',
        tenantId: 'test-tenant-id',
        factoryId: 'test-factory-id',
        vendorId: 'test-vendor-id',
        vehicleId: 'test-vehicle-id',
        transactionNumber: 'TXN-003',
        status: TransactionStatus.ACTIVE,
        currentLevel: OperationalLevel.L2_GATE_ENTRY,
        isLocked: true,
        weighbridgeData: {},
        levelData: {},
        inspectionData: {},
        grnDocumentUrl: null,
        gatePassQrCode: null,
        gatePassExpiresAt: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      transactionRepository.findOne.mockResolvedValue(lockedTransaction as Transaction);
      await expect(service.captureGrossWeight('test-id', mockReading))
        .rejects.toThrow(BadRequestException);

      // Test with wrong level progression
      const wrongLevelTransaction: Partial<Transaction> = {
        id: 'test-id',
        tenantId: 'test-tenant-id',
        factoryId: 'test-factory-id',
        vendorId: 'test-vendor-id',
        vehicleId: 'test-vehicle-id',
        transactionNumber: 'TXN-004',
        status: TransactionStatus.ACTIVE,
        currentLevel: OperationalLevel.L1_VENDOR_DISPATCH,
        isLocked: false,
        weighbridgeData: {},
        levelData: {},
        inspectionData: {},
        grnDocumentUrl: null,
        gatePassQrCode: null,
        gatePassExpiresAt: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      transactionRepository.findOne.mockResolvedValue(wrongLevelTransaction as Transaction);
      await expect(service.captureGrossWeight('test-id', mockReading))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('captureTareWeight', () => {
    it('should capture tare weight and calculate net weight correctly', async () => {
      const mockTransaction: Partial<Transaction> = {
        id: 'test-transaction-id',
        tenantId: 'test-tenant-id',
        factoryId: 'test-factory-id',
        vendorId: 'test-vendor-id',
        vehicleId: 'test-vehicle-id',
        transactionNumber: 'TXN-001',
        currentLevel: OperationalLevel.L4_MATERIAL_INSPECTION,
        status: TransactionStatus.ACTIVE,
        isLocked: false,
        weighbridgeData: {
          grossWeight: 15750,
          grossWeightTimestamp: new Date(),
          grossWeightOperator: 'operator-123'
        },
        levelData: {},
        inspectionData: {},
        grnDocumentUrl: null,
        gatePassQrCode: null,
        gatePassExpiresAt: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        factory: { weighbridgeConfig: { discrepancyThreshold: 5 } } as any
      };

      const mockReading: WeighbridgeReading = {
        weight: 8250,
        timestamp: new Date(),
        operatorId: 'operator-456',
        equipmentId: 'weighbridge-001',
        ticketNumber: 'WB-002'
      };

      transactionRepository.findOne.mockResolvedValue(mockTransaction as Transaction);
      transactionRepository.save.mockResolvedValue(mockTransaction as Transaction);
      evidenceRepository.create.mockReturnValue({} as Evidence);
      evidenceRepository.save.mockResolvedValue({ id: 'evidence-456' } as Evidence);
      auditLogRepository.create.mockReturnValue({} as AuditLog);
      auditLogRepository.save.mockResolvedValue({} as AuditLog);

      const result = await service.captureTareWeight('test-transaction-id', mockReading);

      expect(result.grossWeight).toBe(15750);
      expect(result.tareWeight).toBe(8250);
      expect(result.netWeight).toBe(7500);
      expect(result.isValid).toBe(true);
      expect(typeof result.discrepancyPercentage).toBe('number');
      expect(typeof result.requiresSupervisorApproval).toBe('boolean');
    });

    it('should require gross weight before tare weight', async () => {
      const mockTransaction: Partial<Transaction> = {
        id: 'test-transaction-id',
        tenantId: 'test-tenant-id',
        factoryId: 'test-factory-id',
        vendorId: 'test-vendor-id',
        vehicleId: 'test-vehicle-id',
        transactionNumber: 'TXN-001',
        currentLevel: OperationalLevel.L4_MATERIAL_INSPECTION,
        status: TransactionStatus.ACTIVE,
        isLocked: false,
        weighbridgeData: {}, // No gross weight
        levelData: {},
        inspectionData: {},
        grnDocumentUrl: null,
        gatePassQrCode: null,
        gatePassExpiresAt: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        factory: { weighbridgeConfig: { discrepancyThreshold: 5 } } as any
      };

      const mockReading: WeighbridgeReading = {
        weight: 8250,
        timestamp: new Date(),
        operatorId: 'operator-456'
      };

      transactionRepository.findOne.mockResolvedValue(mockTransaction as Transaction);

      await expect(service.captureTareWeight('test-transaction-id', mockReading))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('validateManualEntry', () => {
    it('should validate manual weight entry with photo evidence', async () => {
      const mockPhoto = {
        originalname: 'weight-ticket.jpg',
        size: 1024,
        mimetype: 'image/jpeg'
      } as Express.Multer.File;

      const result = await service.validateManualEntry(15750, mockPhoto, 'operator-123');
      expect(result).toBe(true);
    });

    it('should reject manual entry without photo evidence', async () => {
      await expect(service.validateManualEntry(15750, null, 'operator-123'))
        .rejects.toThrow(BadRequestException);
    });

    it('should reject invalid weight values', async () => {
      const mockPhoto = {
        originalname: 'weight-ticket.jpg',
        size: 1024,
        mimetype: 'image/jpeg'
      } as Express.Multer.File;

      await expect(service.validateManualEntry(0, mockPhoto, 'operator-123'))
        .rejects.toThrow(BadRequestException);

      await expect(service.validateManualEntry(-100, mockPhoto, 'operator-123'))
        .rejects.toThrow(BadRequestException);
    });
  });
});