import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QCController } from './qc.controller';
import { QCService } from './qc.service';
import { QCReport } from '../entities/qc-report.entity';
import { DebitNote } from '../entities/debit-note.entity';
import { Transaction } from '../entities/transaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([QCReport, DebitNote, Transaction]),
  ],
  controllers: [QCController],
  providers: [QCService],
  exports: [QCService],
})
export class QCModule {}
