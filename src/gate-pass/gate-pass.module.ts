import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GatePassService } from './gate-pass.service';
import { GatePassController } from './gate-pass.controller';
import { Transaction } from '../entities/transaction.entity';
import { Vehicle } from '../entities/vehicle.entity';
import { AuditLog } from '../entities/audit-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, Vehicle, AuditLog])
  ],
  controllers: [GatePassController],
  providers: [GatePassService],
  exports: [GatePassService]
})
export class GatePassModule {}