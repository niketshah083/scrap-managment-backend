import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum NotificationType {
  INSPECTION_COMPLETE = 'inspection_complete',
  MATERIAL_REJECTED = 'material_rejected',
  GRN_GENERATED = 'grn_generated',
  WEIGHT_DEVIATION = 'weight_deviation',
  GATE_PASS_ISSUED = 'gate_pass_issued',
}

export enum NotificationChannel {
  WHATSAPP = 'whatsapp',
  EMAIL = 'email',
  SMS = 'sms',
}

@Entity('notification_templates')
export class NotificationTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @Column({
    type: 'enum',
    enum: NotificationType,
  })
  type: NotificationType;

  @Column({
    type: 'enum',
    enum: NotificationChannel,
  })
  channel: NotificationChannel;

  @Column()
  name: string;

  @Column()
  subject: string;

  @Column('text')
  template: string;

  @Column('json', { nullable: true })
  variables: Record<string, any>;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}