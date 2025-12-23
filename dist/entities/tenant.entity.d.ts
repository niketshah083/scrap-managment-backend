import { Factory } from './factory.entity';
import { User } from './user.entity';
import { Transaction } from './transaction.entity';
import { Vendor } from './vendor.entity';
import { Vehicle } from './vehicle.entity';
export declare class Tenant {
    id: string;
    companyName: string;
    gstNumber: string;
    panNumber: string;
    email: string;
    phone: string;
    address: string;
    subscriptionPlan: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    factories: Factory[];
    users: User[];
    transactions: Transaction[];
    vendors: Vendor[];
    vehicles: Vehicle[];
}
