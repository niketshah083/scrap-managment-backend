import { Tenant } from './tenant.entity';
import { PurchaseOrder } from './purchase-order.entity';
export declare class Vendor {
    id: string;
    tenantId: string;
    vendorName: string;
    gstNumber: string;
    panNumber: string;
    contactPersonName: string;
    contactEmail: string;
    contactPhone: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    bankName: string;
    bankAccount: string;
    ifscCode: string;
    rating: number;
    scrapTypesSupplied: string[];
    performanceMetrics: {
        rejectionPercentage: number;
        weightDeviationPercentage: number;
        inspectionFailureCount: number;
        totalTransactions: number;
        qualityScore: number;
        avgDeliveryTime: number;
        lastUpdated: Date;
    };
    poSummary: {
        totalPOs: number;
        pendingPOs: number;
        completedPOs: number;
        totalValue: number;
        pendingValue: number;
    };
    isBlacklisted: boolean;
    blacklistReason: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    tenant: Tenant;
    purchaseOrders: PurchaseOrder[];
}
