import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkflowConfiguration, FieldValidationType, FieldEditability, FieldCaptureType } from '../entities/workflow-configuration.entity';
import { OperationalLevel } from '../entities/transaction.entity';

export interface CreateFieldConfigDto {
  tenantId: string;
  factoryId?: string; // Optional: for factory-specific configurations
  operationalLevel: OperationalLevel;
  fieldName: string;
  fieldLabel: string;
  fieldType: string;
  captureType: FieldCaptureType;
  validationType: FieldValidationType;
  editability: FieldEditability;
  minPhotoCount?: number;
  maxPhotoCount?: number;
  validationRules?: any;
  rolePermissions?: any;
  displayOrder?: number;
  helpText?: string;
  placeholder?: string;
  conditionalLogic?: any;
}

export interface UpdateFieldConfigDto extends Partial<CreateFieldConfigDto> {
  id: string;
}

@Injectable()
export class FieldConfigurationService {
  constructor(
    @InjectRepository(WorkflowConfiguration)
    private configRepo: Repository<WorkflowConfiguration>,
  ) {}

  /**
   * Creates a new field configuration
   */
  async createFieldConfiguration(dto: CreateFieldConfigDto): Promise<WorkflowConfiguration> {
    // Validate that evidence fields cannot be disabled
    if (!await this.validateEvidenceFieldConfiguration(dto.fieldName)) {
      throw new BadRequestException(
        `Evidence field '${dto.fieldName}' cannot be disabled for audit integrity`
      );
    }

    // Check for existing configuration with same field name and level
    const whereCondition: any = {
      tenantId: dto.tenantId,
      operationalLevel: dto.operationalLevel,
      fieldName: dto.fieldName,
      isActive: true
    };

    // Include factoryId in uniqueness check if provided
    if (dto.factoryId) {
      whereCondition.factoryId = dto.factoryId;
    } else {
      whereCondition.factoryId = null; // Ensure we're checking for tenant-level configs
    }

    const existing = await this.configRepo.findOne({
      where: whereCondition
    });

    if (existing) {
      const scope = dto.factoryId ? `factory ${dto.factoryId}` : 'tenant';
      throw new BadRequestException(
        `Field configuration already exists for '${dto.fieldName}' at level L${dto.operationalLevel} for ${scope}`
      );
    }

    const config = this.configRepo.create({
      ...dto,
      effectiveFrom: new Date(),
      version: 1,
      isActive: true
    });

    return await this.configRepo.save(config);
  }

  /**
   * Updates an existing field configuration
   * Creates a new version to maintain immutability for existing transactions
   */
  async updateFieldConfiguration(dto: UpdateFieldConfigDto): Promise<WorkflowConfiguration> {
    const existing = await this.configRepo.findOne({
      where: { id: dto.id }
    });

    if (!existing) {
      throw new BadRequestException('Field configuration not found');
    }

    // Validate evidence field constraints
    if (dto.fieldName && !await this.validateEvidenceFieldConfiguration(dto.fieldName)) {
      throw new BadRequestException(
        `Evidence field '${dto.fieldName}' cannot be disabled for audit integrity`
      );
    }

    // Deactivate the current configuration
    await this.configRepo.update(existing.id, {
      isActive: false,
      effectiveTo: new Date()
    });

    // Create new version
    const newConfig = this.configRepo.create({
      ...existing,
      ...dto,
      id: undefined, // Let TypeORM generate new ID
      version: existing.version + 1,
      effectiveFrom: new Date(),
      effectiveTo: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    return await this.configRepo.save(newConfig);
  }

  /**
   * Gets field configurations for a tenant and level
   */
  async getFieldConfigurations(
    tenantId: string,
    operationalLevel?: OperationalLevel
  ): Promise<WorkflowConfiguration[]> {
    const where: any = {
      tenantId,
      isActive: true
    };

    if (operationalLevel !== undefined) {
      where.operationalLevel = operationalLevel;
    }

    return await this.configRepo.find({
      where,
      order: {
        operationalLevel: 'ASC',
        displayOrder: 'ASC'
      }
    });
  }

  /**
   * Gets field configurations with factory inheritance
   * Factory-specific configurations override tenant-level configurations
   */
  async getFieldConfigurationsWithInheritance(
    tenantId: string,
    factoryId?: string,
    operationalLevel?: OperationalLevel
  ): Promise<WorkflowConfiguration[]> {
    // First get tenant-level configurations
    const tenantConfigs = await this.getFieldConfigurations(tenantId, operationalLevel);
    
    // If no factory specified, return tenant configs
    if (!factoryId) {
      return tenantConfigs;
    }

    // Get factory-specific configurations
    const factoryWhere: any = {
      tenantId,
      factoryId, // This would require adding factoryId to WorkflowConfiguration entity
      isActive: true
    };

    if (operationalLevel !== undefined) {
      factoryWhere.operationalLevel = operationalLevel;
    }

    const factoryConfigs = await this.configRepo.find({
      where: factoryWhere,
      order: {
        operationalLevel: 'ASC',
        displayOrder: 'ASC'
      }
    });

    // Merge configurations: factory configs override tenant configs
    const configMap = new Map<string, WorkflowConfiguration>();
    
    // Add tenant configs first
    tenantConfigs.forEach(config => {
      const key = `${config.operationalLevel}-${config.fieldName}`;
      configMap.set(key, config);
    });

    // Override with factory configs
    factoryConfigs.forEach(config => {
      const key = `${config.operationalLevel}-${config.fieldName}`;
      configMap.set(key, config);
    });

    return Array.from(configMap.values()).sort((a, b) => {
      if (a.operationalLevel !== b.operationalLevel) {
        return a.operationalLevel - b.operationalLevel;
      }
      return a.displayOrder - b.displayOrder;
    });
  }

  /**
   * Moves a field from one level to another
   */
  async moveFieldToLevel(
    configId: string,
    newLevel: OperationalLevel
  ): Promise<WorkflowConfiguration> {
    const config = await this.configRepo.findOne({
      where: { id: configId }
    });

    if (!config) {
      throw new BadRequestException('Field configuration not found');
    }

    // Validate the move doesn't break workflow integrity
    await this.validateFieldMove(config, newLevel);

    return await this.updateFieldConfiguration({
      id: configId,
      operationalLevel: newLevel
    });
  }

  /**
   * Validates if a field can be moved to a different level
   */
  private async validateFieldMove(
    config: WorkflowConfiguration,
    newLevel: OperationalLevel
  ): Promise<void> {
    // Critical fields that cannot be moved from their designated levels
    const levelRestrictedFields = {
      [OperationalLevel.L1_VENDOR_DISPATCH]: ['vendor_details', 'po_number', 'invoice_number'],
      [OperationalLevel.L2_GATE_ENTRY]: ['vehicle_number', 'driver_details', 'entry_time'],
      [OperationalLevel.L3_WEIGHBRIDGE_GROSS]: ['gross_weight'],
      [OperationalLevel.L4_MATERIAL_INSPECTION]: ['inspection_grade', 'contamination_level'],
      [OperationalLevel.L5_WEIGHBRIDGE_TARE]: ['tare_weight', 'net_weight'],
      [OperationalLevel.L6_GRN_GENERATION]: ['grn_number'],
      [OperationalLevel.L7_GATE_PASS_EXIT]: ['gate_pass_qr', 'exit_time']
    };

    const restrictedFields = levelRestrictedFields[config.operationalLevel] || [];
    
    if (restrictedFields.includes(config.fieldName)) {
      throw new BadRequestException(
        `Field '${config.fieldName}' cannot be moved from level L${config.operationalLevel} ` +
        `as it is critical for that operational stage`
      );
    }

    // Check if the target level already has this field
    const existingAtTarget = await this.configRepo.findOne({
      where: {
        tenantId: config.tenantId,
        operationalLevel: newLevel,
        fieldName: config.fieldName,
        isActive: true
      }
    });

    if (existingAtTarget) {
      throw new BadRequestException(
        `Field '${config.fieldName}' already exists at level L${newLevel}`
      );
    }
  }

  /**
   * Validates evidence field configuration constraints
   */
  private async validateEvidenceFieldConfiguration(fieldName: string): Promise<boolean> {
    // Evidence fields that cannot be disabled for audit and legal integrity
    const protectedEvidenceFields = [
      'photos',
      'documents',
      'timestamp',
      'gps_coordinates',
      'operator_signature',
      'inspector_signature',
      'evidence_photos',
      'inspection_photos',
      'weight_slip_photo',
      'vehicle_photo'
    ];

    return !protectedEvidenceFields.includes(fieldName.toLowerCase());
  }

  /**
   * Gets default field configurations for a new tenant
   */
  async getDefaultFieldConfigurations(tenantId: string): Promise<CreateFieldConfigDto[]> {
    return [
      // L1 - Vendor Dispatch
      {
        tenantId,
        operationalLevel: OperationalLevel.L1_VENDOR_DISPATCH,
        fieldName: 'vendor_details',
        fieldLabel: 'Vendor Details',
        fieldType: 'TEXT',
        captureType: FieldCaptureType.OCR,
        validationType: FieldValidationType.REQUIRED,
        editability: FieldEditability.EDITABLE,
        displayOrder: 1
      },
      {
        tenantId,
        operationalLevel: OperationalLevel.L1_VENDOR_DISPATCH,
        fieldName: 'po_number',
        fieldLabel: 'PO Number',
        fieldType: 'TEXT',
        captureType: FieldCaptureType.OCR,
        validationType: FieldValidationType.REQUIRED,
        editability: FieldEditability.EDITABLE,
        displayOrder: 2
      },
      // L2 - Gate Entry
      {
        tenantId,
        operationalLevel: OperationalLevel.L2_GATE_ENTRY,
        fieldName: 'vehicle_number',
        fieldLabel: 'Vehicle Number',
        fieldType: 'TEXT',
        captureType: FieldCaptureType.CAMERA,
        validationType: FieldValidationType.REQUIRED,
        editability: FieldEditability.EDITABLE,
        displayOrder: 1
      },
      {
        tenantId,
        operationalLevel: OperationalLevel.L2_GATE_ENTRY,
        fieldName: 'driver_mobile',
        fieldLabel: 'Driver Mobile',
        fieldType: 'TEXT',
        captureType: FieldCaptureType.MANUAL,
        validationType: FieldValidationType.REQUIRED,
        editability: FieldEditability.EDITABLE,
        displayOrder: 2
      },
      // L3 - Weighbridge Gross
      {
        tenantId,
        operationalLevel: OperationalLevel.L3_WEIGHBRIDGE_GROSS,
        fieldName: 'gross_weight',
        fieldLabel: 'Gross Weight (KG)',
        fieldType: 'NUMBER',
        captureType: FieldCaptureType.AUTO,
        validationType: FieldValidationType.REQUIRED,
        editability: FieldEditability.READ_ONLY,
        displayOrder: 1
      },
      // L4 - Material Inspection
      {
        tenantId,
        operationalLevel: OperationalLevel.L4_MATERIAL_INSPECTION,
        fieldName: 'inspection_grade',
        fieldLabel: 'Material Grade',
        fieldType: 'SELECT',
        captureType: FieldCaptureType.MANUAL,
        validationType: FieldValidationType.REQUIRED,
        editability: FieldEditability.EDITABLE,
        displayOrder: 1,
        validationRules: {
          allowedValues: ['A', 'B', 'C', 'REJECTED']
        }
      },
      {
        tenantId,
        operationalLevel: OperationalLevel.L4_MATERIAL_INSPECTION,
        fieldName: 'inspection_photos',
        fieldLabel: 'Inspection Photos',
        fieldType: 'FILE',
        captureType: FieldCaptureType.CAMERA,
        validationType: FieldValidationType.REQUIRED,
        editability: FieldEditability.EDITABLE,
        minPhotoCount: 2,
        maxPhotoCount: 10,
        displayOrder: 2
      }
    ];
  }
}