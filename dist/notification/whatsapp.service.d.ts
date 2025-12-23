import { ConfigService } from '@nestjs/config';
import { NotificationResult } from './interfaces/notification.interface';
export declare class WhatsAppService {
    private configService;
    private readonly logger;
    private readonly apiUrl;
    private readonly accessToken;
    private readonly phoneNumberId;
    constructor(configService: ConfigService);
    sendMessage(recipient: string, message: string, subject?: string): Promise<NotificationResult>;
    sendTemplate(recipient: string, templateName: string, templateVariables: Record<string, string>): Promise<NotificationResult>;
    private cleanPhoneNumber;
    getDeliveryStatus(messageId: string): Promise<string | null>;
}
