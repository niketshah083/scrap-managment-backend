import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Tenant } from './tenant.entity';
import { Transaction } from './transaction.entity';

@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  tenantId: string;

  @Column({ type: 'varchar', length: 20, unique: true, nullable: false })
  vehicleNumber: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  driverName: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  driverMobile: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  driverPhotoUrl: string; // S3 URL for driver photo

  @Column({ type: 'varchar', length: 50, nullable: true })
  vehicleType: string; // TRUCK, TRAILER, MINI_TRUCK, etc.

  @Column({ type: 'json', nullable: true })
  visitHistory: Array<{
    transactionId: string;
    visitDate: Date;
    factoryId: string;
    status: string; // COMPLETED, REJECTED, PARTIAL
  }>;

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
  @ManyToOne(() => Tenant, tenant => tenant.vehicles)
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @OneToMany(() => Transaction, transaction => transaction.vehicle)
  transactions: Transaction[];
}