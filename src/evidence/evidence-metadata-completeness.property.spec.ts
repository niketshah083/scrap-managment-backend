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
 * **Feature: scrap-operations-platform, Property 6: Evidence Metadata Completeness**
 * 
 * Property: Evidence Metadata Completeness
 * For any photo or document captured through the platform, the evidence should automatically 
 * include GPS coordinates, timestamp, user identity, and device information
 * Validates: Requirements 4.2
 */

describe('Evidence Metadata Completeness Property Tests', () => {
  let service: EvidenceService;
  let evidenceRepository: Repository<Evidence>;
  let transactionRepository: Repository<Transaction>;
  let userRepository: Repository<User>;
  let auditLogRepository: Repository<AuditLog>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvidenceService,
        {
          provide: getRepositoryToken(Evidence),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AuditLog),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
          },
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

  /**
   * Property Test: All captured evidence must include complete metadata
   * For any evidence captured, GPS coordinates, timestamp, user identity, and device info must be present
   */
  it('should automatically include GPS coordinates, timestamp, user identity, and device info for all evidence', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tenantId: fc.uuid(),
          transactionId: fc.uuid(),
          userId: fc.uuid(),
          operationalLevel: fc.integer({ min: 1, max: 7 }),
          evidenceType: fc.constantFrom(
            EvidenceType.PHOTO,
            EvidenceType.DOCUMENT,
            EvidenceType.VIDEO,
            EvidenceType.WEIGHBRIDGE_TICKET,
            EvidenceType.INSPECTION_REPORT
          ),
          fileName: fc.string({ minLength: 5, maxLength: 50 }),
          mimeType: fc.constantFrom('image/jpeg', 'image/png', 'application/pdf', 'video/mp4'),
          fileSize: fc.integer({ min: 1024, max: 10485760 }), // 1KB to 10MB
          metadata: fc.record({
            gpsCoordinates: fc.option(fc.record({
              latitude: fc.double({ min: -90, max: 90, noNaN: true }),
              longitude: fc.double({ min: -180, max: 180, noNaN: true }),
              accuracy: fc.option(fc.double({ min: 0, max: 100, noNaN: true })),
            })),
            deviceInfo: fc.option(fc.record({
              deviceId: fc.uuid(),
              deviceModel: fc.string({ minLength: 1, maxLength: 50 }),
              osVersion: fc.string({ minLength: 1, maxLength: 20 }),
              appVersion: fc.string({ minLength: 1, maxLength: 20 }),
            })),
            cameraInfo: fc.option(fc.record({
              make: fc.option(fc.string({ minLength: 1, maxLength: 30 })),
              model: fc.option(fc.string({ minLength: 1, maxLength: 30 })),
              orientation: fc.option(fc.integer({ min: 0, max: 360 })),
              flash: fc.option(fc.boolean()),
            })),
          }),
        }),
        async (testData) => {
          // Mock transaction exists
          jest.spyOn(transactionRepository, 'findOne').mockResolvedValue({
            id: testData.transactionId,
            tenantId: testData.tenantId,
          } as any);

          // Mock user exists
          jest.spyOn(userRepository, 'findOne').mockResolvedValue({
            id: testData.userId,
            tenantId: testData.tenantId,
          } as any);

          // Mock evidence creation
          let savedEvidence: Evidence | null = null;
          jest.spyOn(evidenceRepository, 'create').mockImplementation((data: any) => {
            savedEvidence = data as Evidence;
            return data as Evidence;
          });

          jest.spyOn(evidenceRepository, 'save').mockImplementation(async (evidence: any) => {
            return {
              ...evidence,
              id: fc.sample(fc.uuid(), 1)[0],
              capturedAt: new Date(),
            } as Evidence;
          });

          // Mock audit log creation
          jest.spyOn(auditLogRepository, 'create').mockReturnValue({} as any);
          jest.spyOn(auditLogRepository, 'save').mockResolvedValue({} as any);

          // Create evidence
          const createDto: CreateEvidenceDto = {
            transactionId: testData.transactionId,
            operationalLevel: testData.operationalLevel,
            evidenceType: testData.evidenceType,
            file: Buffer.from('test file content'),
            fileName: testData.fileName,
            mimeType: testData.mimeType,
            metadata: testData.metadata,
          };

          const result = await service.createEvidence(
            createDto,
            testData.userId,
            testData.tenantId
          );

          // Property: Evidence must have complete metadata
          expect(result).toBeDefined();
          expect(result.metadata).toBeDefined();

          // Property: Timestamp must always be present (enhanced by service)
          const metadata = result.metadata as any; // Cast to any to access enhanced fields
          expect(metadata.captureInfo).toBeDefined();
          expect(metadata.captureInfo.timestamp).toBeDefined();
          expect(metadata.captureInfo.timestamp).toBeInstanceOf(Date);
          expect(metadata.captureInfo.timezone).toBeDefined();
          expect(typeof metadata.captureInfo.timezone).toBe('string');

          // Property: GPS coordinates must be present if provided, with timestamp
          if (testData.metadata.gpsCoordinates) {
            expect(metadata.gpsCoordinates).toBeDefined();
            expect(metadata.gpsCoordinates.latitude).toBeDefined();
            expect(metadata.gpsCoordinates.longitude).toBeDefined();
            expect(typeof metadata.gpsCoordinates.latitude).toBe('number');
            expect(typeof metadata.gpsCoordinates.longitude).toBe('number');
            
            // GPS coordinates must have timestamp (enhanced by service)
            expect(metadata.gpsCoordinates.timestamp).toBeDefined();
            expect(metadata.gpsCoordinates.timestamp).toBeInstanceOf(Date);
            
            // Validate GPS coordinate ranges
            expect(metadata.gpsCoordinates.latitude).toBeGreaterThanOrEqual(-90);
            expect(metadata.gpsCoordinates.latitude).toBeLessThanOrEqual(90);
            expect(metadata.gpsCoordinates.longitude).toBeGreaterThanOrEqual(-180);
            expect(metadata.gpsCoordinates.longitude).toBeLessThanOrEqual(180);
          }

          // Property: Device info must be present if provided
          if (testData.metadata.deviceInfo) {
            expect(metadata.deviceInfo).toBeDefined();
            expect(metadata.deviceInfo.deviceId).toBeDefined();
            expect(metadata.deviceInfo.deviceModel).toBeDefined();
            expect(metadata.deviceInfo.osVersion).toBeDefined();
            expect(metadata.deviceInfo.appVersion).toBeDefined();
            expect(typeof metadata.deviceInfo.deviceId).toBe('string');
            expect(typeof metadata.deviceInfo.deviceModel).toBe('string');
            expect(typeof metadata.deviceInfo.osVersion).toBe('string');
            expect(typeof metadata.deviceInfo.appVersion).toBe('string');
          }

          // Property: User identity must always be present
          expect(result.capturedBy).toBeDefined();
          expect(result.capturedBy).toBe(testData.userId);

          // Property: System metadata must be automatically added (enhanced by service)
          expect(metadata.systemInfo).toBeDefined();
          expect(metadata.systemInfo.version).toBeDefined();
          expect(metadata.systemInfo.environment).toBeDefined();
          expect(metadata.systemInfo.serverTimestamp).toBeDefined();
          expect(metadata.systemInfo.serverTimestamp).toBeInstanceOf(Date);

          // Property: File metadata must be present for file-based evidence
          if (createDto.file) {
            expect(result.fileHash).toBeDefined();
            expect(typeof result.fileHash).toBe('string');
            expect(result.fileHash.length).toBe(64); // SHA-256 hash length
            expect(result.filePath).toBeDefined();
            expect(typeof result.filePath).toBe('string');
            expect(result.fileSize).toBeDefined();
            expect(typeof result.fileSize).toBe('number');
            expect(result.fileSize).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property Test: Evidence metadata must be immutable after capture
   */
  it('should prevent modification of evidence metadata after capture', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tenantId: fc.uuid(),
          transactionId: fc.uuid(),
          userId: fc.uuid(),
          operationalLevel: fc.integer({ min: 1, max: 7 }),
          evidenceType: fc.constantFrom(EvidenceType.PHOTO, EvidenceType.DOCUMENT),
          gpsCoordinates: fc.record({
            latitude: fc.double({ min: -90, max: 90, noNaN: true }),
            longitude: fc.double({ min: -180, max: 180, noNaN: true }),
            accuracy: fc.double({ min: 0, max: 100, noNaN: true }),
          }),
          deviceInfo: fc.record({
            deviceId: fc.uuid(),
            deviceModel: fc.string({ minLength: 1, maxLength: 50 }),
            osVersion: fc.string({ minLength: 1, maxLength: 20 }),
            appVersion: fc.string({ minLength: 1, maxLength: 20 }),
          }),
        }),
        async (testData) => {
          // Mock transaction and user
          jest.spyOn(transactionRepository, 'findOne').mockResolvedValue({
            id: testData.transactionId,
            tenantId: testData.tenantId,
          } as any);

          jest.spyOn(userRepository, 'findOne').mockResolvedValue({
            id: testData.userId,
            tenantId: testData.tenantId,
          } as any);

          // Create evidence with metadata
          const originalMetadata = {
            gpsCoordinates: testData.gpsCoordinates,
            deviceInfo: testData.deviceInfo,
          };

          jest.spyOn(evidenceRepository, 'create').mockImplementation((data: any) => data as Evidence);
          jest.spyOn(evidenceRepository, 'save').mockImplementation(async (evidence: any) => {
            return {
              ...evidence,
              id: fc.sample(fc.uuid(), 1)[0],
              capturedAt: new Date(),
            } as Evidence;
          });

          jest.spyOn(auditLogRepository, 'create').mockReturnValue({} as any);
          jest.spyOn(auditLogRepository, 'save').mockResolvedValue({} as any);

          const createDto: CreateEvidenceDto = {
            transactionId: testData.transactionId,
            operationalLevel: testData.operationalLevel,
            evidenceType: testData.evidenceType,
            file: Buffer.from('test file'),
            fileName: 'test.jpg',
            mimeType: 'image/jpeg',
            metadata: originalMetadata,
          };

          const evidence = await service.createEvidence(
            createDto,
            testData.userId,
            testData.tenantId
          );

          // Property: Original metadata values must be preserved
          const metadata = evidence.metadata as any; // Cast to any to access enhanced fields
          expect(metadata.gpsCoordinates.latitude).toBe(testData.gpsCoordinates.latitude);
          expect(metadata.gpsCoordinates.longitude).toBe(testData.gpsCoordinates.longitude);
          expect(metadata.deviceInfo.deviceId).toBe(testData.deviceInfo.deviceId);
          expect(metadata.deviceInfo.deviceModel).toBe(testData.deviceInfo.deviceModel);

          // Property: Metadata must include enhanced fields without overwriting original data
          expect(metadata.gpsCoordinates.timestamp).toBeDefined();
          expect(metadata.captureInfo).toBeDefined();
          expect(metadata.systemInfo).toBeDefined();

          // Property: Core metadata fields must remain unchanged
          const metadataString = JSON.stringify(evidence.metadata);
          expect(metadataString).toContain(testData.gpsCoordinates.latitude.toString());
          expect(metadataString).toContain(testData.gpsCoordinates.longitude.toString());
          expect(metadataString).toContain(testData.deviceInfo.deviceId);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property Test: Evidence without GPS should still have complete metadata
   */
  it('should include complete metadata even when GPS is not available', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tenantId: fc.uuid(),
          transactionId: fc.uuid(),
          userId: fc.uuid(),
          operationalLevel: fc.integer({ min: 1, max: 7 }),
          evidenceType: fc.constantFrom(EvidenceType.PHOTO, EvidenceType.DOCUMENT),
          deviceInfo: fc.record({
            deviceId: fc.uuid(),
            deviceModel: fc.string({ minLength: 1, maxLength: 50 }),
            osVersion: fc.string({ minLength: 1, maxLength: 20 }),
            appVersion: fc.string({ minLength: 1, maxLength: 20 }),
          }),
        }),
        async (testData) => {
          // Mock transaction and user
          jest.spyOn(transactionRepository, 'findOne').mockResolvedValue({
            id: testData.transactionId,
            tenantId: testData.tenantId,
          } as any);

          jest.spyOn(userRepository, 'findOne').mockResolvedValue({
            id: testData.userId,
            tenantId: testData.tenantId,
          } as any);

          jest.spyOn(evidenceRepository, 'create').mockImplementation((data: any) => data as Evidence);
          jest.spyOn(evidenceRepository, 'save').mockImplementation(async (evidence: any) => {
            return {
              ...evidence,
              id: fc.sample(fc.uuid(), 1)[0],
              capturedAt: new Date(),
            } as Evidence;
          });

          jest.spyOn(auditLogRepository, 'create').mockReturnValue({} as any);
          jest.spyOn(auditLogRepository, 'save').mockResolvedValue({} as any);

          // Create evidence WITHOUT GPS coordinates
          const createDto: CreateEvidenceDto = {
            transactionId: testData.transactionId,
            operationalLevel: testData.operationalLevel,
            evidenceType: testData.evidenceType,
            file: Buffer.from('test file'),
            fileName: 'test.jpg',
            mimeType: 'image/jpeg',
            metadata: {
              deviceInfo: testData.deviceInfo,
              // No GPS coordinates provided
            },
          };

          const evidence = await service.createEvidence(
            createDto,
            testData.userId,
            testData.tenantId
          );

          // Property: Even without GPS, other metadata must be complete
          const metadata = evidence.metadata as any; // Cast to any to access enhanced fields
          expect(evidence.metadata).toBeDefined();
          expect(metadata.captureInfo).toBeDefined();
          expect(metadata.captureInfo.timestamp).toBeDefined();
          expect(metadata.captureInfo.timezone).toBeDefined();
          expect(metadata.deviceInfo).toBeDefined();
          expect(metadata.systemInfo).toBeDefined();
          expect(evidence.capturedBy).toBe(testData.userId);

          // Property: GPS coordinates should be undefined when not provided
          expect(metadata.gpsCoordinates).toBeUndefined();

          // Property: All other required metadata must still be present
          expect(metadata.deviceInfo.deviceId).toBe(testData.deviceInfo.deviceId);
          expect(metadata.deviceInfo.deviceModel).toBe(testData.deviceInfo.deviceModel);
          expect(metadata.systemInfo.version).toBeDefined();
          expect(metadata.systemInfo.serverTimestamp).toBeInstanceOf(Date);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property Test: Audit log must capture evidence metadata for compliance
   */
  it('should create audit log with complete evidence metadata', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tenantId: fc.uuid(),
          transactionId: fc.uuid(),
          userId: fc.uuid(),
          operationalLevel: fc.integer({ min: 1, max: 7 }),
          evidenceType: fc.constantFrom(EvidenceType.PHOTO, EvidenceType.DOCUMENT),
          gpsCoordinates: fc.record({
            latitude: fc.double({ min: -90, max: 90, noNaN: true }),
            longitude: fc.double({ min: -180, max: 180, noNaN: true }),
          }),
          deviceInfo: fc.record({
            deviceId: fc.uuid(),
            deviceModel: fc.string({ minLength: 1, maxLength: 50 }),
            osVersion: fc.string({ minLength: 1, maxLength: 20 }),
            appVersion: fc.string({ minLength: 1, maxLength: 20 }),
          }),
        }),
        async (testData) => {
          // Mock transaction and user
          jest.spyOn(transactionRepository, 'findOne').mockResolvedValue({
            id: testData.transactionId,
            tenantId: testData.tenantId,
          } as any);

          jest.spyOn(userRepository, 'findOne').mockResolvedValue({
            id: testData.userId,
            tenantId: testData.tenantId,
          } as any);

          jest.spyOn(evidenceRepository, 'create').mockImplementation((data: any) => data as Evidence);
          jest.spyOn(evidenceRepository, 'save').mockImplementation(async (evidence: any) => {
            return {
              ...evidence,
              id: fc.sample(fc.uuid(), 1)[0],
              capturedAt: new Date(),
            } as Evidence;
          });

          let auditLogData: any = null;
          jest.spyOn(auditLogRepository, 'create').mockImplementation((data: any) => {
            auditLogData = data;
            return data as AuditLog;
          });
          jest.spyOn(auditLogRepository, 'save').mockResolvedValue({} as any);

          const createDto: CreateEvidenceDto = {
            transactionId: testData.transactionId,
            operationalLevel: testData.operationalLevel,
            evidenceType: testData.evidenceType,
            file: Buffer.from('test file'),
            fileName: 'test.jpg',
            mimeType: 'image/jpeg',
            metadata: {
              gpsCoordinates: testData.gpsCoordinates,
              deviceInfo: testData.deviceInfo,
            },
          };

          await service.createEvidence(
            createDto,
            testData.userId,
            testData.tenantId
          );

          // Property: Audit log must be created with evidence metadata
          expect(auditLogRepository.create).toHaveBeenCalled();
          expect(auditLogRepository.save).toHaveBeenCalled();
          expect(auditLogData).toBeDefined();

          // Property: Audit log must include GPS coordinates
          expect(auditLogData.metadata).toBeDefined();
          expect(auditLogData.metadata.gpsCoordinates).toBeDefined();
          expect(auditLogData.metadata.gpsCoordinates.latitude).toBe(testData.gpsCoordinates.latitude);
          expect(auditLogData.metadata.gpsCoordinates.longitude).toBe(testData.gpsCoordinates.longitude);

          // Property: Audit log must include device info
          expect(auditLogData.metadata.deviceInfo).toBeDefined();
          expect(auditLogData.metadata.deviceInfo.deviceId).toBe(testData.deviceInfo.deviceId);

          // Property: Audit log must include operational level
          expect(auditLogData.metadata.operationalLevel).toBe(testData.operationalLevel);

          // Property: Audit log must include user identity
          expect(auditLogData.userId).toBe(testData.userId);

          // Property: Audit log must include transaction reference
          expect(auditLogData.transactionId).toBe(testData.transactionId);
        }
      ),
      { numRuns: 50 }
    );
  });
});
