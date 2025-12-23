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
describe('Evidence Metadata Completeness Property Tests', () => {
    let service;
    let evidenceRepository;
    let transactionRepository;
    let userRepository;
    let auditLogRepository;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                evidence_service_1.EvidenceService,
                {
                    provide: (0, typeorm_1.getRepositoryToken)(evidence_entity_1.Evidence),
                    useValue: {
                        find: jest.fn(),
                        findOne: jest.fn(),
                        save: jest.fn(),
                        create: jest.fn(),
                        update: jest.fn(),
                    },
                },
                {
                    provide: (0, typeorm_1.getRepositoryToken)(transaction_entity_1.Transaction),
                    useValue: {
                        find: jest.fn(),
                        findOne: jest.fn(),
                        save: jest.fn(),
                        create: jest.fn(),
                    },
                },
                {
                    provide: (0, typeorm_1.getRepositoryToken)(user_entity_1.User),
                    useValue: {
                        find: jest.fn(),
                        findOne: jest.fn(),
                        save: jest.fn(),
                        create: jest.fn(),
                    },
                },
                {
                    provide: (0, typeorm_1.getRepositoryToken)(audit_log_entity_1.AuditLog),
                    useValue: {
                        find: jest.fn(),
                        findOne: jest.fn(),
                        save: jest.fn(),
                        create: jest.fn(),
                    },
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
    it('should automatically include GPS coordinates, timestamp, user identity, and device info for all evidence', async () => {
        await fc.assert(fc.asyncProperty(fc.record({
            tenantId: fc.uuid(),
            transactionId: fc.uuid(),
            userId: fc.uuid(),
            operationalLevel: fc.integer({ min: 1, max: 7 }),
            evidenceType: fc.constantFrom(evidence_entity_1.EvidenceType.PHOTO, evidence_entity_1.EvidenceType.DOCUMENT, evidence_entity_1.EvidenceType.VIDEO, evidence_entity_1.EvidenceType.WEIGHBRIDGE_TICKET, evidence_entity_1.EvidenceType.INSPECTION_REPORT),
            fileName: fc.string({ minLength: 5, maxLength: 50 }),
            mimeType: fc.constantFrom('image/jpeg', 'image/png', 'application/pdf', 'video/mp4'),
            fileSize: fc.integer({ min: 1024, max: 10485760 }),
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
        }), async (testData) => {
            jest.spyOn(transactionRepository, 'findOne').mockResolvedValue({
                id: testData.transactionId,
                tenantId: testData.tenantId,
            });
            jest.spyOn(userRepository, 'findOne').mockResolvedValue({
                id: testData.userId,
                tenantId: testData.tenantId,
            });
            let savedEvidence = null;
            jest.spyOn(evidenceRepository, 'create').mockImplementation((data) => {
                savedEvidence = data;
                return data;
            });
            jest.spyOn(evidenceRepository, 'save').mockImplementation(async (evidence) => {
                return {
                    ...evidence,
                    id: fc.sample(fc.uuid(), 1)[0],
                    capturedAt: new Date(),
                };
            });
            jest.spyOn(auditLogRepository, 'create').mockReturnValue({});
            jest.spyOn(auditLogRepository, 'save').mockResolvedValue({});
            const createDto = {
                transactionId: testData.transactionId,
                operationalLevel: testData.operationalLevel,
                evidenceType: testData.evidenceType,
                file: Buffer.from('test file content'),
                fileName: testData.fileName,
                mimeType: testData.mimeType,
                metadata: testData.metadata,
            };
            const result = await service.createEvidence(createDto, testData.userId, testData.tenantId);
            expect(result).toBeDefined();
            expect(result.metadata).toBeDefined();
            const metadata = result.metadata;
            expect(metadata.captureInfo).toBeDefined();
            expect(metadata.captureInfo.timestamp).toBeDefined();
            expect(metadata.captureInfo.timestamp).toBeInstanceOf(Date);
            expect(metadata.captureInfo.timezone).toBeDefined();
            expect(typeof metadata.captureInfo.timezone).toBe('string');
            if (testData.metadata.gpsCoordinates) {
                expect(metadata.gpsCoordinates).toBeDefined();
                expect(metadata.gpsCoordinates.latitude).toBeDefined();
                expect(metadata.gpsCoordinates.longitude).toBeDefined();
                expect(typeof metadata.gpsCoordinates.latitude).toBe('number');
                expect(typeof metadata.gpsCoordinates.longitude).toBe('number');
                expect(metadata.gpsCoordinates.timestamp).toBeDefined();
                expect(metadata.gpsCoordinates.timestamp).toBeInstanceOf(Date);
                expect(metadata.gpsCoordinates.latitude).toBeGreaterThanOrEqual(-90);
                expect(metadata.gpsCoordinates.latitude).toBeLessThanOrEqual(90);
                expect(metadata.gpsCoordinates.longitude).toBeGreaterThanOrEqual(-180);
                expect(metadata.gpsCoordinates.longitude).toBeLessThanOrEqual(180);
            }
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
            expect(result.capturedBy).toBeDefined();
            expect(result.capturedBy).toBe(testData.userId);
            expect(metadata.systemInfo).toBeDefined();
            expect(metadata.systemInfo.version).toBeDefined();
            expect(metadata.systemInfo.environment).toBeDefined();
            expect(metadata.systemInfo.serverTimestamp).toBeDefined();
            expect(metadata.systemInfo.serverTimestamp).toBeInstanceOf(Date);
            if (createDto.file) {
                expect(result.fileHash).toBeDefined();
                expect(typeof result.fileHash).toBe('string');
                expect(result.fileHash.length).toBe(64);
                expect(result.filePath).toBeDefined();
                expect(typeof result.filePath).toBe('string');
                expect(result.fileSize).toBeDefined();
                expect(typeof result.fileSize).toBe('number');
                expect(result.fileSize).toBeGreaterThan(0);
            }
        }), { numRuns: 100 });
    });
    it('should prevent modification of evidence metadata after capture', async () => {
        await fc.assert(fc.asyncProperty(fc.record({
            tenantId: fc.uuid(),
            transactionId: fc.uuid(),
            userId: fc.uuid(),
            operationalLevel: fc.integer({ min: 1, max: 7 }),
            evidenceType: fc.constantFrom(evidence_entity_1.EvidenceType.PHOTO, evidence_entity_1.EvidenceType.DOCUMENT),
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
        }), async (testData) => {
            jest.spyOn(transactionRepository, 'findOne').mockResolvedValue({
                id: testData.transactionId,
                tenantId: testData.tenantId,
            });
            jest.spyOn(userRepository, 'findOne').mockResolvedValue({
                id: testData.userId,
                tenantId: testData.tenantId,
            });
            const originalMetadata = {
                gpsCoordinates: testData.gpsCoordinates,
                deviceInfo: testData.deviceInfo,
            };
            jest.spyOn(evidenceRepository, 'create').mockImplementation((data) => data);
            jest.spyOn(evidenceRepository, 'save').mockImplementation(async (evidence) => {
                return {
                    ...evidence,
                    id: fc.sample(fc.uuid(), 1)[0],
                    capturedAt: new Date(),
                };
            });
            jest.spyOn(auditLogRepository, 'create').mockReturnValue({});
            jest.spyOn(auditLogRepository, 'save').mockResolvedValue({});
            const createDto = {
                transactionId: testData.transactionId,
                operationalLevel: testData.operationalLevel,
                evidenceType: testData.evidenceType,
                file: Buffer.from('test file'),
                fileName: 'test.jpg',
                mimeType: 'image/jpeg',
                metadata: originalMetadata,
            };
            const evidence = await service.createEvidence(createDto, testData.userId, testData.tenantId);
            const metadata = evidence.metadata;
            expect(metadata.gpsCoordinates.latitude).toBe(testData.gpsCoordinates.latitude);
            expect(metadata.gpsCoordinates.longitude).toBe(testData.gpsCoordinates.longitude);
            expect(metadata.deviceInfo.deviceId).toBe(testData.deviceInfo.deviceId);
            expect(metadata.deviceInfo.deviceModel).toBe(testData.deviceInfo.deviceModel);
            expect(metadata.gpsCoordinates.timestamp).toBeDefined();
            expect(metadata.captureInfo).toBeDefined();
            expect(metadata.systemInfo).toBeDefined();
            const metadataString = JSON.stringify(evidence.metadata);
            expect(metadataString).toContain(testData.gpsCoordinates.latitude.toString());
            expect(metadataString).toContain(testData.gpsCoordinates.longitude.toString());
            expect(metadataString).toContain(testData.deviceInfo.deviceId);
        }), { numRuns: 50 });
    });
    it('should include complete metadata even when GPS is not available', async () => {
        await fc.assert(fc.asyncProperty(fc.record({
            tenantId: fc.uuid(),
            transactionId: fc.uuid(),
            userId: fc.uuid(),
            operationalLevel: fc.integer({ min: 1, max: 7 }),
            evidenceType: fc.constantFrom(evidence_entity_1.EvidenceType.PHOTO, evidence_entity_1.EvidenceType.DOCUMENT),
            deviceInfo: fc.record({
                deviceId: fc.uuid(),
                deviceModel: fc.string({ minLength: 1, maxLength: 50 }),
                osVersion: fc.string({ minLength: 1, maxLength: 20 }),
                appVersion: fc.string({ minLength: 1, maxLength: 20 }),
            }),
        }), async (testData) => {
            jest.spyOn(transactionRepository, 'findOne').mockResolvedValue({
                id: testData.transactionId,
                tenantId: testData.tenantId,
            });
            jest.spyOn(userRepository, 'findOne').mockResolvedValue({
                id: testData.userId,
                tenantId: testData.tenantId,
            });
            jest.spyOn(evidenceRepository, 'create').mockImplementation((data) => data);
            jest.spyOn(evidenceRepository, 'save').mockImplementation(async (evidence) => {
                return {
                    ...evidence,
                    id: fc.sample(fc.uuid(), 1)[0],
                    capturedAt: new Date(),
                };
            });
            jest.spyOn(auditLogRepository, 'create').mockReturnValue({});
            jest.spyOn(auditLogRepository, 'save').mockResolvedValue({});
            const createDto = {
                transactionId: testData.transactionId,
                operationalLevel: testData.operationalLevel,
                evidenceType: testData.evidenceType,
                file: Buffer.from('test file'),
                fileName: 'test.jpg',
                mimeType: 'image/jpeg',
                metadata: {
                    deviceInfo: testData.deviceInfo,
                },
            };
            const evidence = await service.createEvidence(createDto, testData.userId, testData.tenantId);
            const metadata = evidence.metadata;
            expect(evidence.metadata).toBeDefined();
            expect(metadata.captureInfo).toBeDefined();
            expect(metadata.captureInfo.timestamp).toBeDefined();
            expect(metadata.captureInfo.timezone).toBeDefined();
            expect(metadata.deviceInfo).toBeDefined();
            expect(metadata.systemInfo).toBeDefined();
            expect(evidence.capturedBy).toBe(testData.userId);
            expect(metadata.gpsCoordinates).toBeUndefined();
            expect(metadata.deviceInfo.deviceId).toBe(testData.deviceInfo.deviceId);
            expect(metadata.deviceInfo.deviceModel).toBe(testData.deviceInfo.deviceModel);
            expect(metadata.systemInfo.version).toBeDefined();
            expect(metadata.systemInfo.serverTimestamp).toBeInstanceOf(Date);
        }), { numRuns: 50 });
    });
    it('should create audit log with complete evidence metadata', async () => {
        await fc.assert(fc.asyncProperty(fc.record({
            tenantId: fc.uuid(),
            transactionId: fc.uuid(),
            userId: fc.uuid(),
            operationalLevel: fc.integer({ min: 1, max: 7 }),
            evidenceType: fc.constantFrom(evidence_entity_1.EvidenceType.PHOTO, evidence_entity_1.EvidenceType.DOCUMENT),
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
        }), async (testData) => {
            jest.spyOn(transactionRepository, 'findOne').mockResolvedValue({
                id: testData.transactionId,
                tenantId: testData.tenantId,
            });
            jest.spyOn(userRepository, 'findOne').mockResolvedValue({
                id: testData.userId,
                tenantId: testData.tenantId,
            });
            jest.spyOn(evidenceRepository, 'create').mockImplementation((data) => data);
            jest.spyOn(evidenceRepository, 'save').mockImplementation(async (evidence) => {
                return {
                    ...evidence,
                    id: fc.sample(fc.uuid(), 1)[0],
                    capturedAt: new Date(),
                };
            });
            let auditLogData = null;
            jest.spyOn(auditLogRepository, 'create').mockImplementation((data) => {
                auditLogData = data;
                return data;
            });
            jest.spyOn(auditLogRepository, 'save').mockResolvedValue({});
            const createDto = {
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
            await service.createEvidence(createDto, testData.userId, testData.tenantId);
            expect(auditLogRepository.create).toHaveBeenCalled();
            expect(auditLogRepository.save).toHaveBeenCalled();
            expect(auditLogData).toBeDefined();
            expect(auditLogData.metadata).toBeDefined();
            expect(auditLogData.metadata.gpsCoordinates).toBeDefined();
            expect(auditLogData.metadata.gpsCoordinates.latitude).toBe(testData.gpsCoordinates.latitude);
            expect(auditLogData.metadata.gpsCoordinates.longitude).toBe(testData.gpsCoordinates.longitude);
            expect(auditLogData.metadata.deviceInfo).toBeDefined();
            expect(auditLogData.metadata.deviceInfo.deviceId).toBe(testData.deviceInfo.deviceId);
            expect(auditLogData.metadata.operationalLevel).toBe(testData.operationalLevel);
            expect(auditLogData.userId).toBe(testData.userId);
            expect(auditLogData.transactionId).toBe(testData.transactionId);
        }), { numRuns: 50 });
    });
});
//# sourceMappingURL=evidence-metadata-completeness.property.spec.js.map