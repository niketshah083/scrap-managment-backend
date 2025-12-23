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
exports.PurchaseOrderService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const purchase_order_entity_1 = require("../entities/purchase-order.entity");
const vendor_entity_1 = require("../entities/vendor.entity");
const audit_service_1 = require("../audit/audit.service");
let PurchaseOrderService = class PurchaseOrderService {
    constructor(poRepository, vendorRepository, auditService) {
        this.poRepository = poRepository;
        this.vendorRepository = vendorRepository;
        this.auditService = auditService;
    }
    async searchPOs(query, tenantId, limit = 10) {
        if (!query || query.length < 2) {
            return [];
        }
        const searchPattern = `%${query}%`;
        const pos = await this.poRepository
            .createQueryBuilder('po')
            .leftJoinAndSelect('po.vendor', 'vendor')
            .where('po.tenantId = :tenantId', { tenantId })
            .andWhere('po.isActive = :isActive', { isActive: true })
            .andWhere('(po.poNumber ILIKE :pattern OR vendor.vendorName ILIKE :pattern OR po.materialType ILIKE :pattern)', { pattern: searchPattern })
            .orderBy('po.createdAt', 'DESC')
            .take(limit)
            .getMany();
        return pos.map(po => this.mapToSearchResult(po));
    }
    async getPOById(id) {
        const po = await this.poRepository.findOne({
            where: { id },
            relations: ['vendor'],
        });
        if (!po) {
            throw new common_1.NotFoundException(`Purchase Order with ID ${id} not found`);
        }
        return this.mapToSearchResult(po);
    }
    async getPOByNumber(poNumber, tenantId) {
        const po = await this.poRepository.findOne({
            where: { poNumber, tenantId },
            relations: ['vendor'],
        });
        if (!po) {
            throw new common_1.NotFoundException(`Purchase Order ${poNumber} not found`);
        }
        return this.mapToSearchResult(po);
    }
    async validatePOForGRN(poId, requestedQuantity) {
        const po = await this.poRepository.findOne({
            where: { id: poId },
        });
        if (!po) {
            throw new common_1.NotFoundException(`Purchase Order with ID ${poId} not found`);
        }
        const remainingQuantity = Number(po.orderedQuantity) - Number(po.receivedQuantity);
        const isExpired = new Date() > new Date(po.deliveryDate);
        if (po.status === purchase_order_entity_1.POStatus.CANCELLED) {
            return {
                isValid: false,
                status: po.status,
                remainingQuantity,
                message: 'This Purchase Order has been cancelled and cannot be used for GRN',
                requiresApproval: false,
                isExpired,
            };
        }
        if (po.status === purchase_order_entity_1.POStatus.COMPLETED || remainingQuantity <= 0) {
            return {
                isValid: false,
                status: purchase_order_entity_1.POStatus.COMPLETED,
                remainingQuantity: 0,
                message: 'This Purchase Order is fully received. No more deliveries can be accepted.',
                requiresApproval: false,
                isExpired,
            };
        }
        if (requestedQuantity && requestedQuantity > remainingQuantity) {
            return {
                isValid: true,
                status: po.status,
                remainingQuantity,
                message: `Requested quantity (${requestedQuantity}) exceeds remaining quantity (${remainingQuantity}). Supervisor approval required.`,
                requiresApproval: true,
                isExpired,
            };
        }
        if (isExpired) {
            return {
                isValid: true,
                status: po.status,
                remainingQuantity,
                message: `This Purchase Order has expired (delivery date: ${po.deliveryDate}). You can proceed with confirmation.`,
                requiresApproval: false,
                isExpired: true,
            };
        }
        return {
            isValid: true,
            status: po.status,
            remainingQuantity,
            message: 'Purchase Order is valid for GRN creation',
            requiresApproval: false,
            isExpired: false,
        };
    }
    async updateReceivedQuantity(poId, additionalQuantity) {
        const po = await this.poRepository.findOne({ where: { id: poId } });
        if (!po) {
            throw new common_1.NotFoundException(`Purchase Order with ID ${poId} not found`);
        }
        const newReceivedQuantity = Number(po.receivedQuantity) + additionalQuantity;
        const orderedQuantity = Number(po.orderedQuantity);
        po.receivedQuantity = newReceivedQuantity;
        if (newReceivedQuantity >= orderedQuantity) {
            po.status = purchase_order_entity_1.POStatus.COMPLETED;
        }
        else if (newReceivedQuantity > 0) {
            po.status = purchase_order_entity_1.POStatus.PARTIAL;
        }
        return this.poRepository.save(po);
    }
    async createPO(dto) {
        let poNumber = dto.poNumber;
        if (!poNumber) {
            poNumber = await this.generatePONumber(dto.tenantId);
        }
        const existing = await this.poRepository.findOne({
            where: { poNumber, tenantId: dto.tenantId },
        });
        if (existing) {
            throw new common_1.BadRequestException(`Purchase Order ${poNumber} already exists`);
        }
        const vendor = await this.vendorRepository.findOne({
            where: { id: dto.vendorId, tenantId: dto.tenantId },
        });
        if (!vendor) {
            throw new common_1.NotFoundException(`Vendor with ID ${dto.vendorId} not found`);
        }
        const po = this.poRepository.create({
            ...dto,
            poNumber,
            receivedQuantity: 0,
            status: purchase_order_entity_1.POStatus.PENDING,
        });
        const savedPO = await this.poRepository.save(po);
        await this.auditService.logPOCreation(dto.createdBy || 'system', savedPO.id, {
            poNumber: savedPO.poNumber,
            vendorId: savedPO.vendorId,
            materialType: savedPO.materialType,
            orderedQuantity: savedPO.orderedQuantity,
            rate: savedPO.rate,
            unit: savedPO.unit,
            deliveryDate: savedPO.deliveryDate,
            status: savedPO.status,
        });
        return savedPO;
    }
    async generatePONumber(tenantId) {
        const year = new Date().getFullYear();
        const prefix = `PO-${year}`;
        const latestPO = await this.poRepository
            .createQueryBuilder('po')
            .where('po.tenantId = :tenantId', { tenantId })
            .andWhere('po.poNumber LIKE :prefix', { prefix: `${prefix}%` })
            .orderBy('po.createdAt', 'DESC')
            .getOne();
        let sequence = 1;
        if (latestPO) {
            const match = latestPO.poNumber.match(/PO-\d{4}-(\d+)/);
            if (match) {
                sequence = parseInt(match[1], 10) + 1;
            }
        }
        return `${prefix}-${sequence.toString().padStart(4, '0')}`;
    }
    async updatePO(id, dto, userId) {
        const po = await this.poRepository.findOne({ where: { id } });
        if (!po) {
            throw new common_1.NotFoundException(`Purchase Order with ID ${id} not found`);
        }
        if (po.status === purchase_order_entity_1.POStatus.COMPLETED || po.status === purchase_order_entity_1.POStatus.CANCELLED) {
            throw new common_1.BadRequestException(`Cannot update a ${po.status} Purchase Order`);
        }
        const oldValues = {
            materialType: po.materialType,
            materialDescription: po.materialDescription,
            orderedQuantity: po.orderedQuantity,
            rate: po.rate,
            unit: po.unit,
            deliveryDate: po.deliveryDate,
            notes: po.notes,
            status: po.status,
        };
        Object.assign(po, dto);
        const savedPO = await this.poRepository.save(po);
        await this.auditService.logPOUpdate(userId || 'system', savedPO.id, oldValues, dto);
        return savedPO;
    }
    async cancelPO(id, reason, userId) {
        const po = await this.poRepository.findOne({ where: { id } });
        if (!po) {
            throw new common_1.NotFoundException(`Purchase Order with ID ${id} not found`);
        }
        if (po.status === purchase_order_entity_1.POStatus.COMPLETED) {
            throw new common_1.BadRequestException('Cannot cancel a completed Purchase Order');
        }
        po.status = purchase_order_entity_1.POStatus.CANCELLED;
        if (reason) {
            po.notes = `${po.notes || ''}\nCancellation reason: ${reason}`.trim();
        }
        const savedPO = await this.poRepository.save(po);
        await this.auditService.logPOCancellation(userId || 'system', savedPO.id, reason);
        return savedPO;
    }
    async getPOsByVendor(vendorId, tenantId) {
        const pos = await this.poRepository.find({
            where: { vendorId, tenantId, isActive: true },
            relations: ['vendor'],
            order: { createdAt: 'DESC' },
        });
        return pos.map(po => this.mapToSearchResult(po));
    }
    async getPendingAndPartialPOs(tenantId) {
        const pos = await this.poRepository.find({
            where: {
                tenantId,
                isActive: true,
                status: (0, typeorm_2.In)([purchase_order_entity_1.POStatus.PENDING, purchase_order_entity_1.POStatus.PARTIAL]),
            },
            relations: ['vendor'],
            order: { deliveryDate: 'ASC' },
        });
        return pos.map(po => this.mapToSearchResult(po));
    }
    async getPendingPOs(tenantId) {
        return this.getPendingAndPartialPOs(tenantId);
    }
    mapToSearchResult(po) {
        const remainingQuantity = Number(po.orderedQuantity) - Number(po.receivedQuantity);
        const isExpired = new Date() > new Date(po.deliveryDate);
        return {
            id: po.id,
            poNumber: po.poNumber,
            vendorId: po.vendorId,
            vendorName: po.vendor?.vendorName || 'Unknown Vendor',
            materialType: po.materialType,
            materialDescription: po.materialDescription || '',
            orderedQuantity: Number(po.orderedQuantity),
            receivedQuantity: Number(po.receivedQuantity),
            remainingQuantity,
            rate: Number(po.rate),
            unit: po.unit,
            status: po.status,
            deliveryDate: po.deliveryDate,
            isExpired,
        };
    }
    async uploadDocuments(poId, files, uploadedBy) {
        const po = await this.poRepository.findOne({ where: { id: poId } });
        if (!po) {
            throw new common_1.NotFoundException(`Purchase Order with ID ${poId} not found`);
        }
        if (!po.documents) {
            po.documents = [];
        }
        const newDocuments = files.map(file => ({
            name: file.originalname,
            url: `/uploads/po/${poId}/${file.filename || file.originalname}`,
            type: file.mimetype,
            uploadedAt: new Date(),
            uploadedBy,
        }));
        po.documents = [...po.documents, ...newDocuments];
        const savedPO = await this.poRepository.save(po);
        await this.auditService.logPODocumentUpload(uploadedBy || 'system', savedPO.id, {
            documentsUploaded: newDocuments.length,
            documentNames: newDocuments.map(d => d.name),
        });
        return savedPO;
    }
};
exports.PurchaseOrderService = PurchaseOrderService;
exports.PurchaseOrderService = PurchaseOrderService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(purchase_order_entity_1.PurchaseOrder)),
    __param(1, (0, typeorm_1.InjectRepository)(vendor_entity_1.Vendor)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        audit_service_1.AuditService])
], PurchaseOrderService);
//# sourceMappingURL=purchase-order.service.js.map