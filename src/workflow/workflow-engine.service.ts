import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkflowConfiguration, FieldValidationType, FieldEditability } from '../entities/workflow-configuration.entity';
import { Transaction, OperationalLevel, TransactionStatus } from '../entities/transaction.entity';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface FieldConfiguration {
  fieldName: string;
  fieldLabel: string;
  fieldType: string;
  captureType: string;
  validationType: FieldValidationType;
  editability: FieldEditability;
  minPhotoCount: number;
  maxPhotoCount: number;
  validationRules: any;
  rolePermissions: any;
  displayOrder: number;
  helpText?: string;
  placeholder?: string;
  conditionalLogic?: any;
}

export interface LevelData {
  level: OperationalLevel;
  fieldValues: Record<string, any>;
  completedBy: string;
  completedAt: Date;
  evidenceIds: string[];
  validationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  notes?: string;
}

export interface ProcessingResult {
  success: boolean;
  transactionId: string;
  newLevel?: OperationalLevel;
  errors: string[];
  warnings: string[];
}

@Injectable()
export class WorkflowEngineService {
  constructor(
    @InjectRepository(WorkflowConfiguration)
    private workflowConfigRepo: Repository<WorkflowConfiguration>,
    @InjectRepository(Transaction)
    private transactionRepo: Repository<Transaction>,
  ) {}

  /**
   * Validates if a transaction can progress to the target level
   * Enforces sequential level progression (L1→L2→L3→L4→L5→L6→L7)
   */
  async validateLevelProgression(
    transactionId: string, 
    targetLevel: OperationalLevel
  ): Promise<ValidationResult> {
    const transaction = await this.transactionRepo.findOne({
      where: { id: transactionId }
    });

    if (!transaction) {
      return {
        isValid: false,
        errors: ['Transaction not found'],
        warnings: []
      };
    }

    // Check if transaction is locked
    if (transaction.isLocked) {
      return {
        isValid: false,
        errors: ['Transaction is locked and cannot be modified'],
        warnings: []
      };
    }

    // Check if transaction is completed or cancelled
    if (transaction.status === TransactionStatus.COMPLETED || 
        transaction.status === TransactionStatus.CANCELLED ||
        transaction.status === TransactionStatus.REJECTED) {
      return {
        isValid: false,
        errors: ['Transaction is already completed, cancelled, or rejected'],
        warnings: []
      };
    }

    const currentLevel = transaction.currentLevel;
    const expectedNextLevel = currentLevel + 1;

    // Validate sequential progression
    if (targetLevel !== expectedNextLevel) {
      return {
        isValid: false,
        errors: [
          `Invalid level progression. Current level: L${currentLevel}, ` +
          `Expected next level: L${expectedNextLevel}, ` +
          `Requested level: L${targetLevel}`
        ],
        warnings: []
      };
    }

    // Validate level bounds
    if (targetLevel < OperationalLevel.L1_VENDOR_DISPATCH || 
        targetLevel > OperationalLevel.L7_GATE_PASS_EXIT) {
      return {
        isValid: false,
        errors: [`Invalid operational level: L${targetLevel}. Must be between L1 and L7`],
        warnings: []
      };
    }

    // Additional safety guardrails
    const safetyValidation = await this.validateSafetyGuardrails(transaction, targetLevel);
    if (!safetyValidation.isValid) {
      return safetyValidation;
    }

    return {
      isValid: true,
      errors: [],
      warnings: []
    };
  }

  /**
   * Validates safety guardrails that cannot be configured
   */
  private async validateSafetyGuardrails(
    transaction: Transaction, 
    targetLevel: OperationalLevel
  ): Promise<ValidationResult> {
    const errors: string[] = [];

    // GRN cannot be generated without inspection (L6 requires L4 completion)
    if (targetLevel === OperationalLevel.L6_GRN_GENERATION) {
      const l4Data = transaction.levelData?.[OperationalLevel.L4_MATERIAL_INSPECTION];
      if (!l4Data || l4Data.validationStatus !== 'APPROVED') {
        errors.push('GRN cannot be generated without approved material inspection');
      }
    }

    // Gate pass cannot be generated without GRN (L7 requires L6 completion)
    if (targetLevel === OperationalLevel.L7_GATE_PASS_EXIT) {
      const l6Data = transaction.levelData?.[OperationalLevel.L6_GRN_GENERATION];
      if (!l6Data || l6Data.validationStatus !== 'APPROVED') {
        errors.push('Gate pass cannot be generated without approved GRN');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  /**
   * Gets configured fields for a specific tenant and operational level
   */
  async getConfiguredFields(
    tenantId: string, 
    level: OperationalLevel
  ): Promise<FieldConfiguration[]> {
    const configs = await this.workflowConfigRepo.find({
      where: {
        tenantId,
        operationalLevel: level,
        isActive: true,
        effectiveFrom: { $lte: new Date() } as any,
        effectiveTo: { $gte: new Date() } as any
      },
      order: {
        displayOrder: 'ASC'
      }
    });

    return configs.map(config => ({
      fieldName: config.fieldName,
      fieldLabel: config.fieldLabel,
      fieldType: config.fieldType,
      captureType: config.captureType,
      validationType: config.validationType,
      editability: config.editability,
      minPhotoCount: config.minPhotoCount,
      maxPhotoCount: config.maxPhotoCount,
      validationRules: config.validationRules,
      rolePermissions: config.rolePermissions,
      displayOrder: config.displayOrder,
      helpText: config.helpText,
      placeholder: config.placeholder,
      conditionalLogic: config.conditionalLogic
    }));
  }

  /**
   * Processes completion of an operational level
   */
  async processLevelCompletion(
    transactionId: string, 
    levelData: LevelData
  ): Promise<ProcessingResult> {
    const transaction = await this.transactionRepo.findOne({
      where: { id: transactionId }
    });

    if (!transaction) {
      return {
        success: false,
        transactionId,
        errors: ['Transaction not found'],
        warnings: []
      };
    }

    // Validate level progression
    const validation = await this.validateLevelProgression(transactionId, levelData.level);
    if (!validation.isValid) {
      return {
        success: false,
        transactionId,
        errors: validation.errors,
        warnings: validation.warnings
      };
    }

    // Validate field data against configuration
    const fieldValidation = await this.validateFieldData(
      transaction.tenantId, 
      levelData.level, 
      levelData.fieldValues
    );
    if (!fieldValidation.isValid) {
      return {
        success: false,
        transactionId,
        errors: fieldValidation.errors,
        warnings: fieldValidation.warnings
      };
    }

    // Update transaction with level data
    const updatedLevelData = {
      ...transaction.levelData,
      [levelData.level]: levelData
    };

    const newLevel = levelData.level === OperationalLevel.L7_GATE_PASS_EXIT 
      ? levelData.level 
      : (levelData.level + 1) as OperationalLevel;

    const updateData: Partial<Transaction> = {
      levelData: updatedLevelData,
      currentLevel: newLevel,
      updatedAt: new Date()
    };

    // Mark as completed if this is L7
    if (levelData.level === OperationalLevel.L7_GATE_PASS_EXIT) {
      updateData.status = TransactionStatus.COMPLETED;
      updateData.completedAt = new Date();
      updateData.isLocked = true;
    }

    await this.transactionRepo.update(transactionId, updateData);

    return {
      success: true,
      transactionId,
      newLevel: newLevel,
      errors: [],
      warnings: []
    };
  }

  /**
   * Validates field data against workflow configuration
   */
  private async validateFieldData(
    tenantId: string,
    level: OperationalLevel,
    fieldValues: Record<string, any>
  ): Promise<ValidationResult> {
    const configs = await this.getConfiguredFields(tenantId, level);
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const config of configs) {
      const value = fieldValues[config.fieldName];

      // Check required fields
      if (config.validationType === FieldValidationType.REQUIRED) {
        if (value === undefined || value === null || value === '') {
          errors.push(`Field '${config.fieldLabel}' is required`);
          continue;
        }
      }

      // Validate field-specific rules
      if (value !== undefined && value !== null && config.validationRules) {
        const fieldValidation = this.validateFieldRules(config, value);
        errors.push(...fieldValidation.errors);
        warnings.push(...fieldValidation.warnings);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validates individual field rules
   */
  private validateFieldRules(config: FieldConfiguration, value: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const rules = config.validationRules;

    if (!rules) {
      return { isValid: true, errors, warnings };
    }

    // String validations
    if (typeof value === 'string') {
      if (rules.minLength && value.length < rules.minLength) {
        errors.push(`${config.fieldLabel} must be at least ${rules.minLength} characters`);
      }
      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push(`${config.fieldLabel} must not exceed ${rules.maxLength} characters`);
      }
      if (rules.pattern && !new RegExp(rules.pattern).test(value)) {
        errors.push(`${config.fieldLabel} format is invalid`);
      }
    }

    // Number validations
    if (typeof value === 'number') {
      if (rules.minValue !== undefined && value < rules.minValue) {
        errors.push(`${config.fieldLabel} must be at least ${rules.minValue}`);
      }
      if (rules.maxValue !== undefined && value > rules.maxValue) {
        errors.push(`${config.fieldLabel} must not exceed ${rules.maxValue}`);
      }
    }

    // Allowed values validation
    if (rules.allowedValues && Array.isArray(rules.allowedValues)) {
      if (!rules.allowedValues.includes(value)) {
        errors.push(`${config.fieldLabel} must be one of: ${rules.allowedValues.join(', ')}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Checks if evidence fields can be disabled (they cannot for audit integrity)
   */
  async validateEvidenceFieldConfiguration(
    tenantId: string,
    level: OperationalLevel,
    fieldName: string
  ): Promise<boolean> {
    // Evidence fields that cannot be disabled
    const protectedEvidenceFields = [
      'photos',
      'documents',
      'timestamp',
      'gps_coordinates',
      'operator_signature',
      'inspector_signature'
    ];

    return !protectedEvidenceFields.includes(fieldName.toLowerCase());
  }
}