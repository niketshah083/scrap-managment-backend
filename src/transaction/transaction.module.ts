import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionController } from './transaction.controller';
import { TransactionService } from './transaction.service';
import { Transaction } from '../entities/transaction.entity';
import { PurchaseOrder } from '../entities/purchase-order.entity';
import { Vendor } from '../entities/vendor.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, PurchaseOrder, Vendor]),
  ],
  controllers: [TransactionController],
  providers: [TransactionService],
  exports: [TransactionService],
})
export class TransactionModule {}
