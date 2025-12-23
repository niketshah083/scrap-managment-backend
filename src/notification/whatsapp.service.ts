import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { NotificationResult } from './interfaces/notification.interface';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly apiUrl: string;
  private readonly accessToken: string;
  private readonly phoneNumberId: string;

  constructor(private configService: ConfigService) {
    this.apiUrl = this.configService.get<string>('WHATSAPP_API_URL', 'https://graph.facebook.com/v18.0');
    this.accessToken = this.configService.get<string>('WHATSAPP_ACCESS_TOKEN', '');
    this.phoneNumberId = this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID', '');
  }

  async sendMessage(
    recipient: string,
    message: string,
    subject?: string,
  ): Promise<NotificationResult> {
    try {
      if (!this.accessToken || !this.phoneNumberId) {
        this.logger.warn('WhatsApp credentials not configured, skipping message send');
        return {
          success: false,
          error: 'WhatsApp credentials not configured',
        };
      }

      // Clean phone number (remove spaces, dashes, etc.)
      const cleanRecipient = this.cleanPhoneNumber(recipient);
      
      const payload = {
        messaging_product: 'whatsapp',
        to: cleanRecipient,
        type: 'text',
        text: {
          body: message,
        },
      };

      const response = await axios.post(
        `${this.apiUrl}/${this.phoneNumberId}/messages`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      this.logger.log(`WhatsApp message sent successfully to ${cleanRecipient}`);
      
      return {
        success: true,
        messageId: response.data.messages?.[0]?.id,
        externalId: response.data.messages?.[0]?.id,
      };
    } catch (error) {
      this.logger.error(`Failed to send WhatsApp message: ${error.message}`, error.stack);
      
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
      };
    }
  }

  async sendTemplate(
    recipient: string,
    templateName: string,
    templateVariables: Record<string, string>,
  ): Promise<NotificationResult> {
    try {
      if (!this.accessToken || !this.phoneNumberId) {
        this.logger.warn('WhatsApp credentials not configured, skipping template send');
        return {
          success: false,
          error: 'WhatsApp credentials not configured',
        };
      }

      const cleanRecipient = this.cleanPhoneNumber(recipient);
      
      const payload = {
        messaging_product: 'whatsapp',
        to: cleanRecipient,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: 'en',
          },
          components: [
            {
              type: 'body',
              parameters: Object.values(templateVariables).map(value => ({
                type: 'text',
                text: value,
              })),
            },
          ],
        },
      };

      const response = await axios.post(
        `${this.apiUrl}/${this.phoneNumberId}/messages`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      this.logger.log(`WhatsApp template sent successfully to ${cleanRecipient}`);
      
      return {
        success: true,
        messageId: response.data.messages?.[0]?.id,
        externalId: response.data.messages?.[0]?.id,
      };
    } catch (error) {
      this.logger.error(`Failed to send WhatsApp template: ${error.message}`, error.stack);
      
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
      };
    }
  }

  private cleanPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Add country code if not present (assuming India +91)
    if (cleaned.length === 10) {
      cleaned = '91' + cleaned;
    }
    
    return cleaned;
  }

  async getDeliveryStatus(messageId: string): Promise<string | null> {
    try {
      if (!this.accessToken) {
        return null;
      }

      const response = await axios.get(
        `${this.apiUrl}/${messageId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
          },
        },
      );

      return response.data.status || null;
    } catch (error) {
      this.logger.error(`Failed to get WhatsApp delivery status: ${error.message}`);
      return null;
    }
  }
}