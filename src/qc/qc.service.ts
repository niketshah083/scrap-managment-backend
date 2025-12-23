import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QCReport, QCReportStatus, QCLineItem, QCTotals } from '../entities/qc-report.entity';
import { DebitNote, DebitNoteStatus } from '../entities/debit-note.entity';
import { Transaction, TransactionStatus } from '../entities/transaction.entity';
import { AuditService } from '../audit/audit.service';

export interface CreateQCReportDto {
  transactionId: string;
  tenantId: string;
  lineItems: Omit<QCLineItem, 'netWeight' | 'finalQuantity' | 'amount' | 'deliveryDifference'>[];
  remarks?: string;
  labTechnician: string;
  verifiedBy?: string;
  userId?: string; // Actual user ID for audit logging
}

export interface UpdateQCReportDto {
  lineItems?: Omit<QCLineItem, 'netWeight' | 'finalQuantity' | 'amount' | 'deliveryDifference'>[];
  remarks?: string;
  labTechnician?: string;
  verifiedBy?: string;
}

@Injectable()
export class QCService {
  constructor(
    @InjectRepository(QCReport)
    private qcReportRepository: Repository<QCReport>,
    @InjectRepository(DebitNote)
    private debitNoteRepository: Repository<DebitNote>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    private auditService: AuditService,
  ) {}

  /**
   * Calculate net weight: gross - bardana - rejection
   */
  calculateNetWeight(grossWeight: number, bardana: number, rejection: number): number {
    return grossWeight - bardana - rejection;
  }

  /**
   * Calculate final quantity: netWeight × (expPercent/100) × (1 - qualityDeductPercent/100)
   */
  calculateFinalQuantity(netWeight: number, expPercent: number, qualityDeductPercent: number): number {
    return netWeight * (expPercent / 100) * (1 - qualityDeductPercent / 100);
  }

  /**
   * Calculate amount: finalQuantity × rate
   */
  calculateAmount(finalQuantity: number, rate: number): number {
    return finalQuantity * rate;
  }

  /**
   * Calculate delivery difference: (deliveryRate - rate) × finalQuantity
   */
  calculateDeliveryDifference(finalQuantity: number, rate: number, deliveryRate: number): number {
    return (deliveryRate - rate) * finalQuantity;
  }

  /**
   * Process line items and calculate all derived values
   */
  processLineItems(lineItems: Omit<QCLineItem, 'netWeight' | 'finalQuantity' | 'amount' | 'deliveryDifference'>[]): QCLineItem[] {
    return lineItems.map((item, index) => {
      const netWeight = this.calculateNetWeight(item.grossWeight, item.bardana, item.rejection);
      const finalQuantity = this.calculateFinalQuantity(netWeight, item.expPercent, item.qualityDeductPercent);
      const amount = this.calculateAmount(finalQuantity, item.rate);
      const deliveryDifference = this.calculateDeliveryDifference(finalQuantity, item.rate, item.deliveryRate);

      return {
        ...item,
        id: item.id || index + 1,
        netWeight,
        finalQuantity,
        amount,
        deliveryDifference,
      };
    });
  }

  /**
   * Calculate totals from line items
   */
  calculateTotals(lineItems: QCLineItem[]): QCTotals {
    return lineItems.reduce(
      (totals, item) => ({
        grossWeight: totals.grossWeight + item.grossWeight,
        bardana: totals.bardana + item.bardana,
        rejection: totals.rejection + item.rejection,
        netWeight: totals.netWeight + item.netWeight,
        finalQuantity: totals.finalQuantity + item.finalQuantity,
        amount: totals.amount + item.amount,
        deliveryDifference: totals.deliveryDifference + item.deliveryDifference,
      }),
      {
        grossWeight: 0,
        bardana: 0,
        rejection: 0,
        netWeight: 0,
        finalQuantity: 0,
        amount: 0,
        deliveryDifference: 0,
      },
    );
  }

  /**
   * Create a new QC Report
   */
  async createQCReport(dto: CreateQCReportDto): Promise<QCReport> {
    // Verify transaction exists and is completed
    const transaction = await this.transactionRepository.findOne({
      where: { id: dto.transactionId },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction ${dto.transactionId} not found`);
    }

    if (transaction.status !== TransactionStatus.COMPLETED) {
      throw new BadRequestException('QC Report can only be created for completed transactions');
    }

    // Check if QC report already exists for this transaction
    const existingReport = await this.qcReportRepository.findOne({
      where: { transactionId: dto.transactionId },
    });

    if (existingReport) {
      throw new BadRequestException('QC Report already exists for this transaction');
    }

    // Process line items and calculate totals
    const processedLineItems = this.processLineItems(dto.lineItems);
    const totals = this.calculateTotals(processedLineItems);

    // Create QC Report
    const qcReport = this.qcReportRepository.create({
      transactionId: dto.transactionId,
      tenantId: dto.tenantId,
      lineItems: processedLineItems,
      totals,
      remarks: dto.remarks,
      labTechnician: dto.labTechnician,
      verifiedBy: dto.verifiedBy,
      status: QCReportStatus.DRAFT,
    });

    const savedReport = await this.qcReportRepository.save(qcReport);

    // Create audit log for QC report creation
    // Use provided userId or fall back to a system user for audit logging
    const auditUserId = dto.userId || 'system';
    await this.auditService.logQCReportCreation(
      auditUserId,
      savedReport.id,
      dto.transactionId,
      {
        lineItemCount: processedLineItems.length,
        totals,
        status: savedReport.status,
        labTechnician: dto.labTechnician, // Store lab technician name in metadata
      },
    );

    return savedReport;
  }

  /**
   * Update an existing QC Report
   */
  async updateQCReport(id: string, dto: UpdateQCReportDto, userId?: string): Promise<QCReport> {
    const qcReport = await this.qcReportRepository.findOne({ where: { id } });

    if (!qcReport) {
      throw new NotFoundException(`QC Report ${id} not found`);
    }

    if (qcReport.status === QCReportStatus.APPROVED) {
      throw new BadRequestException('Cannot update an approved QC Report');
    }

    // Capture old values for audit
    const oldValues = {
      lineItems: qcReport.lineItems,
      totals: qcReport.totals,
      remarks: qcReport.remarks,
      labTechnician: qcReport.labTechnician,
      verifiedBy: qcReport.verifiedBy,
    };

    // Update line items if provided
    if (dto.lineItems) {
      const processedLineItems = this.processLineItems(dto.lineItems);
      qcReport.lineItems = processedLineItems;
      qcReport.totals = this.calculateTotals(processedLineItems);
    }

    // Update other fields
    if (dto.remarks !== undefined) qcReport.remarks = dto.remarks;
    if (dto.labTechnician) qcReport.labTechnician = dto.labTechnician;
    if (dto.verifiedBy !== undefined) qcReport.verifiedBy = dto.verifiedBy;

    const savedReport = await this.qcReportRepository.save(qcReport);

    // Create audit log for QC report update
    await this.auditService.logQCReportUpdate(
      userId || dto.labTechnician || 'system',
      savedReport.id,
      savedReport.transactionId,
      oldValues,
      {
        lineItems: savedReport.lineItems,
        totals: savedReport.totals,
        remarks: savedReport.remarks,
        labTechnician: savedReport.labTechnician,
        verifiedBy: savedReport.verifiedBy,
      },
    );

    return savedReport;
  }

  /**
   * Get QC Report by ID
   */
  async getQCReportById(id: string): Promise<QCReport> {
    const qcReport = await this.qcReportRepository.findOne({
      where: { id },
      relations: ['transaction'],
    });

    if (!qcReport) {
      throw new NotFoundException(`QC Report ${id} not found`);
    }

    return qcReport;
  }

  /**
   * Get QC Report by Transaction ID
   */
  async getQCReportByTransaction(transactionId: string): Promise<QCReport | null> {
    return this.qcReportRepository.findOne({
      where: { transactionId },
      relations: ['transaction'],
    });
  }

  /**
   * Approve QC Report and update transaction status
   */
  async approveQCReport(id: string, approverUserId: string): Promise<QCReport> {
    const qcReport = await this.qcReportRepository.findOne({ where: { id } });

    if (!qcReport) {
      throw new NotFoundException(`QC Report ${id} not found`);
    }

    if (qcReport.status === QCReportStatus.APPROVED) {
      throw new BadRequestException('QC Report is already approved');
    }

    // Update QC Report status
    qcReport.status = QCReportStatus.APPROVED;
    qcReport.approvedAt = new Date();
    qcReport.approvedBy = approverUserId;

    await this.qcReportRepository.save(qcReport);

    // Update transaction qcStatus
    await this.transactionRepository.update(
      { id: qcReport.transactionId },
      { qcStatus: 'COMPLETED', qcReportId: qcReport.id },
    );

    // Create audit log for QC report approval
    await this.auditService.logQCReportApproval(
      approverUserId,
      qcReport.id,
      qcReport.transactionId,
      {
        status: qcReport.status,
        approvedAt: qcReport.approvedAt,
        totals: qcReport.totals,
      },
    );

    return qcReport;
  }

  /**
   * Generate Debit Note for approved QC Report
   */
  async generateDebitNote(qcReportId: string, userId?: string): Promise<DebitNote> {
    const qcReport = await this.qcReportRepository.findOne({
      where: { id: qcReportId },
      relations: ['transaction'],
    });

    if (!qcReport) {
      throw new NotFoundException(`QC Report ${qcReportId} not found`);
    }

    if (qcReport.status !== QCReportStatus.APPROVED) {
      throw new BadRequestException('Debit Note can only be generated for approved QC Reports');
    }

    // Check if debit note already exists
    if (qcReport.debitNoteId) {
      const existingNote = await this.debitNoteRepository.findOne({
        where: { id: qcReport.debitNoteId },
      });
      if (existingNote) {
        return existingNote;
      }
    }

    // Generate unique debit note number
    const debitNoteNumber = await this.generateDebitNoteNumber(qcReport.tenantId);

    // Calculate debit note amounts
    const bardanaDeduction = qcReport.totals.bardana * 50; // ₹50/kg for bardana
    const avgRate = qcReport.totals.finalQuantity > 0 
      ? qcReport.totals.amount / qcReport.totals.finalQuantity 
      : 0;
    const rejectionAmount = qcReport.totals.rejection * avgRate;
    const qualityDifference = Math.abs(qcReport.totals.deliveryDifference);
    const grandTotal = -(qualityDifference + bardanaDeduction + rejectionAmount);

    // Create debit note
    const debitNote = this.debitNoteRepository.create({
      debitNoteNumber,
      qcReportId: qcReport.id,
      transactionId: qcReport.transactionId,
      vendorId: qcReport.transaction?.vendorId || '',
      tenantId: qcReport.tenantId,
      weightDifference: 0, // Would need PO data to calculate
      qualityDifference,
      bardanaDeduction,
      rejectionAmount,
      grandTotal,
      status: DebitNoteStatus.GENERATED,
    });

    const savedDebitNote = await this.debitNoteRepository.save(debitNote);

    // Update QC Report with debit note ID
    qcReport.debitNoteId = savedDebitNote.id;
    await this.qcReportRepository.save(qcReport);

    // Create audit log for debit note generation
    await this.auditService.logDebitNoteGeneration(
      userId || qcReport.approvedBy || 'system',
      savedDebitNote.id,
      qcReport.id,
      qcReport.transactionId,
      {
        debitNoteNumber: savedDebitNote.debitNoteNumber,
        qualityDifference: savedDebitNote.qualityDifference,
        bardanaDeduction: savedDebitNote.bardanaDeduction,
        rejectionAmount: savedDebitNote.rejectionAmount,
        grandTotal: savedDebitNote.grandTotal,
        status: savedDebitNote.status,
      },
    );

    return savedDebitNote;
  }

  /**
   * Generate unique debit note number for tenant
   */
  private async generateDebitNoteNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `DN-${year}`;

    // Get the latest debit note number for this tenant and year
    const latestNote = await this.debitNoteRepository
      .createQueryBuilder('dn')
      .where('dn.tenantId = :tenantId', { tenantId })
      .andWhere('dn.debitNoteNumber LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('dn.createdAt', 'DESC')
      .getOne();

    let sequence = 1;
    if (latestNote) {
      const match = latestNote.debitNoteNumber.match(/DN-\d{4}-(\d+)/);
      if (match) {
        sequence = parseInt(match[1], 10) + 1;
      }
    }

    return `${prefix}-${sequence.toString().padStart(4, '0')}`;
  }

  /**
   * Get all QC Reports for a tenant
   */
  async getQCReportsByTenant(tenantId: string, status?: QCReportStatus): Promise<QCReport[]> {
    const where: any = { tenantId };
    if (status) {
      where.status = status;
    }

    return this.qcReportRepository.find({
      where,
      relations: ['transaction'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get Debit Note by ID
   */
  async getDebitNoteById(id: string): Promise<DebitNote> {
    const debitNote = await this.debitNoteRepository.findOne({
      where: { id },
      relations: ['qcReport'],
    });

    if (!debitNote) {
      throw new NotFoundException(`Debit Note ${id} not found`);
    }

    return debitNote;
  }

  /**
   * Send QC Report to Vendor via Email/WhatsApp
   */
  async sendQCReportToVendor(
    qcReportId: string,
    sendMethod: 'EMAIL' | 'WHATSAPP' | 'BOTH',
    userId?: string,
  ): Promise<{ success: boolean; message: string; sentAt: Date }> {
    const qcReport = await this.qcReportRepository.findOne({
      where: { id: qcReportId },
      relations: ['transaction'],
    });

    if (!qcReport) {
      throw new NotFoundException(`QC Report ${qcReportId} not found`);
    }

    if (qcReport.status !== QCReportStatus.APPROVED) {
      throw new BadRequestException('Only approved QC Reports can be sent to vendors');
    }

    // Get vendor details
    const transaction = qcReport.transaction;
    if (!transaction?.vendorId) {
      throw new BadRequestException('No vendor associated with this QC Report');
    }

    // In a real implementation, this would:
    // 1. Generate PDF report
    // 2. Send via email/WhatsApp using notification service
    // For now, we'll simulate the send and log it

    const sentAt = new Date();
    
    // Create audit log for sending QC report
    await this.auditService.logQCReportSent(
      userId || 'system',
      qcReportId,
      qcReport.transactionId,
      {
        sendMethod,
        vendorId: transaction.vendorId,
        sentAt,
        debitNoteId: qcReport.debitNoteId,
      },
    );

    // Update debit note status to SENT if exists
    if (qcReport.debitNoteId) {
      await this.debitNoteRepository.update(
        { id: qcReport.debitNoteId },
        { status: DebitNoteStatus.SENT },
      );
    }

    return {
      success: true,
      message: `QC Report sent successfully via ${sendMethod}`,
      sentAt,
    };
  }
}
