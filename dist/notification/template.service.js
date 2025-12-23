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
exports.TemplateService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const notification_template_entity_1 = require("../entities/notification-template.entity");
let TemplateService = class TemplateService {
    constructor(templateRepository) {
        this.templateRepository = templateRepository;
    }
    async getTemplate(tenantId, type, channel) {
        return this.templateRepository.findOne({
            where: {
                tenantId,
                type,
                channel,
                isActive: true,
            },
        });
    }
    async renderTemplate(template, variables) {
        const subject = this.replaceVariables(template.subject, variables);
        const content = this.replaceVariables(template.template, variables);
        return { subject, content };
    }
    replaceVariables(text, variables) {
        let result = text;
        Object.entries(variables).forEach(([key, value]) => {
            const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
            result = result.replace(regex, String(value || ''));
        });
        return result;
    }
    async createDefaultTemplates(tenantId) {
        const defaultTemplates = [
            {
                tenantId,
                type: notification_template_entity_1.NotificationType.INSPECTION_COMPLETE,
                channel: notification_template_entity_1.NotificationChannel.WHATSAPP,
                name: 'Inspection Complete - WhatsApp',
                subject: 'Material Inspection Completed',
                template: `Dear {{vendorName}},

Your material inspection for vehicle {{vehicleNumber}} has been completed.

Result: {{inspectionResult}}
Factory: {{factoryName}}
Time: {{timestamp}}

Thank you for your business.`,
                variables: {
                    vendorName: 'Vendor Name',
                    vehicleNumber: 'Vehicle Number',
                    inspectionResult: 'Inspection Result',
                    factoryName: 'Factory Name',
                    timestamp: 'Timestamp',
                },
            },
            {
                tenantId,
                type: notification_template_entity_1.NotificationType.MATERIAL_REJECTED,
                channel: notification_template_entity_1.NotificationChannel.EMAIL,
                name: 'Material Rejected - Email',
                subject: 'Material Rejection Notice - {{vehicleNumber}}',
                template: `Dear {{vendorName}},

We regret to inform you that the material delivered in vehicle {{vehicleNumber}} has been rejected.

Rejection Reason: {{rejectionReason}}
Factory: {{factoryName}}
Inspection Time: {{timestamp}}

Please contact our team for further details.

Best regards,
{{factoryName}} Team`,
                variables: {
                    vendorName: 'Vendor Name',
                    vehicleNumber: 'Vehicle Number',
                    rejectionReason: 'Rejection Reason',
                    factoryName: 'Factory Name',
                    timestamp: 'Timestamp',
                },
            },
            {
                tenantId,
                type: notification_template_entity_1.NotificationType.GRN_GENERATED,
                channel: notification_template_entity_1.NotificationChannel.WHATSAPP,
                name: 'GRN Generated - WhatsApp',
                subject: 'GRN Generated Successfully',
                template: `Dear {{vendorName}},

GRN has been generated for your material delivery.

GRN Number: {{grnNumber}}
Vehicle: {{vehicleNumber}}
Factory: {{factoryName}}
Generated at: {{timestamp}}

Your vehicle is now ready for exit processing.`,
                variables: {
                    vendorName: 'Vendor Name',
                    grnNumber: 'GRN Number',
                    vehicleNumber: 'Vehicle Number',
                    factoryName: 'Factory Name',
                    timestamp: 'Timestamp',
                },
            },
            {
                tenantId,
                type: notification_template_entity_1.NotificationType.WEIGHT_DEVIATION,
                channel: notification_template_entity_1.NotificationChannel.EMAIL,
                name: 'Weight Deviation Alert - Email',
                subject: 'Weight Deviation Alert - {{vehicleNumber}}',
                template: `Dear {{vendorName}},

A weight deviation has been detected for vehicle {{vehicleNumber}}.

Deviation: {{weightDeviation}}%
Factory: {{factoryName}}
Time: {{timestamp}}

Please review the weighment details.

Best regards,
{{factoryName}} Team`,
                variables: {
                    vendorName: 'Vendor Name',
                    vehicleNumber: 'Vehicle Number',
                    weightDeviation: 'Weight Deviation Percentage',
                    factoryName: 'Factory Name',
                    timestamp: 'Timestamp',
                },
            },
            {
                tenantId,
                type: notification_template_entity_1.NotificationType.GATE_PASS_ISSUED,
                channel: notification_template_entity_1.NotificationChannel.WHATSAPP,
                name: 'Gate Pass Issued - WhatsApp',
                subject: 'Gate Pass Issued',
                template: `Dear {{vendorName}},

Gate pass has been issued for vehicle {{vehicleNumber}}.

Gate Pass Number: {{gatePassNumber}}
Vehicle: {{vehicleNumber}}
Factory: {{factoryName}}
Issued at: {{timestamp}}

Your vehicle is cleared for exit.`,
                variables: {
                    vendorName: 'Vendor Name',
                    gatePassNumber: 'Gate Pass Number',
                    vehicleNumber: 'Vehicle Number',
                    factoryName: 'Factory Name',
                    timestamp: 'Timestamp',
                },
            },
        ];
        for (const templateData of defaultTemplates) {
            const existingTemplate = await this.templateRepository.findOne({
                where: {
                    tenantId: templateData.tenantId,
                    type: templateData.type,
                    channel: templateData.channel,
                },
            });
            if (!existingTemplate) {
                const template = this.templateRepository.create(templateData);
                await this.templateRepository.save(template);
            }
        }
    }
};
exports.TemplateService = TemplateService;
exports.TemplateService = TemplateService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(notification_template_entity_1.NotificationTemplate)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], TemplateService);
//# sourceMappingURL=template.service.js.map