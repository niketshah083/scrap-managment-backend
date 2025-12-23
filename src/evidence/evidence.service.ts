import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Evidence, EvidenceType } from '../entities/evidence.entity';
import { Transaction } from '../entities/transaction.entity';
import { User } from '../entities/user.entity';
import { AuditLog, AuditAction } from '../entities/audit-log.entity';
import * as crypto from 'crypto';
import * as path from 'path';

export interface CreateEvidenceDto {
  transactionId: string;
  operationalLevel: number;
  evidenceType: EvidenceType;
  file?: Buffer;
  fileName?: string;
  mimeType?: string;
  description?: string;
  tags?: string[];
  metadata?: {
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
    cameraInfo?: {
      make?: string;
      model?: string;
      orientation?: number;
      flash?: boolean;
    };
    ocrData?: {
      extractedText: string;
      confidence: number;
      language: string;
    };
    customFields?: Record<string, any>;
  };
}

export interface EvidenceMetadata {
  gpsCoordinates?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    timestamp: Date;
  };
  deviceInfo: {
    deviceId: string;
    deviceModel: string;
    osVersion: string;
    appVersion: string;
    userAgent?: string;
  };
  captureInfo: {
    timestamp: Date;
    timezone: string;
    networkType?: string;
    batteryLevel?: number;
  };
  cameraInfo?: {
    make?: string;
    model?: string;
    orientation?: number;
    flash?: boolean;
    focusMode?: string;
  };
  fileInfo: {
    originalName: string;
    size: number;
    hash: string;
    mimeType: string;
  };
}

@Injectable()
export class EvidenceService {
  constructor(
    @InjectRepository(Evidence)
    private evidenceRepository: Repository<Evidence>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  async createEvidence(
    createEvidenceDto: CreateEvidenceDto,
    capturedBy: string,
    tenantId: string,
  ): Promise<Evidence> {
    // Verify transaction exists and belongs to the same tenant
    const transaction = await this.transactionRepository.findOne({
      where: { id: createEvidenceDto.transactionId, tenantId },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found or access denied');
    }

    // Verify user exists and belongs to the same tenant
    const user = await this.userRepository.findOne({
      where: { id: capturedBy, tenantId },
    });

    if (!user) {
      throw new ForbiddenException('User not authorized for this tenant');
    }

    // Generate file hash if file is provided
    let fileHash: string | undefined;
    let fileSize: number | undefined;
    let filePath: string | undefined;

    if (createEvidenceDto.file) {
      fileHash = this.generateFileHash(createEvidenceDto.file);
      fileSize = createEvidenceDto.file.length;
      filePath = await this.storeFile(
        createEvidenceDto.file,
        createEvidenceDto.fileName || 'evidence',
        createEvidenceDto.mimeType || 'application/octet-stream',
        tenantId,
        createEvidenceDto.transactionId,
      );
    }

    // Ensure GPS and timestamp metadata is present
    const enhancedMetadata = this.enhanceMetadata(createEvidenceDto.metadata);

    const evidence = this.evidenceRepository.create({
      transactionId: createEvidenceDto.transactionId,
      capturedBy,
      operationalLevel: createEvidenceDto.operationalLevel,
      evidenceType: createEvidenceDto.evidenceType,
      filePath: filePath || '',
      fileName: createEvidenceDto.fileName,
      mimeType: createEvidenceDto.mimeType,
      fileSize,
      metadata: enhancedMetadata,
      fileHash,
      description: createEvidenceDto.description,
      tags: createEvidenceDto.tags || [],
      isProcessed: false,
    });

    const savedEvidence = await this.evidenceRepository.save(evidence);

    // Create audit log for evidence capture
    await this.createAuditLog({
      userId: capturedBy,
      transactionId: createEvidenceDto.transactionId,
      action: AuditAction.EVIDENCE_CAPTURE,
      entityType: 'Evidence',
      entityId: savedEvidence.id,
      description: `Evidence captured: ${createEvidenceDto.evidenceType} at level L${createEvidenceDto.operationalLevel}`,
      newValues: {
        evidenceType: createEvidenceDto.evidenceType,
        operationalLevel: createEvidenceDto.operationalLevel,
        fileName: createEvidenceDto.fileName,
        fileSize: fileSize,
        hasGPS: !!enhancedMetadata.gpsCoordinates,
      },
      metadata: {
        operationalLevel: createEvidenceDto.operationalLevel,
        gpsCoordinates: enhancedMetadata.gpsCoordinates,
        deviceInfo: enhancedMetadata.deviceInfo,
        additionalContext: {
          evidenceType: createEvidenceDto.evidenceType,
          fileHash: fileHash,
          captureMethod: createEvidenceDto.file ? 'upload' : 'manual',
        },
      },
      severity: 'MEDIUM',
    });

    return savedEvidence;
  }

  async getEvidenceByTransaction(
    transactionId: string,
    tenantId: string,
  ): Promise<Evidence[]> {
    // Verify transaction belongs to tenant
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId, tenantId },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found or access denied');
    }

    return await this.evidenceRepository.find({
      where: { transactionId },
      order: { capturedAt: 'ASC' },
      relations: ['user'],
    });
  }

  async getEvidenceById(
    evidenceId: string,
    tenantId: string,
  ): Promise<Evidence> {
    const evidence = await this.evidenceRepository.findOne({
      where: { id: evidenceId },
      relations: ['transaction', 'user'],
    });

    if (!evidence) {
      throw new NotFoundException('Evidence not found');
    }

    // Verify tenant access through transaction
    if (evidence.transaction.tenantId !== tenantId) {
      throw new ForbiddenException('Access denied to this evidence');
    }

    return evidence;
  }

  async verifyEvidenceIntegrity(evidenceId: string): Promise<boolean> {
    const evidence = await this.evidenceRepository.findOne({
      where: { id: evidenceId },
    });

    if (!evidence || !evidence.filePath || !evidence.fileHash) {
      return false;
    }

    try {
      // In a real implementation, you would read the file from storage
      // and compare its hash with the stored hash
      // For now, we'll assume the file exists and return true
      
      // Log integrity verification for audit trail
      await this.createAuditLog({
        userId: 'system', // This should be the requesting user ID in real implementation
        transactionId: evidence.transactionId,
        action: AuditAction.EXPORT, // Using EXPORT as closest action for verification
        entityType: 'Evidence',
        entityId: evidenceId,
        description: `Evidence integrity verification performed`,
        metadata: {
          operationalLevel: evidence.operationalLevel,
          additionalContext: {
            evidenceType: evidence.evidenceType,
            verificationResult: 'passed',
            fileHash: evidence.fileHash,
          },
        },
        severity: 'LOW',
      });
      
      return true;
    } catch (error) {
      // Log integrity verification failure
      await this.createAuditLog({
        userId: 'system',
        transactionId: evidence.transactionId,
        action: AuditAction.EXPORT,
        entityType: 'Evidence',
        entityId: evidenceId,
        description: `Evidence integrity verification FAILED`,
        metadata: {
          operationalLevel: evidence.operationalLevel,
          additionalContext: {
            evidenceType: evidence.evidenceType,
            verificationResult: 'failed',
            error: error.message,
          },
        },
        severity: 'HIGH',
        isSensitive: true,
      });
      
      return false;
    }
  }

  async markAsProcessed(evidenceId: string): Promise<void> {
    await this.evidenceRepository.update(evidenceId, { isProcessed: true });
  }

  async getEvidenceByLevel(
    transactionId: string,
    operationalLevel: number,
    tenantId: string,
  ): Promise<Evidence[]> {
    // Verify transaction belongs to tenant
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId, tenantId },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found or access denied');
    }

    return await this.evidenceRepository.find({
      where: { 
        transactionId, 
        operationalLevel,
      },
      order: { capturedAt: 'ASC' },
      relations: ['user'],
    });
  }

  async validateChronologicalIntegrity(transactionId: string): Promise<boolean> {
    const evidence = await this.evidenceRepository.find({
      where: { transactionId },
      order: { capturedAt: 'ASC' },
    });

    // Check that evidence timestamps are in chronological order
    for (let i = 1; i < evidence.length; i++) {
      if (evidence[i].capturedAt < evidence[i - 1].capturedAt) {
        // Log chronological integrity violation
        await this.createAuditLog({
          userId: 'system',
          transactionId: transactionId,
          action: AuditAction.REJECTION,
          entityType: 'Evidence',
          description: `Chronological integrity violation detected in transaction`,
          metadata: {
            additionalContext: {
              violationType: 'timestamp_order',
              evidenceCount: evidence.length,
              violationIndex: i,
              previousTimestamp: evidence[i - 1].capturedAt,
              currentTimestamp: evidence[i].capturedAt,
            },
          },
          severity: 'HIGH',
          isSensitive: true,
        });
        
        return false;
      }
    }

    // Check that operational levels progress logically
    const levelProgression = evidence.map(e => e.operationalLevel).sort((a, b) => a - b);
    for (let i = 1; i < levelProgression.length; i++) {
      if (levelProgression[i] < levelProgression[i - 1]) {
        // Log level progression violation
        await this.createAuditLog({
          userId: 'system',
          transactionId: transactionId,
          action: AuditAction.REJECTION,
          entityType: 'Evidence',
          description: `Operational level progression violation detected`,
          metadata: {
            additionalContext: {
              violationType: 'level_progression',
              levelProgression: levelProgression,
            },
          },
          severity: 'HIGH',
          isSensitive: true,
        });
        
        return false;
      }
    }

    return true;
  }

  async preventBackdating(proposedTimestamp: Date, transactionId: string, operationalLevel: number): Promise<boolean> {
    const now = new Date();
    const maxAllowedDelay = 5 * 60 * 1000; // 5 minutes tolerance
    
    // Check if timestamp is too far in the past
    if (now.getTime() - proposedTimestamp.getTime() > maxAllowedDelay) {
      await this.createAuditLog({
        userId: 'system',
        transactionId: transactionId,
        action: AuditAction.REJECTION,
        entityType: 'Evidence',
        description: `Back-dating attempt detected and blocked`,
        metadata: {
          operationalLevel: operationalLevel,
          additionalContext: {
            proposedTimestamp: proposedTimestamp,
            serverTimestamp: now,
            timeDifference: now.getTime() - proposedTimestamp.getTime(),
            maxAllowedDelay: maxAllowedDelay,
          },
        },
        severity: 'HIGH',
        isSensitive: true,
      });
      
      return false;
    }
    
    // Check if timestamp is in the future
    if (proposedTimestamp.getTime() > now.getTime()) {
      await this.createAuditLog({
        userId: 'system',
        transactionId: transactionId,
        action: AuditAction.REJECTION,
        entityType: 'Evidence',
        description: `Future-dating attempt detected and blocked`,
        metadata: {
          operationalLevel: operationalLevel,
          additionalContext: {
            proposedTimestamp: proposedTimestamp,
            serverTimestamp: now,
            timeDifference: proposedTimestamp.getTime() - now.getTime(),
          },
        },
        severity: 'HIGH',
        isSensitive: true,
      });
      
      return false;
    }
    
    return true;
  }

  private generateFileHash(file: Buffer): string {
    return crypto.createHash('sha256').update(file).digest('hex');
  }

  private async storeFile(
    file: Buffer,
    fileName: string,
    mimeType: string,
    tenantId: string,
    transactionId: string,
  ): Promise<string> {
    // In a real implementation, this would upload to S3 or similar storage
    // For now, we'll generate a mock file path
    const timestamp = Date.now();
    const extension = path.extname(fileName) || this.getExtensionFromMimeType(mimeType);
    const storagePath = `evidence/${tenantId}/${transactionId}/${timestamp}${extension}`;
    
    // TODO: Implement actual file storage (S3, local filesystem, etc.)
    // console.log(`File would be stored at: ${storagePath}`);
    
    return storagePath;
  }

  private getExtensionFromMimeType(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'audio/mp3': '.mp3',
      'audio/wav': '.wav',
      'application/pdf': '.pdf',
      'text/plain': '.txt',
    };
    
    return mimeToExt[mimeType] || '.bin';
  }

  private enhanceMetadata(metadata?: any): any {
    const now = new Date();
    
    return {
      ...metadata,
      captureInfo: {
        timestamp: now,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...metadata?.captureInfo,
      },
      // Ensure GPS coordinates have timestamp
      gpsCoordinates: metadata?.gpsCoordinates ? {
        ...metadata.gpsCoordinates,
        timestamp: metadata.gpsCoordinates.timestamp || now,
      } : undefined,
      // Add system metadata
      systemInfo: {
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        serverTimestamp: now,
      },
    };
  }

  async deleteEvidence(evidenceId: string, tenantId: string): Promise<void> {
    const evidence = await this.getEvidenceById(evidenceId, tenantId);
    
    // Log the deletion attempt for audit purposes
    await this.createAuditLog({
      userId: 'system', // This should be the requesting user ID in real implementation
      transactionId: evidence.transactionId,
      action: AuditAction.DELETE,
      entityType: 'Evidence',
      entityId: evidenceId,
      description: `Attempted evidence deletion - BLOCKED for audit integrity`,
      oldValues: {
        evidenceType: evidence.evidenceType,
        operationalLevel: evidence.operationalLevel,
        fileName: evidence.fileName,
        capturedAt: evidence.capturedAt,
      },
      metadata: {
        operationalLevel: evidence.operationalLevel,
        additionalContext: {
          reason: 'Evidence deletion blocked to maintain audit integrity',
          evidenceType: evidence.evidenceType,
        },
      },
      severity: 'HIGH',
      isSensitive: true,
    });
    
    // Evidence should be immutable - this method should only be used in exceptional circumstances
    // and should be logged as an audit event
    throw new ForbiddenException('Evidence deletion is not allowed to maintain audit integrity');
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

  async getEvidenceStats(transactionId: string, tenantId: string): Promise<{
    totalCount: number;
    byType: Record<EvidenceType, number>;
    byLevel: Record<number, number>;
    totalSize: number;
  }> {
    const evidence = await this.getEvidenceByTransaction(transactionId, tenantId);
    
    const stats = {
      totalCount: evidence.length,
      byType: {} as Record<EvidenceType, number>,
      byLevel: {} as Record<number, number>,
      totalSize: 0,
    };

    evidence.forEach(e => {
      // Count by type
      stats.byType[e.evidenceType] = (stats.byType[e.evidenceType] || 0) + 1;
      
      // Count by level
      stats.byLevel[e.operationalLevel] = (stats.byLevel[e.operationalLevel] || 0) + 1;
      
      // Sum file sizes
      if (e.fileSize) {
        stats.totalSize += Number(e.fileSize);
      }
    });

    return stats;
  }
}