import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sgMail from '@sendgrid/mail';
import { NotificationResult } from './interfaces/notification.interface';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly fromEmail: string;
  private readonly fromName: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('SENDGRID_API_KEY', '');
    this.fromEmail = this.configService.get<string>('SENDGRID_FROM_EMAIL', 'noreply@scrapops.com');
    this.fromName = this.configService.get<string>('SENDGRID_FROM_NAME', 'Scrap Operations Platform');

    if (apiKey) {
      sgMail.setApiKey(apiKey);
    } else {
      this.logger.warn('SendGrid API key not configured');
    }
  }

  async sendEmail(
    recipient: string,
    subject: string,
    content: string,
    isHtml: boolean = false,
  ): Promise<NotificationResult> {
    try {
      const apiKey = this.configService.get<string>('SENDGRID_API_KEY', '');
      if (!apiKey) {
        this.logger.warn('SendGrid API key not configured, skipping email send');
        return {
          success: false,
          error: 'SendGrid API key not configured',
        };
      }

      const msg = {
        to: recipient,
        from: {
          email: this.fromEmail,
          name: this.fromName,
        },
        subject,
        text: isHtml ? undefined : content,
        html: isHtml ? content : undefined,
      };

      const response = await sgMail.send(msg);
      
      this.logger.log(`Email sent successfully to ${recipient}`);
      
      return {
        success: true,
        messageId: response[0].headers['x-message-id'],
        externalId: response[0].headers['x-message-id'],
      };
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`, error.stack);
      
      return {
        success: false,
        error: error.response?.body?.errors?.[0]?.message || error.message,
      };
    }
  }

  async sendTemplateEmail(
    recipient: string,
    templateId: string,
    templateData: Record<string, any>,
  ): Promise<NotificationResult> {
    try {
      const apiKey = this.configService.get<string>('SENDGRID_API_KEY', '');
      if (!apiKey) {
        this.logger.warn('SendGrid API key not configured, skipping template email send');
        return {
          success: false,
          error: 'SendGrid API key not configured',
        };
      }

      const msg = {
        to: recipient,
        from: {
          email: this.fromEmail,
          name: this.fromName,
        },
        templateId,
        dynamicTemplateData: templateData,
      };

      const response = await sgMail.send(msg);
      
      this.logger.log(`Template email sent successfully to ${recipient}`);
      
      return {
        success: true,
        messageId: response[0].headers['x-message-id'],
        externalId: response[0].headers['x-message-id'],
      };
    } catch (error) {
      this.logger.error(`Failed to send template email: ${error.message}`, error.stack);
      
      return {
        success: false,
        error: error.response?.body?.errors?.[0]?.message || error.message,
      };
    }
  }

  async getDeliveryStatus(messageId: string): Promise<string | null> {
    try {
      // SendGrid doesn't provide a direct API to check delivery status
      // This would typically be handled via webhooks
      // For now, we'll return null and rely on webhook updates
      return null;
    } catch (error) {
      this.logger.error(`Failed to get email delivery status: ${error.message}`);
      return null;
    }
  }
}