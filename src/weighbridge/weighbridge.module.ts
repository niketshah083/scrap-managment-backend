import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WeighbridgeService } from './weighbridge.service';
import { WeighbridgeController } from './weighbridge.controller';
import { Transaction } from '../entities/transaction.entity';
import { Evidence } from '../entities/evidence.entity';
import { AuditLog } from '../entities/audit-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, Evidence, AuditLog])
  ],
  controllers: [WeighbridgeController],
  providers: [WeighbridgeService],
  exports: [WeighbridgeService]
})
export class WeighbridgeModule {}