"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var EmailService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const sgMail = require("@sendgrid/mail");
let EmailService = EmailService_1 = class EmailService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(EmailService_1.name);
        const apiKey = this.configService.get('SENDGRID_API_KEY', '');
        this.fromEmail = this.configService.get('SENDGRID_FROM_EMAIL', 'noreply@scrapops.com');
        this.fromName = this.configService.get('SENDGRID_FROM_NAME', 'Scrap Operations Platform');
        if (apiKey) {
            sgMail.setApiKey(apiKey);
        }
        else {
            this.logger.warn('SendGrid API key not configured');
        }
    }
    async sendEmail(recipient, subject, content, isHtml = false) {
        try {
            const apiKey = this.configService.get('SENDGRID_API_KEY', '');
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
        }
        catch (error) {
            this.logger.error(`Failed to send email: ${error.message}`, error.stack);
            return {
                success: false,
                error: error.response?.body?.errors?.[0]?.message || error.message,
            };
        }
    }
    async sendTemplateEmail(recipient, templateId, templateData) {
        try {
            const apiKey = this.configService.get('SENDGRID_API_KEY', '');
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
        }
        catch (error) {
            this.logger.error(`Failed to send template email: ${error.message}`, error.stack);
            return {
                success: false,
                error: error.response?.body?.errors?.[0]?.message || error.message,
            };
        }
    }
    async getDeliveryStatus(messageId) {
        try {
            return null;
        }
        catch (error) {
            this.logger.error(`Failed to get email delivery status: ${error.message}`);
            return null;
        }
    }
};
exports.EmailService = EmailService;
exports.EmailService = EmailService = EmailService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], EmailService);
//# sourceMappingURL=email.service.js.map