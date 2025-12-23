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
var WhatsAppService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = require("axios");
let WhatsAppService = WhatsAppService_1 = class WhatsAppService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(WhatsAppService_1.name);
        this.apiUrl = this.configService.get('WHATSAPP_API_URL', 'https://graph.facebook.com/v18.0');
        this.accessToken = this.configService.get('WHATSAPP_ACCESS_TOKEN', '');
        this.phoneNumberId = this.configService.get('WHATSAPP_PHONE_NUMBER_ID', '');
    }
    async sendMessage(recipient, message, subject) {
        try {
            if (!this.accessToken || !this.phoneNumberId) {
                this.logger.warn('WhatsApp credentials not configured, skipping message send');
                return {
                    success: false,
                    error: 'WhatsApp credentials not configured',
                };
            }
            const cleanRecipient = this.cleanPhoneNumber(recipient);
            const payload = {
                messaging_product: 'whatsapp',
                to: cleanRecipient,
                type: 'text',
                text: {
                    body: message,
                },
            };
            const response = await axios_1.default.post(`${this.apiUrl}/${this.phoneNumberId}/messages`, payload, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json',
                },
            });
            this.logger.log(`WhatsApp message sent successfully to ${cleanRecipient}`);
            return {
                success: true,
                messageId: response.data.messages?.[0]?.id,
                externalId: response.data.messages?.[0]?.id,
            };
        }
        catch (error) {
            this.logger.error(`Failed to send WhatsApp message: ${error.message}`, error.stack);
            return {
                success: false,
                error: error.response?.data?.error?.message || error.message,
            };
        }
    }
    async sendTemplate(recipient, templateName, templateVariables) {
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
            const response = await axios_1.default.post(`${this.apiUrl}/${this.phoneNumberId}/messages`, payload, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json',
                },
            });
            this.logger.log(`WhatsApp template sent successfully to ${cleanRecipient}`);
            return {
                success: true,
                messageId: response.data.messages?.[0]?.id,
                externalId: response.data.messages?.[0]?.id,
            };
        }
        catch (error) {
            this.logger.error(`Failed to send WhatsApp template: ${error.message}`, error.stack);
            return {
                success: false,
                error: error.response?.data?.error?.message || error.message,
            };
        }
    }
    cleanPhoneNumber(phoneNumber) {
        let cleaned = phoneNumber.replace(/\D/g, '');
        if (cleaned.length === 10) {
            cleaned = '91' + cleaned;
        }
        return cleaned;
    }
    async getDeliveryStatus(messageId) {
        try {
            if (!this.accessToken) {
                return null;
            }
            const response = await axios_1.default.get(`${this.apiUrl}/${messageId}`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                },
            });
            return response.data.status || null;
        }
        catch (error) {
            this.logger.error(`Failed to get WhatsApp delivery status: ${error.message}`);
            return null;
        }
    }
};
exports.WhatsAppService = WhatsAppService;
exports.WhatsAppService = WhatsAppService = WhatsAppService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], WhatsAppService);
//# sourceMappingURL=whatsapp.service.js.map