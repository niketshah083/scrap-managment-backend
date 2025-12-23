import { NotificationType, NotificationChannel } from './notification-template.entity';
export declare enum DeliveryStatus {
    PENDING = "pending",
    SENT = "sent",
    DELIVERED = "delivered",
    FAILED = "failed",
    READ = "read"
}
export declare class NotificationLog {
    id: string;
    tenantId: string;
    transactionId: string;
    templateId: string;
    type: NotificationType;
    channel: NotificationChannel;
    recipient: string;
    subject: string;
    content: string;
    status: DeliveryStatus;
    externalId: string;
    metadata: Record<string, any>;
    errorMessage: string;
    sentAt: Date;
    deliveredAt: Date;
    readAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
