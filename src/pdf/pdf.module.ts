import { Module } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { PdfController } from './pdf.controller';
import { TransactionModule } from '../transaction/transaction.module';
import { PurchaseOrderModule } from '../purchase-order/purchase-order.module';

@Module({
  imports: [TransactionModule, PurchaseOrderModule],
  controllers: [PdfController],
  providers: [PdfService],
  exports: [PdfService],
})
export class PdfModule {}
