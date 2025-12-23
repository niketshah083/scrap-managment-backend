import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToOne } from 'typeorm';
import { QCReport } from './qc-report.entity';

export enum DebitNoteStatus {
  GENERATED = 'GENERATED',
  SENT = 'SENT',
  ACKNOWLEDGED = 'ACKNOWLEDGED'
}

@Entity('debit_notes')
export class DebitNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, unique: true, nullable: false })
  debitNoteNumber: string;

  @Column({ type: 'uuid', nullable: false })
  qcReportId: string;

  @Column({ type: 'uuid', nullable: false })
  transactionId: string;

  @Column({ type: 'uuid', nullable: false })
  vendorId: string;

  @Column({ type: 'uuid', nullable: false })
  tenantId: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  weightDifference: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  qualityDifference: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  bardanaDeduction: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  rejectionAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  grandTotal: number;

  @Column({
    type: 'enum',
    enum: DebitNoteStatus,
    default: DebitNoteStatus.GENERATED
  })
  status: DebitNoteStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relationships
  @OneToOne(() => QCReport)
  @JoinColumn({ name: 'qcReportId' })
  qcReport: QCReport;
}
