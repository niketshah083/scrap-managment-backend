import { PurchaseOrderService, CreatePODto, UpdatePODto, POSearchResult, POValidationResult } from './purchase-order.service';
export declare class PurchaseOrderController {
    private readonly poService;
    constructor(poService: PurchaseOrderService);
    searchPOs(query: string, tenantId: string, limit?: number): Promise<POSearchResult[]>;
    getPendingPOs(tenantId: string): Promise<POSearchResult[]>;
    getPOsByVendor(vendorId: string, tenantId: string): Promise<POSearchResult[]>;
    getPOById(id: string): Promise<POSearchResult>;
    getPOByNumber(poNumber: string, tenantId: string): Promise<POSearchResult>;
    validatePOForGRN(id: string, body: {
        requestedQuantity?: number;
    }): Promise<POValidationResult>;
    createPO(dto: CreatePODto): Promise<import("../entities").PurchaseOrder>;
    uploadDocuments(id: string, files: Express.Multer.File[], uploadedBy?: string): Promise<import("../entities").PurchaseOrder>;
    updatePO(id: string, dto: UpdatePODto): Promise<import("../entities").PurchaseOrder>;
    updateReceivedQuantity(id: string, body: {
        quantity: number;
    }): Promise<import("../entities").PurchaseOrder>;
    cancelPO(id: string, body: {
        reason?: string;
    }): Promise<void>;
}
