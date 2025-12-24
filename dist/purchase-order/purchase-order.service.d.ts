import { Repository } from 'typeorm';
import { PurchaseOrder, POStatus } from '../entities/purchase-order.entity';
import { Vendor } from '../entities/vendor.entity';
import { AuditService } from '../audit/audit.service';
export interface POValidationResult {
    isValid: boolean;
    status: POStatus;
    remainingQuantity: number;
    message: string;
    requiresApproval: boolean;
    isExpired: boolean;
}
export interface POSearchResult {
    id: string;
    poNumber: string;
    vendorId: string;
    vendorName: string;
    materialType: string;
    materialDescription: string;
    orderedQuantity: number;
    receivedQuantity: number;
    remainingQuantity: number;
    rate: number;
    unit: string;
    status: POStatus;
    deliveryDate: Date;
    isExpired: boolean;
}
export interface CreatePODto {
    tenantId: string;
    poNumber?: string;
    vendorId: string;
    materialType: string;
    materialDescription?: string;
    orderedQuantity: number;
    rate: number;
    unit?: string;
    deliveryDate: Date;
    notes?: string;
    createdBy?: string;
}
export interface UpdatePODto {
    materialType?: string;
    materialDescription?: string;
    orderedQuantity?: number;
    rate?: number;
    unit?: string;
    deliveryDate?: Date;
    notes?: string;
    status?: POStatus;
}
export declare class PurchaseOrderService {
    private poRepository;
    private vendorRepository;
    private auditService;
    constructor(poRepository: Repository<PurchaseOrder>, vendorRepository: Repository<Vendor>, auditService: AuditService);
    searchPOs(query: string, tenantId: string, limit?: number): Promise<POSearchResult[]>;
    getPOById(id: string): Promise<POSearchResult>;
    getPOByNumber(poNumber: string, tenantId: string): Promise<POSearchResult>;
    validatePOForGRN(poId: string, requestedQuantity?: number): Promise<POValidationResult>;
    updateReceivedQuantity(poId: string, additionalQuantity: number): Promise<PurchaseOrder>;
    createPO(dto: CreatePODto): Promise<PurchaseOrder>;
    private generatePONumber;
    updatePO(id: string, dto: UpdatePODto, userId?: string): Promise<PurchaseOrder>;
    cancelPO(id: string, reason?: string, userId?: string): Promise<PurchaseOrder>;
    getAllPOs(tenantId: string): Promise<POSearchResult[]>;
    getPOsByVendor(vendorId: string, tenantId: string): Promise<POSearchResult[]>;
    getPendingAndPartialPOs(tenantId: string): Promise<POSearchResult[]>;
    getPendingPOs(tenantId: string): Promise<POSearchResult[]>;
    private mapToSearchResult;
    uploadDocuments(poId: string, files: Express.Multer.File[], uploadedBy?: string): Promise<PurchaseOrder>;
}
