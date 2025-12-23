import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fc from 'fast-check';
import { NotificationService } from './notification.service';
import { TemplateService } from './template.service';
import { WhatsAppService } from './whatsapp.service';
import { EmailService } from './email.service';
import { DeliveryTrackingService } from './delivery-tracking.service';
import { NotificationLog, DeliveryStatus } from '../entities/notification-log.entity';
import { NotificationType, NotificationChannel } from '../entities/notification-template.entity';
import { NotificationRequest } from './interfaces/notification.interface';

describe('NotificationService', () => {
  let service: NotificationService;
  let notificationLogRepository: Repository<NotificationLog>;
  let templateService: TemplateService;
  let whatsAppService: WhatsAppService;
  let emailService: EmailService;
  let deliveryTrackingService: DeliveryTrackingService;

  const mockNotificationLogRepository = {
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    })),
  };

  const mockTemplateService = {
    getTemplate: jest.fn(),
    renderTemplate: jest.fn(),
  };

  const mockWhatsAppService = {
    sendMessage: jest.fn(),
  };

  const mockEmailService = {
    sendEmail: jest.fn(),
  };

  const mockDeliveryTrackingService = {
    updateDeliveryStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: getRepositoryToken(NotificationLog),
          useValue: mockNotificationLogRepository,
        },
        {
          provide: TemplateService,
          useValue: mockTemplateService,
        },
        {
          provide: WhatsAppService,
          useValue: mockWhatsAppService,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: DeliveryTrackingService,
          useValue: mockDeliveryTrackingService,
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    notificationLogRepository = module.get<Repository<NotificationLog>>(
      getRepositoryToken(NotificationLog),
    );
    templateService = module.get<TemplateService>(TemplateService);
    whatsAppService = module.get<WhatsAppService>(WhatsAppService);
    emailService = module.get<EmailService>(EmailService);
    deliveryTrackingService = module.get<DeliveryTrackingService>(DeliveryTrackingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Property 16: Comprehensive Notification System', () => {
    /**
     * **Feature: scrap-operations-platform, Property 16: Comprehensive Notification System**
     * 
     * For any significant transaction event (inspection completion, rejection, GRN generation, 
     * weight deviation, gate pass issuance), the system should send appropriate notifications 
     * to vendors via WhatsApp and Email using configured templates
     * 
     * **Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5**
     */
    it('should send notifications for all significant transaction events via configured channels', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate test data
          fc.record({
            tenantId: fc.uuid(),
            transactionId: fc.uuid(),
            vendorContact: fc.emailAddress(),
            factoryName: fc.string({ minLength: 1, maxLength: 50 }),
            vehicleNumber: fc.string({ minLength: 5, maxLength: 15 }),
            timestamp: fc.date(),
          }),
          fc.oneof(
            fc.constant(NotificationType.INSPECTION_COMPLETE),
            fc.constant(NotificationType.MATERIAL_REJECTED),
            fc.constant(NotificationType.GRN_GENERATED),
            fc.constant(NotificationType.WEIGHT_DEVIATION),
            fc.constant(NotificationType.GATE_PASS_ISSUED),
          ),
          fc.oneof(
            fc.constant(NotificationChannel.WHATSAPP),
            fc.constant(NotificationChannel.EMAIL),
          ),
          async (testData, notificationType, channel) => {
            // Clear all mocks before each property test run
            jest.clearAllMocks();

            // Setup mock template
            const mockTemplate = {
              id: fc.sample(fc.uuid(), 1)[0],
              tenantId: testData.tenantId,
              type: notificationType,
              channel,
              name: `Test Template - ${notificationType}`,
              subject: 'Test Subject {{vehicleNumber}}',
              template: 'Test message for {{vendorName}} about {{vehicleNumber}}',
              variables: {},
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            const mockRenderedTemplate = {
              subject: `Test Subject ${testData.vehicleNumber}`,
              content: `Test message for Vendor about ${testData.vehicleNumber}`,
            };

            const mockNotificationLog = {
              id: fc.sample(fc.uuid(), 1)[0],
              tenantId: testData.tenantId,
              transactionId: testData.transactionId,
              templateId: mockTemplate.id,
              type: notificationType,
              channel,
              recipient: testData.vendorContact,
              subject: mockRenderedTemplate.subject,
              content: mockRenderedTemplate.content,
              status: DeliveryStatus.PENDING,
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            const mockSendResult = {
              success: true,
              messageId: fc.sample(fc.uuid(), 1)[0],
              externalId: fc.sample(fc.uuid(), 1)[0],
            };

            // Setup mocks
            mockTemplateService.getTemplate.mockResolvedValue(mockTemplate);
            mockTemplateService.renderTemplate.mockResolvedValue(mockRenderedTemplate);
            mockNotificationLogRepository.create.mockReturnValue(mockNotificationLog);
            mockNotificationLogRepository.save.mockResolvedValue(mockNotificationLog);
            mockNotificationLogRepository.update.mockResolvedValue({ affected: 1 });

            if (channel === NotificationChannel.WHATSAPP) {
              mockWhatsAppService.sendMessage.mockResolvedValue(mockSendResult);
            } else {
              mockEmailService.sendEmail.mockResolvedValue(mockSendResult);
            }

            // Create notification request
            const request: NotificationRequest = {
              tenantId: testData.tenantId,
              transactionId: testData.transactionId,
              type: notificationType,
              channel,
              recipient: testData.vendorContact,
              variables: {
                vendorName: 'Test Vendor',
                vehicleNumber: testData.vehicleNumber,
                factoryName: testData.factoryName,
                timestamp: testData.timestamp.toISOString(),
              },
            };

            // Execute notification
            const result = await service.sendNotification(request);

            // Verify notification was processed correctly
            expect(result.success).toBe(true);
            expect(result.messageId).toBe(mockNotificationLog.id);

            // Verify template was retrieved
            expect(mockTemplateService.getTemplate).toHaveBeenCalledWith(
              testData.tenantId,
              notificationType,
              channel,
            );

            // Verify template was rendered with variables
            expect(mockTemplateService.renderTemplate).toHaveBeenCalledWith(
              mockTemplate,
              request.variables,
            );

            // Verify notification log was created
            expect(mockNotificationLogRepository.create).toHaveBeenCalledWith(
              expect.objectContaining({
                tenantId: testData.tenantId,
                transactionId: testData.transactionId,
                type: notificationType,
                channel,
                recipient: testData.vendorContact,
                subject: mockRenderedTemplate.subject,
                content: mockRenderedTemplate.content,
                status: DeliveryStatus.PENDING,
              }),
            );

            // Verify appropriate service was called based on channel
            if (channel === NotificationChannel.WHATSAPP) {
              expect(mockWhatsAppService.sendMessage).toHaveBeenCalledWith(
                testData.vendorContact,
                mockRenderedTemplate.content,
                mockRenderedTemplate.subject,
              );
              expect(mockEmailService.sendEmail).not.toHaveBeenCalled();
            } else {
              expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
                testData.vendorContact,
                mockRenderedTemplate.subject,
                mockRenderedTemplate.content,
              );
              expect(mockWhatsAppService.sendMessage).not.toHaveBeenCalled();
            }

            // Verify notification log was updated with success status
            expect(mockNotificationLogRepository.update).toHaveBeenCalledWith(
              mockNotificationLog.id,
              expect.objectContaining({
                status: DeliveryStatus.SENT,
                externalId: mockSendResult.externalId,
                sentAt: expect.any(Date),
              }),
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should handle notification failures gracefully and log errors', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tenantId: fc.uuid(),
            transactionId: fc.uuid(),
            vendorContact: fc.emailAddress(),
          }),
          fc.oneof(
            fc.constant(NotificationChannel.WHATSAPP),
            fc.constant(NotificationChannel.EMAIL),
          ),
          async (testData, channel) => {
            // Clear all mocks before each property test run
            jest.clearAllMocks();

            // Setup mock template
            const mockTemplate = {
              id: fc.sample(fc.uuid(), 1)[0],
              tenantId: testData.tenantId,
              type: NotificationType.INSPECTION_COMPLETE,
              channel,
              name: 'Test Template',
              subject: 'Test Subject',
              template: 'Test message',
              variables: {},
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            const mockRenderedTemplate = {
              subject: 'Test Subject',
              content: 'Test message',
            };

            const mockNotificationLog = {
              id: fc.sample(fc.uuid(), 1)[0],
              tenantId: testData.tenantId,
              transactionId: testData.transactionId,
              templateId: mockTemplate.id,
              type: NotificationType.INSPECTION_COMPLETE,
              channel,
              recipient: testData.vendorContact,
              subject: mockRenderedTemplate.subject,
              content: mockRenderedTemplate.content,
              status: DeliveryStatus.PENDING,
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            const mockFailureResult = {
              success: false,
              error: 'Service unavailable',
            };

            // Setup mocks
            mockTemplateService.getTemplate.mockResolvedValue(mockTemplate);
            mockTemplateService.renderTemplate.mockResolvedValue(mockRenderedTemplate);
            mockNotificationLogRepository.create.mockReturnValue(mockNotificationLog);
            mockNotificationLogRepository.save.mockResolvedValue(mockNotificationLog);
            mockNotificationLogRepository.update.mockResolvedValue({ affected: 1 });

            if (channel === NotificationChannel.WHATSAPP) {
              mockWhatsAppService.sendMessage.mockResolvedValue(mockFailureResult);
            } else {
              mockEmailService.sendEmail.mockResolvedValue(mockFailureResult);
            }

            // Create notification request
            const request: NotificationRequest = {
              tenantId: testData.tenantId,
              transactionId: testData.transactionId,
              type: NotificationType.INSPECTION_COMPLETE,
              channel,
              recipient: testData.vendorContact,
              variables: {},
            };

            // Execute notification
            const result = await service.sendNotification(request);

            // Verify failure was handled correctly
            expect(result.success).toBe(false);
            expect(result.error).toBe('Service unavailable');

            // Verify notification log was updated with failure status
            expect(mockNotificationLogRepository.update).toHaveBeenCalledWith(
              mockNotificationLog.id,
              expect.objectContaining({
                status: DeliveryStatus.FAILED,
                errorMessage: 'Service unavailable',
              }),
            );
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should handle missing templates gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tenantId: fc.uuid(),
            transactionId: fc.uuid(),
            vendorContact: fc.emailAddress(),
          }),
          fc.oneof(
            fc.constant(NotificationType.INSPECTION_COMPLETE),
            fc.constant(NotificationType.MATERIAL_REJECTED),
          ),
          fc.oneof(
            fc.constant(NotificationChannel.WHATSAPP),
            fc.constant(NotificationChannel.EMAIL),
          ),
          async (testData, notificationType, channel) => {
            // Clear all mocks before each property test run
            jest.clearAllMocks();

            // Setup mock to return no template
            mockTemplateService.getTemplate.mockResolvedValue(null);

            // Create notification request
            const request: NotificationRequest = {
              tenantId: testData.tenantId,
              transactionId: testData.transactionId,
              type: notificationType,
              channel,
              recipient: testData.vendorContact,
              variables: {},
            };

            // Execute notification
            const result = await service.sendNotification(request);

            // Verify failure was handled correctly
            expect(result.success).toBe(false);
            expect(result.error).toBe('Template not found');

            // Verify no notification log was created
            expect(mockNotificationLogRepository.create).not.toHaveBeenCalled();
            expect(mockWhatsAppService.sendMessage).not.toHaveBeenCalled();
            expect(mockEmailService.sendEmail).not.toHaveBeenCalled();
          },
        ),
        { numRuns: 30 },
      );
    });
  });

  describe('Specific notification methods', () => {
    it('should send inspection reports via both WhatsApp and Email', async () => {
      const testData = {
        tenantId: fc.sample(fc.uuid(), 1)[0],
        transactionId: fc.sample(fc.uuid(), 1)[0],
        vendorContact: 'vendor@example.com',
        variables: {
          vendorName: 'Test Vendor',
          vehicleNumber: 'MH12AB1234',
          factoryName: 'Test Factory',
        },
      };

      // Mock successful notification sending
      jest.spyOn(service, 'sendNotification').mockResolvedValue({
        success: true,
        messageId: 'test-message-id',
      });

      await service.sendInspectionReport(
        testData.tenantId,
        testData.transactionId,
        testData.vendorContact,
        testData.variables,
      );

      // Verify both WhatsApp and Email notifications were sent
      expect(service.sendNotification).toHaveBeenCalledTimes(2);
      expect(service.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: NotificationType.INSPECTION_COMPLETE,
          channel: NotificationChannel.WHATSAPP,
        }),
      );
      expect(service.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: NotificationType.INSPECTION_COMPLETE,
          channel: NotificationChannel.EMAIL,
        }),
      );
    });

    it('should send rejection notifications with reason', async () => {
      const testData = {
        tenantId: fc.sample(fc.uuid(), 1)[0],
        transactionId: fc.sample(fc.uuid(), 1)[0],
        vendorContact: 'vendor@example.com',
        rejectionReason: 'Poor quality material',
        variables: {
          vendorName: 'Test Vendor',
          vehicleNumber: 'MH12AB1234',
        },
      };

      jest.spyOn(service, 'sendNotification').mockResolvedValue({
        success: true,
        messageId: 'test-message-id',
      });

      await service.notifyRejection(
        testData.tenantId,
        testData.transactionId,
        testData.vendorContact,
        testData.rejectionReason,
        testData.variables,
      );

      // Verify rejection notifications were sent with reason
      expect(service.sendNotification).toHaveBeenCalledTimes(2);
      expect(service.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: NotificationType.MATERIAL_REJECTED,
          variables: expect.objectContaining({
            rejectionReason: testData.rejectionReason,
          }),
        }),
      );
    });
  });
});