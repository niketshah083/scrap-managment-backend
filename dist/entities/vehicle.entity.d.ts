import { Tenant } from './tenant.entity';
import { Transaction } from './transaction.entity';
export declare class Vehicle {
    id: string;
    tenantId: string;
    vehicleNumber: string;
    driverName: string;
    driverMobile: string;
    driverPhotoUrl: string;
    vehicleType: string;
    visitHistory: Array<{
        transactionId: string;
        visitDate: Date;
        factoryId: string;
        status: string;
    }>;
    isBlacklisted: boolean;
    blacklistReason: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    tenant: Tenant;
    transactions: Transaction[];
}
