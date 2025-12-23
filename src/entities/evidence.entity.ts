import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Transaction } from './transaction.entity';
import { User } from './user.entity';

export enum EvidenceType {
  PHOTO = 'PHOTO',
  DOCUMENT = 'DOCUMENT',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
  GPS_LOCATION = 'GPS_LOCATION',
  TIMESTAMP = 'TIMESTAMP',
  WEIGHBRIDGE_TICKET = 'WEIGHBRIDGE_TICKET',
  INSPECTION_REPORT = 'INSPECTION_REPORT',
  GRN_DOCUMENT = 'GRN_DOCUMENT',
  GATE_PASS = 'GATE_PASS'
}

@Entity('evidence')
export class Evidence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  transactionId: string;

  @Column({ type: 'uuid', nullable: false })
  capturedBy: string; // User ID

  @Column({ type: 'int', nullable: false })
  operationalLevel: number; // L1-L7

  @Column({ 
    type: 'enum', 
    enum: EvidenceType, 
    nullable: false 
  })
  evidenceType: EvidenceType;

  @Column({ type: 'varchar', length: 500, nullable: false })
  filePath: string; // S3 URL or file path

  @Column({ type: 'varchar', length: 255, nullable: true })
  fileName: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  mimeType: string;

  @Column({ type: 'bigint', nullable: true })
  fileSize: number; // File size in bytes

  @Column({ type: 'json', nullable: true })
  metadata: {
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

  @Column({ type: 'varchar', length: 64, nullable: true })
  fileHash: string; // SHA-256 hash for integrity verification

  @Column({ type: 'boolean', default: false })
  isProcessed: boolean; // For OCR or other processing

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'json', nullable: true })
  tags: string[]; // Searchable tags

  @CreateDateColumn()
  capturedAt: Date;

  // Relationships
  @ManyToOne(() => Transaction, transaction => transaction.evidence)
  @JoinColumn({ name: 'transactionId' })
  transaction: Transaction;

  @ManyToOne(() => User, user => user.auditLogs)
  @JoinColumn({ name: 'capturedBy' })
  user: User;
}