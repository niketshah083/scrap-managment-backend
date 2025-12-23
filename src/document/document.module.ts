import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentProcessingService } from './document-processing.service';
import { DocumentController } from './document.controller';
import { OcrService } from './ocr.service';
import { Evidence } from '../entities/evidence.entity';
import { Transaction } from '../entities/transaction.entity';
import { User } from '../entities/user.entity';
import { AuditLog } from '../entities/audit-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Evidence, Transaction, User, AuditLog]),
  ],
  controllers: [DocumentController],
  providers: [DocumentProcessingService, OcrService],
  exports: [DocumentProcessingService, OcrService],
})
export class DocumentModule {}