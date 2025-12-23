import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, ILike, In } from 'typeorm';
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
  poNumber?: string; // Optional - will be auto-generated if not provided
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

@Injectable()
export class PurchaseOrderService {
  constructor(
    @InjectRepository(PurchaseOrder)
    private poRepository: Repository<PurchaseOrder>,
    @InjectRepository(Vendor)
    private vendorRepository: Repository<Vendor>,
    private auditService: AuditService,
  ) {}

  /**
   * Search POs by query string matching poNumber, vendor name, or material type
   */
  async searchPOs(query: string, tenantId: string, limit = 10): Promise<POSearchResult[]> {
    if (!query || query.length < 2) {
      return [];
    }

    const searchPattern = `%${query}%`;

    // Search with vendor join
    const pos = await this.poRepository
      .createQueryBuilder('po')
      .leftJoinAndSelect('po.vendor', 'vendor')
      .where('po.tenantId = :tenantId', { tenantId })
      .andWhere('po.isActive = :isActive', { isActive: true })
      .andWhere(
        '(po.poNumber ILIKE :pattern OR vendor.vendorName ILIKE :pattern OR po.materialType ILIKE :pattern)',
        { pattern: searchPattern }
      )
      .orderBy('po.createdAt', 'DESC')
      .take(limit)
      .getMany();

    return pos.map(po => this.mapToSearchResult(po));
  }

  /**
   * Get PO by ID with vendor details
   */
  async getPOById(id: string): Promise<POSearchResult> {
    const po = await this.poRepository.findOne({
      where: { id },
      relations: ['vendor'],
    });

    if (!po) {
      throw new NotFoundException(`Purchase Order with ID ${id} not found`);
    }

    return this.mapToSearchResult(po);
  }

  /**
   * Get PO by PO Number
   */
  async getPOByNumber(poNumber: string, tenantId: string): Promise<POSearchResult> {
    const po = await this.poRepository.findOne({
      where: { poNumber, tenantId },
      relations: ['vendor'],
    });

    if (!po) {
      throw new NotFoundException(`Purchase Order ${poNumber} not found`);
    }

    return this.mapToSearchResult(po);
  }

  /**
   * Validate if a PO can be used for GRN creation
   */
  async validatePOForGRN(poId: string, requestedQuantity?: number): Promise<POValidationResult> {
    const po = await this.poRepository.findOne({
      where: { id: poId },
    });

    if (!po) {
      throw new NotFoundException(`Purchase Order with ID ${poId} not found`);
    }

    const remainingQuantity = Number(po.orderedQuantity) - Number(po.receivedQuantity);
    const isExpired = new Date() > new Date(po.deliveryDate);

    // Check if PO is cancelled
    if (po.status === POStatus.CANCELLED) {
      return {
        isValid: false,
        status: po.status,
        remainingQuantity,
        message: 'This Purchase Order has been cancelled and cannot be used for GRN',
        requiresApproval: false,
        isExpired,
      };
    }

    // Check if PO is completed
    if (po.status === POStatus.COMPLETED || remainingQuantity <= 0) {
      return {
        isValid: false,
        status: POStatus.COMPLETED,
        remainingQuantity: 0,
        message: 'This Purchase Order is fully received. No more deliveries can be accepted.',
        requiresApproval: false,
        isExpired,
      };
    }

    // Check for over-receipt
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

    // Check if expired
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

    // Valid PO
    return {
      isValid: true,
      status: po.status,
      remainingQuantity,
      message: 'Purchase Order is valid for GRN creation',
      requiresApproval: false,
      isExpired: false,
    };
  }

  /**
   * Update received quantity after transaction completion
   */
  async updateReceivedQuantity(poId: string, additionalQuantity: number): Promise<PurchaseOrder> {
    const po = await this.poRepository.findOne({ where: { id: poId } });

    if (!po) {
      throw new NotFoundException(`Purchase Order with ID ${poId} not found`);
    }

    const newReceivedQuantity = Number(po.receivedQuantity) + additionalQuantity;
    const orderedQuantity = Number(po.orderedQuantity);

    // Update received quantity
    po.receivedQuantity = newReceivedQuantity;

    // Update status based on received quantity
    if (newReceivedQuantity >= orderedQuantity) {
      po.status = POStatus.COMPLETED;
    } else if (newReceivedQuantity > 0) {
      po.status = POStatus.PARTIAL;
    }

    return this.poRepository.save(po);
  }

  /**
   * Create a new Purchase Order
   */
  async createPO(dto: CreatePODto): Promise<PurchaseOrder> {
    // Auto-generate PO number if not provided
    let poNumber = dto.poNumber;
    if (!poNumber) {
      poNumber = await this.generatePONumber(dto.tenantId);
    }

    // Check if PO number already exists for tenant
    const existing = await this.poRepository.findOne({
      where: { poNumber, tenantId: dto.tenantId },
    });

    if (existing) {
      throw new BadRequestException(`Purchase Order ${poNumber} already exists`);
    }

    // Verify vendor exists
    const vendor = await this.vendorRepository.findOne({
      where: { id: dto.vendorId, tenantId: dto.tenantId },
    });

    if (!vendor) {
      throw new NotFoundException(`Vendor with ID ${dto.vendorId} not found`);
    }

    const po = this.poRepository.create({
      ...dto,
      poNumber,
      receivedQuantity: 0,
      status: POStatus.PENDING,
    });

    const savedPO = await this.poRepository.save(po);

    // Create audit log for PO creation
    await this.auditService.logPOCreation(
      dto.createdBy || 'system',
      savedPO.id,
      {
        poNumber: savedPO.poNumber,
        vendorId: savedPO.vendorId,
        materialType: savedPO.materialType,
        orderedQuantity: savedPO.orderedQuantity,
        rate: savedPO.rate,
        unit: savedPO.unit,
        deliveryDate: savedPO.deliveryDate,
        status: savedPO.status,
      },
    );

    return savedPO;
  }

  /**
   * Generate unique PO number for tenant
   */
  private async generatePONumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `PO-${year}`;

    // Get the latest PO number for this tenant and year
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

  /**
   * Update a Purchase Order
   */
  async updatePO(id: string, dto: UpdatePODto, userId?: string): Promise<PurchaseOrder> {
    const po = await this.poRepository.findOne({ where: { id } });

    if (!po) {
      throw new NotFoundException(`Purchase Order with ID ${id} not found`);
    }

    // Don't allow updates to completed or cancelled POs
    if (po.status === POStatus.COMPLETED || po.status === POStatus.CANCELLED) {
      throw new BadRequestException(`Cannot update a ${po.status} Purchase Order`);
    }

    // Capture old values for audit
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

    // Create audit log for PO update
    await this.auditService.logPOUpdate(
      userId || 'system',
      savedPO.id,
      oldValues,
      dto,
    );

    return savedPO;
  }

  /**
   * Cancel a Purchase Order
   */
  async cancelPO(id: string, reason?: string, userId?: string): Promise<PurchaseOrder> {
    const po = await this.poRepository.findOne({ where: { id } });

    if (!po) {
      throw new NotFoundException(`Purchase Order with ID ${id} not found`);
    }

    if (po.status === POStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel a completed Purchase Order');
    }

    po.status = POStatus.CANCELLED;
    if (reason) {
      po.notes = `${po.notes || ''}\nCancellation reason: ${reason}`.trim();
    }

    const savedPO = await this.poRepository.save(po);

    // Create audit log for PO cancellation
    await this.auditService.logPOCancellation(
      userId || 'system',
      savedPO.id,
      reason,
    );

    return savedPO;
  }

  /**
   * Get all POs for a vendor
   */
  async getPOsByVendor(vendorId: string, tenantId: string): Promise<POSearchResult[]> {
    const pos = await this.poRepository.find({
      where: { vendorId, tenantId, isActive: true },
      relations: ['vendor'],
      order: { createdAt: 'DESC' },
    });

    return pos.map(po => this.mapToSearchResult(po));
  }

  /**
   * Get pending and partial POs for a tenant (for GRN entry)
   * Excludes COMPLETED and CANCELLED POs
   */
  async getPendingAndPartialPOs(tenantId: string): Promise<POSearchResult[]> {
    const pos = await this.poRepository.find({
      where: { 
        tenantId, 
        isActive: true,
        status: In([POStatus.PENDING, POStatus.PARTIAL]),
      },
      relations: ['vendor'],
      order: { deliveryDate: 'ASC' },
    });

    return pos.map(po => this.mapToSearchResult(po));
  }

  /**
   * Get pending POs for a tenant (alias for getPendingAndPartialPOs)
   */
  async getPendingPOs(tenantId: string): Promise<POSearchResult[]> {
    return this.getPendingAndPartialPOs(tenantId);
  }

  /**
   * Map PurchaseOrder entity to search result
   */
  private mapToSearchResult(po: PurchaseOrder): POSearchResult {
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

  /**
   * Upload documents for a PO
   */
  async uploadDocuments(
    poId: string, 
    files: Express.Multer.File[], 
    uploadedBy?: string
  ): Promise<PurchaseOrder> {
    const po = await this.poRepository.findOne({ where: { id: poId } });

    if (!po) {
      throw new NotFoundException(`Purchase Order with ID ${poId} not found`);
    }

    // Initialize documents array if not exists
    if (!po.documents) {
      po.documents = [];
    }

    // Add new documents
    const newDocuments = files.map(file => ({
      name: file.originalname,
      url: `/uploads/po/${poId}/${file.filename || file.originalname}`, // In production, this would be S3 URL
      type: file.mimetype,
      uploadedAt: new Date(),
      uploadedBy,
    }));

    po.documents = [...po.documents, ...newDocuments];

    const savedPO = await this.poRepository.save(po);

    // Create audit log for document upload
    await this.auditService.logPODocumentUpload(
      uploadedBy || 'system',
      savedPO.id,
      {
        documentsUploaded: newDocuments.length,
        documentNames: newDocuments.map(d => d.name),
      },
    );

    return savedPO;
  }
}
