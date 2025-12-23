import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { VendorModule } from '../vendor/vendor.module';
import { Transaction } from '../entities/transaction.entity';
import { Vendor } from '../entities/vendor.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, Vendor]),
    VendorModule,
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}