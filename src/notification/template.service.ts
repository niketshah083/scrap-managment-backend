import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationTemplate, NotificationType, NotificationChannel } from '../entities/notification-template.entity';
import { TemplateVariables } from './interfaces/notification.interface';

@Injectable()
export class TemplateService {
  constructor(
    @InjectRepository(NotificationTemplate)
    private templateRepository: Repository<NotificationTemplate>,
  ) {}

  async getTemplate(
    tenantId: string,
    type: NotificationType,
    channel: NotificationChannel,
  ): Promise<NotificationTemplate | null> {
    return this.templateRepository.findOne({
      where: {
        tenantId,
        type,
        channel,
        isActive: true,
      },
    });
  }

  async renderTemplate(
    template: NotificationTemplate,
    variables: TemplateVariables,
  ): Promise<{ subject: string; content: string }> {
    const subject = this.replaceVariables(template.subject, variables);
    const content = this.replaceVariables(template.template, variables);

    return { subject, content };
  }

  private replaceVariables(text: string, variables: TemplateVariables): string {
    let result = text;
    
    // Replace variables in format {{variableName}}
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(regex, String(value || ''));
    });

    return result;
  }

  async createDefaultTemplates(tenantId: string): Promise<void> {
    const defaultTemplates = [
      {
        tenantId,
        type: NotificationType.INSPECTION_COMPLETE,
        channel: NotificationChannel.WHATSAPP,
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
        type: NotificationType.MATERIAL_REJECTED,
        channel: NotificationChannel.EMAIL,
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
        type: NotificationType.GRN_GENERATED,
        channel: NotificationChannel.WHATSAPP,
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
        type: NotificationType.WEIGHT_DEVIATION,
        channel: NotificationChannel.EMAIL,
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
        type: NotificationType.GATE_PASS_ISSUED,
        channel: NotificationChannel.WHATSAPP,
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
}