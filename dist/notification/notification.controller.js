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
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const role_guard_1 = require("../auth/guards/role.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const user_entity_1 = require("../entities/user.entity");
const notification_service_1 = require("./notification.service");
const delivery_tracking_service_1 = require("./delivery-tracking.service");
const template_service_1 = require("./template.service");
let NotificationController = class NotificationController {
    constructor(notificationService, deliveryTrackingService, templateService) {
        this.notificationService = notificationService;
        this.deliveryTrackingService = deliveryTrackingService;
        this.templateService = templateService;
    }
    async sendNotification(request) {
        return this.notificationService.sendNotification(request);
    }
    async handleWhatsAppWebhook(update) {
        await this.deliveryTrackingService.processWebhookUpdate(update);
        return { success: true };
    }
    async handleSendGridWebhook(events) {
        for (const event of events) {
            const update = {
                externalId: event.sg_message_id,
                status: event.event,
                timestamp: new Date(event.timestamp * 1000),
                metadata: event,
            };
            await this.deliveryTrackingService.processWebhookUpdate(update);
        }
        return { success: true };
    }
    async getNotificationHistory(tenantId, transactionId, limit = 50) {
        return this.notificationService.getNotificationHistory(tenantId, transactionId, limit);
    }
    async getDeliveryStatistics(tenantId, days = 30) {
        return this.deliveryTrackingService.getDeliveryStatistics(tenantId, days);
    }
    async createDefaultTemplates(tenantId) {
        await this.templateService.createDefaultTemplates(tenantId);
        return { success: true };
    }
    async retryFailedNotifications(tenantId) {
        await this.deliveryTrackingService.retryFailedNotifications(tenantId);
        return { success: true };
    }
};
exports.NotificationController = NotificationController;
__decorate([
    (0, common_1.Post)('send'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.SUPERVISOR, user_entity_1.UserRole.MANAGER, user_entity_1.UserRole.OWNER),
    (0, swagger_1.ApiOperation)({ summary: 'Send a notification' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Notification sent successfully' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationController.prototype, "sendNotification", null);
__decorate([
    (0, common_1.Post)('webhook/whatsapp'),
    (0, swagger_1.ApiOperation)({ summary: 'WhatsApp delivery webhook' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Webhook processed successfully' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationController.prototype, "handleWhatsAppWebhook", null);
__decorate([
    (0, common_1.Post)('webhook/sendgrid'),
    (0, swagger_1.ApiOperation)({ summary: 'SendGrid delivery webhook' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Webhook processed successfully' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array]),
    __metadata("design:returntype", Promise)
], NotificationController.prototype, "handleSendGridWebhook", null);
__decorate([
    (0, common_1.Get)('history/:tenantId'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.SUPERVISOR, user_entity_1.UserRole.MANAGER, user_entity_1.UserRole.OWNER),
    (0, swagger_1.ApiOperation)({ summary: 'Get notification history for a tenant' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Notification history retrieved successfully' }),
    __param(0, (0, common_1.Param)('tenantId')),
    __param(1, (0, common_1.Query)('transactionId')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Number]),
    __metadata("design:returntype", Promise)
], NotificationController.prototype, "getNotificationHistory", null);
__decorate([
    (0, common_1.Get)('stats/:tenantId'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.MANAGER, user_entity_1.UserRole.OWNER),
    (0, swagger_1.ApiOperation)({ summary: 'Get delivery statistics for a tenant' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Delivery statistics retrieved successfully' }),
    __param(0, (0, common_1.Param)('tenantId')),
    __param(1, (0, common_1.Query)('days')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number]),
    __metadata("design:returntype", Promise)
], NotificationController.prototype, "getDeliveryStatistics", null);
__decorate([
    (0, common_1.Post)('templates/create-defaults/:tenantId'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.OWNER),
    (0, swagger_1.ApiOperation)({ summary: 'Create default notification templates for a tenant' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Default templates created successfully' }),
    __param(0, (0, common_1.Param)('tenantId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], NotificationController.prototype, "createDefaultTemplates", null);
__decorate([
    (0, common_1.Post)('retry-failed/:tenantId'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.MANAGER, user_entity_1.UserRole.OWNER),
    (0, swagger_1.ApiOperation)({ summary: 'Retry failed notifications for a tenant' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Failed notifications retry initiated' }),
    __param(0, (0, common_1.Param)('tenantId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], NotificationController.prototype, "retryFailedNotifications", null);
exports.NotificationController = NotificationController = __decorate([
    (0, swagger_1.ApiTags)('notifications'),
    (0, common_1.Controller)('notifications'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, role_guard_1.RoleGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:paramtypes", [notification_service_1.NotificationService,
        delivery_tracking_service_1.DeliveryTrackingService,
        template_service_1.TemplateService])
], NotificationController);
//# sourceMappingURL=notification.controller.js.map