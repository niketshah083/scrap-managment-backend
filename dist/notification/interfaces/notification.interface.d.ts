import { NotificationType, NotificationChannel } from '../../entities/notification-template.entity';
export interface NotificationRequest {
    tenantId: string;
    transactionId?: string;
    type: NotificationType;
    channel: NotificationChannel;
    recipient: string;
    variables?: Record<string, any>;
}
export interface NotificationResult {
    success: boolean;
    messageId?: string;
    externalId?: string;
    error?: string;
}
export interface TemplateVariables {
    vendorName?: string;
    vehicleNumber?: string;
    inspectionResult?: string;
    rejectionReason?: string;
    grnNumber?: string;
    weightDeviation?: number;
    gatePassNumber?: string;
    factoryName?: string;
    timestamp?: string;
    [key: string]: any;
}
export interface DeliveryUpdate {
    externalId: string;
    status: string;
    timestamp: Date;
    metadata?: Record<string, any>;
}
