import { Repository } from 'typeorm';
import { NotificationLog } from '../entities/notification-log.entity';
import { TemplateService } from './template.service';
import { WhatsAppService } from './whatsapp.service';
import { EmailService } from './email.service';
import { DeliveryTrackingService } from './delivery-tracking.service';
import { NotificationRequest, NotificationResult, TemplateVariables } from './interfaces/notification.interface';
export declare class NotificationService {
    private notificationLogRepository;
    private templateService;
    private whatsAppService;
    private emailService;
    private deliveryTrackingService;
    private readonly logger;
    constructor(notificationLogRepository: Repository<NotificationLog>, templateService: TemplateService, whatsAppService: WhatsAppService, emailService: EmailService, deliveryTrackingService: DeliveryTrackingService);
    sendNotification(request: NotificationRequest): Promise<NotificationResult>;
    sendInspectionReport(tenantId: string, transactionId: string, vendorContact: string, variables: TemplateVariables): Promise<void>;
    notifyRejection(tenantId: string, transactionId: string, vendorContact: string, rejectionReason: string, variables: TemplateVariables): Promise<void>;
    sendGrnConfirmation(tenantId: string, transactionId: string, vendorContact: string, grnNumber: string, variables: TemplateVariables): Promise<void>;
    alertWeightDeviation(tenantId: string, transactionId: string, vendorContact: string, weightDeviation: number, variables: TemplateVariables): Promise<void>;
    notifyGatePassIssued(tenantId: string, transactionId: string, vendorContact: string, gatePassNumber: string, variables: TemplateVariables): Promise<void>;
    getNotificationHistory(tenantId: string, transactionId?: string, limit?: number): Promise<NotificationLog[]>;
}
