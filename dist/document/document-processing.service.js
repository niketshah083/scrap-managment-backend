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
var DocumentProcessingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentProcessingService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const evidence_entity_1 = require("../entities/evidence.entity");
const transaction_entity_1 = require("../entities/transaction.entity");
const user_entity_1 = require("../entities/user.entity");
const audit_log_entity_1 = require("../entities/audit-log.entity");
const ocr_service_1 = require("./ocr.service");
let DocumentProcessingService = DocumentProcessingService_1 = class DocumentProcessingService {
    constructor(evidenceRepository, transactionRepository, userRepository, auditLogRepository, ocrService) {
        this.evidenceRepository = evidenceRepository;
        this.transactionRepository = transactionRepository;
        this.userRepository = userRepository;
        this.auditLogRepository = auditLogRepository;
        this.ocrService = ocrService;
        this.logger = new common_1.Logger(DocumentProcessingService_1.name);
    }
    async processDocument(uploadDto, uploadedBy, tenantId) {
        const transaction = await this.transactionRepository.findOne({
            where: { id: uploadDto.transactionId, tenantId },
        });
        if (!transaction) {
            throw new common_1.NotFoundException('Transaction not found or access denied');
        }
        const user = await this.userRepository.findOne({
            where: { id: uploadedBy, tenantId },
        });
        if (!user) {
            throw new common_1.BadRequestException('User not authorized for this tenant');
        }
        this.logger.log(`Processing document: ${uploadDto.fileName} for transaction: ${uploadDto.transactionId}`);
        const ocrResult = await this.ocrService.extractTextFromDocument(uploadDto.file, uploadDto.mimeType, {
            extractFields: uploadDto.extractFields,
            confidenceThreshold: 0.6,
        });
        const isQualityGood = await this.ocrService.validateExtractionQuality(ocrResult);
        if (!isQualityGood) {
            this.logger.warn(`Poor OCR quality for document: ${uploadDto.fileName}`);
        }
        const evidence = this.evidenceRepository.create({
            transactionId: uploadDto.transactionId,
            capturedBy: uploadedBy,
            operationalLevel: uploadDto.operationalLevel,
            evidenceType: evidence_entity_1.EvidenceType.DOCUMENT,
            filePath: `documents/${tenantId}/${uploadDto.transactionId}/${Date.now()}_${uploadDto.fileName}`,
            fileName: uploadDto.fileName,
            mimeType: uploadDto.mimeType,
            fileSize: uploadDto.file.length,
            metadata: {
                ocrData: {
                    extractedText: ocrResult.extractedText,
                    confidence: ocrResult.confidence,
                    language: ocrResult.language,
                },
                customFields: {
                    documentType: uploadDto.documentType,
                    ocrFields: ocrResult.fields,
                    processingInfo: {
                        processedAt: new Date(),
                        ocrEngine: 'mock-ocr-engine',
                        qualityScore: ocrResult.confidence,
                    },
                    requiresConfirmation: true,
                    isConfirmed: false,
                },
            },
            description: `${uploadDto.documentType} document processed with OCR`,
            tags: [uploadDto.documentType.toLowerCase(), 'ocr-processed', 'requires-confirmation'],
            isProcessed: true,
        });
        const savedEvidence = await this.evidenceRepository.save(evidence);
        await this.createAuditLog({
            userId: uploadedBy,
            transactionId: uploadDto.transactionId,
            action: audit_log_entity_1.AuditAction.EVIDENCE_CAPTURE,
            entityType: 'Document',
            entityId: savedEvidence.id,
            description: `Document processed with OCR: ${uploadDto.documentType} - ${uploadDto.fileName}`,
            newValues: {
                documentType: uploadDto.documentType,
                fileName: uploadDto.fileName,
                ocrConfidence: ocrResult.confidence,
                extractedFieldCount: ocrResult.fields ? Object.keys(ocrResult.fields).length : 0,
                requiresConfirmation: true,
            },
            metadata: {
                operationalLevel: uploadDto.operationalLevel,
                ocrResult: {
                    confidence: ocrResult.confidence,
                    language: ocrResult.language,
                    textLength: ocrResult.extractedText.length,
                },
                additionalContext: {
                    documentType: uploadDto.documentType,
                    processingEngine: 'mock-ocr-engine',
                    qualityGood: isQualityGood,
                },
            },
            severity: 'MEDIUM',
        });
        return {
            id: savedEvidence.id,
            transactionId: uploadDto.transactionId,
            documentType: uploadDto.documentType,
            fileName: uploadDto.fileName,
            ocrResult,
            isConfirmed: false,
            createdAt: savedEvidence.capturedAt,
        };
    }
    async confirmDocumentData(confirmationDto, tenantId) {
        const evidence = await this.evidenceRepository.findOne({
            where: { id: confirmationDto.documentId },
            relations: ['transaction'],
        });
        if (!evidence) {
            throw new common_1.NotFoundException('Document not found');
        }
        if (evidence.transaction.tenantId !== tenantId) {
            throw new common_1.BadRequestException('Access denied to this document');
        }
        const user = await this.userRepository.findOne({
            where: { id: confirmationDto.confirmedBy, tenantId },
        });
        if (!user) {
            throw new common_1.BadRequestException('User not authorized for this tenant');
        }
        if (evidence.metadata?.customFields?.isConfirmed) {
            throw new common_1.BadRequestException('Document data has already been confirmed');
        }
        this.logger.log(`Confirming document data for evidence: ${confirmationDto.documentId}`);
        const updatedMetadata = {
            ...evidence.metadata,
            customFields: {
                ...evidence.metadata?.customFields,
                isConfirmed: true,
                confirmedData: confirmationDto.confirmedData,
                confirmedBy: confirmationDto.confirmedBy,
                confirmedAt: new Date(),
                originalOcrData: evidence.metadata?.ocrData,
            },
        };
        await this.evidenceRepository.update(confirmationDto.documentId, {
            metadata: updatedMetadata,
            description: `${evidence.description} - CONFIRMED by ${user.name}`,
        });
        await this.createAuditLog({
            userId: confirmationDto.confirmedBy,
            transactionId: evidence.transactionId,
            action: audit_log_entity_1.AuditAction.APPROVAL,
            entityType: 'Document',
            entityId: confirmationDto.documentId,
            description: `Document data confirmed manually after OCR processing`,
            oldValues: {
                isConfirmed: false,
                ocrData: evidence.metadata?.ocrData,
            },
            newValues: {
                isConfirmed: true,
                confirmedData: confirmationDto.confirmedData,
                confirmedBy: confirmationDto.confirmedBy,
                confirmedAt: new Date(),
            },
            metadata: {
                operationalLevel: evidence.operationalLevel,
                documentConfirmation: {
                    originalOcrConfidence: evidence.metadata?.ocrData?.confidence,
                    fieldsConfirmed: Object.keys(confirmationDto.confirmedData).length,
                    confirmationRequired: true,
                },
                additionalContext: {
                    documentType: evidence.metadata?.customFields?.documentType,
                    fileName: evidence.fileName,
                    confirmationWorkflow: 'manual_required',
                },
            },
            severity: 'MEDIUM',
        });
        const updatedEvidence = await this.evidenceRepository.findOne({
            where: { id: confirmationDto.documentId },
            relations: ['transaction'],
        });
        return {
            id: updatedEvidence.id,
            transactionId: updatedEvidence.transactionId,
            documentType: updatedEvidence.metadata?.customFields?.documentType,
            fileName: updatedEvidence.fileName,
            ocrResult: {
                extractedText: updatedEvidence.metadata?.ocrData?.extractedText || '',
                confidence: updatedEvidence.metadata?.ocrData?.confidence || 0,
                language: updatedEvidence.metadata?.ocrData?.language || 'en',
                fields: updatedEvidence.metadata?.customFields?.ocrFields,
            },
            isConfirmed: true,
            confirmedData: confirmationDto.confirmedData,
            confirmedBy: confirmationDto.confirmedBy,
            confirmedAt: updatedEvidence.metadata?.customFields?.confirmedAt,
            createdAt: updatedEvidence.capturedAt,
        };
    }
    async getDocumentsByTransaction(transactionId, tenantId) {
        const transaction = await this.transactionRepository.findOne({
            where: { id: transactionId, tenantId },
        });
        if (!transaction) {
            throw new common_1.NotFoundException('Transaction not found or access denied');
        }
        const documents = await this.evidenceRepository.find({
            where: {
                transactionId,
                evidenceType: evidence_entity_1.EvidenceType.DOCUMENT,
            },
            order: { capturedAt: 'ASC' },
        });
        return documents.map(doc => ({
            id: doc.id,
            transactionId: doc.transactionId,
            documentType: doc.metadata?.customFields?.documentType || 'OTHER',
            fileName: doc.fileName,
            ocrResult: {
                extractedText: doc.metadata?.ocrData?.extractedText || '',
                confidence: doc.metadata?.ocrData?.confidence || 0,
                language: doc.metadata?.ocrData?.language || 'en',
                fields: doc.metadata?.customFields?.ocrFields,
            },
            isConfirmed: doc.metadata?.customFields?.isConfirmed || false,
            confirmedData: doc.metadata?.customFields?.confirmedData,
            confirmedBy: doc.metadata?.customFields?.confirmedBy,
            confirmedAt: doc.metadata?.customFields?.confirmedAt,
            createdAt: doc.capturedAt,
        }));
    }
    async getUnconfirmedDocuments(tenantId) {
        const documents = await this.evidenceRepository
            .createQueryBuilder('evidence')
            .leftJoinAndSelect('evidence.transaction', 'transaction')
            .where('transaction.tenantId = :tenantId', { tenantId })
            .andWhere('evidence.evidenceType = :type', { type: evidence_entity_1.EvidenceType.DOCUMENT })
            .andWhere("JSON_EXTRACT(evidence.metadata, '$.customFields.isConfirmed') IS NULL OR JSON_EXTRACT(evidence.metadata, '$.customFields.isConfirmed') = false")
            .orderBy('evidence.capturedAt', 'ASC')
            .getMany();
        return documents.map(doc => ({
            id: doc.id,
            transactionId: doc.transactionId,
            documentType: doc.metadata?.customFields?.documentType || 'OTHER',
            fileName: doc.fileName,
            ocrResult: {
                extractedText: doc.metadata?.ocrData?.extractedText || '',
                confidence: doc.metadata?.ocrData?.confidence || 0,
                language: doc.metadata?.ocrData?.language || 'en',
                fields: doc.metadata?.customFields?.ocrFields,
            },
            isConfirmed: false,
            createdAt: doc.capturedAt,
        }));
    }
    async linkDocumentToTransaction(documentId, transactionId, tenantId) {
        const evidence = await this.evidenceRepository.findOne({
            where: { id: documentId },
            relations: ['transaction'],
        });
        if (!evidence || evidence.transaction.tenantId !== tenantId) {
            throw new common_1.NotFoundException('Document not found or access denied');
        }
        const targetTransaction = await this.transactionRepository.findOne({
            where: { id: transactionId, tenantId },
        });
        if (!targetTransaction) {
            throw new common_1.NotFoundException('Target transaction not found or access denied');
        }
        await this.evidenceRepository.update(documentId, {
            transactionId: transactionId,
        });
        await this.createAuditLog({
            userId: 'system',
            transactionId: transactionId,
            action: audit_log_entity_1.AuditAction.UPDATE,
            entityType: 'Document',
            entityId: documentId,
            description: `Document linked to transaction`,
            oldValues: {
                transactionId: evidence.transactionId,
            },
            newValues: {
                transactionId: transactionId,
            },
            metadata: {
                documentLinking: {
                    originalTransactionId: evidence.transactionId,
                    newTransactionId: transactionId,
                    documentType: evidence.metadata?.customFields?.documentType,
                    fileName: evidence.fileName,
                },
                additionalContext: {
                    linkingReason: 'manual_reassignment',
                    documentConfirmed: evidence.metadata?.customFields?.isConfirmed || false,
                },
            },
            severity: 'MEDIUM',
        });
    }
    async createAuditLog(auditData) {
        const auditLog = this.auditLogRepository.create({
            userId: auditData.userId,
            transactionId: auditData.transactionId,
            action: auditData.action,
            entityType: auditData.entityType,
            entityId: auditData.entityId,
            description: auditData.description,
            oldValues: auditData.oldValues,
            newValues: auditData.newValues,
            metadata: auditData.metadata,
            severity: auditData.severity || 'LOW',
            isSensitive: auditData.isSensitive || false,
        });
        await this.auditLogRepository.save(auditLog);
    }
};
exports.DocumentProcessingService = DocumentProcessingService;
exports.DocumentProcessingService = DocumentProcessingService = DocumentProcessingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(evidence_entity_1.Evidence)),
    __param(1, (0, typeorm_1.InjectRepository)(transaction_entity_1.Transaction)),
    __param(2, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(3, (0, typeorm_1.InjectRepository)(audit_log_entity_1.AuditLog)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        ocr_service_1.OcrService])
], DocumentProcessingService);
//# sourceMappingURL=document-processing.service.js.map