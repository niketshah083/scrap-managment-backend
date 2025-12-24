import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Body, 
  Param, 
  Query, 
  BadRequestException,
  ParseUUIDPipe,
  ParseIntPipe
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { WorkflowEngineService, LevelData } from './workflow-engine.service';
import { FieldConfigurationService, CreateFieldConfigDto } from './field-configuration.service';
import { OperationalLevel } from '../entities/transaction.entity';

@ApiTags('Workflow Management')
@Controller('workflow')
export class WorkflowController {
  constructor(
    private workflowEngine: WorkflowEngineService,
    private fieldConfigService: FieldConfigurationService
  ) {}

  @Get('levels')
  @ApiOperation({ summary: 'Get all workflow levels with their configurations and fields' })
  @ApiResponse({ status: 200, description: 'Returns all workflow levels with field configurations' })
  async getWorkflowLevels(@Query('tenantId') tenantId?: string) {
    // Default field configurations for each level
    const defaultLevelConfigs = [
      { 
        operationalLevel: 1, 
        levelName: 'Gate Entry', 
        description: 'Upload PO/Invoice and enter truck details',
        fields: [
          { fieldName: 'po_document', fieldLabel: 'PO Document', fieldType: 'FILE', captureType: 'CAMERA', validationType: 'REQUIRED', editability: 'EDITABLE', helpText: 'Upload PO document photo', minPhotoCount: 1, maxPhotoCount: 3, displayOrder: 1 },
          { fieldName: 'invoice_document', fieldLabel: 'Invoice Copy', fieldType: 'FILE', captureType: 'CAMERA', validationType: 'REQUIRED', editability: 'EDITABLE', helpText: 'Upload invoice photo', minPhotoCount: 1, maxPhotoCount: 3, displayOrder: 2 },
          { fieldName: 'truck_number', fieldLabel: 'Truck Number', fieldType: 'TEXT', captureType: 'MANUAL', validationType: 'REQUIRED', editability: 'EDITABLE', placeholder: 'MH12AB1234', helpText: 'Enter vehicle registration', displayOrder: 3 },
          { fieldName: 'driver_name', fieldLabel: 'Driver Name', fieldType: 'TEXT', captureType: 'MANUAL', validationType: 'REQUIRED', editability: 'EDITABLE', placeholder: 'Enter driver name', displayOrder: 4 },
          { fieldName: 'driver_mobile', fieldLabel: 'Driver Mobile', fieldType: 'TEXT', captureType: 'MANUAL', validationType: 'REQUIRED', editability: 'EDITABLE', placeholder: '+91 98765 43210', displayOrder: 5 }
        ]
      },
      { 
        operationalLevel: 2, 
        levelName: 'Initial Weighing', 
        description: 'Record loaded truck weight on weighbridge',
        fields: [
          { fieldName: 'gross_weight', fieldLabel: 'Gross Weight (KG)', fieldType: 'NUMBER', captureType: 'AUTO', validationType: 'REQUIRED', editability: 'EDITABLE', placeholder: 'Enter weight in KG', helpText: 'Loaded truck weight', displayOrder: 1 },
          { fieldName: 'weighbridge_photo', fieldLabel: 'Weighbridge Display', fieldType: 'FILE', captureType: 'CAMERA', validationType: 'REQUIRED', editability: 'EDITABLE', helpText: 'Photo of weighbridge display', minPhotoCount: 1, maxPhotoCount: 2, displayOrder: 2 }
        ]
      },
      { 
        operationalLevel: 3, 
        levelName: 'Unloading', 
        description: 'Capture driver photos, license & unloading process',
        fields: [
          { fieldName: 'driver_photo', fieldLabel: 'Driver Photo', fieldType: 'FILE', captureType: 'CAMERA', validationType: 'REQUIRED', editability: 'EDITABLE', helpText: 'Clear photo of driver', minPhotoCount: 1, maxPhotoCount: 1, displayOrder: 1 },
          { fieldName: 'driver_license', fieldLabel: 'Driver License', fieldType: 'FILE', captureType: 'CAMERA', validationType: 'REQUIRED', editability: 'EDITABLE', helpText: 'Photo of driving license', minPhotoCount: 1, maxPhotoCount: 2, displayOrder: 2 },
          { fieldName: 'unloading_photos', fieldLabel: 'Unloading Photos', fieldType: 'FILE', captureType: 'CAMERA', validationType: 'REQUIRED', editability: 'EDITABLE', helpText: 'Photos during unloading', minPhotoCount: 3, maxPhotoCount: 10, displayOrder: 3 },
          { fieldName: 'unloading_notes', fieldLabel: 'Notes', fieldType: 'TEXT', captureType: 'MANUAL', validationType: 'OPTIONAL', editability: 'EDITABLE', placeholder: 'Any observations...', displayOrder: 4 }
        ]
      },
      { 
        operationalLevel: 4, 
        levelName: 'Final Weighing', 
        description: 'Record empty weight and final material count',
        fields: [
          { fieldName: 'tare_weight', fieldLabel: 'Tare Weight (KG)', fieldType: 'NUMBER', captureType: 'AUTO', validationType: 'REQUIRED', editability: 'EDITABLE', placeholder: 'Empty truck weight', helpText: 'Weight after unloading', displayOrder: 1 },
          { fieldName: 'empty_weighbridge_photo', fieldLabel: 'Empty Weight Display', fieldType: 'FILE', captureType: 'CAMERA', validationType: 'REQUIRED', editability: 'EDITABLE', minPhotoCount: 1, maxPhotoCount: 2, displayOrder: 2 },
          { fieldName: 'material_count', fieldLabel: 'Material Count', fieldType: 'NUMBER', captureType: 'MANUAL', validationType: 'OPTIONAL', editability: 'EDITABLE', placeholder: 'Piece count if applicable', displayOrder: 3 }
        ]
      },
      { 
        operationalLevel: 5, 
        levelName: 'Supervisor Review', 
        description: 'Document verification and approval',
        fields: [
          { fieldName: 'review_notes', fieldLabel: 'Review Notes', fieldType: 'TEXT', captureType: 'MANUAL', validationType: 'REQUIRED', editability: 'EDITABLE', placeholder: 'Supervisor comments', displayOrder: 1 },
          { fieldName: 'verification_status', fieldLabel: 'Verification Status', fieldType: 'SELECT', captureType: 'MANUAL', validationType: 'REQUIRED', editability: 'EDITABLE', validationRules: { allowedValues: ['VERIFIED', 'NEEDS_CORRECTION', 'REJECTED'] }, displayOrder: 2 },
          { fieldName: 'approval_status', fieldLabel: 'Approval', fieldType: 'SELECT', captureType: 'MANUAL', validationType: 'REQUIRED', editability: 'EDITABLE', validationRules: { allowedValues: ['APPROVED', 'REJECTED', 'HOLD'] }, displayOrder: 3 }
        ]
      },
      { 
        operationalLevel: 6, 
        levelName: 'Gate Pass', 
        description: 'Generate exit gate pass with QR code',
        fields: [
          { fieldName: 'gate_pass_number', fieldLabel: 'Gate Pass Number', fieldType: 'TEXT', captureType: 'AUTO', validationType: 'REQUIRED', editability: 'EDITABLE', displayOrder: 1 },
          { fieldName: 'exit_time', fieldLabel: 'Exit Time', fieldType: 'DATE', captureType: 'AUTO', validationType: 'REQUIRED', editability: 'EDITABLE', displayOrder: 2 }
        ]
      },
      { 
        operationalLevel: 7, 
        levelName: 'Inspection Report', 
        description: 'Vendor quality inspection report',
        fields: [
          { fieldName: 'inspection_report', fieldLabel: 'Inspection Report', fieldType: 'FILE', captureType: 'MANUAL', validationType: 'REQUIRED', editability: 'EDITABLE', minPhotoCount: 1, maxPhotoCount: 5, displayOrder: 1 },
          { fieldName: 'quality_grade', fieldLabel: 'Quality Grade', fieldType: 'SELECT', captureType: 'MANUAL', validationType: 'REQUIRED', editability: 'EDITABLE', validationRules: { allowedValues: ['A', 'B', 'C', 'REJECT'] }, displayOrder: 2 }
        ]
      }
    ];

    // If tenantId is provided, try to get custom configurations from database
    if (tenantId) {
      try {
        const dbConfigs = await this.fieldConfigService.getFieldConfigurations(tenantId);
        
        if (dbConfigs && dbConfigs.length > 0) {
          // Group configurations by level
          const configsByLevel = new Map<number, any[]>();
          
          dbConfigs.forEach(config => {
            const level = config.operationalLevel;
            if (!configsByLevel.has(level)) {
              configsByLevel.set(level, []);
            }
            configsByLevel.get(level)!.push({
              fieldName: config.fieldName,
              fieldLabel: config.fieldLabel,
              fieldType: config.fieldType,
              captureType: config.captureType,
              validationType: config.validationType,
              editability: config.editability,
              minPhotoCount: config.minPhotoCount,
              maxPhotoCount: config.maxPhotoCount,
              validationRules: config.validationRules,
              helpText: config.helpText,
              placeholder: config.placeholder,
              displayOrder: config.displayOrder
            });
          });

          // Merge with defaults - use DB configs where available
          return defaultLevelConfigs.map(level => {
            const dbFields = configsByLevel.get(level.operationalLevel);
            return {
              ...level,
              fields: dbFields && dbFields.length > 0 ? dbFields : level.fields
            };
          });
        }
      } catch (error) {
        // Fall back to defaults if DB query fails
      }
    }
    
    return defaultLevelConfigs;
  }

  @Get('fields/:tenantId')
  @ApiOperation({ summary: 'Get field configurations for a tenant' })
  @ApiParam({ name: 'tenantId', description: 'Tenant UUID' })
  @ApiQuery({ name: 'level', description: 'Operational Level (1-7)', required: false })
  async getFieldConfigurations(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Query('level', new ParseIntPipe({ optional: true })) level?: number
  ) {
    const operationalLevel = level as OperationalLevel;
    return await this.fieldConfigService.getFieldConfigurations(tenantId, operationalLevel);
  }

  @Post('fields')
  @ApiOperation({ summary: 'Create a new field configuration' })
  @ApiResponse({ status: 201, description: 'Field configuration created successfully' })
  async createFieldConfiguration(@Body() dto: CreateFieldConfigDto) {
    return await this.fieldConfigService.createFieldConfiguration(dto);
  }

  @Put('fields/:configId')
  @ApiOperation({ summary: 'Update field configuration' })
  @ApiParam({ name: 'configId', description: 'Configuration UUID' })
  async updateFieldConfiguration(
    @Param('configId', ParseUUIDPipe) configId: string,
    @Body() dto: Partial<CreateFieldConfigDto>
  ) {
    return await this.fieldConfigService.updateFieldConfiguration({
      id: configId,
      ...dto
    });
  }

  @Put('fields/:configId/move/:newLevel')
  @ApiOperation({ summary: 'Move field to different operational level' })
  @ApiParam({ name: 'configId', description: 'Configuration UUID' })
  @ApiParam({ name: 'newLevel', description: 'New operational level (1-7)' })
  async moveFieldToLevel(
    @Param('configId', ParseUUIDPipe) configId: string,
    @Param('newLevel', ParseIntPipe) newLevel: number
  ) {
    if (newLevel < 1 || newLevel > 7) {
      throw new BadRequestException('Operational level must be between 1 and 7');
    }
    
    return await this.fieldConfigService.moveFieldToLevel(configId, newLevel as OperationalLevel);
  }

  @Post('transaction/:transactionId/validate-progression/:targetLevel')
  @ApiOperation({ summary: 'Validate if transaction can progress to target level' })
  @ApiParam({ name: 'transactionId', description: 'Transaction UUID' })
  @ApiParam({ name: 'targetLevel', description: 'Target operational level (1-7)' })
  async validateLevelProgression(
    @Param('transactionId', ParseUUIDPipe) transactionId: string,
    @Param('targetLevel', ParseIntPipe) targetLevel: number
  ) {
    if (targetLevel < 1 || targetLevel > 7) {
      throw new BadRequestException('Target level must be between 1 and 7');
    }

    return await this.workflowEngine.validateLevelProgression(
      transactionId, 
      targetLevel as OperationalLevel
    );
  }

  @Post('transaction/:transactionId/complete-level')
  @ApiOperation({ summary: 'Complete an operational level for a transaction' })
  @ApiParam({ name: 'transactionId', description: 'Transaction UUID' })
  async completeLevelData(
    @Param('transactionId', ParseUUIDPipe) transactionId: string,
    @Body() levelData: LevelData
  ) {
    return await this.workflowEngine.processLevelCompletion(transactionId, levelData);
  }

  @Get('configured-fields/:tenantId/:level')
  @ApiOperation({ summary: 'Get configured fields for specific tenant and level' })
  @ApiParam({ name: 'tenantId', description: 'Tenant UUID' })
  @ApiParam({ name: 'level', description: 'Operational level (1-7)' })
  async getConfiguredFields(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('level', ParseIntPipe) level: number
  ) {
    if (level < 1 || level > 7) {
      throw new BadRequestException('Level must be between 1 and 7');
    }

    return await this.workflowEngine.getConfiguredFields(tenantId, level as OperationalLevel);
  }

  @Get('configured-fields/:tenantId/:level/factory/:factoryId')
  @ApiOperation({ summary: 'Get configured fields with factory inheritance' })
  @ApiParam({ name: 'tenantId', description: 'Tenant UUID' })
  @ApiParam({ name: 'level', description: 'Operational level (1-7)' })
  @ApiParam({ name: 'factoryId', description: 'Factory UUID' })
  async getConfiguredFieldsWithInheritance(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('level', ParseIntPipe) level: number,
    @Param('factoryId', ParseUUIDPipe) factoryId: string
  ) {
    if (level < 1 || level > 7) {
      throw new BadRequestException('Level must be between 1 and 7');
    }

    const configs = await this.fieldConfigService.getFieldConfigurationsWithInheritance(
      tenantId,
      factoryId,
      level as OperationalLevel
    );

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
      conditionalLogic: config.conditionalLogic,
      isFactorySpecific: !!config.factoryId
    }));
  }

  @Post('tenant/:tenantId/initialize-default-config')
  @ApiOperation({ summary: 'Initialize default field configurations for a new tenant' })
  @ApiParam({ name: 'tenantId', description: 'Tenant UUID' })
  async initializeDefaultConfiguration(
    @Param('tenantId', ParseUUIDPipe) tenantId: string
  ) {
    const defaultConfigs = await this.fieldConfigService.getDefaultFieldConfigurations(tenantId);
    const results = [];

    for (const config of defaultConfigs) {
      try {
        const created = await this.fieldConfigService.createFieldConfiguration(config);
        results.push(created);
      } catch (error) {
        // Skip if already exists
        if (!error.message.includes('already exists')) {
          throw error;
        }
      }
    }

    return {
      message: 'Default configuration initialized',
      configurationsCreated: results.length,
      configurations: results
    };
  }

  @Post('factory/:factoryId/create-specific-config')
  @ApiOperation({ summary: 'Create factory-specific field configuration' })
  @ApiParam({ name: 'factoryId', description: 'Factory UUID' })
  async createFactorySpecificConfiguration(
    @Param('factoryId', ParseUUIDPipe) factoryId: string,
    @Body() dto: CreateFieldConfigDto
  ) {
    return await this.fieldConfigService.createFieldConfiguration({
      ...dto,
      factoryId
    });
  }
}