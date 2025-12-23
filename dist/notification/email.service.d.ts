import { ConfigService } from '@nestjs/config';
import { NotificationResult } from './interfaces/notification.interface';
export declare class EmailService {
    private configService;
    private readonly logger;
    private readonly fromEmail;
    private readonly fromName;
    constructor(configService: ConfigService);
    sendEmail(recipient: string, subject: string, content: string, isHtml?: boolean): Promise<NotificationResult>;
    sendTemplateEmail(recipient: string, templateId: string, templateData: Record<string, any>): Promise<NotificationResult>;
    getDeliveryStatus(messageId: string): Promise<string | null>;
}
