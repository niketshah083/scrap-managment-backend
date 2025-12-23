import { Tenant } from './tenant.entity';
import { Vendor } from './vendor.entity';
export declare enum POStatus {
    PENDING = "PENDING",
    PARTIAL = "PARTIAL",
    COMPLETED = "COMPLETED",
    CANCELLED = "CANCELLED",
    EXPIRED = "EXPIRED"
}
export declare class PurchaseOrder {
    id: string;
    tenantId: string;
    poNumber: string;
    vendorId: string;
    materialType: string;
    materialDescription: string;
    orderedQuantity: number;
    receivedQuantity: number;
    rate: number;
    unit: string;
    status: POStatus;
    deliveryDate: Date;
    notes: string;
    createdBy: string;
    isActive: boolean;
    documents: {
        name: string;
        url: string;
        type: string;
        uploadedAt: Date;
        uploadedBy?: string;
    }[];
    createdAt: Date;
    updatedAt: Date;
    get remainingQuantity(): number;
    get totalAmount(): number;
    get isExpired(): boolean;
    get canReceiveMore(): boolean;
    tenant: Tenant;
    vendor: Vendor;
}
