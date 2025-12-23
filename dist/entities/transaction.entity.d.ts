import { Tenant } from './tenant.entity';
import { Factory } from './factory.entity';
import { Vendor } from './vendor.entity';
import { Vehicle } from './vehicle.entity';
import { Evidence } from './evidence.entity';
import { AuditLog } from './audit-log.entity';
import { PurchaseOrder } from './purchase-order.entity';
export declare enum TransactionStatus {
    ACTIVE = "ACTIVE",
    COMPLETED = "COMPLETED",
    REJECTED = "REJECTED",
    CANCELLED = "CANCELLED"
}
export declare enum OperationalLevel {
    L1_VENDOR_DISPATCH = 1,
    L2_GATE_ENTRY = 2,
    L3_WEIGHBRIDGE_GROSS = 3,
    L4_MATERIAL_INSPECTION = 4,
    L5_WEIGHBRIDGE_TARE = 5,
    L6_GRN_GENERATION = 6,
    L7_GATE_PASS_EXIT = 7
}
export declare class Transaction {
    id: string;
    tenantId: string;
    factoryId: string;
    vendorId: string;
    vehicleId: string;
    transactionNumber: string;
    currentLevel: OperationalLevel;
    status: TransactionStatus;
    levelData: {
        [key: number]: {
            level: OperationalLevel;
            fieldValues: Record<string, any>;
            completedBy: string;
            completedAt: Date;
            evidenceIds: string[];
            validationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
            notes?: string;
        };
    };
    weighbridgeData: {
        grossWeight?: number;
        tareWeight?: number;
        netWeight?: number;
        grossWeightTimestamp?: Date;
        tareWeightTimestamp?: Date;
        grossWeightOperator?: string;
        tareWeightOperator?: string;
        weighbridgeTicketUrl?: string;
    };
    inspectionData: {
        grade?: string;
        contaminationLevel?: number;
        moistureLevel?: number;
        inspectorId?: string;
        inspectionTimestamp?: Date;
        inspectionReportUrl?: string;
        rejectionReason?: string;
        qualityNotes?: string;
    };
    grnDocumentUrl: string;
    gatePassQrCode: string;
    gatePassExpiresAt: Date;
    isLocked: boolean;
    completedAt: Date;
    purchaseOrderId: string;
    stepData: {
        [stepNumber: number]: {
            stepNumber: number;
            data: Record<string, any>;
            files: Record<string, {
                name: string;
                url: string;
                type: string;
            }[]>;
            timestamp: Date;
            userId: string;
        };
    };
    requiresSupervisorApproval: boolean;
    approvalReason: string;
    qcStatus: 'PENDING' | 'COMPLETED' | null;
    qcReportId: string;
    createdAt: Date;
    updatedAt: Date;
    tenant: Tenant;
    factory: Factory;
    vendor: Vendor;
    vehicle: Vehicle;
    evidence: Evidence[];
    auditLogs: AuditLog[];
    purchaseOrder: PurchaseOrder;
}
