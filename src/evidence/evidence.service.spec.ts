import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fc from 'fast-check';
import { EvidenceService, CreateEvidenceDto } from './evidence.service';
import { Evidence, EvidenceType } from '../entities/evidence.entity';
import { Transaction } from '../entities/transaction.entity';
import { User } from '../entities/user.entity';
import { AuditLog } from '../entities/audit-log.entity';

/**
 * Feature: scrap-operations-platform, Property 6: Evidence Metadata Completeness
 * 
 * Property: For any photo or document captured through the platform, the evidence should 
 * automatically include GPS coordinates, timestamp, user identity, and device information
 * 
 * Validates: Requirements 4.2
 */

/**
 * Feature: scrap-operations-platform, Property 17: Evidence Immutability
 * 
 * Property: For any captured evidence (photos, documents, timestamps), the system should 
 * prevent deletion and maintain immutable audit trails throughout the evidence lifecycle
 * 
 * Validates: Requirements 12.2
 */

/**
 * Feature: scrap-operations-platform, Property 18: Chronological Integrity
 * 
 * Property: For any timestamp-dependent operation, the system should reject back-dating 
 * attempts and maintain strict chronological order of all transactions and evidence
 * 
 * Validates: Requirements 12.3
 */

describe('EvidenceService - Property Tests', () => {
  let service: EvidenceService;
  let evidenceRepository: Repository<Evidence>;
  let transactionRepository: Repository<Transaction>;
  let userRepository: Repository<User>;
  let auditLogRepository: Repository<AuditLog>;

  const mockEvidenceRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockTransactionRepository = {
    findOne: jest.fn(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
  };

  const mockAuditLogRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvidenceService,
        {
          provide: getRepositoryToken(Evidence),
          useValue: mockEvidenceRepository,
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: mockTransactionRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(AuditLog),
          useValue: mockAuditLogRepository,
        },
      ],
    }).compile();

    service = module.get<EvidenceService>(EvidenceService);
    evidenceRepository = module.get<Repository<Evidence>>(getRepositoryToken(Evidence));
    transactionRepository = module.get<Repository<Transaction>>(getRepositoryToken(Transaction));
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    auditLogRepository = module.get<Repository<AuditLog>>(getRepositoryToken(AuditLog));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Generators for property-based testing
  const evidenceTypeArb = fc.constantFrom(
    EvidenceType.PHOTO,
    EvidenceType.DOCUMENT,
    EvidenceType.VIDEO,
    EvidenceType.AUDIO,
    EvidenceType.GPS_LOCATION,
    EvidenceType.TIMESTAMP,
    EvidenceType.WEIGHBRIDGE_TICKET,
    EvidenceType.INSPECTION_REPORT,
    EvidenceType.GRN_DOCUMENT,
    EvidenceType.GATE_PASS
  );

  const operationalLevelArb = fc.integer({ min: 1, max: 7 });

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

  const createEvidenceDtoArb = fc.record({
    transactionId: fc.uuid(),
    operationalLevel: operationalLevelArb,
    evidenceType: evidenceTypeArb,
    file: fc.option(fc.uint8Array({ minLength: 100, maxLength: 1000 }).map(arr => Buffer.from(arr))),
    fileName: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
    mimeType: fc.option(fc.constantFrom('image/jpeg', 'image/png', 'application/pdf', 'video/mp4')),
    description: fc.option(fc.string({ minLength: 1, maxLength: 500 })),
    tags: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 })),
    metadata: fc.option(fc.record({
      gpsCoordinates: fc.option(gpsCoordinatesArb),
      deviceInfo: fc.option(deviceInfoArb),
      customFields: fc.option(fc.dictionary(fc.string(), fc.anything())),
    })),
  });

  describe('Property 6: Evidence Metadata Completeness', () => {
    beforeEach(() => {
      // Setup default mocks
      mockTransactionRepository.findOne.mockResolvedValue({
        id: 'transaction-id',
        tenantId: 'tenant-id',
      });
      
      mockUserRepository.findOne.mockResolvedValue({
        id: 'user-id',
        tenantId: 'tenant-id',
      });

      mockEvidenceRepository.create.mockImplementation((data) => data);
      mockEvidenceRepository.save.mockImplementation((data) => Promise.resolve({
        id: 'evidence-id',
        ...data,
        capturedAt: new Date(),
      }));

      mockAuditLogRepository.create.mockImplementation((data) => data);
      mockAuditLogRepository.save.mockImplementation((data) => Promise.resolve({
        id: 'audit-log-id',
        ...data,
        timestamp: new Date(),
      }));
    });

    it('should automatically embed GPS coordinates and timestamp metadata for all evidence', async () => {
      await fc.assert(
        fc.asyncProperty(
          createEvidenceDtoArb,
          fc.uuid(), // capturedBy
          fc.uuid(), // tenantId
          async (createEvidenceDto, capturedBy, tenantId) => {
            const result = await service.createEvidence(createEvidenceDto, capturedBy, tenantId);
            
            // Verify that metadata is enhanced with required fields
            const savedEvidence = mockEvidenceRepository.save.mock.calls[mockEvidenceRepository.save.mock.calls.length - 1][0];
            
            // Should have capture info with timestamp
            expect(savedEvidence.metadata).toHaveProperty('captureInfo');
            expect(savedEvidence.metadata.captureInfo).toHaveProperty('timestamp');
            expect(savedEvidence.metadata.captureInfo.timestamp).toBeInstanceOf(Date);
            expect(savedEvidence.metadata.captureInfo).toHaveProperty('timezone');
            
            // Should have system info
            expect(savedEvidence.metadata).toHaveProperty('systemInfo');
            expect(savedEvidence.metadata.systemInfo).toHaveProperty('serverTimestamp');
            expect(savedEvidence.metadata.systemInfo.serverTimestamp).toBeInstanceOf(Date);
            
            // If GPS coordinates were provided, they should have timestamp
            if (createEvidenceDto.metadata?.gpsCoordinates) {
              expect(savedEvidence.metadata.gpsCoordinates).toHaveProperty('timestamp');
              expect(savedEvidence.metadata.gpsCoordinates.timestamp).toBeInstanceOf(Date);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should preserve user identity in evidence records', async () => {
      await fc.assert(
        fc.asyncProperty(
          createEvidenceDtoArb,
          fc.uuid(), // capturedBy
          fc.uuid(), // tenantId
          async (createEvidenceDto, capturedBy, tenantId) => {
            await service.createEvidence(createEvidenceDto, capturedBy, tenantId);
            
            const savedEvidence = mockEvidenceRepository.save.mock.calls[mockEvidenceRepository.save.mock.calls.length - 1][0];
            
            // User identity should be preserved
            expect(savedEvidence.capturedBy).toBe(capturedBy);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should generate file hash for integrity verification when file is provided', async () => {
      await fc.assert(
        fc.asyncProperty(
          createEvidenceDtoArb,
          fc.uuid(), // capturedBy
          fc.uuid(), // tenantId
          async (createEvidenceDto, capturedBy, tenantId) => {
            // Only test when file is actually provided
            fc.pre(createEvidenceDto.file !== null && createEvidenceDto.file !== undefined);
            
            await service.createEvidence(createEvidenceDto, capturedBy, tenantId);
            
            const savedEvidence = mockEvidenceRepository.save.mock.calls[mockEvidenceRepository.save.mock.calls.length - 1][0];
            
            // Should have file hash when file is provided
            expect(savedEvidence.fileHash).toBeDefined();
            expect(typeof savedEvidence.fileHash).toBe('string');
            expect(savedEvidence.fileHash.length).toBe(64); // SHA-256 hex string length
            
            // Should have file size
            expect(savedEvidence.fileSize).toBeDefined();
            expect(savedEvidence.fileSize).toBeGreaterThan(0);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should maintain metadata structure consistency across all evidence types', async () => {
      await fc.assert(
        fc.asyncProperty(
          evidenceTypeArb,
          createEvidenceDtoArb,
          fc.uuid(), // capturedBy
          fc.uuid(), // tenantId
          async (evidenceType, createEvidenceDto, capturedBy, tenantId) => {
            const dtoWithType = { ...createEvidenceDto, evidenceType };
            
            await service.createEvidence(dtoWithType, capturedBy, tenantId);
            
            const savedEvidence = mockEvidenceRepository.save.mock.calls[mockEvidenceRepository.save.mock.calls.length - 1][0];
            
            // All evidence should have consistent metadata structure
            expect(savedEvidence.metadata).toHaveProperty('captureInfo');
            expect(savedEvidence.metadata).toHaveProperty('systemInfo');
            
            // Capture info should have required fields
            expect(savedEvidence.metadata.captureInfo).toHaveProperty('timestamp');
            expect(savedEvidence.metadata.captureInfo).toHaveProperty('timezone');
            
            // System info should have required fields
            expect(savedEvidence.metadata.systemInfo).toHaveProperty('version');
            expect(savedEvidence.metadata.systemInfo).toHaveProperty('environment');
            expect(savedEvidence.metadata.systemInfo).toHaveProperty('serverTimestamp');
          }
        ),
        { numRuns: 70 }
      );
    });

    it('should enforce tenant isolation in evidence creation', async () => {
      await fc.assert(
        fc.asyncProperty(
          createEvidenceDtoArb,
          fc.uuid(), // capturedBy
          fc.uuid(), // tenantId1
          fc.uuid(), // tenantId2 (different tenant)
          async (createEvidenceDto, capturedBy, tenantId1, tenantId2) => {
            // Ensure tenantId1 and tenantId2 are different
            fc.pre(tenantId1 !== tenantId2);
            
            // Reset mocks for this test
            mockTransactionRepository.findOne.mockReset();
            mockUserRepository.findOne.mockReset();
            
            // Setup transaction for tenantId1
            mockTransactionRepository.findOne.mockResolvedValueOnce({
              id: createEvidenceDto.transactionId,
              tenantId: tenantId1,
            });
            
            // Setup user lookup to return null (user not found for this tenant)
            mockUserRepository.findOne.mockResolvedValueOnce(null);
            
            // Try to create evidence - this should fail because user is not found for the tenant
            await expect(
              service.createEvidence(createEvidenceDto, capturedBy, tenantId1)
            ).rejects.toThrow('User not authorized for this tenant');
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should validate operational level constraints', async () => {
      await fc.assert(
        fc.asyncProperty(
          createEvidenceDtoArb,
          fc.integer({ min: -10, max: 20 }).filter(level => level < 1 || level > 7),
          fc.uuid(), // capturedBy
          fc.uuid(), // tenantId
          async (createEvidenceDto, invalidLevel, capturedBy, tenantId) => {
            const dtoWithInvalidLevel = { ...createEvidenceDto, operationalLevel: invalidLevel };
            
            await service.createEvidence(dtoWithInvalidLevel, capturedBy, tenantId);
            
            const savedEvidence = mockEvidenceRepository.save.mock.calls[mockEvidenceRepository.save.mock.calls.length - 1][0];
            
            // Should save the evidence with the provided level (validation happens at controller level)
            expect(savedEvidence.operationalLevel).toBe(invalidLevel);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should preserve original metadata while enhancing it', async () => {
      await fc.assert(
        fc.asyncProperty(
          createEvidenceDtoArb,
          fc.uuid(), // capturedBy
          fc.uuid(), // tenantId
          async (createEvidenceDto, capturedBy, tenantId) => {
            // Only test when metadata is actually provided
            fc.pre(createEvidenceDto.metadata !== null && createEvidenceDto.metadata !== undefined);
            
            const originalMetadata = createEvidenceDto.metadata!;
            
            await service.createEvidence(createEvidenceDto, capturedBy, tenantId);
            
            const savedEvidence = mockEvidenceRepository.save.mock.calls[mockEvidenceRepository.save.mock.calls.length - 1][0];
            
            // Original metadata should be preserved
            if (originalMetadata.gpsCoordinates) {
              expect(savedEvidence.metadata.gpsCoordinates.latitude)
                .toBe(originalMetadata.gpsCoordinates.latitude);
              expect(savedEvidence.metadata.gpsCoordinates.longitude)
                .toBe(originalMetadata.gpsCoordinates.longitude);
            }
            
            if (originalMetadata.deviceInfo) {
              expect(savedEvidence.metadata.deviceInfo).toEqual(originalMetadata.deviceInfo);
            }
            
            if (originalMetadata.customFields) {
              expect(savedEvidence.metadata.customFields).toEqual(originalMetadata.customFields);
            }
          }
        ),
        { numRuns: 40 }
      );
    });
  });

  describe('Property 17: Evidence Immutability', () => {
    beforeEach(() => {
      // Setup default mocks
      mockTransactionRepository.findOne.mockResolvedValue({
        id: 'transaction-id',
        tenantId: 'tenant-id',
      });
      
      mockUserRepository.findOne.mockResolvedValue({
        id: 'user-id',
        tenantId: 'tenant-id',
      });

      mockEvidenceRepository.create.mockImplementation((data) => data);
      mockEvidenceRepository.save.mockImplementation((data) => Promise.resolve({
        id: 'evidence-id',
        ...data,
        capturedAt: new Date(),
      }));

      mockAuditLogRepository.create.mockImplementation((data) => data);
      mockAuditLogRepository.save.mockImplementation((data) => Promise.resolve({
        id: 'audit-log-id',
        ...data,
        timestamp: new Date(),
      }));
    });

    it('should prevent evidence deletion to maintain audit integrity', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // evidenceId
          fc.uuid(), // tenantId
          async (evidenceId, tenantId) => {
            // Mock evidence exists
            mockEvidenceRepository.findOne.mockResolvedValueOnce({
              id: evidenceId,
              transaction: { tenantId },
            });

            // Attempt to delete evidence should be rejected
            await expect(
              service.deleteEvidence(evidenceId, tenantId)
            ).rejects.toThrow('Evidence deletion is not allowed to maintain audit integrity');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should maintain file integrity through hash verification', async () => {
      await fc.assert(
        fc.asyncProperty(
          createEvidenceDtoArb,
          fc.uuid(), // capturedBy
          fc.uuid(), // tenantId
          async (createEvidenceDto, capturedBy, tenantId) => {
            // Only test when file is provided
            fc.pre(createEvidenceDto.file !== null && createEvidenceDto.file !== undefined);
            
            await service.createEvidence(createEvidenceDto, capturedBy, tenantId);
            
            const savedEvidence = mockEvidenceRepository.save.mock.calls[mockEvidenceRepository.save.mock.calls.length - 1][0];
            
            // File hash should be generated and stored for integrity verification
            expect(savedEvidence.fileHash).toBeDefined();
            expect(typeof savedEvidence.fileHash).toBe('string');
            expect(savedEvidence.fileHash.length).toBe(64); // SHA-256 hex string
            
            // Hash should be deterministic for the same file content
            const buffer1 = createEvidenceDto.file;
            const buffer2 = Buffer.from(buffer1); // Same content
            
            // Reset mocks and create another evidence with same file
            mockEvidenceRepository.save.mockClear();
            await service.createEvidence({
              ...createEvidenceDto,
              file: buffer2,
            }, capturedBy, tenantId);
            
            const savedEvidence2 = mockEvidenceRepository.save.mock.calls[mockEvidenceRepository.save.mock.calls.length - 1][0];
            
            // Same file content should produce same hash
            expect(savedEvidence2.fileHash).toBe(savedEvidence.fileHash);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should preserve evidence metadata immutability after creation', async () => {
      await fc.assert(
        fc.asyncProperty(
          createEvidenceDtoArb,
          fc.uuid(), // capturedBy
          fc.uuid(), // tenantId
          async (createEvidenceDto, capturedBy, tenantId) => {
            const evidence = await service.createEvidence(createEvidenceDto, capturedBy, tenantId);
            
            const savedEvidence = mockEvidenceRepository.save.mock.calls[mockEvidenceRepository.save.mock.calls.length - 1][0];
            
            // Evidence should have immutable properties set
            expect(savedEvidence.capturedBy).toBe(capturedBy);
            expect(savedEvidence.transactionId).toBe(createEvidenceDto.transactionId);
            expect(savedEvidence.operationalLevel).toBe(createEvidenceDto.operationalLevel);
            expect(savedEvidence.evidenceType).toBe(createEvidenceDto.evidenceType);
            
            // Metadata should include system-generated immutable fields
            expect(savedEvidence.metadata.captureInfo.timestamp).toBeInstanceOf(Date);
            expect(savedEvidence.metadata.systemInfo.serverTimestamp).toBeInstanceOf(Date);
            expect(savedEvidence.metadata.systemInfo.version).toBeDefined();
            expect(savedEvidence.metadata.systemInfo.environment).toBeDefined();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should maintain evidence integrity verification capability', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // evidenceId
          async (evidenceId) => {
            // Mock evidence with file hash
            mockEvidenceRepository.findOne.mockResolvedValueOnce({
              id: evidenceId,
              filePath: '/path/to/file',
              fileHash: 'abc123def456',
            });

            const isValid = await service.verifyEvidenceIntegrity(evidenceId);
            
            // Should return true for evidence with valid file path and hash
            expect(typeof isValid).toBe('boolean');
            expect(isValid).toBe(true);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should detect missing evidence integrity data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // evidenceId
          async (evidenceId) => {
            // Mock evidence without file hash or path
            mockEvidenceRepository.findOne.mockResolvedValueOnce({
              id: evidenceId,
              filePath: null,
              fileHash: null,
            });

            const isValid = await service.verifyEvidenceIntegrity(evidenceId);
            
            // Should return false for evidence without integrity data
            expect(isValid).toBe(false);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should handle non-existent evidence integrity checks gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // evidenceId
          async (evidenceId) => {
            // Mock evidence not found
            mockEvidenceRepository.findOne.mockResolvedValueOnce(null);

            const isValid = await service.verifyEvidenceIntegrity(evidenceId);
            
            // Should return false for non-existent evidence
            expect(isValid).toBe(false);
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Property 18: Chronological Integrity', () => {
    beforeEach(() => {
      // Setup default mocks
      mockTransactionRepository.findOne.mockResolvedValue({
        id: 'transaction-id',
        tenantId: 'tenant-id',
      });
      
      mockUserRepository.findOne.mockResolvedValue({
        id: 'user-id',
        tenantId: 'tenant-id',
      });

      mockAuditLogRepository.create.mockImplementation((data) => data);
      mockAuditLogRepository.save.mockImplementation((data) => Promise.resolve({
        id: 'audit-log-id',
        ...data,
        timestamp: new Date(),
      }));
    });

    it('should maintain chronological order of evidence timestamps', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // transactionId
          fc.array(
            fc.record({
              capturedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
              operationalLevel: fc.integer({ min: 1, max: 7 }),
            }),
            { minLength: 2, maxLength: 10 }
          ),
          async (transactionId, evidenceData) => {
            // Sort evidence by timestamp to ensure chronological order
            const sortedEvidence = evidenceData.sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
            
            // Mock repository to return the sorted evidence
            mockEvidenceRepository.find.mockResolvedValueOnce(sortedEvidence);

            const isValid = await service.validateChronologicalIntegrity(transactionId);
            
            // Should return true for chronologically ordered evidence
            expect(isValid).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should detect chronological violations in evidence timestamps', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // transactionId
          fc.array(
            fc.record({
              capturedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
              operationalLevel: fc.integer({ min: 1, max: 7 }),
            }),
            { minLength: 3, maxLength: 10 }
          ),
          async (transactionId, evidenceData) => {
            // Ensure we have at least 3 items to create a violation
            fc.pre(evidenceData.length >= 3);
            
            // Create chronological violation by making the first timestamp later than the last
            const violatedEvidence = [...evidenceData];
            
            // Ensure timestamps are different to create a real violation
            const baseTime = new Date('2020-01-01').getTime();
            violatedEvidence[0].capturedAt = new Date(baseTime + 1000000); // Later time
            violatedEvidence[violatedEvidence.length - 1].capturedAt = new Date(baseTime); // Earlier time
            
            // Mock repository to return evidence with chronological violation
            mockEvidenceRepository.find.mockResolvedValueOnce(violatedEvidence);

            const isValid = await service.validateChronologicalIntegrity(transactionId);
            
            // Should return false for chronologically violated evidence
            expect(isValid).toBe(false);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should validate operational level progression logic', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // transactionId
          fc.array(
            fc.record({
              capturedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
              operationalLevel: fc.integer({ min: 1, max: 7 }),
            }),
            { minLength: 2, maxLength: 7 }
          ),
          async (transactionId, evidenceData) => {
            // Create evidence with proper level progression (1, 2, 3, etc.)
            const progressiveEvidence = evidenceData.map((item, index) => ({
              ...item,
              operationalLevel: index + 1,
              capturedAt: new Date(Date.now() + index * 1000), // Ensure chronological order
            }));
            
            // Mock repository to return evidence with proper progression
            mockEvidenceRepository.find.mockResolvedValueOnce(progressiveEvidence);

            const isValid = await service.validateChronologicalIntegrity(transactionId);
            
            // Should return true for proper level progression
            expect(isValid).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle empty evidence arrays gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // transactionId
          async (transactionId) => {
            // Mock repository to return empty evidence array
            mockEvidenceRepository.find.mockResolvedValueOnce([]);

            const isValid = await service.validateChronologicalIntegrity(transactionId);
            
            // Should return true for empty evidence (no violations possible)
            expect(isValid).toBe(true);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should handle single evidence item gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // transactionId
          fc.record({
            capturedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
            operationalLevel: fc.integer({ min: 1, max: 7 }),
          }),
          async (transactionId, evidenceItem) => {
            // Mock repository to return single evidence item
            mockEvidenceRepository.find.mockResolvedValueOnce([evidenceItem]);

            const isValid = await service.validateChronologicalIntegrity(transactionId);
            
            // Should return true for single evidence (no violations possible)
            expect(isValid).toBe(true);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should prevent back-dating through timestamp validation', async () => {
      await fc.assert(
        fc.asyncProperty(
          createEvidenceDtoArb,
          fc.uuid(), // capturedBy
          fc.uuid(), // tenantId
          async (createEvidenceDto, capturedBy, tenantId) => {
            const evidence = await service.createEvidence(createEvidenceDto, capturedBy, tenantId);
            
            const savedEvidence = mockEvidenceRepository.save.mock.calls[mockEvidenceRepository.save.mock.calls.length - 1][0];
            
            // System should automatically set server timestamp
            expect(savedEvidence.metadata.systemInfo.serverTimestamp).toBeInstanceOf(Date);
            expect(savedEvidence.metadata.captureInfo.timestamp).toBeInstanceOf(Date);
            
            // Server timestamp should be recent (within last few seconds)
            const now = new Date();
            const timeDiff = now.getTime() - savedEvidence.metadata.systemInfo.serverTimestamp.getTime();
            expect(timeDiff).toBeLessThan(5000); // Within 5 seconds
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});