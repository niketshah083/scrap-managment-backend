import { VendorService } from './vendor.service';
import { Vendor } from '../entities/vendor.entity';
export declare class CreateVendorDto {
    vendorName: string;
    gstNumber: string;
    panNumber: string;
    contactPersonName?: string;
    contactEmail?: string;
    contactPhone?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    bankName?: string;
    bankAccount?: string;
    ifscCode?: string;
    scrapTypesSupplied?: string[];
    isActive?: boolean;
    isBlacklisted?: boolean;
}
export declare class UpdateVendorDto extends CreateVendorDto {
    rating?: number;
}
export declare class VendorController {
    private readonly vendorService;
    constructor(vendorService: VendorService);
    getAllVendors(tenantId: string): Promise<Vendor[]>;
    getVendorById(id: string, tenantId: string): Promise<Vendor>;
    createVendor(createVendorDto: CreateVendorDto, tenantId: string): Promise<Vendor>;
    updateVendor(id: string, updateVendorDto: UpdateVendorDto, tenantId: string): Promise<Vendor>;
    toggleBlacklist(id: string, tenantId: string, body: {
        reason?: string;
    }): Promise<Vendor>;
    deleteVendor(id: string, tenantId: string): Promise<void>;
    seedVendors(tenantId: string): Promise<Vendor[]>;
}
