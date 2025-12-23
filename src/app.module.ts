import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseConfig } from './config/database.config';
import { WorkflowModule } from './workflow/workflow.module';
import { AuthModule } from './auth/auth.module';
import { PurchaseOrderModule } from './purchase-order/purchase-order.module';
import { TransactionModule } from './transaction/transaction.module';
import { QCModule } from './qc/qc.module';
import { AuditModule } from './audit/audit.module';
import { VendorModule } from './vendor/vendor.module';
// import { EvidenceModule } from './evidence/evidence.module';
// import { WeighbridgeModule } from './weighbridge/weighbridge.module';
// import { InspectionModule } from './inspection/inspection.module';
// import { NotificationModule } from './notification/notification.module';
// import { GatePassModule } from './gate-pass/gate-pass.module';
// import { DocumentModule } from './document/document.module';
// import { AnalyticsModule } from './analytics/analytics.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      useClass: DatabaseConfig,
    }),
    AuthModule,
    AuditModule,
    // EvidenceModule,
    WorkflowModule,
    PurchaseOrderModule,
    TransactionModule,
    QCModule,
    VendorModule,
    // WeighbridgeModule,
    // InspectionModule,
    // NotificationModule,
    // GatePassModule,
    // DocumentModule,
    // AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // {
    //   provide: APP_GUARD,
    //   useClass: JwtAuthGuard,
    // },
  ],
})
export class AppModule {}