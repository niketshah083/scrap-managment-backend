import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Tenant } from '../entities/tenant.entity';
import { Factory } from '../entities/factory.entity';
export declare class AuthDemoService {
    private userRepository;
    private tenantRepository;
    private factoryRepository;
    constructor(userRepository: Repository<User>, tenantRepository: Repository<Tenant>, factoryRepository: Repository<Factory>);
    createDemoData(): Promise<void>;
    private getDefaultPermissions;
}
