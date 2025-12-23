import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowEngineService } from './workflow-engine.service';
import { FieldConfigurationService } from './field-configuration.service';
import { WorkflowController } from './workflow.controller';
import { WorkflowConfiguration } from '../entities/workflow-configuration.entity';
import { Transaction } from '../entities/transaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkflowConfiguration,
      Transaction
    ])
  ],
  providers: [
    WorkflowEngineService,
    FieldConfigurationService
  ],
  controllers: [
    WorkflowController
  ],
  exports: [
    WorkflowEngineService,
    FieldConfigurationService
  ]
})
export class WorkflowModule {}