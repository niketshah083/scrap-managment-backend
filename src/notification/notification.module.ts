import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { WhatsAppService } from './whatsapp.service';
import { EmailService } from './email.service';
import { TemplateService } from './template.service';
import { DeliveryTrackingService } from './delivery-tracking.service';
import { NotificationTemplate } from '../entities/notification-template.entity';
import { NotificationLog } from '../entities/notification-log.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([NotificationTemplate, NotificationLog]),
  ],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    WhatsAppService,
    EmailService,
    TemplateService,
    DeliveryTrackingService,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}