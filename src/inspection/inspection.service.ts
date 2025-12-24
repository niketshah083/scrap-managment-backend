import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction, OperationalLevel, TransactionStatus } from '../entities/transaction.entity';
import { Evidence, EvidenceType } from '../entities/evidence.entity';
import { User } from '../entities/user.entity';
import { Vendor } from '../entities/vendor.entity';
import { EvidenceService } from '../evidence/evidence.service';
import { NotificationService } from '../notification/notification.service';
import * as PDFDocument from 'pdfkit';

export interface InspectionData {
  grade: 'A' | 'B' | 'C' | 'REJECTED';
  contaminationLevel: number; // Percentage 0-100
  moistureLevel?: number; // Percentage 0-100
  qualityNotes?: string;
  rejectionReason?: string;
  inspectorId: string;
  photos: {
    file: Buffer;
    fileName: string;
    mimeType: string;
    description?: string;
  }[];
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
}

export interface InspectionResult {
  transactionId: string;
  inspectionData: any;
  evidenceIds: string[];
  reportUrl?: string;
  isApproved: boolean;
}

@Injectable()
export class InspectionService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(Evidence)
    private evidenceRepository: Repository<Evidence>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Vendor)
    private vendorRepository: Repository<Vendor>,
    private evidenceService: EvidenceService,
    private notificationService: NotificationService,
  ) {}

  async conductInspection(
    transactionId: string,
    inspectionData: InspectionData,
    tenantId: string,
  ): Promise<InspectionResult> {
    // Verify transaction exists and belongs to tenant
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId, tenantId },
      relations: ['vendor', 'vehicle', 'factory'],
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found or access denied');
    }

    // Verify transaction is at the correct level (L4 - Material Inspection)
    if (transaction.currentLevel !== OperationalLevel.L4_MATERIAL_INSPECTION) {
      throw new BadRequestException(
        `Transaction must be at L4 Material Inspection level. Current level: L${transaction.currentLevel}`
      );
    }

    // Verify inspector exists and belongs to tenant
    const inspector = await this.userRepository.findOne({
      where: { id: inspectionData.inspectorId, tenantId },
    });

    if (!inspector) {
      throw new ForbiddenException('Inspector not authorized for this tenant');
    }

    // Validate inspection data
    this.validateInspectionData(inspectionData);

    // Store inspection photos as evidence
    const evidenceIds: string[] = [];
    for (const photo of inspectionData.photos) {
      const evidence = await this.evidenceService.createEvidence(
        {
          transactionId,
          operationalLevel: OperationalLevel.L4_MATERIAL_INSPECTION,
          evidenceType: EvidenceType.PHOTO,
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
        },
        inspectionData.inspectorId,
        tenantId,
      );
      evidenceIds.push(evidence.id);
    }

    // Generate inspection report PDF
    const reportBuffer = await this.generateInspectionReport(transaction, inspectionData, evidenceIds);
    
    // Store inspection report as evidence
    const reportEvidence = await this.evidenceService.createEvidence(
      {
        transactionId,
        operationalLevel: OperationalLevel.L4_MATERIAL_INSPECTION,
        evidenceType: EvidenceType.INSPECTION_REPORT,
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
      },
      inspectionData.inspectorId,
      tenantId,
    );

    evidenceIds.push(reportEvidence.id);

    // Update transaction with inspection data
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

    // Update level data
    const levelData = transaction.levelData || {};
    levelData[OperationalLevel.L4_MATERIAL_INSPECTION] = {
      level: OperationalLevel.L4_MATERIAL_INSPECTION,
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

    // Update transaction
    await this.transactionRepository.update(transactionId, {
      inspectionData: updatedInspectionData,
      levelData,
      currentLevel: isApproved ? OperationalLevel.L5_WEIGHBRIDGE_TARE : OperationalLevel.L4_MATERIAL_INSPECTION,
      status: isApproved ? TransactionStatus.ACTIVE : TransactionStatus.REJECTED,
    });

    // Update vendor performance metrics if rejected
    if (!isApproved) {
      await this.updateVendorPerformance(transaction.vendorId, false);
    }

    // Send notifications to vendor
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
          // Send inspection completion notification
          await this.notificationService.sendInspectionReport(
            tenantId,
            transactionId,
            vendor.contactEmail,
            notificationVariables,
          );
        } else {
          // Send rejection notification
          await this.notificationService.notifyRejection(
            tenantId,
            transactionId,
            vendor.contactEmail,
            inspectionData.rejectionReason || 'Material quality does not meet standards',
            notificationVariables,
          );
        }
      }
    } catch (notificationError) {
      // Notification error - don't fail the inspection
    }

    return {
      transactionId,
      inspectionData: updatedInspectionData,
      evidenceIds,
      reportUrl: reportEvidence.filePath,
      isApproved,
    };
  }

  async getInspectionData(transactionId: string, tenantId: string): Promise<any> {
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId, tenantId },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found or access denied');
    }

    return transaction.inspectionData;
  }

  async getInspectionEvidence(transactionId: string, tenantId: string): Promise<Evidence[]> {
    return await this.evidenceService.getEvidenceByLevel(
      transactionId,
      OperationalLevel.L4_MATERIAL_INSPECTION,
      tenantId,
    );
  }

  private validateInspectionData(inspectionData: InspectionData): void {
    // Validate grade
    if (!['A', 'B', 'C', 'REJECTED'].includes(inspectionData.grade)) {
      throw new BadRequestException('Invalid grade. Must be A, B, C, or REJECTED');
    }

    // Validate contamination level
    if (inspectionData.contaminationLevel < 0 || inspectionData.contaminationLevel > 100) {
      throw new BadRequestException('Contamination level must be between 0 and 100');
    }

    // Validate moisture level if provided
    if (inspectionData.moistureLevel !== undefined && 
        (inspectionData.moistureLevel < 0 || inspectionData.moistureLevel > 100)) {
      throw new BadRequestException('Moisture level must be between 0 and 100');
    }

    // Require rejection reason if grade is REJECTED
    if (inspectionData.grade === 'REJECTED' && !inspectionData.rejectionReason) {
      throw new BadRequestException('Rejection reason is required when grade is REJECTED');
    }

    // Require at least 2 photos for inspection
    if (!inspectionData.photos || inspectionData.photos.length < 2) {
      throw new BadRequestException('At least 2 photos are required for material inspection');
    }

    // Validate photo count (max 10 photos)
    if (inspectionData.photos.length > 10) {
      throw new BadRequestException('Maximum 10 photos allowed for inspection');
    }

    // Validate each photo
    inspectionData.photos.forEach((photo, index) => {
      if (!photo.file || photo.file.length === 0) {
        throw new BadRequestException(`Photo ${index + 1} file is required`);
      }
      if (!photo.fileName) {
        throw new BadRequestException(`Photo ${index + 1} filename is required`);
      }
      if (!photo.mimeType || !photo.mimeType.startsWith('image/')) {
        throw new BadRequestException(`Photo ${index + 1} must be an image file`);
      }
    });
  }

  private async generateInspectionReport(
    transaction: Transaction,
    inspectionData: InspectionData,
    evidenceIds: string[],
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument();
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        // Header
        doc.fontSize(20).text('Material Inspection Report', 50, 50);
        doc.fontSize(12).text(`Report Date: ${new Date().toLocaleDateString()}`, 50, 80);
        doc.text(`Transaction ID: ${transaction.id}`, 50, 100);
        doc.text(`Vehicle Number: ${transaction.vehicle?.vehicleNumber || 'N/A'}`, 50, 120);
        doc.text(`Vendor: ${transaction.vendor?.vendorName || 'N/A'}`, 50, 140);

        // Inspection Details
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

        // Evidence section
        doc.fontSize(16).text('Evidence', 50, 350);
        doc.fontSize(12).text(`Number of photos captured: ${inspectionData.photos.length}`, 50, 380);
        doc.text(`Evidence IDs: ${evidenceIds.join(', ')}`, 50, 400, { width: 500 });

        // Footer
        doc.fontSize(10).text(
          `Inspector ID: ${inspectionData.inspectorId}`,
          50,
          doc.page.height - 100
        );
        doc.text(
          `Generated on: ${new Date().toISOString()}`,
          50,
          doc.page.height - 80
        );
        doc.text(
          'This report is generated automatically by the Scrap Operations Platform',
          50,
          doc.page.height - 60
        );

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  private async updateVendorPerformance(vendorId: string, isApproved: boolean): Promise<void> {
    const vendor = await this.vendorRepository.findOne({
      where: { id: vendorId },
    });

    if (!vendor) {
      return; // Vendor not found, skip update
    }

    const currentMetrics = vendor.performanceMetrics || {
      rejectionPercentage: 0,
      weightDeviationPercentage: 0,
      inspectionFailureCount: 0,
      totalTransactions: 0,
      lastUpdated: new Date(),
    };

    // Update metrics
    currentMetrics.totalTransactions += 1;
    if (!isApproved) {
      currentMetrics.inspectionFailureCount += 1;
    }
    
    // Recalculate rejection percentage
    currentMetrics.rejectionPercentage = 
      (currentMetrics.inspectionFailureCount / currentMetrics.totalTransactions) * 100;
    
    currentMetrics.lastUpdated = new Date();

    await this.vendorRepository.update(vendorId, {
      performanceMetrics: currentMetrics,
    });
  }

  async validateInspectionRequirements(transactionId: string, tenantId: string): Promise<{
    canProceed: boolean;
    missingRequirements: string[];
  }> {
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId, tenantId },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found or access denied');
    }

    const missingRequirements: string[] = [];

    // Check if at correct level
    if (transaction.currentLevel !== OperationalLevel.L4_MATERIAL_INSPECTION) {
      missingRequirements.push(`Must be at L4 Material Inspection level (currently at L${transaction.currentLevel})`);
    }

    // Check if previous levels are completed
    if (!transaction.levelData?.[OperationalLevel.L3_WEIGHBRIDGE_GROSS]) {
      missingRequirements.push('L3 Weighbridge Gross must be completed first');
    }

    // Check if inspection is already completed
    if (transaction.levelData?.[OperationalLevel.L4_MATERIAL_INSPECTION]) {
      missingRequirements.push('Inspection already completed for this transaction');
    }

    return {
      canProceed: missingRequirements.length === 0,
      missingRequirements,
    };
  }

  async getInspectionConfiguration(tenantId: string): Promise<{
    requiredPhotos: { min: number; max: number };
    availableGrades: string[];
    contaminationThresholds: { [grade: string]: number };
    requiredFields: string[];
  }> {
    // In a real implementation, this would come from tenant configuration
    // For now, return default configuration
    return {
      requiredPhotos: { min: 2, max: 10 },
      availableGrades: ['A', 'B', 'C', 'REJECTED'],
      contaminationThresholds: {
        'A': 5,   // Grade A: <= 5% contamination
        'B': 15,  // Grade B: <= 15% contamination
        'C': 30,  // Grade C: <= 30% contamination
        'REJECTED': 100, // Rejected: > 30% contamination
      },
      requiredFields: ['grade', 'contaminationLevel', 'photos'],
    };
  }
}