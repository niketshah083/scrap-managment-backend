import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Tenant } from './tenant.entity';
import { Factory } from './factory.entity';
import { AuditLog } from './audit-log.entity';

export enum UserRole {
  SECURITY = 'Security',
  INSPECTOR = 'Inspector',
  SUPERVISOR = 'Supervisor',
  MANAGER = 'Manager',
  OWNER = 'Owner'
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  tenantId: string;

  @Column({ type: 'uuid', nullable: true })
  factoryId: string;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: false })
  email: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  passwordHash: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  name: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string;

  @Column({ 
    type: 'enum', 
    enum: UserRole, 
    default: UserRole.SECURITY 
  })
  role: UserRole;

  @Column({ type: 'json', nullable: true })
  permissions: {
    levels: number[]; // Which operational levels (1-7) user can access
    actions: string[]; // Specific actions user can perform
  };

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt: Date;

  @Column({ type: 'varchar', length: 45, nullable: true })
  lastLoginIp: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relationships
  @ManyToOne(() => Tenant, tenant => tenant.users)
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @ManyToOne(() => Factory, factory => factory.users)
  @JoinColumn({ name: 'factoryId' })
  factory: Factory;

  @OneToMany(() => AuditLog, auditLog => auditLog.user)
  auditLogs: AuditLog[];
}