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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var NotificationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const notification_log_entity_1 = require("../entities/notification-log.entity");
const notification_template_entity_1 = require("../entities/notification-template.entity");
const template_service_1 = require("./template.service");
const whatsapp_service_1 = require("./whatsapp.service");
const email_service_1 = require("./email.service");
const delivery_tracking_service_1 = require("./delivery-tracking.service");
let NotificationService = NotificationService_1 = class NotificationService {
    constructor(notificationLogRepository, templateService, whatsAppService, emailService, deliveryTrackingService) {
        this.notificationLogRepository = notificationLogRepository;
        this.templateService = templateService;
        this.whatsAppService = whatsAppService;
        this.emailService = emailService;
        this.deliveryTrackingService = deliveryTrackingService;
        this.logger = new common_1.Logger(NotificationService_1.name);
    }
    async sendNotification(request) {
        try {
            const template = await this.templateService.getTemplate(request.tenantId, request.type, request.channel);
            if (!template) {
                this.logger.warn(`No template found for ${request.type} on ${request.channel}`);
                return {
                    success: false,
                    error: 'Template not found',
                };
            }
            const { subject, content } = await this.templateService.renderTemplate(template, request.variables || {});
            const notificationLog = this.notificationLogRepository.create({
                tenantId: request.tenantId,
                transactionId: request.transactionId,
                templateId: template.id,
                type: request.type,
                channel: request.channel,
                recipient: request.recipient,
                subject,
                content,
                status: notification_log_entity_1.DeliveryStatus.PENDING,
            });
            const savedLog = await this.notificationLogRepository.save(notificationLog);
            let result;
            switch (request.channel) {
                case notification_template_entity_1.NotificationChannel.WHATSAPP:
                    result = await this.whatsAppService.sendMessage(request.recipient, content, subject);
                    break;
                case notification_template_entity_1.NotificationChannel.EMAIL:
                    result = await this.emailService.sendEmail(request.recipient, subject, content);
                    break;
                default:
                    result = {
                        success: false,
                        error: 'Unsupported notification channel',
                    };
            }
            const updateData = {
                status: result.success ? notification_log_entity_1.DeliveryStatus.SENT : notification_log_entity_1.DeliveryStatus.FAILED,
                externalId: result.externalId,
                errorMessage: result.error,
            };
            if (result.success) {
                updateData.sentAt = new Date();
            }
            await this.notificationLogRepository.update(savedLog.id, updateData);
            this.logger.log(`Notification sent: ${request.type} to ${request.recipient} via ${request.channel}`);
            return {
                ...result,
                messageId: savedLog.id,
            };
        }
        catch (error) {
            this.logger.error(`Failed to send notification: ${error.message}`, error.stack);
            return {
                success: false,
                error: error.message,
            };
        }
    }
    async sendInspectionReport(tenantId, transactionId, vendorContact, variables) {
        await this.sendNotification({
            tenantId,
            transactionId,
            type: notification_template_entity_1.NotificationType.INSPECTION_COMPLETE,
            channel: notification_template_entity_1.NotificationChannel.WHATSAPP,
            recipient: vendorContact,
            variables,
        });
        await this.sendNotification({
            tenantId,
            transactionId,
            type: notification_template_entity_1.NotificationType.INSPECTION_COMPLETE,
            channel: notification_template_entity_1.NotificationChannel.EMAIL,
            recipient: vendorContact,
            variables,
        });
    }
    async notifyRejection(tenantId, transactionId, vendorContact, rejectionReason, variables) {
        const rejectionVariables = {
            ...variables,
            rejectionReason,
        };
        await this.sendNotification({
            tenantId,
            transactionId,
            type: notification_template_entity_1.NotificationType.MATERIAL_REJECTED,
            channel: notification_template_entity_1.NotificationChannel.WHATSAPP,
            recipient: vendorContact,
            variables: rejectionVariables,
        });
        await this.sendNotification({
            tenantId,
            transactionId,
            type: notification_template_entity_1.NotificationType.MATERIAL_REJECTED,
            channel: notification_template_entity_1.NotificationChannel.EMAIL,
            recipient: vendorContact,
            variables: rejectionVariables,
        });
    }
    async sendGrnConfirmation(tenantId, transactionId, vendorContact, grnNumber, variables) {
        const grnVariables = {
            ...variables,
            grnNumber,
        };
        await this.sendNotification({
            tenantId,
            transactionId,
            type: notification_template_entity_1.NotificationType.GRN_GENERATED,
            channel: notification_template_entity_1.NotificationChannel.WHATSAPP,
            recipient: vendorContact,
            variables: grnVariables,
        });
    }
    async alertWeightDeviation(tenantId, transactionId, vendorContact, weightDeviation, variables) {
        const deviationVariables = {
            ...variables,
            weightDeviation,
        };
        await this.sendNotification({
            tenantId,
            transactionId,
            type: notification_template_entity_1.NotificationType.WEIGHT_DEVIATION,
            channel: notification_template_entity_1.NotificationChannel.EMAIL,
            recipient: vendorContact,
            variables: deviationVariables,
        });
    }
    async notifyGatePassIssued(tenantId, transactionId, vendorContact, gatePassNumber, variables) {
        const gatePassVariables = {
            ...variables,
            gatePassNumber,
        };
        await this.sendNotification({
            tenantId,
            transactionId,
            type: notification_template_entity_1.NotificationType.GATE_PASS_ISSUED,
            channel: notification_template_entity_1.NotificationChannel.WHATSAPP,
            recipient: vendorContact,
            variables: gatePassVariables,
        });
    }
    async getNotificationHistory(tenantId, transactionId, limit = 50) {
        const query = this.notificationLogRepository
            .createQueryBuilder('log')
            .where('log.tenantId = :tenantId', { tenantId })
            .orderBy('log.createdAt', 'DESC')
            .limit(limit);
        if (transactionId) {
            query.andWhere('log.transactionId = :transactionId', { transactionId });
        }
        return query.getMany();
    }
};
exports.NotificationService = NotificationService;
exports.NotificationService = NotificationService = NotificationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(notification_log_entity_1.NotificationLog)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        template_service_1.TemplateService,
        whatsapp_service_1.WhatsAppService,
        email_service_1.EmailService,
        delivery_tracking_service_1.DeliveryTrackingService])
], NotificationService);
//# sourceMappingURL=notification.service.js.map