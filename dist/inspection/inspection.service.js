"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InspectionService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const transaction_entity_1 = require("../entities/transaction.entity");
const evidence_entity_1 = require("../entities/evidence.entity");
const user_entity_1 = require("../entities/user.entity");
const vendor_entity_1 = require("../entities/vendor.entity");
const evidence_service_1 = require("../evidence/evidence.service");
const notification_service_1 = require("../notification/notification.service");
const PDFDocument = require("pdfkit");
let InspectionService = class InspectionService {
    constructor(transactionRepository, evidenceRepository, userRepository, vendorRepository, evidenceService, notificationService) {
        this.transactionRepository = transactionRepository;
        this.evidenceRepository = evidenceRepository;
        this.userRepository = userRepository;
        this.vendorRepository = vendorRepository;
        this.evidenceService = evidenceService;
        this.notificationService = notificationService;
    }
    async conductInspection(transactionId, inspectionData, tenantId) {
        const transaction = await this.transactionRepository.findOne({
            where: { id: transactionId, tenantId },
            relations: ['vendor', 'vehicle', 'factory'],
        });
        if (!transaction) {
            throw new common_1.NotFoundException('Transaction not found or access denied');
        }
        if (transaction.currentLevel !== transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION) {
            throw new common_1.BadRequestException(`Transaction must be at L4 Material Inspection level. Current level: L${transaction.currentLevel}`);
        }
        const inspector = await this.userRepository.findOne({
            where: { id: inspectionData.inspectorId, tenantId },
        });
        if (!inspector) {
            throw new common_1.ForbiddenException('Inspector not authorized for this tenant');
        }
        this.validateInspectionData(inspectionData);
        const evidenceIds = [];
        for (const photo of inspectionData.photos) {
            const evidence = await this.evidenceService.createEvidence({
                transactionId,
                operationalLevel: transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION,
                evidenceType: evidence_entity_1.EvidenceType.PHOTO,
                file: photo.file,
                fileName: photo.fileName,
                mimeType: photo.mimeType,
                description: photo.description || 'Inspection photo',
                tags: ['inspection', 'material-quality'],
                metadata: {
                    gpsCoordinates: inspectionData.gpsCoordinates,
                    deviceInfo: inspectionData.deviceInfo,
                    customFields: {
                        inspectionGrade: inspectionData.grade,
                        contaminationLevel: inspectionData.contaminationLevel,
                    },
                },
            }, inspectionData.inspectorId, tenantId);
            evidenceIds.push(evidence.id);
        }
        const reportBuffer = await this.generateInspectionReport(transaction, inspectionData, evidenceIds);
        const reportEvidence = await this.evidenceService.createEvidence({
            transactionId,
            operationalLevel: transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION,
            evidenceType: evidence_entity_1.EvidenceType.INSPECTION_REPORT,
            file: reportBuffer,
            fileName: `inspection-report-${transactionId}.pdf`,
            mimeType: 'application/pdf',
            description: 'Material inspection report',
            tags: ['inspection', 'report', 'pdf'],
            metadata: {
                gpsCoordinates: inspectionData.gpsCoordinates,
                deviceInfo: inspectionData.deviceInfo,
                customFields: {
                    inspectionGrade: inspectionData.grade,
                    contaminationLevel: inspectionData.contaminationLevel,
                    reportType: 'material-inspection',
                },
            },
        }, inspectionData.inspectorId, tenantId);
        evidenceIds.push(reportEvidence.id);
        const isApproved = inspectionData.grade !== 'REJECTED';
        const updatedInspectionData = {
            grade: inspectionData.grade,
            contaminationLevel: inspectionData.contaminationLevel,
            moistureLevel: inspectionData.moistureLevel,
            inspectorId: inspectionData.inspectorId,
            inspectionTimestamp: new Date(),
            inspectionReportUrl: reportEvidence.filePath,
            rejectionReason: inspectionData.rejectionReason,
            qualityNotes: inspectionData.qualityNotes,
        };
        const levelData = transaction.levelData || {};
        levelData[transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION] = {
            level: transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION,
            fieldValues: {
                grade: inspectionData.grade,
                contaminationLevel: inspectionData.contaminationLevel,
                moistureLevel: inspectionData.moistureLevel,
                qualityNotes: inspectionData.qualityNotes,
                rejectionReason: inspectionData.rejectionReason,
            },
            completedBy: inspectionData.inspectorId,
            completedAt: new Date(),
            evidenceIds,
            validationStatus: isApproved ? 'APPROVED' : 'REJECTED',
            notes: inspectionData.qualityNotes,
        };
        await this.transactionRepository.update(transactionId, {
            inspectionData: updatedInspectionData,
            levelData,
            currentLevel: isApproved ? transaction_entity_1.OperationalLevel.L5_WEIGHBRIDGE_TARE : transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION,
            status: isApproved ? transaction_entity_1.TransactionStatus.ACTIVE : transaction_entity_1.TransactionStatus.REJECTED,
        });
        if (!isApproved) {
            await this.updateVendorPerformance(transaction.vendorId, false);
        }
        try {
            const vendor = await this.vendorRepository.findOne({
                where: { id: transaction.vendorId },
            });
            if (vendor && vendor.contactEmail) {
                const notificationVariables = {
                    vendorName: vendor.vendorName,
                    vehicleNumber: transaction.vehicle?.vehicleNumber || 'N/A',
                    inspectionResult: inspectionData.grade,
                    factoryName: transaction.factory?.factoryName || 'Factory',
                    timestamp: new Date().toISOString(),
                    rejectionReason: inspectionData.rejectionReason,
                };
                if (isApproved) {
                    await this.notificationService.sendInspectionReport(tenantId, transactionId, vendor.contactEmail, notificationVariables);
                }
                else {
                    await this.notificationService.notifyRejection(tenantId, transactionId, vendor.contactEmail, inspectionData.rejectionReason || 'Material quality does not meet standards', notificationVariables);
                }
            }
        }
        catch (notificationError) {
        }
        return {
            transactionId,
            inspectionData: updatedInspectionData,
            evidenceIds,
            reportUrl: reportEvidence.filePath,
            isApproved,
        };
    }
    async getInspectionData(transactionId, tenantId) {
        const transaction = await this.transactionRepository.findOne({
            where: { id: transactionId, tenantId },
        });
        if (!transaction) {
            throw new common_1.NotFoundException('Transaction not found or access denied');
        }
        return transaction.inspectionData;
    }
    async getInspectionEvidence(transactionId, tenantId) {
        return await this.evidenceService.getEvidenceByLevel(transactionId, transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION, tenantId);
    }
    validateInspectionData(inspectionData) {
        if (!['A', 'B', 'C', 'REJECTED'].includes(inspectionData.grade)) {
            throw new common_1.BadRequestException('Invalid grade. Must be A, B, C, or REJECTED');
        }
        if (inspectionData.contaminationLevel < 0 || inspectionData.contaminationLevel > 100) {
            throw new common_1.BadRequestException('Contamination level must be between 0 and 100');
        }
        if (inspectionData.moistureLevel !== undefined &&
            (inspectionData.moistureLevel < 0 || inspectionData.moistureLevel > 100)) {
            throw new common_1.BadRequestException('Moisture level must be between 0 and 100');
        }
        if (inspectionData.grade === 'REJECTED' && !inspectionData.rejectionReason) {
            throw new common_1.BadRequestException('Rejection reason is required when grade is REJECTED');
        }
        if (!inspectionData.photos || inspectionData.photos.length < 2) {
            throw new common_1.BadRequestException('At least 2 photos are required for material inspection');
        }
        if (inspectionData.photos.length > 10) {
            throw new common_1.BadRequestException('Maximum 10 photos allowed for inspection');
        }
        inspectionData.photos.forEach((photo, index) => {
            if (!photo.file || photo.file.length === 0) {
                throw new common_1.BadRequestException(`Photo ${index + 1} file is required`);
            }
            if (!photo.fileName) {
                throw new common_1.BadRequestException(`Photo ${index + 1} filename is required`);
            }
            if (!photo.mimeType || !photo.mimeType.startsWith('image/')) {
                throw new common_1.BadRequestException(`Photo ${index + 1} must be an image file`);
            }
        });
    }
    async generateInspectionReport(transaction, inspectionData, evidenceIds) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument();
                const chunks = [];
                doc.on('data', (chunk) => chunks.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(chunks)));
                doc.fontSize(20).text('Material Inspection Report', 50, 50);
                doc.fontSize(12).text(`Report Date: ${new Date().toLocaleDateString()}`, 50, 80);
                doc.text(`Transaction ID: ${transaction.id}`, 50, 100);
                doc.text(`Vehicle Number: ${transaction.vehicle?.vehicleNumber || 'N/A'}`, 50, 120);
                doc.text(`Vendor: ${transaction.vendor?.vendorName || 'N/A'}`, 50, 140);
                doc.fontSize(16).text('Inspection Results', 50, 180);
                doc.fontSize(12);
                doc.text(`Grade: ${inspectionData.grade}`, 50, 210);
                doc.text(`Contamination Level: ${inspectionData.contaminationLevel}%`, 50, 230);
                if (inspectionData.moistureLevel !== undefined) {
                    doc.text(`Moisture Level: ${inspectionData.moistureLevel}%`, 50, 250);
                }
                if (inspectionData.qualityNotes) {
                    doc.text(`Quality Notes: ${inspectionData.qualityNotes}`, 50, 270, { width: 500 });
                }
                if (inspectionData.rejectionReason) {
                    doc.text(`Rejection Reason: ${inspectionData.rejectionReason}`, 50, 310, { width: 500 });
                }
                doc.fontSize(16).text('Evidence', 50, 350);
                doc.fontSize(12).text(`Number of photos captured: ${inspectionData.photos.length}`, 50, 380);
                doc.text(`Evidence IDs: ${evidenceIds.join(', ')}`, 50, 400, { width: 500 });
                doc.fontSize(10).text(`Inspector ID: ${inspectionData.inspectorId}`, 50, doc.page.height - 100);
                doc.text(`Generated on: ${new Date().toISOString()}`, 50, doc.page.height - 80);
                doc.text('This report is generated automatically by the Scrap Operations Platform', 50, doc.page.height - 60);
                doc.end();
            }
            catch (error) {
                reject(error);
            }
        });
    }
    async updateVendorPerformance(vendorId, isApproved) {
        const vendor = await this.vendorRepository.findOne({
            where: { id: vendorId },
        });
        if (!vendor) {
            return;
        }
        const currentMetrics = vendor.performanceMetrics || {
            rejectionPercentage: 0,
            weightDeviationPercentage: 0,
            inspectionFailureCount: 0,
            totalTransactions: 0,
            lastUpdated: new Date(),
        };
        currentMetrics.totalTransactions += 1;
        if (!isApproved) {
            currentMetrics.inspectionFailureCount += 1;
        }
        currentMetrics.rejectionPercentage =
            (currentMetrics.inspectionFailureCount / currentMetrics.totalTransactions) * 100;
        currentMetrics.lastUpdated = new Date();
        await this.vendorRepository.update(vendorId, {
            performanceMetrics: currentMetrics,
        });
    }
    async validateInspectionRequirements(transactionId, tenantId) {
        const transaction = await this.transactionRepository.findOne({
            where: { id: transactionId, tenantId },
        });
        if (!transaction) {
            throw new common_1.NotFoundException('Transaction not found or access denied');
        }
        const missingRequirements = [];
        if (transaction.currentLevel !== transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION) {
            missingRequirements.push(`Must be at L4 Material Inspection level (currently at L${transaction.currentLevel})`);
        }
        if (!transaction.levelData?.[transaction_entity_1.OperationalLevel.L3_WEIGHBRIDGE_GROSS]) {
            missingRequirements.push('L3 Weighbridge Gross must be completed first');
        }
        if (transaction.levelData?.[transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION]) {
            missingRequirements.push('Inspection already completed for this transaction');
        }
        return {
            canProceed: missingRequirements.length === 0,
            missingRequirements,
        };
    }
    async getInspectionConfiguration(tenantId) {
        return {
            requiredPhotos: { min: 2, max: 10 },
            availableGrades: ['A', 'B', 'C', 'REJECTED'],
            contaminationThresholds: {
                'A': 5,
                'B': 15,
                'C': 30,
                'REJECTED': 100,
            },
            requiredFields: ['grade', 'contaminationLevel', 'photos'],
        };
    }
};
exports.InspectionService = InspectionService;
exports.InspectionService = InspectionService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(transaction_entity_1.Transaction)),
    __param(1, (0, typeorm_1.InjectRepository)(evidence_entity_1.Evidence)),
    __param(2, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(3, (0, typeorm_1.InjectRepository)(vendor_entity_1.Vendor)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        evidence_service_1.EvidenceService,
        notification_service_1.NotificationService])
], InspectionService);
//# sourceMappingURL=inspection.service.js.map