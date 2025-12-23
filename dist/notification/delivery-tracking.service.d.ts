import { Repository } from 'typeorm';
import { NotificationLog, DeliveryStatus } from '../entities/notification-log.entity';
import { DeliveryUpdate } from './interfaces/notification.interface';
import { WhatsAppService } from './whatsapp.service';
import { EmailService } from './email.service';
export declare class DeliveryTrackingService {
    private notificationLogRepository;
    private whatsAppService;
    private emailService;
    private readonly logger;
    constructor(notificationLogRepository: Repository<NotificationLog>, whatsAppService: WhatsAppService, emailService: EmailService);
    updateDeliveryStatus(notificationId: string, status: DeliveryStatus, metadata?: Record<string, any>): Promise<void>;
    processWebhookUpdate(update: DeliveryUpdate): Promise<void>;
    getDeliveryStatistics(tenantId: string, days?: number): Promise<any>;
    private formatDeliveryStats;
    retryFailedNotifications(tenantId: string, maxRetries?: number): Promise<void>;
    private retryNotification;
}
