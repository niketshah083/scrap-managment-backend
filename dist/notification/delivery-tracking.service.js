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
var DeliveryTrackingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeliveryTrackingService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const notification_log_entity_1 = require("../entities/notification-log.entity");
const whatsapp_service_1 = require("./whatsapp.service");
const email_service_1 = require("./email.service");
let DeliveryTrackingService = DeliveryTrackingService_1 = class DeliveryTrackingService {
    constructor(notificationLogRepository, whatsAppService, emailService) {
        this.notificationLogRepository = notificationLogRepository;
        this.whatsAppService = whatsAppService;
        this.emailService = emailService;
        this.logger = new common_1.Logger(DeliveryTrackingService_1.name);
    }
    async updateDeliveryStatus(notificationId, status, metadata) {
        try {
            const notification = await this.notificationLogRepository.findOne({
                where: { id: notificationId },
            });
            if (!notification) {
                this.logger.warn(`Notification not found: ${notificationId}`);
                return;
            }
            const updateData = {
                status,
                metadata: { ...notification.metadata, ...metadata },
            };
            switch (status) {
                case notification_log_entity_1.DeliveryStatus.SENT:
                    updateData.sentAt = new Date();
                    break;
                case notification_log_entity_1.DeliveryStatus.DELIVERED:
                    updateData.deliveredAt = new Date();
                    break;
                case notification_log_entity_1.DeliveryStatus.READ:
                    updateData.readAt = new Date();
                    break;
            }
            await this.notificationLogRepository.update(notificationId, updateData);
            this.logger.log(`Updated notification ${notificationId} status to ${status}`);
        }
        catch (error) {
            this.logger.error(`Failed to update delivery status: ${error.message}`, error.stack);
        }
    }
    async processWebhookUpdate(update) {
        try {
            const notification = await this.notificationLogRepository.findOne({
                where: { externalId: update.externalId },
            });
            if (!notification) {
                this.logger.warn(`Notification not found for external ID: ${update.externalId}`);
                return;
            }
            let deliveryStatus;
            switch (update.status.toLowerCase()) {
                case 'sent':
                case 'queued':
                    deliveryStatus = notification_log_entity_1.DeliveryStatus.SENT;
                    break;
                case 'delivered':
                    deliveryStatus = notification_log_entity_1.DeliveryStatus.DELIVERED;
                    break;
                case 'read':
                    deliveryStatus = notification_log_entity_1.DeliveryStatus.READ;
                    break;
                case 'failed':
                case 'undelivered':
                    deliveryStatus = notification_log_entity_1.DeliveryStatus.FAILED;
                    break;
                default:
                    this.logger.warn(`Unknown delivery status: ${update.status}`);
                    return;
            }
            await this.updateDeliveryStatus(notification.id, deliveryStatus, update.metadata);
        }
        catch (error) {
            this.logger.error(`Failed to process webhook update: ${error.message}`, error.stack);
        }
    }
    async getDeliveryStatistics(tenantId, days = 30) {
        try {
            const fromDate = new Date();
            fromDate.setDate(fromDate.getDate() - days);
            const stats = await this.notificationLogRepository
                .createQueryBuilder('log')
                .select('log.channel', 'channel')
                .addSelect('log.status', 'status')
                .addSelect('COUNT(*)', 'count')
                .where('log.tenantId = :tenantId', { tenantId })
                .andWhere('log.createdAt >= :fromDate', { fromDate })
                .groupBy('log.channel, log.status')
                .getRawMany();
            return this.formatDeliveryStats(stats);
        }
        catch (error) {
            this.logger.error(`Failed to get delivery statistics: ${error.message}`, error.stack);
            return {};
        }
    }
    formatDeliveryStats(rawStats) {
        const stats = {
            whatsapp: {
                total: 0,
                sent: 0,
                delivered: 0,
                failed: 0,
                pending: 0,
            },
            email: {
                total: 0,
                sent: 0,
                delivered: 0,
                failed: 0,
                pending: 0,
            },
        };
        rawStats.forEach(stat => {
            const channel = stat.channel.toLowerCase();
            const status = stat.status.toLowerCase();
            const count = parseInt(stat.count, 10);
            if (stats[channel]) {
                stats[channel].total += count;
                if (stats[channel][status] !== undefined) {
                    stats[channel][status] += count;
                }
            }
        });
        return stats;
    }
    async retryFailedNotifications(tenantId, maxRetries = 3) {
        try {
            const failedNotifications = await this.notificationLogRepository.find({
                where: {
                    tenantId,
                    status: notification_log_entity_1.DeliveryStatus.FAILED,
                },
                take: 100,
            });
            for (const notification of failedNotifications) {
                const retryCount = notification.metadata?.retryCount || 0;
                if (retryCount < maxRetries) {
                    await this.retryNotification(notification);
                }
            }
        }
        catch (error) {
            this.logger.error(`Failed to retry notifications: ${error.message}`, error.stack);
        }
    }
    async retryNotification(notification) {
        try {
            const retryCount = (notification.metadata?.retryCount || 0) + 1;
            await this.notificationLogRepository.update(notification.id, {
                metadata: { ...notification.metadata, retryCount },
                status: notification_log_entity_1.DeliveryStatus.PENDING,
            });
            this.logger.log(`Retrying notification ${notification.id} (attempt ${retryCount})`);
        }
        catch (error) {
            this.logger.error(`Failed to retry notification ${notification.id}: ${error.message}`);
        }
    }
};
exports.DeliveryTrackingService = DeliveryTrackingService;
exports.DeliveryTrackingService = DeliveryTrackingService = DeliveryTrackingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(notification_log_entity_1.NotificationLog)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        whatsapp_service_1.WhatsAppService,
        email_service_1.EmailService])
], DeliveryTrackingService);
//# sourceMappingURL=delivery-tracking.service.js.map