"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurchaseOrderController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const purchase_order_service_1 = require("./purchase-order.service");
let PurchaseOrderController = class PurchaseOrderController {
    constructor(poService) {
        this.poService = poService;
    }
    async getAllPOs(tenantId) {
        return this.poService.getAllPOs(tenantId);
    }
    async searchPOs(query, tenantId, limit) {
        return this.poService.searchPOs(query, tenantId, limit || 10);
    }
    async getPendingPOs(tenantId) {
        return this.poService.getPendingAndPartialPOs(tenantId);
    }
    async getPOsByVendor(vendorId, tenantId) {
        return this.poService.getPOsByVendor(vendorId, tenantId);
    }
    async getPOById(id) {
        return this.poService.getPOById(id);
    }
    async getPOByNumber(poNumber, tenantId) {
        return this.poService.getPOByNumber(poNumber, tenantId);
    }
    async validatePOForGRN(id, body) {
        return this.poService.validatePOForGRN(id, body.requestedQuantity);
    }
    async createPO(dto) {
        return this.poService.createPO(dto);
    }
    async uploadDocuments(id, files, uploadedBy) {
        return this.poService.uploadDocuments(id, files, uploadedBy);
    }
    async updatePO(id, dto) {
        return this.poService.updatePO(id, dto);
    }
    async updateReceivedQuantity(id, body) {
        return this.poService.updateReceivedQuantity(id, body.quantity);
    }
    async cancelPO(id, body) {
        await this.poService.cancelPO(id, body.reason);
    }
};
exports.PurchaseOrderController = PurchaseOrderController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get all purchase orders for a tenant' }),
    (0, swagger_1.ApiQuery)({ name: 'tenantId', description: 'Tenant UUID', required: true }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Returns all purchase orders' }),
    __param(0, (0, common_1.Query)('tenantId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PurchaseOrderController.prototype, "getAllPOs", null);
__decorate([
    (0, common_1.Get)('search'),
    (0, swagger_1.ApiOperation)({ summary: 'Search purchase orders by query string' }),
    (0, swagger_1.ApiQuery)({ name: 'query', description: 'Search query (min 2 characters)', required: true }),
    (0, swagger_1.ApiQuery)({ name: 'tenantId', description: 'Tenant UUID', required: true }),
    (0, swagger_1.ApiQuery)({ name: 'limit', description: 'Max results to return', required: false }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Returns matching purchase orders' }),
    __param(0, (0, common_1.Query)('query')),
    __param(1, (0, common_1.Query)('tenantId')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Number]),
    __metadata("design:returntype", Promise)
], PurchaseOrderController.prototype, "searchPOs", null);
__decorate([
    (0, common_1.Get)('pending'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all pending and partial purchase orders for a tenant' }),
    (0, swagger_1.ApiQuery)({ name: 'tenantId', description: 'Tenant UUID', required: true }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Returns pending and partial purchase orders' }),
    __param(0, (0, common_1.Query)('tenantId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PurchaseOrderController.prototype, "getPendingPOs", null);
__decorate([
    (0, common_1.Get)('vendor/:vendorId'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all purchase orders for a vendor' }),
    (0, swagger_1.ApiParam)({ name: 'vendorId', description: 'Vendor UUID' }),
    (0, swagger_1.ApiQuery)({ name: 'tenantId', description: 'Tenant UUID', required: true }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Returns vendor purchase orders' }),
    __param(0, (0, common_1.Param)('vendorId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)('tenantId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], PurchaseOrderController.prototype, "getPOsByVendor", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get purchase order by ID' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Purchase Order UUID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Returns the purchase order' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Purchase order not found' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PurchaseOrderController.prototype, "getPOById", null);
__decorate([
    (0, common_1.Get)('number/:poNumber'),
    (0, swagger_1.ApiOperation)({ summary: 'Get purchase order by PO number' }),
    (0, swagger_1.ApiParam)({ name: 'poNumber', description: 'Purchase Order Number' }),
    (0, swagger_1.ApiQuery)({ name: 'tenantId', description: 'Tenant UUID', required: true }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Returns the purchase order' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Purchase order not found' }),
    __param(0, (0, common_1.Param)('poNumber')),
    __param(1, (0, common_1.Query)('tenantId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], PurchaseOrderController.prototype, "getPOByNumber", null);
__decorate([
    (0, common_1.Post)(':id/validate'),
    (0, swagger_1.ApiOperation)({ summary: 'Validate if PO can be used for GRN creation' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Purchase Order UUID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Returns validation result' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Purchase order not found' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PurchaseOrderController.prototype, "validatePOForGRN", null);
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new purchase order' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Purchase order created successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Invalid input or PO number already exists' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PurchaseOrderController.prototype, "createPO", null);
__decorate([
    (0, common_1.Post)(':id/documents'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FilesInterceptor)('files', 10)),
    (0, swagger_1.ApiOperation)({ summary: 'Upload documents for a purchase order' }),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Purchase Order UUID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Documents uploaded successfully' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Purchase order not found' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.UploadedFiles)()),
    __param(2, (0, common_1.Body)('uploadedBy')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Array, String]),
    __metadata("design:returntype", Promise)
], PurchaseOrderController.prototype, "uploadDocuments", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Update a purchase order' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Purchase Order UUID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Purchase order updated successfully' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Purchase order not found' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Cannot update completed/cancelled PO' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PurchaseOrderController.prototype, "updatePO", null);
__decorate([
    (0, common_1.Put)(':id/receive'),
    (0, swagger_1.ApiOperation)({ summary: 'Update received quantity after GRN completion' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Purchase Order UUID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Received quantity updated' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Purchase order not found' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PurchaseOrderController.prototype, "updateReceivedQuantity", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, swagger_1.ApiOperation)({ summary: 'Cancel a purchase order' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Purchase Order UUID' }),
    (0, swagger_1.ApiResponse)({ status: 204, description: 'Purchase order cancelled' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Purchase order not found' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Cannot cancel completed PO' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PurchaseOrderController.prototype, "cancelPO", null);
exports.PurchaseOrderController = PurchaseOrderController = __decorate([
    (0, swagger_1.ApiTags)('Purchase Orders'),
    (0, common_1.Controller)('po'),
    __metadata("design:paramtypes", [purchase_order_service_1.PurchaseOrderService])
], PurchaseOrderController);
//# sourceMappingURL=purchase-order.controller.js.map