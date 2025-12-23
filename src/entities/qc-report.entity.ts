import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToOne } from 'typeorm';
import { Transaction } from './transaction.entity';

export enum QCReportStatus {
  DRAFT = 'DRAFT',
  APPROVED = 'APPROVED'
}

export interface QCLineItem {
  id: number;
  date: string;
  scrapType: string;
  grossWeight: number;
  bardana: number;
  rejection: number;
  netWeight: number;
  expPercent: number;
  qualityDeductPercent: number;
  finalQuantity: number;
  rate: number;
  amount: number;
  deliveryRate: number;
  deliveryDifference: number;
}

export interface QCTotals {
  grossWeight: number;
  bardana: number;
  rejection: number;
  netWeight: number;
  finalQuantity: number;
  amount: number;
  deliveryDifference: number;
}

@Entity('qc_reports')
export class QCReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  transactionId: string;

  @Column({ type: 'uuid', nullable: false })
  tenantId: string;

  @Column({ type: 'json', nullable: false })
  lineItems: QCLineItem[];

  @Column({ type: 'json', nullable: false })
  totals: QCTotals;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  labTechnician: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  verifiedBy: string;

  @Column({
    type: 'enum',
    enum: QCReportStatus,
    default: QCReportStatus.DRAFT
  })
  status: QCReportStatus;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  approvedBy: string;

  @Column({ type: 'uuid', nullable: true })
  debitNoteId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relationships
  @ManyToOne(() => Transaction)
  @JoinColumn({ name: 'transactionId' })
  transaction: Transaction;
}
