import { NotificationService } from './notification.service';
import { DeliveryTrackingService } from './delivery-tracking.service';
import { TemplateService } from './template.service';
import { NotificationRequest, DeliveryUpdate } from './interfaces/notification.interface';
export declare class NotificationController {
    private notificationService;
    private deliveryTrackingService;
    private templateService;
    constructor(notificationService: NotificationService, deliveryTrackingService: DeliveryTrackingService, templateService: TemplateService);
    sendNotification(request: NotificationRequest): Promise<import("./interfaces/notification.interface").NotificationResult>;
    handleWhatsAppWebhook(update: DeliveryUpdate): Promise<{
        success: boolean;
    }>;
    handleSendGridWebhook(events: any[]): Promise<{
        success: boolean;
    }>;
    getNotificationHistory(tenantId: string, transactionId?: string, limit?: number): Promise<import("../entities").NotificationLog[]>;
    getDeliveryStatistics(tenantId: string, days?: number): Promise<any>;
    createDefaultTemplates(tenantId: string): Promise<{
        success: boolean;
    }>;
    retryFailedNotifications(tenantId: string): Promise<{
        success: boolean;
    }>;
}
