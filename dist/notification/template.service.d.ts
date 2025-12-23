import { Repository } from 'typeorm';
import { NotificationTemplate, NotificationType, NotificationChannel } from '../entities/notification-template.entity';
import { TemplateVariables } from './interfaces/notification.interface';
export declare class TemplateService {
    private templateRepository;
    constructor(templateRepository: Repository<NotificationTemplate>);
    getTemplate(tenantId: string, type: NotificationType, channel: NotificationChannel): Promise<NotificationTemplate | null>;
    renderTemplate(template: NotificationTemplate, variables: TemplateVariables): Promise<{
        subject: string;
        content: string;
    }>;
    private replaceVariables;
    createDefaultTemplates(tenantId: string): Promise<void>;
}
