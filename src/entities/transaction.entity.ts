import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Tenant } from './tenant.entity';
import { Factory } from './factory.entity';
import { Vendor } from './vendor.entity';
import { Vehicle } from './vehicle.entity';
import { Evidence } from './evidence.entity';
import { AuditLog } from './audit-log.entity';
import { PurchaseOrder } from './purchase-order.entity';

export enum TransactionStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED'
}

export enum OperationalLevel {
  L1_VENDOR_DISPATCH = 1,
  L2_GATE_ENTRY = 2,
  L3_WEIGHBRIDGE_GROSS = 3,
  L4_MATERIAL_INSPECTION = 4,
  L5_WEIGHBRIDGE_TARE = 5,
  L6_GRN_GENERATION = 6,
  L7_GATE_PASS_EXIT = 7
}

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  tenantId: string;

  @Column({ type: 'uuid', nullable: false })
  factoryId: string;

  @Column({ type: 'uuid', nullable: false })
  vendorId: string;

  @Column({ type: 'uuid', nullable: false })
  vehicleId: string;

  @Column({ type: 'varchar', length: 50, unique: true, nullable: false })
  transactionNumber: string; // Auto-generated unique transaction number

  @Column({ 
    type: 'int', 
    default: OperationalLevel.L1_VENDOR_DISPATCH 
  })
  currentLevel: OperationalLevel;

  @Column({ 
    type: 'enum', 
    enum: TransactionStatus, 
    default: TransactionStatus.ACTIVE 
  })
  status: TransactionStatus;

  @Column({ type: 'json', nullable: true })
  levelData: {
    [key: number]: {
      level: OperationalLevel;
      fieldValues: Record<string, any>;
      completedBy: string; // User ID
      completedAt: Date;
      evidenceIds: string[];
      validationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
      notes?: string;
    };
  };

  @Column({ type: 'json', nullable: true })
  weighbridgeData: {
    grossWeight?: number;
    tareWeight?: number;
    netWeight?: number;
    grossWeightTimestamp?: Date;
    tareWeightTimestamp?: Date;
    grossWeightOperator?: string;
    tareWeightOperator?: string;
    weighbridgeTicketUrl?: string;
  };

  @Column({ type: 'json', nullable: true })
  inspectionData: {
    grade?: string; // A, B, C, REJECTED
    contaminationLevel?: number; // Percentage
    moistureLevel?: number; // Percentage
    inspectorId?: string;
    inspectionTimestamp?: Date;
    inspectionReportUrl?: string;
    rejectionReason?: string;
    qualityNotes?: string;
  };

  @Column({ type: 'varchar', length: 500, nullable: true })
  grnDocumentUrl: string; // S3 URL for generated GRN PDF

  @Column({ type: 'varchar', length: 500, nullable: true })
  gatePassQrCode: string; // QR code data for gate pass

  @Column({ type: 'timestamp', nullable: true })
  gatePassExpiresAt: Date;

  @Column({ type: 'boolean', default: false })
  isLocked: boolean; // Locked after completion to prevent modifications

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  // PO-based GRN fields
  @Column({ type: 'uuid', nullable: true })
  purchaseOrderId: string;

  @Column({ type: 'json', nullable: true })
  stepData: {
    [stepNumber: number]: {
      stepNumber: number;
      data: Record<string, any>;
      files: Record<string, { name: string; url: string; type: string }[]>;
      timestamp: Date;
      userId: string;
    };
  };

  @Column({ type: 'boolean', default: false })
  requiresSupervisorApproval: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  approvalReason: string;

  // QC Status fields
  @Column({ type: 'varchar', length: 20, nullable: true })
  qcStatus: 'PENDING' | 'COMPLETED' | null;

  @Column({ type: 'uuid', nullable: true })
  qcReportId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relationships
  @ManyToOne(() => Tenant, tenant => tenant.transactions)
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @ManyToOne(() => Factory, factory => factory.transactions)
  @JoinColumn({ name: 'factoryId' })
  factory: Factory;

  @ManyToOne(() => Vendor)
  @JoinColumn({ name: 'vendorId' })
  vendor: Vendor;

  @ManyToOne(() => Vehicle, vehicle => vehicle.transactions)
  @JoinColumn({ name: 'vehicleId' })
  vehicle: Vehicle;

  @OneToMany(() => Evidence, evidence => evidence.transaction)
  evidence: Evidence[];

  @OneToMany(() => AuditLog, auditLog => auditLog.transaction)
  auditLogs: AuditLog[];

  @ManyToOne(() => PurchaseOrder, { nullable: true })
  @JoinColumn({ name: 'purchaseOrderId' })
  purchaseOrder: PurchaseOrder;
}