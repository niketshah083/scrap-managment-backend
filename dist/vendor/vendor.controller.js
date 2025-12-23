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
exports.VendorController = exports.UpdateVendorDto = exports.CreateVendorDto = void 0;
const common_1 = require("@nestjs/common");
const vendor_service_1 = require("./vendor.service");
class CreateVendorDto {
}
exports.CreateVendorDto = CreateVendorDto;
class UpdateVendorDto extends CreateVendorDto {
}
exports.UpdateVendorDto = UpdateVendorDto;
let VendorController = class VendorController {
    constructor(vendorService) {
        this.vendorService = vendorService;
    }
    async getAllVendors(tenantId) {
        return this.vendorService.findAll(tenantId || 'test-tenant-1');
    }
    async getVendorById(id, tenantId) {
        return this.vendorService.findOne(id, tenantId || 'test-tenant-1');
    }
    async createVendor(createVendorDto, tenantId) {
        return this.vendorService.create(createVendorDto, tenantId || 'test-tenant-1');
    }
    async updateVendor(id, updateVendorDto, tenantId) {
        return this.vendorService.update(id, updateVendorDto, tenantId || 'test-tenant-1');
    }
    async toggleBlacklist(id, tenantId, body) {
        return this.vendorService.toggleBlacklist(id, tenantId || 'test-tenant-1', body.reason);
    }
    async deleteVendor(id, tenantId) {
        return this.vendorService.delete(id, tenantId || 'test-tenant-1');
    }
    async seedVendors(tenantId) {
        return this.vendorService.seedVendors(tenantId || 'test-tenant-1');
    }
};
exports.VendorController = VendorController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('tenantId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], VendorController.prototype, "getAllVendors", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('tenantId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], VendorController.prototype, "getVendorById", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Query)('tenantId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CreateVendorDto, String]),
    __metadata("design:returntype", Promise)
], VendorController.prototype, "createVendor", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('tenantId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, UpdateVendorDto, String]),
    __metadata("design:returntype", Promise)
], VendorController.prototype, "updateVendor", null);
__decorate([
    (0, common_1.Put)(':id/toggle-blacklist'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('tenantId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], VendorController.prototype, "toggleBlacklist", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('tenantId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], VendorController.prototype, "deleteVendor", null);
__decorate([
    (0, common_1.Post)('seed'),
    __param(0, (0, common_1.Query)('tenantId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], VendorController.prototype, "seedVendors", null);
exports.VendorController = VendorController = __decorate([
    (0, common_1.Controller)('vendors'),
    __metadata("design:paramtypes", [vendor_service_1.VendorService])
], VendorController);
//# sourceMappingURL=vendor.controller.js.map