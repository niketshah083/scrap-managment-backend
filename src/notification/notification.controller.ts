import { Controller, Post, Get, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../auth/guards/role.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { NotificationService } from './notification.service';
import { DeliveryTrackingService } from './delivery-tracking.service';
import { TemplateService } from './template.service';
import { NotificationRequest, DeliveryUpdate } from './interfaces/notification.interface';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard, RoleGuard)
@ApiBearerAuth()
export class NotificationController {
  constructor(
    private notificationService: NotificationService,
    private deliveryTrackingService: DeliveryTrackingService,
    private templateService: TemplateService,
  ) {}

  @Post('send')
  @Roles(UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.OWNER)
  @ApiOperation({ summary: 'Send a notification' })
  @ApiResponse({ status: 201, description: 'Notification sent successfully' })
  async sendNotification(@Body() request: NotificationRequest) {
    return this.notificationService.sendNotification(request);
  }

  @Post('webhook/whatsapp')
  @ApiOperation({ summary: 'WhatsApp delivery webhook' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  async handleWhatsAppWebhook(@Body() update: DeliveryUpdate) {
    await this.deliveryTrackingService.processWebhookUpdate(update);
    return { success: true };
  }

  @Post('webhook/sendgrid')
  @ApiOperation({ summary: 'SendGrid delivery webhook' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  async handleSendGridWebhook(@Body() events: any[]) {
    for (const event of events) {
      const update: DeliveryUpdate = {
        externalId: event.sg_message_id,
        status: event.event,
        timestamp: new Date(event.timestamp * 1000),
        metadata: event,
      };
      
      await this.deliveryTrackingService.processWebhookUpdate(update);
    }
    
    return { success: true };
  }

  @Get('history/:tenantId')
  @Roles(UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.OWNER)
  @ApiOperation({ summary: 'Get notification history for a tenant' })
  @ApiResponse({ status: 200, description: 'Notification history retrieved successfully' })
  async getNotificationHistory(
    @Param('tenantId') tenantId: string,
    @Query('transactionId') transactionId?: string,
    @Query('limit') limit: number = 50,
  ) {
    return this.notificationService.getNotificationHistory(tenantId, transactionId, limit);
  }

  @Get('stats/:tenantId')
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  @ApiOperation({ summary: 'Get delivery statistics for a tenant' })
  @ApiResponse({ status: 200, description: 'Delivery statistics retrieved successfully' })
  async getDeliveryStatistics(
    @Param('tenantId') tenantId: string,
    @Query('days') days: number = 30,
  ) {
    return this.deliveryTrackingService.getDeliveryStatistics(tenantId, days);
  }

  @Post('templates/create-defaults/:tenantId')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Create default notification templates for a tenant' })
  @ApiResponse({ status: 201, description: 'Default templates created successfully' })
  async createDefaultTemplates(@Param('tenantId') tenantId: string) {
    await this.templateService.createDefaultTemplates(tenantId);
    return { success: true };
  }

  @Post('retry-failed/:tenantId')
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  @ApiOperation({ summary: 'Retry failed notifications for a tenant' })
  @ApiResponse({ status: 200, description: 'Failed notifications retry initiated' })
  async retryFailedNotifications(@Param('tenantId') tenantId: string) {
    await this.deliveryTrackingService.retryFailedNotifications(tenantId);
    return { success: true };
  }
}