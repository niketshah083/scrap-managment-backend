import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Factory } from './factory.entity';
import { User } from './user.entity';
import { Transaction } from './transaction.entity';
import { Vendor } from './vendor.entity';
import { Vehicle } from './vehicle.entity';

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  companyName: string;

  @Column({ type: 'varchar', length: 15, unique: true, nullable: false })
  gstNumber: string;

  @Column({ type: 'varchar', length: 10, unique: true, nullable: false })
  panNumber: string;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: false })
  email: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ type: 'varchar', length: 50, default: 'TRIAL' })
  subscriptionPlan: string; // TRIAL, BASIC, PREMIUM, ENTERPRISE

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relationships
  @OneToMany(() => Factory, factory => factory.tenant)
  factories: Factory[];

  @OneToMany(() => User, user => user.tenant)
  users: User[];

  @OneToMany(() => Transaction, transaction => transaction.tenant)
  transactions: Transaction[];

  @OneToMany(() => Vendor, vendor => vendor.tenant)
  vendors: Vendor[];

  @OneToMany(() => Vehicle, vehicle => vehicle.tenant)
  vehicles: Vehicle[];
}