export declare enum NotificationType {
    INSPECTION_COMPLETE = "inspection_complete",
    MATERIAL_REJECTED = "material_rejected",
    GRN_GENERATED = "grn_generated",
    WEIGHT_DEVIATION = "weight_deviation",
    GATE_PASS_ISSUED = "gate_pass_issued"
}
export declare enum NotificationChannel {
    WHATSAPP = "whatsapp",
    EMAIL = "email",
    SMS = "sms"
}
export declare class NotificationTemplate {
    id: string;
    tenantId: string;
    type: NotificationType;
    channel: NotificationChannel;
    name: string;
    subject: string;
    template: string;
    variables: Record<string, any>;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
