"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const typeorm_1 = require("@nestjs/typeorm");
const fc = require("fast-check");
const notification_service_1 = require("./notification.service");
const template_service_1 = require("./template.service");
const whatsapp_service_1 = require("./whatsapp.service");
const email_service_1 = require("./email.service");
const delivery_tracking_service_1 = require("./delivery-tracking.service");
const notification_log_entity_1 = require("../entities/notification-log.entity");
const notification_template_entity_1 = require("../entities/notification-template.entity");
describe('NotificationService', () => {
    let service;
    let notificationLogRepository;
    let templateService;
    let whatsAppService;
    let emailService;
    let deliveryTrackingService;
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
        const module = await testing_1.Test.createTestingModule({
            providers: [
                notification_service_1.NotificationService,
                {
                    provide: (0, typeorm_1.getRepositoryToken)(notification_log_entity_1.NotificationLog),
                    useValue: mockNotificationLogRepository,
                },
                {
                    provide: template_service_1.TemplateService,
                    useValue: mockTemplateService,
                },
                {
                    provide: whatsapp_service_1.WhatsAppService,
                    useValue: mockWhatsAppService,
                },
                {
                    provide: email_service_1.EmailService,
                    useValue: mockEmailService,
                },
                {
                    provide: delivery_tracking_service_1.DeliveryTrackingService,
                    useValue: mockDeliveryTrackingService,
                },
            ],
        }).compile();
        service = module.get(notification_service_1.NotificationService);
        notificationLogRepository = module.get((0, typeorm_1.getRepositoryToken)(notification_log_entity_1.NotificationLog));
        templateService = module.get(template_service_1.TemplateService);
        whatsAppService = module.get(whatsapp_service_1.WhatsAppService);
        emailService = module.get(email_service_1.EmailService);
        deliveryTrackingService = module.get(delivery_tracking_service_1.DeliveryTrackingService);
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    describe('Property 16: Comprehensive Notification System', () => {
        it('should send notifications for all significant transaction events via configured channels', async () => {
            await fc.assert(fc.asyncProperty(fc.record({
                tenantId: fc.uuid(),
                transactionId: fc.uuid(),
                vendorContact: fc.emailAddress(),
                factoryName: fc.string({ minLength: 1, maxLength: 50 }),
                vehicleNumber: fc.string({ minLength: 5, maxLength: 15 }),
                timestamp: fc.date(),
            }), fc.oneof(fc.constant(notification_template_entity_1.NotificationType.INSPECTION_COMPLETE), fc.constant(notification_template_entity_1.NotificationType.MATERIAL_REJECTED), fc.constant(notification_template_entity_1.NotificationType.GRN_GENERATED), fc.constant(notification_template_entity_1.NotificationType.WEIGHT_DEVIATION), fc.constant(notification_template_entity_1.NotificationType.GATE_PASS_ISSUED)), fc.oneof(fc.constant(notification_template_entity_1.NotificationChannel.WHATSAPP), fc.constant(notification_template_entity_1.NotificationChannel.EMAIL)), async (testData, notificationType, channel) => {
                jest.clearAllMocks();
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
                    status: notification_log_entity_1.DeliveryStatus.PENDING,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                };
                const mockSendResult = {
                    success: true,
                    messageId: fc.sample(fc.uuid(), 1)[0],
                    externalId: fc.sample(fc.uuid(), 1)[0],
                };
                mockTemplateService.getTemplate.mockResolvedValue(mockTemplate);
                mockTemplateService.renderTemplate.mockResolvedValue(mockRenderedTemplate);
                mockNotificationLogRepository.create.mockReturnValue(mockNotificationLog);
                mockNotificationLogRepository.save.mockResolvedValue(mockNotificationLog);
                mockNotificationLogRepository.update.mockResolvedValue({ affected: 1 });
                if (channel === notification_template_entity_1.NotificationChannel.WHATSAPP) {
                    mockWhatsAppService.sendMessage.mockResolvedValue(mockSendResult);
                }
                else {
                    mockEmailService.sendEmail.mockResolvedValue(mockSendResult);
                }
                const request = {
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
                const result = await service.sendNotification(request);
                expect(result.success).toBe(true);
                expect(result.messageId).toBe(mockNotificationLog.id);
                expect(mockTemplateService.getTemplate).toHaveBeenCalledWith(testData.tenantId, notificationType, channel);
                expect(mockTemplateService.renderTemplate).toHaveBeenCalledWith(mockTemplate, request.variables);
                expect(mockNotificationLogRepository.create).toHaveBeenCalledWith(expect.objectContaining({
                    tenantId: testData.tenantId,
                    transactionId: testData.transactionId,
                    type: notificationType,
                    channel,
                    recipient: testData.vendorContact,
                    subject: mockRenderedTemplate.subject,
                    content: mockRenderedTemplate.content,
                    status: notification_log_entity_1.DeliveryStatus.PENDING,
                }));
                if (channel === notification_template_entity_1.NotificationChannel.WHATSAPP) {
                    expect(mockWhatsAppService.sendMessage).toHaveBeenCalledWith(testData.vendorContact, mockRenderedTemplate.content, mockRenderedTemplate.subject);
                    expect(mockEmailService.sendEmail).not.toHaveBeenCalled();
                }
                else {
                    expect(mockEmailService.sendEmail).toHaveBeenCalledWith(testData.vendorContact, mockRenderedTemplate.subject, mockRenderedTemplate.content);
                    expect(mockWhatsAppService.sendMessage).not.toHaveBeenCalled();
                }
                expect(mockNotificationLogRepository.update).toHaveBeenCalledWith(mockNotificationLog.id, expect.objectContaining({
                    status: notification_log_entity_1.DeliveryStatus.SENT,
                    externalId: mockSendResult.externalId,
                    sentAt: expect.any(Date),
                }));
            }), { numRuns: 100 });
        });
        it('should handle notification failures gracefully and log errors', async () => {
            await fc.assert(fc.asyncProperty(fc.record({
                tenantId: fc.uuid(),
                transactionId: fc.uuid(),
                vendorContact: fc.emailAddress(),
            }), fc.oneof(fc.constant(notification_template_entity_1.NotificationChannel.WHATSAPP), fc.constant(notification_template_entity_1.NotificationChannel.EMAIL)), async (testData, channel) => {
                jest.clearAllMocks();
                const mockTemplate = {
                    id: fc.sample(fc.uuid(), 1)[0],
                    tenantId: testData.tenantId,
                    type: notification_template_entity_1.NotificationType.INSPECTION_COMPLETE,
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
                    type: notification_template_entity_1.NotificationType.INSPECTION_COMPLETE,
                    channel,
                    recipient: testData.vendorContact,
                    subject: mockRenderedTemplate.subject,
                    content: mockRenderedTemplate.content,
                    status: notification_log_entity_1.DeliveryStatus.PENDING,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                };
                const mockFailureResult = {
                    success: false,
                    error: 'Service unavailable',
                };
                mockTemplateService.getTemplate.mockResolvedValue(mockTemplate);
                mockTemplateService.renderTemplate.mockResolvedValue(mockRenderedTemplate);
                mockNotificationLogRepository.create.mockReturnValue(mockNotificationLog);
                mockNotificationLogRepository.save.mockResolvedValue(mockNotificationLog);
                mockNotificationLogRepository.update.mockResolvedValue({ affected: 1 });
                if (channel === notification_template_entity_1.NotificationChannel.WHATSAPP) {
                    mockWhatsAppService.sendMessage.mockResolvedValue(mockFailureResult);
                }
                else {
                    mockEmailService.sendEmail.mockResolvedValue(mockFailureResult);
                }
                const request = {
                    tenantId: testData.tenantId,
                    transactionId: testData.transactionId,
                    type: notification_template_entity_1.NotificationType.INSPECTION_COMPLETE,
                    channel,
                    recipient: testData.vendorContact,
                    variables: {},
                };
                const result = await service.sendNotification(request);
                expect(result.success).toBe(false);
                expect(result.error).toBe('Service unavailable');
                expect(mockNotificationLogRepository.update).toHaveBeenCalledWith(mockNotificationLog.id, expect.objectContaining({
                    status: notification_log_entity_1.DeliveryStatus.FAILED,
                    errorMessage: 'Service unavailable',
                }));
            }), { numRuns: 50 });
        });
        it('should handle missing templates gracefully', async () => {
            await fc.assert(fc.asyncProperty(fc.record({
                tenantId: fc.uuid(),
                transactionId: fc.uuid(),
                vendorContact: fc.emailAddress(),
            }), fc.oneof(fc.constant(notification_template_entity_1.NotificationType.INSPECTION_COMPLETE), fc.constant(notification_template_entity_1.NotificationType.MATERIAL_REJECTED)), fc.oneof(fc.constant(notification_template_entity_1.NotificationChannel.WHATSAPP), fc.constant(notification_template_entity_1.NotificationChannel.EMAIL)), async (testData, notificationType, channel) => {
                jest.clearAllMocks();
                mockTemplateService.getTemplate.mockResolvedValue(null);
                const request = {
                    tenantId: testData.tenantId,
                    transactionId: testData.transactionId,
                    type: notificationType,
                    channel,
                    recipient: testData.vendorContact,
                    variables: {},
                };
                const result = await service.sendNotification(request);
                expect(result.success).toBe(false);
                expect(result.error).toBe('Template not found');
                expect(mockNotificationLogRepository.create).not.toHaveBeenCalled();
                expect(mockWhatsAppService.sendMessage).not.toHaveBeenCalled();
                expect(mockEmailService.sendEmail).not.toHaveBeenCalled();
            }), { numRuns: 30 });
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
            jest.spyOn(service, 'sendNotification').mockResolvedValue({
                success: true,
                messageId: 'test-message-id',
            });
            await service.sendInspectionReport(testData.tenantId, testData.transactionId, testData.vendorContact, testData.variables);
            expect(service.sendNotification).toHaveBeenCalledTimes(2);
            expect(service.sendNotification).toHaveBeenCalledWith(expect.objectContaining({
                type: notification_template_entity_1.NotificationType.INSPECTION_COMPLETE,
                channel: notification_template_entity_1.NotificationChannel.WHATSAPP,
            }));
            expect(service.sendNotification).toHaveBeenCalledWith(expect.objectContaining({
                type: notification_template_entity_1.NotificationType.INSPECTION_COMPLETE,
                channel: notification_template_entity_1.NotificationChannel.EMAIL,
            }));
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
            await service.notifyRejection(testData.tenantId, testData.transactionId, testData.vendorContact, testData.rejectionReason, testData.variables);
            expect(service.sendNotification).toHaveBeenCalledTimes(2);
            expect(service.sendNotification).toHaveBeenCalledWith(expect.objectContaining({
                type: notification_template_entity_1.NotificationType.MATERIAL_REJECTED,
                variables: expect.objectContaining({
                    rejectionReason: testData.rejectionReason,
                }),
            }));
        });
    });
});
//# sourceMappingURL=notification.service.spec.js.map