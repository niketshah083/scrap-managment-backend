import { Tenant } from './tenant.entity';
import { Transaction } from './transaction.entity';
import { User } from './user.entity';
import { WorkflowConfiguration } from './workflow-configuration.entity';
export declare class Factory {
    id: string;
    tenantId: string;
    factoryName: string;
    factoryCode: string;
    address: string;
    latitude: number;
    longitude: number;
    weighbridgeConfig: {
        isIntegrated: boolean;
        equipmentModel?: string;
        connectionType?: string;
        connectionString?: string;
        discrepancyThreshold?: number;
    };
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    tenant: Tenant;
    transactions: Transaction[];
    users: User[];
    workflowConfigurations: WorkflowConfiguration[];
}
