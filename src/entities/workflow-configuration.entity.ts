import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Tenant } from './tenant.entity';
import { Factory } from './factory.entity';

export enum FieldCaptureType {
  MANUAL = 'MANUAL',
  OCR = 'OCR',
  CAMERA = 'CAMERA',
  AUTO = 'AUTO' // GPS, timestamp, etc.
}

export enum FieldValidationType {
  REQUIRED = 'REQUIRED',
  OPTIONAL = 'OPTIONAL'
}

export enum FieldEditability {
  EDITABLE = 'EDITABLE',
  READ_ONLY = 'READ_ONLY'
}

@Entity('workflow_configurations')
export class WorkflowConfiguration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  tenantId: string;

  @Column({ type: 'uuid', nullable: true })
  factoryId: string; // Optional: for factory-specific configurations

  @Column({ type: 'int', nullable: false })
  operationalLevel: number; // L1-L7

  @Column({ type: 'varchar', length: 100, nullable: false })
  fieldName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  fieldLabel: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  fieldType: string; // TEXT, NUMBER, DATE, BOOLEAN, SELECT, MULTI_SELECT, FILE

  @Column({ 
    type: 'enum', 
    enum: FieldCaptureType, 
    default: FieldCaptureType.MANUAL 
  })
  captureType: FieldCaptureType;

  @Column({ 
    type: 'enum', 
    enum: FieldValidationType, 
    default: FieldValidationType.REQUIRED 
  })
  validationType: FieldValidationType;

  @Column({ 
    type: 'enum', 
    enum: FieldEditability, 
    default: FieldEditability.EDITABLE 
  })
  editability: FieldEditability;

  @Column({ type: 'int', default: 0 })
  minPhotoCount: number;

  @Column({ type: 'int', default: 10 })
  maxPhotoCount: number;

  @Column({ type: 'json', nullable: true })
  validationRules: {
    minLength?: number;
    maxLength?: number;
    pattern?: string; // Regex pattern
    minValue?: number;
    maxValue?: number;
    allowedValues?: string[]; // For SELECT fields
    customValidation?: string; // Custom validation logic
  };

  @Column({ type: 'json', nullable: true })
  rolePermissions: {
    [key: string]: { // Role name
      canView: boolean;
      canEdit: boolean;
      canApprove: boolean;
    };
  };

  @Column({ type: 'int', default: 0 })
  displayOrder: number; // Order of fields in UI

  @Column({ type: 'varchar', length: 255, nullable: true })
  helpText: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  placeholder: string;

  @Column({ type: 'json', nullable: true })
  conditionalLogic: {
    showIf?: {
      fieldName: string;
      operator: string; // EQUALS, NOT_EQUALS, CONTAINS, etc.
      value: any;
    };
    requiredIf?: {
      fieldName: string;
      operator: string;
      value: any;
    };
  };

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ type: 'timestamp', nullable: false })
  effectiveFrom: Date;

  @Column({ type: 'timestamp', nullable: true })
  effectiveTo: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relationships
  @ManyToOne(() => Tenant, tenant => tenant.factories)
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @ManyToOne(() => Factory, factory => factory.workflowConfigurations, { nullable: true })
  @JoinColumn({ name: 'factoryId' })
  factory: Factory;
}