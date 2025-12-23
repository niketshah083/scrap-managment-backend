import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { Transaction } from './transaction.entity';

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  LEVEL_COMPLETE = 'LEVEL_COMPLETE',
  EVIDENCE_CAPTURE = 'EVIDENCE_CAPTURE',
  APPROVAL = 'APPROVAL',
  REJECTION = 'REJECTION',
  CONFIGURATION_CHANGE = 'CONFIGURATION_CHANGE',
  EXPORT = 'EXPORT',
  PRINT = 'PRINT',
  WEIGHBRIDGE_GROSS_CAPTURED = 'WEIGHBRIDGE_GROSS_CAPTURED',
  WEIGHBRIDGE_TARE_CAPTURED = 'WEIGHBRIDGE_TARE_CAPTURED',
  WEIGHT_DISCREPANCY_FLAGGED = 'WEIGHT_DISCREPANCY_FLAGGED',
  GATE_PASS_GENERATED = 'GATE_PASS_GENERATED',
  VEHICLE_EXIT_COMPLETED = 'VEHICLE_EXIT_COMPLETED',
  VEHICLE_EXIT_SUPERVISOR_OVERRIDE = 'VEHICLE_EXIT_SUPERVISOR_OVERRIDE',
  SUPERVISOR_OVERRIDE_EXPIRED_GATE_PASS = 'SUPERVISOR_OVERRIDE_EXPIRED_GATE_PASS',
  // PO Actions
  PO_CREATED = 'PO_CREATED',
  PO_UPDATED = 'PO_UPDATED',
  PO_CANCELLED = 'PO_CANCELLED',
  PO_DOCUMENT_UPLOADED = 'PO_DOCUMENT_UPLOADED',
  // GRN/Transaction Actions
  GRN_STEP_SAVED = 'GRN_STEP_SAVED',
  GRN_COMPLETED = 'GRN_COMPLETED',
  TRANSACTION_CREATED = 'TRANSACTION_CREATED',
  // QC Actions
  QC_REPORT_CREATED = 'QC_REPORT_CREATED',
  QC_REPORT_UPDATED = 'QC_REPORT_UPDATED',
  QC_REPORT_APPROVED = 'QC_REPORT_APPROVED',
  QC_REPORT_SENT = 'QC_REPORT_SENT',
  DEBIT_NOTE_GENERATED = 'DEBIT_NOTE_GENERATED',
}

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  userId: string;

  @Column({ type: 'uuid', nullable: true })
  transactionId: string;

  @Column({ 
    type: 'enum', 
    enum: AuditAction, 
    nullable: false 
  })
  action: AuditAction;

  @Column({ type: 'varchar', length: 100, nullable: false })
  entityType: string; // Transaction, User, Vendor, etc.

  @Column({ type: 'uuid', nullable: true })
  entityId: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'json', nullable: true })
  oldValues: Record<string, any>; // Previous values for UPDATE actions

  @Column({ type: 'json', nullable: true })
  newValues: Record<string, any>; // New values for CREATE/UPDATE actions

  @Column({ type: 'json', nullable: true })
  metadata: {
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

  @Column({ type: 'boolean', default: false })
  isSensitive: boolean; // Mark sensitive operations

  @Column({ type: 'varchar', length: 50, nullable: true })
  severity: string; // LOW, MEDIUM, HIGH, CRITICAL

  @CreateDateColumn()
  timestamp: Date;

  // Relationships
  @ManyToOne(() => User, user => user.auditLogs)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Transaction, transaction => transaction.auditLogs)
  @JoinColumn({ name: 'transactionId' })
  transaction: Transaction;
}