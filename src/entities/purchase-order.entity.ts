import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn, 
  ManyToOne, 
  JoinColumn,
  Index
} from 'typeorm';
import { Tenant } from './tenant.entity';
import { Vendor } from './vendor.entity';

export enum POStatus {
  PENDING = 'PENDING',
  PARTIAL = 'PARTIAL',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED'
}

@Entity('purchase_orders')
@Index(['tenantId', 'poNumber'], { unique: true })
@Index(['vendorId'])
@Index(['status'])
@Index(['tenantId', 'status'])
export class PurchaseOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  tenantId: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  poNumber: string;

  @Column({ type: 'uuid', nullable: false })
  vendorId: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  materialType: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  materialDescription: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: false })
  orderedQuantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  receivedQuantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: false })
  rate: number;

  @Column({ type: 'varchar', length: 20, default: 'KG' })
  unit: string;

  @Column({ 
    type: 'enum', 
    enum: POStatus, 
    default: POStatus.PENDING 
  })
  status: POStatus;

  @Column({ type: 'date', nullable: false })
  deliveryDate: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  createdBy: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'json', nullable: true })
  documents: {
    name: string;
    url: string;
    type: string;
    uploadedAt: Date;
    uploadedBy?: string;
  }[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Computed property for remaining quantity
  get remainingQuantity(): number {
    return Number(this.orderedQuantity) - Number(this.receivedQuantity);
  }

  // Computed property for total amount
  get totalAmount(): number {
    return Number(this.orderedQuantity) * Number(this.rate);
  }

  // Check if PO is expired
  get isExpired(): boolean {
    return new Date() > new Date(this.deliveryDate);
  }

  // Check if PO can accept more deliveries
  get canReceiveMore(): boolean {
    return this.status !== POStatus.COMPLETED && 
           this.status !== POStatus.CANCELLED &&
           this.remainingQuantity > 0;
  }

  // Relationships
  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @ManyToOne(() => Vendor, vendor => vendor.purchaseOrders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vendorId' })
  vendor: Vendor;
}
