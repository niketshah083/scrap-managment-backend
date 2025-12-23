import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationLog, DeliveryStatus } from '../entities/notification-log.entity';
import { DeliveryUpdate } from './interfaces/notification.interface';
import { WhatsAppService } from './whatsapp.service';
import { EmailService } from './email.service';

@Injectable()
export class DeliveryTrackingService {
  private readonly logger = new Logger(DeliveryTrackingService.name);

  constructor(
    @InjectRepository(NotificationLog)
    private notificationLogRepository: Repository<NotificationLog>,
    private whatsAppService: WhatsAppService,
    private emailService: EmailService,
  ) {}

  async updateDeliveryStatus(
    notificationId: string,
    status: DeliveryStatus,
    metadata?: Record<string, any>,
  ): Promise<void> {
    try {
      const notification = await this.notificationLogRepository.findOne({
        where: { id: notificationId },
      });

      if (!notification) {
        this.logger.warn(`Notification not found: ${notificationId}`);
        return;
      }

      const updateData: Partial<NotificationLog> = {
        status,
        metadata: { ...notification.metadata, ...metadata },
      };

      switch (status) {
        case DeliveryStatus.SENT:
          updateData.sentAt = new Date();
          break;
        case DeliveryStatus.DELIVERED:
          updateData.deliveredAt = new Date();
          break;
        case DeliveryStatus.READ:
          updateData.readAt = new Date();
          break;
      }

      await this.notificationLogRepository.update(notificationId, updateData);
      
      this.logger.log(`Updated notification ${notificationId} status to ${status}`);
    } catch (error) {
      this.logger.error(`Failed to update delivery status: ${error.message}`, error.stack);
    }
  }

  async processWebhookUpdate(update: DeliveryUpdate): Promise<void> {
    try {
      const notification = await this.notificationLogRepository.findOne({
        where: { externalId: update.externalId },
      });

      if (!notification) {
        this.logger.warn(`Notification not found for external ID: ${update.externalId}`);
        return;
      }

      let deliveryStatus: DeliveryStatus;
      
      // Map external status to our internal status
      switch (update.status.toLowerCase()) {
        case 'sent':
        case 'queued':
          deliveryStatus = DeliveryStatus.SENT;
          break;
        case 'delivered':
          deliveryStatus = DeliveryStatus.DELIVERED;
          break;
        case 'read':
          deliveryStatus = DeliveryStatus.READ;
          break;
        case 'failed':
        case 'undelivered':
          deliveryStatus = DeliveryStatus.FAILED;
          break;
        default:
          this.logger.warn(`Unknown delivery status: ${update.status}`);
          return;
      }

      await this.updateDeliveryStatus(notification.id, deliveryStatus, update.metadata);
    } catch (error) {
      this.logger.error(`Failed to process webhook update: ${error.message}`, error.stack);
    }
  }

  async getDeliveryStatistics(tenantId: string, days: number = 30): Promise<any> {
    try {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);

      const stats = await this.notificationLogRepository
        .createQueryBuilder('log')
        .select('log.channel', 'channel')
        .addSelect('log.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .where('log.tenantId = :tenantId', { tenantId })
        .andWhere('log.createdAt >= :fromDate', { fromDate })
        .groupBy('log.channel, log.status')
        .getRawMany();

      return this.formatDeliveryStats(stats);
    } catch (error) {
      this.logger.error(`Failed to get delivery statistics: ${error.message}`, error.stack);
      return {};
    }
  }

  private formatDeliveryStats(rawStats: any[]): any {
    const stats = {
      whatsapp: {
        total: 0,
        sent: 0,
        delivered: 0,
        failed: 0,
        pending: 0,
      },
      email: {
        total: 0,
        sent: 0,
        delivered: 0,
        failed: 0,
        pending: 0,
      },
    };

    rawStats.forEach(stat => {
      const channel = stat.channel.toLowerCase();
      const status = stat.status.toLowerCase();
      const count = parseInt(stat.count, 10);

      if (stats[channel]) {
        stats[channel].total += count;
        if (stats[channel][status] !== undefined) {
          stats[channel][status] += count;
        }
      }
    });

    return stats;
  }

  async retryFailedNotifications(tenantId: string, maxRetries: number = 3): Promise<void> {
    try {
      const failedNotifications = await this.notificationLogRepository.find({
        where: {
          tenantId,
          status: DeliveryStatus.FAILED,
        },
        take: 100, // Limit to prevent overwhelming the system
      });

      for (const notification of failedNotifications) {
        const retryCount = notification.metadata?.retryCount || 0;
        
        if (retryCount < maxRetries) {
          await this.retryNotification(notification);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to retry notifications: ${error.message}`, error.stack);
    }
  }

  private async retryNotification(notification: NotificationLog): Promise<void> {
    try {
      const retryCount = (notification.metadata?.retryCount || 0) + 1;
      
      // Update retry count
      await this.notificationLogRepository.update(notification.id, {
        metadata: { ...notification.metadata, retryCount },
        status: DeliveryStatus.PENDING,
      });

      this.logger.log(`Retrying notification ${notification.id} (attempt ${retryCount})`);
    } catch (error) {
      this.logger.error(`Failed to retry notification ${notification.id}: ${error.message}`);
    }
  }
}