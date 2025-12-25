import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MulterModule } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { TransactionController } from "./transaction.controller";
import { TransactionService } from "./transaction.service";
import { FileUploadController } from "./file-upload.controller";
import { FileUploadService } from "./file-upload.service";
import { Transaction } from "../entities/transaction.entity";
import { PurchaseOrder } from "../entities/purchase-order.entity";
import { Vendor } from "../entities/vendor.entity";
import { PdfModule } from "../pdf/pdf.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, PurchaseOrder, Vendor]),
    forwardRef(() => PdfModule),
    MulterModule.register({
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max file size
      },
    }),
  ],
  controllers: [TransactionController, FileUploadController],
  providers: [TransactionService, FileUploadService],
  exports: [TransactionService, FileUploadService],
})
export class TransactionModule {}
