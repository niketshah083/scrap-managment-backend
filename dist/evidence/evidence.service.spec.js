"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const typeorm_1 = require("@nestjs/typeorm");
const fc = require("fast-check");
const evidence_service_1 = require("./evidence.service");
const evidence_entity_1 = require("../entities/evidence.entity");
const transaction_entity_1 = require("../entities/transaction.entity");
const user_entity_1 = require("../entities/user.entity");
const audit_log_entity_1 = require("../entities/audit-log.entity");
describe('EvidenceService - Property Tests', () => {
    let service;
    let evidenceRepository;
    let transactionRepository;
    let userRepository;
    let auditLogRepository;
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
        const module = await testing_1.Test.createTestingModule({
            providers: [
                evidence_service_1.EvidenceService,
                {
                    provide: (0, typeorm_1.getRepositoryToken)(evidence_entity_1.Evidence),
                    useValue: mockEvidenceRepository,
                },
                {
                    provide: (0, typeorm_1.getRepositoryToken)(transaction_entity_1.Transaction),
                    useValue: mockTransactionRepository,
                },
                {
                    provide: (0, typeorm_1.getRepositoryToken)(user_entity_1.User),
                    useValue: mockUserRepository,
                },
                {
                    provide: (0, typeorm_1.getRepositoryToken)(audit_log_entity_1.AuditLog),
                    useValue: mockAuditLogRepository,
                },
            ],
        }).compile();
        service = module.get(evidence_service_1.EvidenceService);
        evidenceRepository = module.get((0, typeorm_1.getRepositoryToken)(evidence_entity_1.Evidence));
        transactionRepository = module.get((0, typeorm_1.getRepositoryToken)(transaction_entity_1.Transaction));
        userRepository = module.get((0, typeorm_1.getRepositoryToken)(user_entity_1.User));
        auditLogRepository = module.get((0, typeorm_1.getRepositoryToken)(audit_log_entity_1.AuditLog));
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    const evidenceTypeArb = fc.constantFrom(evidence_entity_1.EvidenceType.PHOTO, evidence_entity_1.EvidenceType.DOCUMENT, evidence_entity_1.EvidenceType.VIDEO, evidence_entity_1.EvidenceType.AUDIO, evidence_entity_1.EvidenceType.GPS_LOCATION, evidence_entity_1.EvidenceType.TIMESTAMP, evidence_entity_1.EvidenceType.WEIGHBRIDGE_TICKET, evidence_entity_1.EvidenceType.INSPECTION_REPORT, evidence_entity_1.EvidenceType.GRN_DOCUMENT, evidence_entity_1.EvidenceType.GATE_PASS);
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
            await fc.assert(fc.asyncProperty(createEvidenceDtoArb, fc.uuid(), fc.uuid(), async (createEvidenceDto, capturedBy, tenantId) => {
                const result = await service.createEvidence(createEvidenceDto, capturedBy, tenantId);
                const savedEvidence = mockEvidenceRepository.save.mock.calls[mockEvidenceRepository.save.mock.calls.length - 1][0];
                expect(savedEvidence.metadata).toHaveProperty('captureInfo');
                expect(savedEvidence.metadata.captureInfo).toHaveProperty('timestamp');
                expect(savedEvidence.metadata.captureInfo.timestamp).toBeInstanceOf(Date);
                expect(savedEvidence.metadata.captureInfo).toHaveProperty('timezone');
                expect(savedEvidence.metadata).toHaveProperty('systemInfo');
                expect(savedEvidence.metadata.systemInfo).toHaveProperty('serverTimestamp');
                expect(savedEvidence.metadata.systemInfo.serverTimestamp).toBeInstanceOf(Date);
                if (createEvidenceDto.metadata?.gpsCoordinates) {
                    expect(savedEvidence.metadata.gpsCoordinates).toHaveProperty('timestamp');
                    expect(savedEvidence.metadata.gpsCoordinates.timestamp).toBeInstanceOf(Date);
                }
            }), { numRuns: 50 });
        });
        it('should preserve user identity in evidence records', async () => {
            await fc.assert(fc.asyncProperty(createEvidenceDtoArb, fc.uuid(), fc.uuid(), async (createEvidenceDto, capturedBy, tenantId) => {
                await service.createEvidence(createEvidenceDto, capturedBy, tenantId);
                const savedEvidence = mockEvidenceRepository.save.mock.calls[mockEvidenceRepository.save.mock.calls.length - 1][0];
                expect(savedEvidence.capturedBy).toBe(capturedBy);
            }), { numRuns: 50 });
        });
        it('should generate file hash for integrity verification when file is provided', async () => {
            await fc.assert(fc.asyncProperty(createEvidenceDtoArb, fc.uuid(), fc.uuid(), async (createEvidenceDto, capturedBy, tenantId) => {
                fc.pre(createEvidenceDto.file !== null && createEvidenceDto.file !== undefined);
                await service.createEvidence(createEvidenceDto, capturedBy, tenantId);
                const savedEvidence = mockEvidenceRepository.save.mock.calls[mockEvidenceRepository.save.mock.calls.length - 1][0];
                expect(savedEvidence.fileHash).toBeDefined();
                expect(typeof savedEvidence.fileHash).toBe('string');
                expect(savedEvidence.fileHash.length).toBe(64);
                expect(savedEvidence.fileSize).toBeDefined();
                expect(savedEvidence.fileSize).toBeGreaterThan(0);
            }), { numRuns: 30 });
        });
        it('should maintain metadata structure consistency across all evidence types', async () => {
            await fc.assert(fc.asyncProperty(evidenceTypeArb, createEvidenceDtoArb, fc.uuid(), fc.uuid(), async (evidenceType, createEvidenceDto, capturedBy, tenantId) => {
                const dtoWithType = { ...createEvidenceDto, evidenceType };
                await service.createEvidence(dtoWithType, capturedBy, tenantId);
                const savedEvidence = mockEvidenceRepository.save.mock.calls[mockEvidenceRepository.save.mock.calls.length - 1][0];
                expect(savedEvidence.metadata).toHaveProperty('captureInfo');
                expect(savedEvidence.metadata).toHaveProperty('systemInfo');
                expect(savedEvidence.metadata.captureInfo).toHaveProperty('timestamp');
                expect(savedEvidence.metadata.captureInfo).toHaveProperty('timezone');
                expect(savedEvidence.metadata.systemInfo).toHaveProperty('version');
                expect(savedEvidence.metadata.systemInfo).toHaveProperty('environment');
                expect(savedEvidence.metadata.systemInfo).toHaveProperty('serverTimestamp');
            }), { numRuns: 70 });
        });
        it('should enforce tenant isolation in evidence creation', async () => {
            await fc.assert(fc.asyncProperty(createEvidenceDtoArb, fc.uuid(), fc.uuid(), fc.uuid(), async (createEvidenceDto, capturedBy, tenantId1, tenantId2) => {
                fc.pre(tenantId1 !== tenantId2);
                mockTransactionRepository.findOne.mockReset();
                mockUserRepository.findOne.mockReset();
                mockTransactionRepository.findOne.mockResolvedValueOnce({
                    id: createEvidenceDto.transactionId,
                    tenantId: tenantId1,
                });
                mockUserRepository.findOne.mockResolvedValueOnce(null);
                await expect(service.createEvidence(createEvidenceDto, capturedBy, tenantId1)).rejects.toThrow('User not authorized for this tenant');
            }), { numRuns: 30 });
        });
        it('should validate operational level constraints', async () => {
            await fc.assert(fc.asyncProperty(createEvidenceDtoArb, fc.integer({ min: -10, max: 20 }).filter(level => level < 1 || level > 7), fc.uuid(), fc.uuid(), async (createEvidenceDto, invalidLevel, capturedBy, tenantId) => {
                const dtoWithInvalidLevel = { ...createEvidenceDto, operationalLevel: invalidLevel };
                await service.createEvidence(dtoWithInvalidLevel, capturedBy, tenantId);
                const savedEvidence = mockEvidenceRepository.save.mock.calls[mockEvidenceRepository.save.mock.calls.length - 1][0];
                expect(savedEvidence.operationalLevel).toBe(invalidLevel);
            }), { numRuns: 20 });
        });
        it('should preserve original metadata while enhancing it', async () => {
            await fc.assert(fc.asyncProperty(createEvidenceDtoArb, fc.uuid(), fc.uuid(), async (createEvidenceDto, capturedBy, tenantId) => {
                fc.pre(createEvidenceDto.metadata !== null && createEvidenceDto.metadata !== undefined);
                const originalMetadata = createEvidenceDto.metadata;
                await service.createEvidence(createEvidenceDto, capturedBy, tenantId);
                const savedEvidence = mockEvidenceRepository.save.mock.calls[mockEvidenceRepository.save.mock.calls.length - 1][0];
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
            }), { numRuns: 40 });
        });
    });
    describe('Property 17: Evidence Immutability', () => {
        beforeEach(() => {
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
            await fc.assert(fc.asyncProperty(fc.uuid(), fc.uuid(), async (evidenceId, tenantId) => {
                mockEvidenceRepository.findOne.mockResolvedValueOnce({
                    id: evidenceId,
                    transaction: { tenantId },
                });
                await expect(service.deleteEvidence(evidenceId, tenantId)).rejects.toThrow('Evidence deletion is not allowed to maintain audit integrity');
            }), { numRuns: 50 });
        });
        it('should maintain file integrity through hash verification', async () => {
            await fc.assert(fc.asyncProperty(createEvidenceDtoArb, fc.uuid(), fc.uuid(), async (createEvidenceDto, capturedBy, tenantId) => {
                fc.pre(createEvidenceDto.file !== null && createEvidenceDto.file !== undefined);
                await service.createEvidence(createEvidenceDto, capturedBy, tenantId);
                const savedEvidence = mockEvidenceRepository.save.mock.calls[mockEvidenceRepository.save.mock.calls.length - 1][0];
                expect(savedEvidence.fileHash).toBeDefined();
                expect(typeof savedEvidence.fileHash).toBe('string');
                expect(savedEvidence.fileHash.length).toBe(64);
                const buffer1 = createEvidenceDto.file;
                const buffer2 = Buffer.from(buffer1);
                mockEvidenceRepository.save.mockClear();
                await service.createEvidence({
                    ...createEvidenceDto,
                    file: buffer2,
                }, capturedBy, tenantId);
                const savedEvidence2 = mockEvidenceRepository.save.mock.calls[mockEvidenceRepository.save.mock.calls.length - 1][0];
                expect(savedEvidence2.fileHash).toBe(savedEvidence.fileHash);
            }), { numRuns: 30 });
        });
        it('should preserve evidence metadata immutability after creation', async () => {
            await fc.assert(fc.asyncProperty(createEvidenceDtoArb, fc.uuid(), fc.uuid(), async (createEvidenceDto, capturedBy, tenantId) => {
                const evidence = await service.createEvidence(createEvidenceDto, capturedBy, tenantId);
                const savedEvidence = mockEvidenceRepository.save.mock.calls[mockEvidenceRepository.save.mock.calls.length - 1][0];
                expect(savedEvidence.capturedBy).toBe(capturedBy);
                expect(savedEvidence.transactionId).toBe(createEvidenceDto.transactionId);
                expect(savedEvidence.operationalLevel).toBe(createEvidenceDto.operationalLevel);
                expect(savedEvidence.evidenceType).toBe(createEvidenceDto.evidenceType);
                expect(savedEvidence.metadata.captureInfo.timestamp).toBeInstanceOf(Date);
                expect(savedEvidence.metadata.systemInfo.serverTimestamp).toBeInstanceOf(Date);
                expect(savedEvidence.metadata.systemInfo.version).toBeDefined();
                expect(savedEvidence.metadata.systemInfo.environment).toBeDefined();
            }), { numRuns: 50 });
        });
        it('should maintain evidence integrity verification capability', async () => {
            await fc.assert(fc.asyncProperty(fc.uuid(), async (evidenceId) => {
                mockEvidenceRepository.findOne.mockResolvedValueOnce({
                    id: evidenceId,
                    filePath: '/path/to/file',
                    fileHash: 'abc123def456',
                });
                const isValid = await service.verifyEvidenceIntegrity(evidenceId);
                expect(typeof isValid).toBe('boolean');
                expect(isValid).toBe(true);
            }), { numRuns: 30 });
        });
        it('should detect missing evidence integrity data', async () => {
            await fc.assert(fc.asyncProperty(fc.uuid(), async (evidenceId) => {
                mockEvidenceRepository.findOne.mockResolvedValueOnce({
                    id: evidenceId,
                    filePath: null,
                    fileHash: null,
                });
                const isValid = await service.verifyEvidenceIntegrity(evidenceId);
                expect(isValid).toBe(false);
            }), { numRuns: 30 });
        });
        it('should handle non-existent evidence integrity checks gracefully', async () => {
            await fc.assert(fc.asyncProperty(fc.uuid(), async (evidenceId) => {
                mockEvidenceRepository.findOne.mockResolvedValueOnce(null);
                const isValid = await service.verifyEvidenceIntegrity(evidenceId);
                expect(isValid).toBe(false);
            }), { numRuns: 30 });
        });
    });
    describe('Property 18: Chronological Integrity', () => {
        beforeEach(() => {
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
            await fc.assert(fc.asyncProperty(fc.uuid(), fc.array(fc.record({
                capturedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
                operationalLevel: fc.integer({ min: 1, max: 7 }),
            }), { minLength: 2, maxLength: 10 }), async (transactionId, evidenceData) => {
                const sortedEvidence = evidenceData.sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
                mockEvidenceRepository.find.mockResolvedValueOnce(sortedEvidence);
                const isValid = await service.validateChronologicalIntegrity(transactionId);
                expect(isValid).toBe(true);
            }), { numRuns: 50 });
        });
        it('should detect chronological violations in evidence timestamps', async () => {
            await fc.assert(fc.asyncProperty(fc.uuid(), fc.array(fc.record({
                capturedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
                operationalLevel: fc.integer({ min: 1, max: 7 }),
            }), { minLength: 3, maxLength: 10 }), async (transactionId, evidenceData) => {
                fc.pre(evidenceData.length >= 3);
                const violatedEvidence = [...evidenceData];
                const baseTime = new Date('2020-01-01').getTime();
                violatedEvidence[0].capturedAt = new Date(baseTime + 1000000);
                violatedEvidence[violatedEvidence.length - 1].capturedAt = new Date(baseTime);
                mockEvidenceRepository.find.mockResolvedValueOnce(violatedEvidence);
                const isValid = await service.validateChronologicalIntegrity(transactionId);
                expect(isValid).toBe(false);
            }), { numRuns: 30 });
        });
        it('should validate operational level progression logic', async () => {
            await fc.assert(fc.asyncProperty(fc.uuid(), fc.array(fc.record({
                capturedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
                operationalLevel: fc.integer({ min: 1, max: 7 }),
            }), { minLength: 2, maxLength: 7 }), async (transactionId, evidenceData) => {
                const progressiveEvidence = evidenceData.map((item, index) => ({
                    ...item,
                    operationalLevel: index + 1,
                    capturedAt: new Date(Date.now() + index * 1000),
                }));
                mockEvidenceRepository.find.mockResolvedValueOnce(progressiveEvidence);
                const isValid = await service.validateChronologicalIntegrity(transactionId);
                expect(isValid).toBe(true);
            }), { numRuns: 50 });
        });
        it('should handle empty evidence arrays gracefully', async () => {
            await fc.assert(fc.asyncProperty(fc.uuid(), async (transactionId) => {
                mockEvidenceRepository.find.mockResolvedValueOnce([]);
                const isValid = await service.validateChronologicalIntegrity(transactionId);
                expect(isValid).toBe(true);
            }), { numRuns: 30 });
        });
        it('should handle single evidence item gracefully', async () => {
            await fc.assert(fc.asyncProperty(fc.uuid(), fc.record({
                capturedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
                operationalLevel: fc.integer({ min: 1, max: 7 }),
            }), async (transactionId, evidenceItem) => {
                mockEvidenceRepository.find.mockResolvedValueOnce([evidenceItem]);
                const isValid = await service.validateChronologicalIntegrity(transactionId);
                expect(isValid).toBe(true);
            }), { numRuns: 30 });
        });
        it('should prevent back-dating through timestamp validation', async () => {
            await fc.assert(fc.asyncProperty(createEvidenceDtoArb, fc.uuid(), fc.uuid(), async (createEvidenceDto, capturedBy, tenantId) => {
                const evidence = await service.createEvidence(createEvidenceDto, capturedBy, tenantId);
                const savedEvidence = mockEvidenceRepository.save.mock.calls[mockEvidenceRepository.save.mock.calls.length - 1][0];
                expect(savedEvidence.metadata.systemInfo.serverTimestamp).toBeInstanceOf(Date);
                expect(savedEvidence.metadata.captureInfo.timestamp).toBeInstanceOf(Date);
                const now = new Date();
                const timeDiff = now.getTime() - savedEvidence.metadata.systemInfo.serverTimestamp.getTime();
                expect(timeDiff).toBeLessThan(5000);
            }), { numRuns: 50 });
        });
    });
});
//# sourceMappingURL=evidence.service.spec.js.map