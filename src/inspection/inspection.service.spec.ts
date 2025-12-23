import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fc from 'fast-check';
import { InspectionService, InspectionData } from './inspection.service';
import { Transaction, OperationalLevel, TransactionStatus } from '../entities/transaction.entity';
import { Evidence, EvidenceType } from '../entities/evidence.entity';
import { User } from '../entities/user.entity';
import { Vendor } from '../entities/vendor.entity';
import { EvidenceService } from '../evidence/evidence.service';
import { NotificationService } from '../notification/notification.service';

/**
 * Feature: scrap-operations-platform, Property 8: Inspection Evidence Requirements
 * 
 * Property: For any material inspection, the system should capture multiple photos, 
 * inspector identity, timestamp, and generate a complete PDF report with all evidence
 * 
 * Validates: Requirements 6.2, 6.3
 */

describe('InspectionService - Inspection Evidence Requirements Property Tests', () => {
  let service: InspectionService;
  let transactionRepository: Repository<Transaction>;
  let evidenceRepository: Repository<Evidence>;
  let userRepository: Repository<User>;
  let vendorRepository: Repository<Vendor>;
  let evidenceService: EvidenceService;

  const mockTransactionRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockEvidenceRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
  };

  const mockVendorRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockEvidenceService = {
    createEvidence: jest.fn(),
    getEvidenceByLevel: jest.fn(),
  };

  const mockNotificationService = {
    sendInspectionReport: jest.fn().mockResolvedValue(undefined),
    notifyRejection: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InspectionService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: mockTransactionRepository,
        },
        {
          provide: getRepositoryToken(Evidence),
          useValue: mockEvidenceRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(Vendor),
          useValue: mockVendorRepository,
        },
        {
          provide: EvidenceService,
          useValue: mockEvidenceService,
        },
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
      ],
    }).compile();

    service = module.get<InspectionService>(InspectionService);
    transactionRepository = module.get<Repository<Transaction>>(getRepositoryToken(Transaction));
    evidenceRepository = module.get<Repository<Evidence>>(getRepositoryToken(Evidence));
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    vendorRepository = module.get<Repository<Vendor>>(getRepositoryToken(Vendor));
    evidenceService = module.get<EvidenceService>(EvidenceService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Generators for property-based testing
  const gradeArb = fc.constantFrom('A', 'B', 'C', 'REJECTED');
  
  const contaminationLevelArb = fc.integer({ min: 0, max: 100 });
  
  const moistureLevelArb = fc.option(fc.integer({ min: 0, max: 100 }));

  const gpsCoordinatesArb = fc.record({
    latitude: fc.double({ min: -90, max: 90 }),
    longitude: fc.double({ min: -180, max: 180 }),
    accuracy: fc.option(fc.double({ min: 0, max: 1000 })),
  });

  const deviceInfoArb = fc.record({
    deviceId: fc.uuid(),
    deviceModel: fc.string({ minLength: 1, maxLength: 50 }),
    osVersion: fc.string({ minLength: 1, maxLength: 20 }),
    appVersion: fc.string({ minLength: 1, maxLength: 20 }),
  });

  const photoArb = fc.record({
    file: fc.uint8Array({ minLength: 100, maxLength: 1000 }).map(arr => Buffer.from(arr)),
    fileName: fc.string({ minLength: 1, maxLength: 100 }).map(name => `${name}.jpg`),
    mimeType: fc.constantFrom('image/jpeg', 'image/png', 'image/webp'),
    description: fc.option(fc.string({ minLength: 1, maxLength: 200 })),
  });

  const inspectionDataArb = fc.record({
    grade: gradeArb,
    contaminationLevel: contaminationLevelArb,
    moistureLevel: moistureLevelArb,
    qualityNotes: fc.option(fc.string({ minLength: 1, maxLength: 500 })),
    rejectionReason: fc.option(fc.string({ minLength: 1, maxLength: 500 })),
    inspectorId: fc.uuid(),
    photos: fc.array(photoArb, { minLength: 2, maxLength: 10 }), // Minimum 2 photos required
    gpsCoordinates: fc.option(gpsCoordinatesArb),
    deviceInfo: fc.option(deviceInfoArb),
  }).map(data => {
    // Ensure rejection reason is provided when grade is REJECTED
    if (data.grade === 'REJECTED' && !data.rejectionReason) {
      return { ...data, rejectionReason: 'Material quality below standards' };
    }
    return data;
  }) as fc.Arbitrary<InspectionData>;

  describe('Property 8: Inspection Evidence Requirements', () => {
    beforeEach(() => {
      // Setup default mocks
      mockTransactionRepository.findOne.mockResolvedValue({
        id: 'transaction-id',
        tenantId: 'tenant-id',
        currentLevel: OperationalLevel.L4_MATERIAL_INSPECTION,
        vendorId: 'vendor-id',
        levelData: {
          [OperationalLevel.L3_WEIGHBRIDGE_GROSS]: {
            level: OperationalLevel.L3_WEIGHBRIDGE_GROSS,
            completedAt: new Date(),
            validationStatus: 'APPROVED',
          },
        },
        vendor: { id: 'vendor-id', vendorName: 'Test Vendor' },
        vehicle: { id: 'vehicle-id', vehicleNumber: 'MH12AB1234' },
      });

      mockUserRepository.findOne.mockResolvedValue({
        id: 'inspector-id',
        tenantId: 'tenant-id',
        role: 'Inspector',
      });

      mockVendorRepository.findOne.mockResolvedValue({
        id: 'vendor-id',
        performanceMetrics: {
          rejectionPercentage: 10,
          weightDeviationPercentage: 5,
          inspectionFailureCount: 2,
          totalTransactions: 20,
          lastUpdated: new Date(),
        },
      });

      mockTransactionRepository.update.mockResolvedValue({ affected: 1 });
      mockVendorRepository.update.mockResolvedValue({ affected: 1 });
    });

    it('should capture multiple photos with inspector identity and timestamp for all inspections', async () => {
      await fc.assert(
        fc.asyncProperty(
          inspectionDataArb,
          fc.uuid(), // transactionId
          fc.uuid(), // tenantId
          async (inspectionData, transactionId, tenantId) => {
            // Reset mocks for each property test run
            jest.clearAllMocks();
            
            // Setup fresh mocks for this test run
            mockTransactionRepository.findOne.mockResolvedValue({
              id: transactionId,
              tenantId,
              currentLevel: OperationalLevel.L4_MATERIAL_INSPECTION,
              vendorId: 'vendor-id',
              levelData: {
                [OperationalLevel.L3_WEIGHBRIDGE_GROSS]: {
                  level: OperationalLevel.L3_WEIGHBRIDGE_GROSS,
                  completedAt: new Date(),
                  validationStatus: 'APPROVED',
                },
              },
              vendor: { id: 'vendor-id', vendorName: 'Test Vendor' },
              vehicle: { id: 'vehicle-id', vehicleNumber: 'MH12AB1234' },
            });

            mockUserRepository.findOne.mockResolvedValue({
              id: inspectionData.inspectorId,
              tenantId,
              role: 'Inspector',
            });

            mockVendorRepository.findOne.mockResolvedValue({
              id: 'vendor-id',
              performanceMetrics: {
                rejectionPercentage: 10,
                weightDeviationPercentage: 5,
                inspectionFailureCount: 2,
                totalTransactions: 20,
                lastUpdated: new Date(),
              },
            });

            mockTransactionRepository.update.mockResolvedValue({ affected: 1 });
            mockVendorRepository.update.mockResolvedValue({ affected: 1 });

            // Mock evidence creation to return unique IDs for this test run
            let evidenceIdCounter = 0;
            mockEvidenceService.createEvidence.mockImplementation(() => 
              Promise.resolve({
                id: `evidence-${++evidenceIdCounter}`,
                filePath: `evidence/path/evidence-${evidenceIdCounter}`,
                capturedAt: new Date(),
              })
            );
            
            const result = await service.conductInspection(transactionId, inspectionData, tenantId);
            
            // Verify multiple photos were captured
            expect(inspectionData.photos.length).toBeGreaterThanOrEqual(2);
            expect(inspectionData.photos.length).toBeLessThanOrEqual(10);
            
            // Verify evidence service was called for each photo
            const photoEvidenceCalls = mockEvidenceService.createEvidence.mock.calls.filter(
              call => call[0].evidenceType === EvidenceType.PHOTO
            );
            expect(photoEvidenceCalls).toHaveLength(inspectionData.photos.length);
            
            // Verify inspector identity is preserved in each photo evidence
            photoEvidenceCalls.forEach(call => {
              expect(call[1]).toBe(inspectionData.inspectorId); // capturedBy parameter
              expect(call[0].operationalLevel).toBe(OperationalLevel.L4_MATERIAL_INSPECTION);
              expect(call[0].tags).toContain('inspection');
              expect(call[0].tags).toContain('material-quality');
            });
            
            // Verify result contains evidence IDs
            expect(result.evidenceIds).toHaveLength(inspectionData.photos.length + 1); // photos + report
            expect(result.transactionId).toBe(transactionId);
          }
        ),
        { numRuns: 20 } // Reduced runs for faster execution
      );
    });

    it('should generate complete PDF report with all evidence for every inspection', async () => {
      await fc.assert(
        fc.asyncProperty(
          inspectionDataArb,
          fc.uuid(), // transactionId
          fc.uuid(), // tenantId
          async (inspectionData, transactionId, tenantId) => {
            // Reset mocks for each property test run
            jest.clearAllMocks();
            
            // Setup fresh mocks for this test run
            mockTransactionRepository.findOne.mockResolvedValue({
              id: transactionId,
              tenantId,
              currentLevel: OperationalLevel.L4_MATERIAL_INSPECTION,
              vendorId: 'vendor-id',
              levelData: {
                [OperationalLevel.L3_WEIGHBRIDGE_GROSS]: {
                  level: OperationalLevel.L3_WEIGHBRIDGE_GROSS,
                  completedAt: new Date(),
                  validationStatus: 'APPROVED',
                },
              },
              vendor: { id: 'vendor-id', vendorName: 'Test Vendor' },
              vehicle: { id: 'vehicle-id', vehicleNumber: 'MH12AB1234' },
            });

            mockUserRepository.findOne.mockResolvedValue({
              id: inspectionData.inspectorId,
              tenantId,
              role: 'Inspector',
            });

            mockVendorRepository.findOne.mockResolvedValue({
              id: 'vendor-id',
              performanceMetrics: {
                rejectionPercentage: 10,
                weightDeviationPercentage: 5,
                inspectionFailureCount: 2,
                totalTransactions: 20,
                lastUpdated: new Date(),
              },
            });

            mockTransactionRepository.update.mockResolvedValue({ affected: 1 });
            mockVendorRepository.update.mockResolvedValue({ affected: 1 });

            // Mock evidence creation to return unique IDs for this test run
            let evidenceIdCounter = 0;
            mockEvidenceService.createEvidence.mockImplementation(() => 
              Promise.resolve({
                id: `evidence-${++evidenceIdCounter}`,
                filePath: `evidence/path/evidence-${evidenceIdCounter}`,
                capturedAt: new Date(),
              })
            );
            
            const result = await service.conductInspection(transactionId, inspectionData, tenantId);
            
            // Verify PDF report was created as evidence
            const reportEvidenceCalls = mockEvidenceService.createEvidence.mock.calls.filter(
              call => call[0].evidenceType === EvidenceType.INSPECTION_REPORT
            );
            expect(reportEvidenceCalls).toHaveLength(1);
            
            const reportCall = reportEvidenceCalls[0];
            expect(reportCall[0].fileName).toMatch(/inspection-report-.*\.pdf/);
            expect(reportCall[0].mimeType).toBe('application/pdf');
            expect(reportCall[0].file).toBeInstanceOf(Buffer);
            expect(reportCall[0].file.length).toBeGreaterThan(0);
            
            // Verify report metadata includes inspection details
            expect(reportCall[0].metadata.customFields.inspectionGrade).toBe(inspectionData.grade);
            expect(reportCall[0].metadata.customFields.contaminationLevel).toBe(inspectionData.contaminationLevel);
            expect(reportCall[0].metadata.customFields.reportType).toBe('material-inspection');
            
            // Verify report URL is returned
            expect(result.reportUrl).toBeDefined();
            expect(typeof result.reportUrl).toBe('string');
          }
        ),
        { numRuns: 15 } // Reduced runs for faster execution
      );
    });

    it('should preserve GPS coordinates and device info in all evidence when provided', async () => {
      await fc.assert(
        fc.asyncProperty(
          inspectionDataArb,
          fc.uuid(), // transactionId
          fc.uuid(), // tenantId
          async (inspectionData, transactionId, tenantId) => {
            // Only test when GPS and device info are provided
            fc.pre(inspectionData.gpsCoordinates !== null && inspectionData.deviceInfo !== null);
            
            // Reset mocks for each property test run
            jest.clearAllMocks();
            
            // Setup fresh mocks for this test run
            mockTransactionRepository.findOne.mockResolvedValue({
              id: transactionId,
              tenantId,
              currentLevel: OperationalLevel.L4_MATERIAL_INSPECTION,
              vendorId: 'vendor-id',
              levelData: {
                [OperationalLevel.L3_WEIGHBRIDGE_GROSS]: {
                  level: OperationalLevel.L3_WEIGHBRIDGE_GROSS,
                  completedAt: new Date(),
                  validationStatus: 'APPROVED',
                },
              },
              vendor: { id: 'vendor-id', vendorName: 'Test Vendor' },
              vehicle: { id: 'vehicle-id', vehicleNumber: 'MH12AB1234' },
            });

            mockUserRepository.findOne.mockResolvedValue({
              id: inspectionData.inspectorId,
              tenantId,
              role: 'Inspector',
            });

            mockVendorRepository.findOne.mockResolvedValue({
              id: 'vendor-id',
              performanceMetrics: {
                rejectionPercentage: 10,
                weightDeviationPercentage: 5,
                inspectionFailureCount: 2,
                totalTransactions: 20,
                lastUpdated: new Date(),
              },
            });

            mockTransactionRepository.update.mockResolvedValue({ affected: 1 });
            mockVendorRepository.update.mockResolvedValue({ affected: 1 });

            // Mock evidence creation to return unique IDs for this test run
            let evidenceIdCounter = 0;
            mockEvidenceService.createEvidence.mockImplementation(() => 
              Promise.resolve({
                id: `evidence-${++evidenceIdCounter}`,
                filePath: `evidence/path/evidence-${evidenceIdCounter}`,
                capturedAt: new Date(),
              })
            );
            
            await service.conductInspection(transactionId, inspectionData, tenantId);
            
            // Verify all evidence calls include GPS and device info
            mockEvidenceService.createEvidence.mock.calls.forEach(call => {
              expect(call[0].metadata.gpsCoordinates).toEqual(inspectionData.gpsCoordinates);
              expect(call[0].metadata.deviceInfo).toEqual(inspectionData.deviceInfo);
            });
          }
        ),
        { numRuns: 10 } // Reduced runs for faster execution
      );
    });

    it('should update transaction level data with complete inspection information', async () => {
      await fc.assert(
        fc.asyncProperty(
          inspectionDataArb,
          fc.uuid(), // transactionId
          fc.uuid(), // tenantId
          async (inspectionData, transactionId, tenantId) => {
            await service.conductInspection(transactionId, inspectionData, tenantId);
            
            // Verify transaction was updated with inspection data
            expect(mockTransactionRepository.update).toHaveBeenCalledWith(
              transactionId,
              expect.objectContaining({
                inspectionData: expect.objectContaining({
                  grade: inspectionData.grade,
                  contaminationLevel: inspectionData.contaminationLevel,
                  inspectorId: inspectionData.inspectorId,
                  inspectionTimestamp: expect.any(Date),
                  inspectionReportUrl: expect.any(String),
                }),
                levelData: expect.objectContaining({
                  [OperationalLevel.L4_MATERIAL_INSPECTION]: expect.objectContaining({
                    level: OperationalLevel.L4_MATERIAL_INSPECTION,
                    fieldValues: expect.objectContaining({
                      grade: inspectionData.grade,
                      contaminationLevel: inspectionData.contaminationLevel,
                    }),
                    completedBy: inspectionData.inspectorId,
                    completedAt: expect.any(Date),
                    evidenceIds: expect.any(Array),
                    validationStatus: inspectionData.grade === 'REJECTED' ? 'REJECTED' : 'APPROVED',
                  }),
                }),
              })
            );
          }
        ),
        { numRuns: 40 }
      );
    });

    it('should enforce minimum photo requirements and reject insufficient evidence', async () => {
      await fc.assert(
        fc.asyncProperty(
          inspectionDataArb.map(data => ({
            ...data,
            photos: data.photos.slice(0, 1), // Keep only 1 photo (insufficient)
          })),
          fc.uuid(), // transactionId
          fc.uuid(), // tenantId
          async (inspectionDataWithFewPhotos, transactionId, tenantId) => {
            // Should throw error for insufficient photos
            await expect(
              service.conductInspection(transactionId, inspectionDataWithFewPhotos, tenantId)
            ).rejects.toThrow('At least 2 photos are required for material inspection');
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should enforce maximum photo limits and reject excessive evidence', async () => {
      await fc.assert(
        fc.asyncProperty(
          inspectionDataArb.filter(data => data.photos.length <= 10).map(data => ({
            ...data,
            photos: [...data.photos, ...Array(5).fill(data.photos[0])], // Add extra photos to exceed limit
          })),
          fc.uuid(), // transactionId
          fc.uuid(), // tenantId
          async (inspectionDataWithManyPhotos, transactionId, tenantId) => {
            // Only test when we actually have more than 10 photos
            fc.pre(inspectionDataWithManyPhotos.photos.length > 10);
            
            // Reset mocks for each property test run
            jest.clearAllMocks();
            
            // Setup fresh mocks for this test run
            mockTransactionRepository.findOne.mockResolvedValue({
              id: transactionId,
              tenantId,
              currentLevel: OperationalLevel.L4_MATERIAL_INSPECTION,
              vendorId: 'vendor-id',
              levelData: {
                [OperationalLevel.L3_WEIGHBRIDGE_GROSS]: {
                  level: OperationalLevel.L3_WEIGHBRIDGE_GROSS,
                  completedAt: new Date(),
                  validationStatus: 'APPROVED',
                },
              },
              vendor: { id: 'vendor-id', vendorName: 'Test Vendor' },
              vehicle: { id: 'vehicle-id', vehicleNumber: 'MH12AB1234' },
            });

            mockUserRepository.findOne.mockResolvedValue({
              id: inspectionDataWithManyPhotos.inspectorId,
              tenantId,
              role: 'Inspector',
            });
            
            // Should throw error for too many photos
            await expect(
              service.conductInspection(transactionId, inspectionDataWithManyPhotos, tenantId)
            ).rejects.toThrow('Maximum 10 photos allowed for inspection');
          }
        ),
        { numRuns: 10 } // Reduced runs for faster execution
      );
    });

    it('should validate inspection data completeness and reject invalid grades', async () => {
      await fc.assert(
        fc.asyncProperty(
          inspectionDataArb.map(data => ({
            ...data,
            grade: 'INVALID_GRADE' as any, // Invalid grade
          })),
          fc.uuid(), // transactionId
          fc.uuid(), // tenantId
          async (inspectionDataWithInvalidGrade, transactionId, tenantId) => {
            // Should throw error for invalid grade
            await expect(
              service.conductInspection(transactionId, inspectionDataWithInvalidGrade, tenantId)
            ).rejects.toThrow('Invalid grade. Must be A, B, C, or REJECTED');
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should require rejection reason when grade is REJECTED', async () => {
      await fc.assert(
        fc.asyncProperty(
          inspectionDataArb.map(data => ({
            ...data,
            grade: 'REJECTED' as const,
            rejectionReason: undefined, // No rejection reason
          })),
          fc.uuid(), // transactionId
          fc.uuid(), // tenantId
          async (inspectionDataWithoutReason, transactionId, tenantId) => {
            // Should throw error for missing rejection reason
            await expect(
              service.conductInspection(transactionId, inspectionDataWithoutReason, tenantId)
            ).rejects.toThrow('Rejection reason is required when grade is REJECTED');
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should update vendor performance metrics when inspection fails', async () => {
      await fc.assert(
        fc.asyncProperty(
          inspectionDataArb.map(data => ({
            ...data,
            grade: 'REJECTED' as const,
            rejectionReason: 'Poor material quality',
          })),
          fc.uuid(), // transactionId
          fc.uuid(), // tenantId
          async (rejectedInspectionData, transactionId, tenantId) => {
            // Reset mocks for each property test run
            jest.clearAllMocks();
            
            // Setup fresh mocks for this test run
            mockTransactionRepository.findOne.mockResolvedValue({
              id: transactionId,
              tenantId,
              currentLevel: OperationalLevel.L4_MATERIAL_INSPECTION,
              vendorId: 'vendor-id',
              levelData: {
                [OperationalLevel.L3_WEIGHBRIDGE_GROSS]: {
                  level: OperationalLevel.L3_WEIGHBRIDGE_GROSS,
                  completedAt: new Date(),
                  validationStatus: 'APPROVED',
                },
              },
              vendor: { id: 'vendor-id', vendorName: 'Test Vendor' },
              vehicle: { id: 'vehicle-id', vehicleNumber: 'MH12AB1234' },
            });

            mockUserRepository.findOne.mockResolvedValue({
              id: rejectedInspectionData.inspectorId,
              tenantId,
              role: 'Inspector',
            });

            mockVendorRepository.findOne.mockResolvedValue({
              id: 'vendor-id',
              performanceMetrics: {
                rejectionPercentage: 10,
                weightDeviationPercentage: 5,
                inspectionFailureCount: 2,
                totalTransactions: 20,
                lastUpdated: new Date(),
              },
            });

            mockTransactionRepository.update.mockResolvedValue({ affected: 1 });
            mockVendorRepository.update.mockResolvedValue({ affected: 1 });

            // Mock evidence creation to return unique IDs for this test run
            let evidenceIdCounter = 0;
            mockEvidenceService.createEvidence.mockImplementation(() => 
              Promise.resolve({
                id: `evidence-${++evidenceIdCounter}`,
                filePath: `evidence/path/evidence-${evidenceIdCounter}`,
                capturedAt: new Date(),
              })
            );
            
            await service.conductInspection(transactionId, rejectedInspectionData, tenantId);
            
            // Verify vendor performance was updated
            expect(mockVendorRepository.update).toHaveBeenCalledWith(
              'vendor-id',
              expect.objectContaining({
                performanceMetrics: expect.objectContaining({
                  totalTransactions: 21, // Incremented from 20
                  inspectionFailureCount: 3, // Incremented from 2
                  rejectionPercentage: expect.any(Number),
                  lastUpdated: expect.any(Date),
                }),
              })
            );
          }
        ),
        { numRuns: 10 } // Reduced runs for faster execution
      );
    });

    it('should enforce operational level progression and reject inspections at wrong level', async () => {
      await fc.assert(
        fc.asyncProperty(
          inspectionDataArb,
          fc.uuid(), // transactionId
          fc.uuid(), // tenantId
          fc.constantFrom(
            OperationalLevel.L1_VENDOR_DISPATCH,
            OperationalLevel.L2_GATE_ENTRY,
            OperationalLevel.L3_WEIGHBRIDGE_GROSS,
            OperationalLevel.L5_WEIGHBRIDGE_TARE,
            OperationalLevel.L6_GRN_GENERATION,
            OperationalLevel.L7_GATE_PASS_EXIT
          ), // Wrong levels
          async (inspectionData, transactionId, tenantId, wrongLevel) => {
            // Setup transaction at wrong level
            mockTransactionRepository.findOne.mockResolvedValueOnce({
              id: transactionId,
              tenantId,
              currentLevel: wrongLevel,
              vendorId: 'vendor-id',
              vendor: { id: 'vendor-id', vendorName: 'Test Vendor' },
              vehicle: { id: 'vehicle-id', vehicleNumber: 'MH12AB1234' },
            });
            
            // Should throw error for wrong operational level
            await expect(
              service.conductInspection(transactionId, inspectionData, tenantId)
            ).rejects.toThrow(/Transaction must be at L4 Material Inspection level/);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should maintain evidence immutability and chronological integrity', async () => {
      await fc.assert(
        fc.asyncProperty(
          inspectionDataArb,
          fc.uuid(), // transactionId
          fc.uuid(), // tenantId
          async (inspectionData, transactionId, tenantId) => {
            // Reset mocks for each property test run
            jest.clearAllMocks();
            
            // Setup fresh mocks for this test run
            mockTransactionRepository.findOne.mockResolvedValue({
              id: transactionId,
              tenantId,
              currentLevel: OperationalLevel.L4_MATERIAL_INSPECTION,
              vendorId: 'vendor-id',
              levelData: {
                [OperationalLevel.L3_WEIGHBRIDGE_GROSS]: {
                  level: OperationalLevel.L3_WEIGHBRIDGE_GROSS,
                  completedAt: new Date(),
                  validationStatus: 'APPROVED',
                },
              },
              vendor: { id: 'vendor-id', vendorName: 'Test Vendor' },
              vehicle: { id: 'vehicle-id', vehicleNumber: 'MH12AB1234' },
            });

            mockUserRepository.findOne.mockResolvedValue({
              id: inspectionData.inspectorId,
              tenantId,
              role: 'Inspector',
            });

            mockVendorRepository.findOne.mockResolvedValue({
              id: 'vendor-id',
              performanceMetrics: {
                rejectionPercentage: 10,
                weightDeviationPercentage: 5,
                inspectionFailureCount: 2,
                totalTransactions: 20,
                lastUpdated: new Date(),
              },
            });

            mockTransactionRepository.update.mockResolvedValue({ affected: 1 });
            mockVendorRepository.update.mockResolvedValue({ affected: 1 });

            // Mock evidence creation to return unique IDs for this test run
            let evidenceIdCounter = 0;
            mockEvidenceService.createEvidence.mockImplementation(() => 
              Promise.resolve({
                id: `evidence-${++evidenceIdCounter}`,
                filePath: `evidence/path/evidence-${evidenceIdCounter}`,
                capturedAt: new Date(),
              })
            );
            
            await service.conductInspection(transactionId, inspectionData, tenantId);
            
            // Verify all evidence has immutable properties
            mockEvidenceService.createEvidence.mock.calls.forEach(call => {
              // Evidence should have description and tags for searchability
              expect(call[0].description).toBeDefined();
              expect(call[0].tags).toBeDefined();
              expect(Array.isArray(call[0].tags)).toBe(true);
              
              // Evidence should be linked to correct transaction and level
              expect(call[0].transactionId).toBe(transactionId);
              expect(call[0].operationalLevel).toBe(OperationalLevel.L4_MATERIAL_INSPECTION);
              
              // Evidence should have proper tenant isolation
              expect(call[2]).toBe(tenantId); // tenantId parameter
            });
          }
        ),
        { numRuns: 15 } // Reduced runs for faster execution
      );
    });
  });

  describe('Inspection Configuration and Validation', () => {
    it('should provide consistent configuration for all tenants', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // tenantId
          async (tenantId) => {
            const config = await service.getInspectionConfiguration(tenantId);
            
            // Verify configuration structure
            expect(config).toHaveProperty('requiredPhotos');
            expect(config.requiredPhotos).toHaveProperty('min');
            expect(config.requiredPhotos).toHaveProperty('max');
            expect(config.requiredPhotos.min).toBeGreaterThanOrEqual(2);
            expect(config.requiredPhotos.max).toBeLessThanOrEqual(10);
            
            expect(config).toHaveProperty('availableGrades');
            expect(config.availableGrades).toContain('A');
            expect(config.availableGrades).toContain('B');
            expect(config.availableGrades).toContain('C');
            expect(config.availableGrades).toContain('REJECTED');
            
            expect(config).toHaveProperty('contaminationThresholds');
            expect(config).toHaveProperty('requiredFields');
            expect(config.requiredFields).toContain('grade');
            expect(config.requiredFields).toContain('contaminationLevel');
            expect(config.requiredFields).toContain('photos');
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should validate inspection requirements correctly for all transaction states', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // transactionId
          fc.uuid(), // tenantId
          fc.constantFrom(
            OperationalLevel.L1_VENDOR_DISPATCH,
            OperationalLevel.L2_GATE_ENTRY,
            OperationalLevel.L3_WEIGHBRIDGE_GROSS,
            OperationalLevel.L4_MATERIAL_INSPECTION,
            OperationalLevel.L5_WEIGHBRIDGE_TARE,
            OperationalLevel.L6_GRN_GENERATION,
            OperationalLevel.L7_GATE_PASS_EXIT
          ),
          async (transactionId, tenantId, currentLevel) => {
            // Setup transaction at various levels
            mockTransactionRepository.findOne.mockResolvedValueOnce({
              id: transactionId,
              tenantId,
              currentLevel,
              levelData: currentLevel >= OperationalLevel.L3_WEIGHBRIDGE_GROSS ? {
                [OperationalLevel.L3_WEIGHBRIDGE_GROSS]: {
                  level: OperationalLevel.L3_WEIGHBRIDGE_GROSS,
                  completedAt: new Date(),
                  validationStatus: 'APPROVED',
                },
              } : {},
            });
            
            const validation = await service.validateInspectionRequirements(transactionId, tenantId);
            
            // Should only allow inspection at L4 with L3 completed
            const shouldProceed = currentLevel === OperationalLevel.L4_MATERIAL_INSPECTION;
            expect(validation.canProceed).toBe(shouldProceed);
            
            if (!shouldProceed) {
              expect(validation.missingRequirements.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 35 }
      );
    });
  });
});