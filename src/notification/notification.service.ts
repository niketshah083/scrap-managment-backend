import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationLog, DeliveryStatus } from '../entities/notification-log.entity';
import { NotificationType, NotificationChannel } from '../entities/notification-template.entity';
import { TemplateService } from './template.service';
import { WhatsAppService } from './whatsapp.service';
import { EmailService } from './email.service';
import { DeliveryTrackingService } from './delivery-tracking.service';
import { NotificationRequest, NotificationResult, TemplateVariables } from './interfaces/notification.interface';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(NotificationLog)
    private notificationLogRepository: Repository<NotificationLog>,
    private templateService: TemplateService,
    private whatsAppService: WhatsAppService,
    private emailService: EmailService,
    private deliveryTrackingService: DeliveryTrackingService,
  ) {}

  async sendNotification(request: NotificationRequest): Promise<NotificationResult> {
    try {
      // Get template for the notification
      const template = await this.templateService.getTemplate(
        request.tenantId,
        request.type,
        request.channel,
      );

      if (!template) {
        this.logger.warn(`No template found for ${request.type} on ${request.channel}`);
        return {
          success: false,
          error: 'Template not found',
        };
      }

      // Render template with variables
      const { subject, content } = await this.templateService.renderTemplate(
        template,
        request.variables || {},
      );

      // Create notification log entry
      const notificationLog = this.notificationLogRepository.create({
        tenantId: request.tenantId,
        transactionId: request.transactionId,
        templateId: template.id,
        type: request.type,
        channel: request.channel,
        recipient: request.recipient,
        subject,
        content,
        status: DeliveryStatus.PENDING,
      });

      const savedLog = await this.notificationLogRepository.save(notificationLog);

      // Send notification based on channel
      let result: NotificationResult;
      
      switch (request.channel) {
        case NotificationChannel.WHATSAPP:
          result = await this.whatsAppService.sendMessage(
            request.recipient,
            content,
            subject,
          );
          break;
        case NotificationChannel.EMAIL:
          result = await this.emailService.sendEmail(
            request.recipient,
            subject,
            content,
          );
          break;
        default:
          result = {
            success: false,
            error: 'Unsupported notification channel',
          };
      }

      // Update notification log with result
      const updateData: Partial<NotificationLog> = {
        status: result.success ? DeliveryStatus.SENT : DeliveryStatus.FAILED,
        externalId: result.externalId,
        errorMessage: result.error,
      };

      if (result.success) {
        updateData.sentAt = new Date();
      }

      await this.notificationLogRepository.update(savedLog.id, updateData);

      this.logger.log(`Notification sent: ${request.type} to ${request.recipient} via ${request.channel}`);

      return {
        ...result,
        messageId: savedLog.id,
      };
    } catch (error) {
      this.logger.error(`Failed to send notification: ${error.message}`, error.stack);
      
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async sendInspectionReport(
    tenantId: string,
    transactionId: string,
    vendorContact: string,
    variables: TemplateVariables,
  ): Promise<void> {
    // Send WhatsApp notification
    await this.sendNotification({
      tenantId,
      transactionId,
      type: NotificationType.INSPECTION_COMPLETE,
      channel: NotificationChannel.WHATSAPP,
      recipient: vendorContact,
      variables,
    });

    // Send Email notification
    await this.sendNotification({
      tenantId,
      transactionId,
      type: NotificationType.INSPECTION_COMPLETE,
      channel: NotificationChannel.EMAIL,
      recipient: vendorContact,
      variables,
    });
  }

  async notifyRejection(
    tenantId: string,
    transactionId: string,
    vendorContact: string,
    rejectionReason: string,
    variables: TemplateVariables,
  ): Promise<void> {
    const rejectionVariables = {
      ...variables,
      rejectionReason,
    };

    // Send immediate WhatsApp notification
    await this.sendNotification({
      tenantId,
      transactionId,
      type: NotificationType.MATERIAL_REJECTED,
      channel: NotificationChannel.WHATSAPP,
      recipient: vendorContact,
      variables: rejectionVariables,
    });

    // Send detailed Email notification
    await this.sendNotification({
      tenantId,
      transactionId,
      type: NotificationType.MATERIAL_REJECTED,
      channel: NotificationChannel.EMAIL,
      recipient: vendorContact,
      variables: rejectionVariables,
    });
  }

  async sendGrnConfirmation(
    tenantId: string,
    transactionId: string,
    vendorContact: string,
    grnNumber: string,
    variables: TemplateVariables,
  ): Promise<void> {
    const grnVariables = {
      ...variables,
      grnNumber,
    };

    await this.sendNotification({
      tenantId,
      transactionId,
      type: NotificationType.GRN_GENERATED,
      channel: NotificationChannel.WHATSAPP,
      recipient: vendorContact,
      variables: grnVariables,
    });
  }

  async alertWeightDeviation(
    tenantId: string,
    transactionId: string,
    vendorContact: string,
    weightDeviation: number,
    variables: TemplateVariables,
  ): Promise<void> {
    const deviationVariables = {
      ...variables,
      weightDeviation,
    };

    await this.sendNotification({
      tenantId,
      transactionId,
      type: NotificationType.WEIGHT_DEVIATION,
      channel: NotificationChannel.EMAIL,
      recipient: vendorContact,
      variables: deviationVariables,
    });
  }

  async notifyGatePassIssued(
    tenantId: string,
    transactionId: string,
    vendorContact: string,
    gatePassNumber: string,
    variables: TemplateVariables,
  ): Promise<void> {
    const gatePassVariables = {
      ...variables,
      gatePassNumber,
    };

    await this.sendNotification({
      tenantId,
      transactionId,
      type: NotificationType.GATE_PASS_ISSUED,
      channel: NotificationChannel.WHATSAPP,
      recipient: vendorContact,
      variables: gatePassVariables,
    });
  }

  async getNotificationHistory(
    tenantId: string,
    transactionId?: string,
    limit: number = 50,
  ): Promise<NotificationLog[]> {
    const query = this.notificationLogRepository
      .createQueryBuilder('log')
      .where('log.tenantId = :tenantId', { tenantId })
      .orderBy('log.createdAt', 'DESC')
      .limit(limit);

    if (transactionId) {
      query.andWhere('log.transactionId = :transactionId', { transactionId });
    }

    return query.getMany();
  }
}