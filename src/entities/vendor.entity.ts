import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Tenant } from './tenant.entity';
import { PurchaseOrder } from './purchase-order.entity';

@Entity('vendors')
export class Vendor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  tenantId: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  vendorName: string;

  @Column({ type: 'varchar', length: 15, nullable: false })
  gstNumber: string;

  @Column({ type: 'varchar', length: 10, nullable: false })
  panNumber: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  contactPersonName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  contactEmail: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  contactPhone: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  state: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  pincode: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  bankName: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  bankAccount: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  ifscCode: string;

  @Column({ type: 'decimal', precision: 2, scale: 1, default: 0 })
  rating: number;

  @Column({ type: 'json', nullable: true })
  scrapTypesSupplied: string[]; // Array of scrap material types

  @Column({ type: 'json', nullable: true })
  performanceMetrics: {
    rejectionPercentage: number;
    weightDeviationPercentage: number;
    inspectionFailureCount: number;
    totalTransactions: number;
    qualityScore: number;
    avgDeliveryTime: number;
    lastUpdated: Date;
  };

  @Column({ type: 'json', nullable: true })
  poSummary: {
    totalPOs: number;
    pendingPOs: number;
    completedPOs: number;
    totalValue: number;
    pendingValue: number;
  };

  @Column({ type: 'boolean', default: false })
  isBlacklisted: boolean;

  @Column({ type: 'text', nullable: true })
  blacklistReason: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relationships
  @ManyToOne(() => Tenant, tenant => tenant.vendors)
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @OneToMany(() => PurchaseOrder, po => po.vendor)
  purchaseOrders: PurchaseOrder[];
}