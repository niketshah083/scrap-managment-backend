import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, AuditAction } from '../entities/audit-log.entity';

export interface CreateAuditLogDto {
  userId: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  transactionId?: string;
  description?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    gpsCoordinates?: {
      latitude: number;
      longitude: number;
      accuracy?: number;
    };
    deviceInfo?: {
      deviceId: string;
      deviceModel: string;
      osVersion: string;
      appVersion: string;
    };
    sessionId?: string;
    operationalLevel?: number;
    additionalContext?: Record<string, any>;
  };
  isSensitive?: boolean;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  /**
   * Create an audit log entry
   */
  async createAuditLog(dto: CreateAuditLogDto): Promise<AuditLog> {
    const auditLog = this.auditLogRepository.create({
      ...dto,
      timestamp: new Date(),
    });

    return this.auditLogRepository.save(auditLog);
  }

  /**
   * Log PO creation
   */
  async logPOCreation(
    userId: string,
    poId: string,
    poData: Record<string, any>,
  ): Promise<AuditLog> {
    return this.createAuditLog({
      userId,
      action: AuditAction.PO_CREATED,
      entityType: 'PurchaseOrder',
      entityId: poId,
      description: `Purchase Order ${poData.poNumber || poId} created`,
      newValues: poData,
      severity: 'MEDIUM',
    });
  }

  /**
   * Log PO update
   */
  async logPOUpdate(
    userId: string,
    poId: string,
    oldValues: Record<string, any>,
    newValues: Record<string, any>,
  ): Promise<AuditLog> {
    return this.createAuditLog({
      userId,
      action: AuditAction.PO_UPDATED,
      entityType: 'PurchaseOrder',
      entityId: poId,
      description: `Purchase Order ${poId} updated`,
      oldValues,
      newValues,
      severity: 'MEDIUM',
    });
  }

  /**
   * Log PO cancellation
   */
  async logPOCancellation(
    userId: string,
    poId: string,
    reason?: string,
  ): Promise<AuditLog> {
    return this.createAuditLog({
      userId,
      action: AuditAction.PO_CANCELLED,
      entityType: 'PurchaseOrder',
      entityId: poId,
      description: `Purchase Order ${poId} cancelled${reason ? `: ${reason}` : ''}`,
      newValues: { status: 'CANCELLED', reason },
      severity: 'HIGH',
    });
  }

  /**
   * Log PO document upload
   */
  async logPODocumentUpload(
    userId: string,
    poId: string,
    documentInfo: Record<string, any>,
  ): Promise<AuditLog> {
    return this.createAuditLog({
      userId,
      action: AuditAction.PO_DOCUMENT_UPLOADED,
      entityType: 'PurchaseOrder',
      entityId: poId,
      description: `Document uploaded to Purchase Order ${poId}`,
      newValues: documentInfo,
      severity: 'LOW',
    });
  }

  /**
   * Log GRN step save
   */
  async logGRNStepSave(
    userId: string,
    transactionId: string,
    stepNumber: number,
    stepData: Record<string, any>,
  ): Promise<AuditLog> {
    return this.createAuditLog({
      userId,
      action: AuditAction.GRN_STEP_SAVED,
      entityType: 'Transaction',
      entityId: transactionId,
      transactionId,
      description: `GRN Step ${stepNumber} saved for transaction ${transactionId}`,
      newValues: { stepNumber, ...stepData },
      metadata: {
        operationalLevel: stepNumber + 1,
      },
      severity: 'LOW',
    });
  }

  /**
   * Log transaction creation
   */
  async logTransactionCreation(
    userId: string,
    transactionId: string,
    transactionData: Record<string, any>,
  ): Promise<AuditLog> {
    return this.createAuditLog({
      userId,
      action: AuditAction.TRANSACTION_CREATED,
      entityType: 'Transaction',
      entityId: transactionId,
      transactionId,
      description: `Transaction ${transactionData.transactionNumber || transactionId} created`,
      newValues: transactionData,
      severity: 'MEDIUM',
    });
  }

  /**
   * Log GRN completion
   */
  async logGRNCompletion(
    userId: string,
    transactionId: string,
    transactionData: Record<string, any>,
  ): Promise<AuditLog> {
    return this.createAuditLog({
      userId,
      action: AuditAction.GRN_COMPLETED,
      entityType: 'Transaction',
      entityId: transactionId,
      transactionId,
      description: `GRN completed for transaction ${transactionId}`,
      newValues: transactionData,
      severity: 'HIGH',
    });
  }

  /**
   * Log QC report creation
   */
  async logQCReportCreation(
    userId: string,
    qcReportId: string,
    transactionId: string,
    qcData: Record<string, any>,
  ): Promise<AuditLog> {
    return this.createAuditLog({
      userId,
      action: AuditAction.QC_REPORT_CREATED,
      entityType: 'QCReport',
      entityId: qcReportId,
      transactionId,
      description: `QC Report created for transaction ${transactionId}`,
      newValues: qcData,
      severity: 'MEDIUM',
    });
  }

  /**
   * Log QC report update
   */
  async logQCReportUpdate(
    userId: string,
    qcReportId: string,
    transactionId: string,
    oldValues: Record<string, any>,
    newValues: Record<string, any>,
  ): Promise<AuditLog> {
    return this.createAuditLog({
      userId,
      action: AuditAction.QC_REPORT_UPDATED,
      entityType: 'QCReport',
      entityId: qcReportId,
      transactionId,
      description: `QC Report ${qcReportId} updated`,
      oldValues,
      newValues,
      severity: 'MEDIUM',
    });
  }

  /**
   * Log QC report approval
   */
  async logQCReportApproval(
    userId: string,
    qcReportId: string,
    transactionId: string,
    approvalData: Record<string, any>,
  ): Promise<AuditLog> {
    return this.createAuditLog({
      userId,
      action: AuditAction.QC_REPORT_APPROVED,
      entityType: 'QCReport',
      entityId: qcReportId,
      transactionId,
      description: `QC Report ${qcReportId} approved`,
      newValues: approvalData,
      severity: 'HIGH',
    });
  }

  /**
   * Log debit note generation
   */
  async logDebitNoteGeneration(
    userId: string,
    debitNoteId: string,
    qcReportId: string,
    transactionId: string,
    debitNoteData: Record<string, any>,
  ): Promise<AuditLog> {
    return this.createAuditLog({
      userId,
      action: AuditAction.DEBIT_NOTE_GENERATED,
      entityType: 'DebitNote',
      entityId: debitNoteId,
      transactionId,
      description: `Debit Note ${debitNoteData.debitNoteNumber || debitNoteId} generated for QC Report ${qcReportId}`,
      newValues: debitNoteData,
      severity: 'HIGH',
    });
  }

  /**
   * Log QC report sent to vendor
   */
  async logQCReportSent(
    userId: string,
    qcReportId: string,
    transactionId: string,
    sendData: Record<string, any>,
  ): Promise<AuditLog> {
    return this.createAuditLog({
      userId,
      action: AuditAction.QC_REPORT_SENT,
      entityType: 'QCReport',
      entityId: qcReportId,
      transactionId,
      description: `QC Report ${qcReportId} sent to vendor via ${sendData.sendMethod}`,
      newValues: sendData,
      severity: 'MEDIUM',
    });
  }

  /**
   * Get audit logs for an entity
   */
  async getAuditLogsForEntity(
    entityType: string,
    entityId: string,
  ): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { entityType, entityId },
      order: { timestamp: 'DESC' },
    });
  }

  /**
   * Get audit logs for a transaction
   */
  async getAuditLogsForTransaction(transactionId: string): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { transactionId },
      order: { timestamp: 'DESC' },
    });
  }

  /**
   * Get audit logs by user
   */
  async getAuditLogsByUser(userId: string, limit = 100): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { userId },
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }
}
