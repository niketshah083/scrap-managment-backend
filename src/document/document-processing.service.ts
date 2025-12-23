import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Evidence, EvidenceType } from '../entities/evidence.entity';
import { Transaction } from '../entities/transaction.entity';
import { User } from '../entities/user.entity';
import { AuditLog, AuditAction } from '../entities/audit-log.entity';
import { OcrService, OcrExtractionResult } from './ocr.service';

export interface DocumentUploadDto {
  transactionId: string;
  operationalLevel: number;
  file: Buffer;
  fileName: string;
  mimeType: string;
  documentType: 'PO' | 'INVOICE' | 'CHALLAN' | 'OTHER';
  extractFields?: boolean;
}

export interface DocumentConfirmationDto {
  documentId: string;
  confirmedData: {
    vendorName?: string;
    invoiceNumber?: string;
    poNumber?: string;
    date?: string;
    amount?: string;
    materialLines?: Array<{
      description: string;
      quantity: string;
      unit: string;
      rate?: string;
    }>;
    customFields?: Record<string, any>;
  };
  confirmedBy: string;
}

export interface ProcessedDocument {
  id: string;
  transactionId: string;
  documentType: string;
  fileName: string;
  ocrResult: OcrExtractionResult;
  isConfirmed: boolean;
  confirmedData?: any;
  confirmedBy?: string;
  confirmedAt?: Date;
  createdAt: Date;
}

@Injectable()
export class DocumentProcessingService {
  private readonly logger = new Logger(DocumentProcessingService.name);

  constructor(
    @InjectRepository(Evidence)
    private evidenceRepository: Repository<Evidence>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    private ocrService: OcrService,
  ) {}

  async processDocument(
    uploadDto: DocumentUploadDto,
    uploadedBy: string,
    tenantId: string,
  ): Promise<ProcessedDocument> {
    // Verify transaction exists and belongs to tenant
    const transaction = await this.transactionRepository.findOne({
      where: { id: uploadDto.transactionId, tenantId },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found or access denied');
    }

    // Verify user exists and belongs to tenant
    const user = await this.userRepository.findOne({
      where: { id: uploadedBy, tenantId },
    });

    if (!user) {
      throw new BadRequestException('User not authorized for this tenant');
    }

    this.logger.log(`Processing document: ${uploadDto.fileName} for transaction: ${uploadDto.transactionId}`);

    // Extract text using OCR
    const ocrResult = await this.ocrService.extractTextFromDocument(
      uploadDto.file,
      uploadDto.mimeType,
      {
        extractFields: uploadDto.extractFields,
        confidenceThreshold: 0.6,
      }
    );

    // Validate OCR quality
    const isQualityGood = await this.ocrService.validateExtractionQuality(ocrResult);
    if (!isQualityGood) {
      this.logger.warn(`Poor OCR quality for document: ${uploadDto.fileName}`);
    }

    // Create evidence record with OCR data
    const evidence = this.evidenceRepository.create({
      transactionId: uploadDto.transactionId,
      capturedBy: uploadedBy,
      operationalLevel: uploadDto.operationalLevel,
      evidenceType: EvidenceType.DOCUMENT,
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
          requiresConfirmation: true, // Always require manual confirmation
          isConfirmed: false,
        },
      },
      description: `${uploadDto.documentType} document processed with OCR`,
      tags: [uploadDto.documentType.toLowerCase(), 'ocr-processed', 'requires-confirmation'],
      isProcessed: true, // OCR processing is complete
    });

    const savedEvidence = await this.evidenceRepository.save(evidence);

    // Create audit log for document processing
    await this.createAuditLog({
      userId: uploadedBy,
      transactionId: uploadDto.transactionId,
      action: AuditAction.EVIDENCE_CAPTURE,
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

  async confirmDocumentData(
    confirmationDto: DocumentConfirmationDto,
    tenantId: string,
  ): Promise<ProcessedDocument> {
    // Get the document evidence
    const evidence = await this.evidenceRepository.findOne({
      where: { id: confirmationDto.documentId },
      relations: ['transaction'],
    });

    if (!evidence) {
      throw new NotFoundException('Document not found');
    }

    // Verify tenant access
    if (evidence.transaction.tenantId !== tenantId) {
      throw new BadRequestException('Access denied to this document');
    }

    // Verify user exists and belongs to tenant
    const user = await this.userRepository.findOne({
      where: { id: confirmationDto.confirmedBy, tenantId },
    });

    if (!user) {
      throw new BadRequestException('User not authorized for this tenant');
    }

    // Check if already confirmed
    if (evidence.metadata?.customFields?.isConfirmed) {
      throw new BadRequestException('Document data has already been confirmed');
    }

    this.logger.log(`Confirming document data for evidence: ${confirmationDto.documentId}`);

    // Update evidence with confirmed data
    const updatedMetadata = {
      ...evidence.metadata,
      customFields: {
        ...evidence.metadata?.customFields,
        isConfirmed: true,
        confirmedData: confirmationDto.confirmedData,
        confirmedBy: confirmationDto.confirmedBy,
        confirmedAt: new Date(),
        originalOcrData: evidence.metadata?.ocrData, // Preserve original OCR data
      },
    };

    await this.evidenceRepository.update(confirmationDto.documentId, {
      metadata: updatedMetadata as any,
      description: `${evidence.description} - CONFIRMED by ${user.name}`,
    });

    // Create audit log for confirmation
    await this.createAuditLog({
      userId: confirmationDto.confirmedBy,
      transactionId: evidence.transactionId,
      action: AuditAction.APPROVAL,
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
          confirmationRequired: true, // This is always true per requirements
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

  async getDocumentsByTransaction(
    transactionId: string,
    tenantId: string,
  ): Promise<ProcessedDocument[]> {
    // Verify transaction belongs to tenant
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId, tenantId },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found or access denied');
    }

    const documents = await this.evidenceRepository.find({
      where: {
        transactionId,
        evidenceType: EvidenceType.DOCUMENT,
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

  async getUnconfirmedDocuments(tenantId: string): Promise<ProcessedDocument[]> {
    // Get all unconfirmed documents for the tenant
    const documents = await this.evidenceRepository
      .createQueryBuilder('evidence')
      .leftJoinAndSelect('evidence.transaction', 'transaction')
      .where('transaction.tenantId = :tenantId', { tenantId })
      .andWhere('evidence.evidenceType = :type', { type: EvidenceType.DOCUMENT })
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

  async linkDocumentToTransaction(
    documentId: string,
    transactionId: string,
    tenantId: string,
  ): Promise<void> {
    // Verify both document and transaction belong to tenant
    const evidence = await this.evidenceRepository.findOne({
      where: { id: documentId },
      relations: ['transaction'],
    });

    if (!evidence || evidence.transaction.tenantId !== tenantId) {
      throw new NotFoundException('Document not found or access denied');
    }

    const targetTransaction = await this.transactionRepository.findOne({
      where: { id: transactionId, tenantId },
    });

    if (!targetTransaction) {
      throw new NotFoundException('Target transaction not found or access denied');
    }

    // Update the document's transaction link
    await this.evidenceRepository.update(documentId, {
      transactionId: transactionId,
    });

    // Create audit log for document linking
    await this.createAuditLog({
      userId: 'system', // This should be the requesting user ID in real implementation
      transactionId: transactionId,
      action: AuditAction.UPDATE,
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

  private async createAuditLog(auditData: {
    userId: string;
    transactionId?: string;
    action: AuditAction;
    entityType: string;
    entityId?: string;
    description?: string;
    oldValues?: Record<string, any>;
    newValues?: Record<string, any>;
    metadata?: any;
    severity?: string;
    isSensitive?: boolean;
  }): Promise<void> {
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
}