import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InspectionService } from './inspection.service';
import { InspectionController } from './inspection.controller';
import { Transaction } from '../entities/transaction.entity';
import { Evidence } from '../entities/evidence.entity';
import { User } from '../entities/user.entity';
import { Vendor } from '../entities/vendor.entity';
import { EvidenceModule } from '../evidence/evidence.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, Evidence, User, Vendor]),
    EvidenceModule,
    NotificationModule,
  ],
  controllers: [InspectionController],
  providers: [InspectionService],
  exports: [InspectionService],
})
export class InspectionModule {}