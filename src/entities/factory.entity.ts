import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Tenant } from './tenant.entity';
import { Transaction } from './transaction.entity';
import { User } from './user.entity';
import { WorkflowConfiguration } from './workflow-configuration.entity';

@Entity('factories')
export class Factory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  tenantId: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  factoryName: string;

  @Column({ type: 'varchar', length: 10, nullable: false })
  factoryCode: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitude: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitude: number;

  @Column({ type: 'json', nullable: true })
  weighbridgeConfig: {
    isIntegrated: boolean;
    equipmentModel?: string;
    connectionType?: string; // SERIAL, TCP, USB
    connectionString?: string;
    discrepancyThreshold?: number; // Percentage threshold for weight discrepancies
  };

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relationships
  @ManyToOne(() => Tenant, tenant => tenant.factories)
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @OneToMany(() => Transaction, transaction => transaction.factory)
  transactions: Transaction[];

  @OneToMany(() => User, user => user.factory)
  users: User[];

  @OneToMany(() => WorkflowConfiguration, config => config.factory)
  workflowConfigurations: WorkflowConfiguration[];
}