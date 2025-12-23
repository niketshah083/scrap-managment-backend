"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const typeorm_1 = require("@nestjs/typeorm");
const fc = require("fast-check");
const inspection_service_1 = require("./inspection.service");
const transaction_entity_1 = require("../entities/transaction.entity");
const evidence_entity_1 = require("../entities/evidence.entity");
const user_entity_1 = require("../entities/user.entity");
const vendor_entity_1 = require("../entities/vendor.entity");
const evidence_service_1 = require("../evidence/evidence.service");
const notification_service_1 = require("../notification/notification.service");
describe('InspectionService - Inspection Evidence Requirements Property Tests', () => {
    let service;
    let transactionRepository;
    let evidenceRepository;
    let userRepository;
    let vendorRepository;
    let evidenceService;
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
        const module = await testing_1.Test.createTestingModule({
            providers: [
                inspection_service_1.InspectionService,
                {
                    provide: (0, typeorm_1.getRepositoryToken)(transaction_entity_1.Transaction),
                    useValue: mockTransactionRepository,
                },
                {
                    provide: (0, typeorm_1.getRepositoryToken)(evidence_entity_1.Evidence),
                    useValue: mockEvidenceRepository,
                },
                {
                    provide: (0, typeorm_1.getRepositoryToken)(user_entity_1.User),
                    useValue: mockUserRepository,
                },
                {
                    provide: (0, typeorm_1.getRepositoryToken)(vendor_entity_1.Vendor),
                    useValue: mockVendorRepository,
                },
                {
                    provide: evidence_service_1.EvidenceService,
                    useValue: mockEvidenceService,
                },
                {
                    provide: notification_service_1.NotificationService,
                    useValue: mockNotificationService,
                },
            ],
        }).compile();
        service = module.get(inspection_service_1.InspectionService);
        transactionRepository = module.get((0, typeorm_1.getRepositoryToken)(transaction_entity_1.Transaction));
        evidenceRepository = module.get((0, typeorm_1.getRepositoryToken)(evidence_entity_1.Evidence));
        userRepository = module.get((0, typeorm_1.getRepositoryToken)(user_entity_1.User));
        vendorRepository = module.get((0, typeorm_1.getRepositoryToken)(vendor_entity_1.Vendor));
        evidenceService = module.get(evidence_service_1.EvidenceService);
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
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
        photos: fc.array(photoArb, { minLength: 2, maxLength: 10 }),
        gpsCoordinates: fc.option(gpsCoordinatesArb),
        deviceInfo: fc.option(deviceInfoArb),
    }).map(data => {
        if (data.grade === 'REJECTED' && !data.rejectionReason) {
            return { ...data, rejectionReason: 'Material quality below standards' };
        }
        return data;
    });
    describe('Property 8: Inspection Evidence Requirements', () => {
        beforeEach(() => {
            mockTransactionRepository.findOne.mockResolvedValue({
                id: 'transaction-id',
                tenantId: 'tenant-id',
                currentLevel: transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION,
                vendorId: 'vendor-id',
                levelData: {
                    [transaction_entity_1.OperationalLevel.L3_WEIGHBRIDGE_GROSS]: {
                        level: transaction_entity_1.OperationalLevel.L3_WEIGHBRIDGE_GROSS,
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
            await fc.assert(fc.asyncProperty(inspectionDataArb, fc.uuid(), fc.uuid(), async (inspectionData, transactionId, tenantId) => {
                jest.clearAllMocks();
                mockTransactionRepository.findOne.mockResolvedValue({
                    id: transactionId,
                    tenantId,
                    currentLevel: transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION,
                    vendorId: 'vendor-id',
                    levelData: {
                        [transaction_entity_1.OperationalLevel.L3_WEIGHBRIDGE_GROSS]: {
                            level: transaction_entity_1.OperationalLevel.L3_WEIGHBRIDGE_GROSS,
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
                let evidenceIdCounter = 0;
                mockEvidenceService.createEvidence.mockImplementation(() => Promise.resolve({
                    id: `evidence-${++evidenceIdCounter}`,
                    filePath: `evidence/path/evidence-${evidenceIdCounter}`,
                    capturedAt: new Date(),
                }));
                const result = await service.conductInspection(transactionId, inspectionData, tenantId);
                expect(inspectionData.photos.length).toBeGreaterThanOrEqual(2);
                expect(inspectionData.photos.length).toBeLessThanOrEqual(10);
                const photoEvidenceCalls = mockEvidenceService.createEvidence.mock.calls.filter(call => call[0].evidenceType === evidence_entity_1.EvidenceType.PHOTO);
                expect(photoEvidenceCalls).toHaveLength(inspectionData.photos.length);
                photoEvidenceCalls.forEach(call => {
                    expect(call[1]).toBe(inspectionData.inspectorId);
                    expect(call[0].operationalLevel).toBe(transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION);
                    expect(call[0].tags).toContain('inspection');
                    expect(call[0].tags).toContain('material-quality');
                });
                expect(result.evidenceIds).toHaveLength(inspectionData.photos.length + 1);
                expect(result.transactionId).toBe(transactionId);
            }), { numRuns: 20 });
        });
        it('should generate complete PDF report with all evidence for every inspection', async () => {
            await fc.assert(fc.asyncProperty(inspectionDataArb, fc.uuid(), fc.uuid(), async (inspectionData, transactionId, tenantId) => {
                jest.clearAllMocks();
                mockTransactionRepository.findOne.mockResolvedValue({
                    id: transactionId,
                    tenantId,
                    currentLevel: transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION,
                    vendorId: 'vendor-id',
                    levelData: {
                        [transaction_entity_1.OperationalLevel.L3_WEIGHBRIDGE_GROSS]: {
                            level: transaction_entity_1.OperationalLevel.L3_WEIGHBRIDGE_GROSS,
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
                let evidenceIdCounter = 0;
                mockEvidenceService.createEvidence.mockImplementation(() => Promise.resolve({
                    id: `evidence-${++evidenceIdCounter}`,
                    filePath: `evidence/path/evidence-${evidenceIdCounter}`,
                    capturedAt: new Date(),
                }));
                const result = await service.conductInspection(transactionId, inspectionData, tenantId);
                const reportEvidenceCalls = mockEvidenceService.createEvidence.mock.calls.filter(call => call[0].evidenceType === evidence_entity_1.EvidenceType.INSPECTION_REPORT);
                expect(reportEvidenceCalls).toHaveLength(1);
                const reportCall = reportEvidenceCalls[0];
                expect(reportCall[0].fileName).toMatch(/inspection-report-.*\.pdf/);
                expect(reportCall[0].mimeType).toBe('application/pdf');
                expect(reportCall[0].file).toBeInstanceOf(Buffer);
                expect(reportCall[0].file.length).toBeGreaterThan(0);
                expect(reportCall[0].metadata.customFields.inspectionGrade).toBe(inspectionData.grade);
                expect(reportCall[0].metadata.customFields.contaminationLevel).toBe(inspectionData.contaminationLevel);
                expect(reportCall[0].metadata.customFields.reportType).toBe('material-inspection');
                expect(result.reportUrl).toBeDefined();
                expect(typeof result.reportUrl).toBe('string');
            }), { numRuns: 15 });
        });
        it('should preserve GPS coordinates and device info in all evidence when provided', async () => {
            await fc.assert(fc.asyncProperty(inspectionDataArb, fc.uuid(), fc.uuid(), async (inspectionData, transactionId, tenantId) => {
                fc.pre(inspectionData.gpsCoordinates !== null && inspectionData.deviceInfo !== null);
                jest.clearAllMocks();
                mockTransactionRepository.findOne.mockResolvedValue({
                    id: transactionId,
                    tenantId,
                    currentLevel: transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION,
                    vendorId: 'vendor-id',
                    levelData: {
                        [transaction_entity_1.OperationalLevel.L3_WEIGHBRIDGE_GROSS]: {
                            level: transaction_entity_1.OperationalLevel.L3_WEIGHBRIDGE_GROSS,
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
                let evidenceIdCounter = 0;
                mockEvidenceService.createEvidence.mockImplementation(() => Promise.resolve({
                    id: `evidence-${++evidenceIdCounter}`,
                    filePath: `evidence/path/evidence-${evidenceIdCounter}`,
                    capturedAt: new Date(),
                }));
                await service.conductInspection(transactionId, inspectionData, tenantId);
                mockEvidenceService.createEvidence.mock.calls.forEach(call => {
                    expect(call[0].metadata.gpsCoordinates).toEqual(inspectionData.gpsCoordinates);
                    expect(call[0].metadata.deviceInfo).toEqual(inspectionData.deviceInfo);
                });
            }), { numRuns: 10 });
        });
        it('should update transaction level data with complete inspection information', async () => {
            await fc.assert(fc.asyncProperty(inspectionDataArb, fc.uuid(), fc.uuid(), async (inspectionData, transactionId, tenantId) => {
                await service.conductInspection(transactionId, inspectionData, tenantId);
                expect(mockTransactionRepository.update).toHaveBeenCalledWith(transactionId, expect.objectContaining({
                    inspectionData: expect.objectContaining({
                        grade: inspectionData.grade,
                        contaminationLevel: inspectionData.contaminationLevel,
                        inspectorId: inspectionData.inspectorId,
                        inspectionTimestamp: expect.any(Date),
                        inspectionReportUrl: expect.any(String),
                    }),
                    levelData: expect.objectContaining({
                        [transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION]: expect.objectContaining({
                            level: transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION,
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
                }));
            }), { numRuns: 40 });
        });
        it('should enforce minimum photo requirements and reject insufficient evidence', async () => {
            await fc.assert(fc.asyncProperty(inspectionDataArb.map(data => ({
                ...data,
                photos: data.photos.slice(0, 1),
            })), fc.uuid(), fc.uuid(), async (inspectionDataWithFewPhotos, transactionId, tenantId) => {
                await expect(service.conductInspection(transactionId, inspectionDataWithFewPhotos, tenantId)).rejects.toThrow('At least 2 photos are required for material inspection');
            }), { numRuns: 20 });
        });
        it('should enforce maximum photo limits and reject excessive evidence', async () => {
            await fc.assert(fc.asyncProperty(inspectionDataArb.filter(data => data.photos.length <= 10).map(data => ({
                ...data,
                photos: [...data.photos, ...Array(5).fill(data.photos[0])],
            })), fc.uuid(), fc.uuid(), async (inspectionDataWithManyPhotos, transactionId, tenantId) => {
                fc.pre(inspectionDataWithManyPhotos.photos.length > 10);
                jest.clearAllMocks();
                mockTransactionRepository.findOne.mockResolvedValue({
                    id: transactionId,
                    tenantId,
                    currentLevel: transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION,
                    vendorId: 'vendor-id',
                    levelData: {
                        [transaction_entity_1.OperationalLevel.L3_WEIGHBRIDGE_GROSS]: {
                            level: transaction_entity_1.OperationalLevel.L3_WEIGHBRIDGE_GROSS,
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
                await expect(service.conductInspection(transactionId, inspectionDataWithManyPhotos, tenantId)).rejects.toThrow('Maximum 10 photos allowed for inspection');
            }), { numRuns: 10 });
        });
        it('should validate inspection data completeness and reject invalid grades', async () => {
            await fc.assert(fc.asyncProperty(inspectionDataArb.map(data => ({
                ...data,
                grade: 'INVALID_GRADE',
            })), fc.uuid(), fc.uuid(), async (inspectionDataWithInvalidGrade, transactionId, tenantId) => {
                await expect(service.conductInspection(transactionId, inspectionDataWithInvalidGrade, tenantId)).rejects.toThrow('Invalid grade. Must be A, B, C, or REJECTED');
            }), { numRuns: 20 });
        });
        it('should require rejection reason when grade is REJECTED', async () => {
            await fc.assert(fc.asyncProperty(inspectionDataArb.map(data => ({
                ...data,
                grade: 'REJECTED',
                rejectionReason: undefined,
            })), fc.uuid(), fc.uuid(), async (inspectionDataWithoutReason, transactionId, tenantId) => {
                await expect(service.conductInspection(transactionId, inspectionDataWithoutReason, tenantId)).rejects.toThrow('Rejection reason is required when grade is REJECTED');
            }), { numRuns: 20 });
        });
        it('should update vendor performance metrics when inspection fails', async () => {
            await fc.assert(fc.asyncProperty(inspectionDataArb.map(data => ({
                ...data,
                grade: 'REJECTED',
                rejectionReason: 'Poor material quality',
            })), fc.uuid(), fc.uuid(), async (rejectedInspectionData, transactionId, tenantId) => {
                jest.clearAllMocks();
                mockTransactionRepository.findOne.mockResolvedValue({
                    id: transactionId,
                    tenantId,
                    currentLevel: transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION,
                    vendorId: 'vendor-id',
                    levelData: {
                        [transaction_entity_1.OperationalLevel.L3_WEIGHBRIDGE_GROSS]: {
                            level: transaction_entity_1.OperationalLevel.L3_WEIGHBRIDGE_GROSS,
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
                let evidenceIdCounter = 0;
                mockEvidenceService.createEvidence.mockImplementation(() => Promise.resolve({
                    id: `evidence-${++evidenceIdCounter}`,
                    filePath: `evidence/path/evidence-${evidenceIdCounter}`,
                    capturedAt: new Date(),
                }));
                await service.conductInspection(transactionId, rejectedInspectionData, tenantId);
                expect(mockVendorRepository.update).toHaveBeenCalledWith('vendor-id', expect.objectContaining({
                    performanceMetrics: expect.objectContaining({
                        totalTransactions: 21,
                        inspectionFailureCount: 3,
                        rejectionPercentage: expect.any(Number),
                        lastUpdated: expect.any(Date),
                    }),
                }));
            }), { numRuns: 10 });
        });
        it('should enforce operational level progression and reject inspections at wrong level', async () => {
            await fc.assert(fc.asyncProperty(inspectionDataArb, fc.uuid(), fc.uuid(), fc.constantFrom(transaction_entity_1.OperationalLevel.L1_VENDOR_DISPATCH, transaction_entity_1.OperationalLevel.L2_GATE_ENTRY, transaction_entity_1.OperationalLevel.L3_WEIGHBRIDGE_GROSS, transaction_entity_1.OperationalLevel.L5_WEIGHBRIDGE_TARE, transaction_entity_1.OperationalLevel.L6_GRN_GENERATION, transaction_entity_1.OperationalLevel.L7_GATE_PASS_EXIT), async (inspectionData, transactionId, tenantId, wrongLevel) => {
                mockTransactionRepository.findOne.mockResolvedValueOnce({
                    id: transactionId,
                    tenantId,
                    currentLevel: wrongLevel,
                    vendorId: 'vendor-id',
                    vendor: { id: 'vendor-id', vendorName: 'Test Vendor' },
                    vehicle: { id: 'vehicle-id', vehicleNumber: 'MH12AB1234' },
                });
                await expect(service.conductInspection(transactionId, inspectionData, tenantId)).rejects.toThrow(/Transaction must be at L4 Material Inspection level/);
            }), { numRuns: 30 });
        });
        it('should maintain evidence immutability and chronological integrity', async () => {
            await fc.assert(fc.asyncProperty(inspectionDataArb, fc.uuid(), fc.uuid(), async (inspectionData, transactionId, tenantId) => {
                jest.clearAllMocks();
                mockTransactionRepository.findOne.mockResolvedValue({
                    id: transactionId,
                    tenantId,
                    currentLevel: transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION,
                    vendorId: 'vendor-id',
                    levelData: {
                        [transaction_entity_1.OperationalLevel.L3_WEIGHBRIDGE_GROSS]: {
                            level: transaction_entity_1.OperationalLevel.L3_WEIGHBRIDGE_GROSS,
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
                let evidenceIdCounter = 0;
                mockEvidenceService.createEvidence.mockImplementation(() => Promise.resolve({
                    id: `evidence-${++evidenceIdCounter}`,
                    filePath: `evidence/path/evidence-${evidenceIdCounter}`,
                    capturedAt: new Date(),
                }));
                await service.conductInspection(transactionId, inspectionData, tenantId);
                mockEvidenceService.createEvidence.mock.calls.forEach(call => {
                    expect(call[0].description).toBeDefined();
                    expect(call[0].tags).toBeDefined();
                    expect(Array.isArray(call[0].tags)).toBe(true);
                    expect(call[0].transactionId).toBe(transactionId);
                    expect(call[0].operationalLevel).toBe(transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION);
                    expect(call[2]).toBe(tenantId);
                });
            }), { numRuns: 15 });
        });
    });
    describe('Inspection Configuration and Validation', () => {
        it('should provide consistent configuration for all tenants', async () => {
            await fc.assert(fc.asyncProperty(fc.uuid(), async (tenantId) => {
                const config = await service.getInspectionConfiguration(tenantId);
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
            }), { numRuns: 20 });
        });
        it('should validate inspection requirements correctly for all transaction states', async () => {
            await fc.assert(fc.asyncProperty(fc.uuid(), fc.uuid(), fc.constantFrom(transaction_entity_1.OperationalLevel.L1_VENDOR_DISPATCH, transaction_entity_1.OperationalLevel.L2_GATE_ENTRY, transaction_entity_1.OperationalLevel.L3_WEIGHBRIDGE_GROSS, transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION, transaction_entity_1.OperationalLevel.L5_WEIGHBRIDGE_TARE, transaction_entity_1.OperationalLevel.L6_GRN_GENERATION, transaction_entity_1.OperationalLevel.L7_GATE_PASS_EXIT), async (transactionId, tenantId, currentLevel) => {
                mockTransactionRepository.findOne.mockResolvedValueOnce({
                    id: transactionId,
                    tenantId,
                    currentLevel,
                    levelData: currentLevel >= transaction_entity_1.OperationalLevel.L3_WEIGHBRIDGE_GROSS ? {
                        [transaction_entity_1.OperationalLevel.L3_WEIGHBRIDGE_GROSS]: {
                            level: transaction_entity_1.OperationalLevel.L3_WEIGHBRIDGE_GROSS,
                            completedAt: new Date(),
                            validationStatus: 'APPROVED',
                        },
                    } : {},
                });
                const validation = await service.validateInspectionRequirements(transactionId, tenantId);
                const shouldProceed = currentLevel === transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION;
                expect(validation.canProceed).toBe(shouldProceed);
                if (!shouldProceed) {
                    expect(validation.missingRequirements.length).toBeGreaterThan(0);
                }
            }), { numRuns: 35 });
        });
    });
});
//# sourceMappingURL=inspection.service.spec.js.map