"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fc = require("fast-check");
class MockPORepository {
    constructor() {
        this.pos = new Map();
        this.poNumbersByTenant = new Map();
    }
    async save(po) {
        const id = po.id || `po-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const savedPO = { ...po, id };
        this.pos.set(id, savedPO);
        if (!this.poNumbersByTenant.has(po.tenantId)) {
            this.poNumbersByTenant.set(po.tenantId, new Set());
        }
        this.poNumbersByTenant.get(po.tenantId).add(po.poNumber);
        return savedPO;
    }
    async findOne(options) {
        if (options.where.id) {
            return this.pos.get(options.where.id) || null;
        }
        if (options.where.poNumber && options.where.tenantId) {
            for (const po of this.pos.values()) {
                if (po.poNumber === options.where.poNumber && po.tenantId === options.where.tenantId) {
                    return po;
                }
            }
        }
        return null;
    }
    async find(options) {
        const results = [];
        for (const po of this.pos.values()) {
            let match = true;
            for (const [key, value] of Object.entries(options.where)) {
                if (Array.isArray(value)) {
                    if (!value.includes(po[key])) {
                        match = false;
                        break;
                    }
                }
                else if (po[key] !== value) {
                    match = false;
                    break;
                }
            }
            if (match) {
                results.push(po);
            }
        }
        return results;
    }
    clear() {
        this.pos.clear();
        this.poNumbersByTenant.clear();
    }
}
class MockVendorRepository {
    constructor() {
        this.vendors = new Map();
    }
    addVendor(vendor) {
        this.vendors.set(vendor.id, vendor);
    }
    async findOne(options) {
        if (options.where.id && options.where.tenantId) {
            const vendor = this.vendors.get(options.where.id);
            if (vendor && vendor.tenantId === options.where.tenantId) {
                return vendor;
            }
        }
        return null;
    }
}
class POServiceSimulation {
    constructor() {
        this.poRepo = new MockPORepository();
        this.vendorRepo = new MockVendorRepository();
        this.sequenceByTenant = new Map();
    }
    addVendor(vendor) {
        this.vendorRepo.addVendor(vendor);
    }
    async generatePONumber(tenantId) {
        const year = new Date().getFullYear();
        const prefix = `PO-${year}`;
        const currentSequence = this.sequenceByTenant.get(tenantId) || 0;
        const newSequence = currentSequence + 1;
        this.sequenceByTenant.set(tenantId, newSequence);
        return `${prefix}-${newSequence.toString().padStart(4, '0')}`;
    }
    async createPO(dto) {
        let poNumber = dto.poNumber;
        if (!poNumber) {
            poNumber = await this.generatePONumber(dto.tenantId);
        }
        const existing = await this.poRepo.findOne({
            where: { poNumber, tenantId: dto.tenantId },
        });
        if (existing) {
            throw new Error(`Purchase Order ${poNumber} already exists`);
        }
        const vendor = await this.vendorRepo.findOne({
            where: { id: dto.vendorId, tenantId: dto.tenantId },
        });
        if (!vendor) {
            throw new Error(`Vendor with ID ${dto.vendorId} not found`);
        }
        const po = {
            ...dto,
            poNumber,
            receivedQuantity: 0,
            status: 'PENDING',
        };
        return this.poRepo.save(po);
    }
    async getPOById(id) {
        const po = await this.poRepo.findOne({ where: { id } });
        if (!po) {
            throw new Error(`Purchase Order with ID ${id} not found`);
        }
        return po;
    }
    async getPendingAndPartialPOs(tenantId) {
        return this.poRepo.find({
            where: {
                tenantId,
                isActive: true,
                status: ['PENDING', 'PARTIAL'],
            },
        });
    }
    reset() {
        this.poRepo.clear();
        this.sequenceByTenant.clear();
    }
}
describe('PO Persistence Property Tests', () => {
    describe('Property 1: PO Creation Persistence Round-Trip', () => {
        it('should persist PO with all fields matching and status PENDING', async () => {
            await fc.assert(fc.asyncProperty(fc.uuid(), fc.uuid(), fc.string({ minLength: 1, maxLength: 50 }), fc.float({ min: 100, max: 100000, noNaN: true }), fc.float({ min: 1, max: 10000, noNaN: true }), async (tenantId, vendorId, materialType, orderedQuantity, rate) => {
                const service = new POServiceSimulation();
                service.addVendor({ id: vendorId, tenantId, vendorName: 'Test Vendor' });
                const dto = {
                    tenantId,
                    vendorId,
                    materialType,
                    orderedQuantity,
                    rate,
                    unit: 'KG',
                    deliveryDate: new Date(),
                    isActive: true,
                };
                const savedPO = await service.createPO(dto);
                expect(savedPO.tenantId).toBe(tenantId);
                expect(savedPO.vendorId).toBe(vendorId);
                expect(savedPO.materialType).toBe(materialType);
                expect(savedPO.orderedQuantity).toBe(orderedQuantity);
                expect(savedPO.rate).toBe(rate);
                expect(savedPO.status).toBe('PENDING');
                expect(savedPO.receivedQuantity).toBe(0);
                expect(savedPO.id).toBeDefined();
                expect(savedPO.poNumber).toBeDefined();
            }), { numRuns: 100 });
        });
        it('should be retrievable after creation with same data', async () => {
            await fc.assert(fc.asyncProperty(fc.uuid(), fc.uuid(), fc.string({ minLength: 1, maxLength: 50 }), fc.float({ min: 100, max: 100000, noNaN: true }), fc.float({ min: 1, max: 10000, noNaN: true }), async (tenantId, vendorId, materialType, orderedQuantity, rate) => {
                const service = new POServiceSimulation();
                service.addVendor({ id: vendorId, tenantId, vendorName: 'Test Vendor' });
                const dto = {
                    tenantId,
                    vendorId,
                    materialType,
                    orderedQuantity,
                    rate,
                    unit: 'KG',
                    deliveryDate: new Date(),
                    isActive: true,
                };
                const savedPO = await service.createPO(dto);
                const retrievedPO = await service.getPOById(savedPO.id);
                expect(retrievedPO.id).toBe(savedPO.id);
                expect(retrievedPO.poNumber).toBe(savedPO.poNumber);
                expect(retrievedPO.tenantId).toBe(savedPO.tenantId);
                expect(retrievedPO.vendorId).toBe(savedPO.vendorId);
                expect(retrievedPO.materialType).toBe(savedPO.materialType);
                expect(retrievedPO.orderedQuantity).toBe(savedPO.orderedQuantity);
                expect(retrievedPO.rate).toBe(savedPO.rate);
            }), { numRuns: 100 });
        });
    });
    describe('Property 2: PO Number Auto-Generation Uniqueness', () => {
        it('should generate unique PO numbers for same tenant', async () => {
            await fc.assert(fc.asyncProperty(fc.uuid(), fc.uuid(), fc.integer({ min: 2, max: 50 }), async (tenantId, vendorId, count) => {
                const service = new POServiceSimulation();
                service.addVendor({ id: vendorId, tenantId, vendorName: 'Test Vendor' });
                const poNumbers = [];
                for (let i = 0; i < count; i++) {
                    const dto = {
                        tenantId,
                        vendorId,
                        materialType: `Material ${i}`,
                        orderedQuantity: 1000,
                        rate: 100,
                        unit: 'KG',
                        deliveryDate: new Date(),
                        isActive: true,
                    };
                    const savedPO = await service.createPO(dto);
                    poNumbers.push(savedPO.poNumber);
                }
                const uniqueNumbers = new Set(poNumbers);
                expect(uniqueNumbers.size).toBe(poNumbers.length);
            }), { numRuns: 50 });
        });
        it('should follow PO-YYYY-NNNN format', async () => {
            await fc.assert(fc.asyncProperty(fc.uuid(), fc.uuid(), async (tenantId, vendorId) => {
                const service = new POServiceSimulation();
                service.addVendor({ id: vendorId, tenantId, vendorName: 'Test Vendor' });
                const dto = {
                    tenantId,
                    vendorId,
                    materialType: 'Test Material',
                    orderedQuantity: 1000,
                    rate: 100,
                    unit: 'KG',
                    deliveryDate: new Date(),
                    isActive: true,
                };
                const savedPO = await service.createPO(dto);
                const pattern = /^PO-\d{4}-\d{4}$/;
                expect(savedPO.poNumber).toMatch(pattern);
            }), { numRuns: 100 });
        });
    });
    describe('Property 3: PO Validation Rejects Invalid Vendors', () => {
        it('should reject PO creation with non-existent vendor', async () => {
            await fc.assert(fc.asyncProperty(fc.uuid(), fc.uuid(), async (tenantId, invalidVendorId) => {
                const service = new POServiceSimulation();
                const dto = {
                    tenantId,
                    vendorId: invalidVendorId,
                    materialType: 'Test Material',
                    orderedQuantity: 1000,
                    rate: 100,
                    unit: 'KG',
                    deliveryDate: new Date(),
                    isActive: true,
                };
                await expect(service.createPO(dto)).rejects.toThrow(`Vendor with ID ${invalidVendorId} not found`);
            }), { numRuns: 100 });
        });
        it('should reject PO creation with vendor from different tenant', async () => {
            await fc.assert(fc.asyncProperty(fc.uuid(), fc.uuid(), fc.uuid(), async (tenantId1, tenantId2, vendorId) => {
                if (tenantId1 === tenantId2)
                    return;
                const service = new POServiceSimulation();
                service.addVendor({ id: vendorId, tenantId: tenantId1, vendorName: 'Test Vendor' });
                const dto = {
                    tenantId: tenantId2,
                    vendorId,
                    materialType: 'Test Material',
                    orderedQuantity: 1000,
                    rate: 100,
                    unit: 'KG',
                    deliveryDate: new Date(),
                    isActive: true,
                };
                await expect(service.createPO(dto)).rejects.toThrow(`Vendor with ID ${vendorId} not found`);
            }), { numRuns: 100 });
        });
    });
    describe('Property 4: Pending PO List Excludes Completed and Cancelled', () => {
        it('should only return PENDING and PARTIAL POs', async () => {
            await fc.assert(fc.asyncProperty(fc.uuid(), fc.uuid(), fc.array(fc.record({
                status: fc.constantFrom('PENDING', 'PARTIAL', 'COMPLETED', 'CANCELLED'),
                materialType: fc.string({ minLength: 1, maxLength: 20 }),
            }), { minLength: 1, maxLength: 20 }), async (tenantId, vendorId, poConfigs) => {
                const service = new POServiceSimulation();
                service.addVendor({ id: vendorId, tenantId, vendorName: 'Test Vendor' });
                for (const config of poConfigs) {
                    const dto = {
                        tenantId,
                        vendorId,
                        materialType: config.materialType,
                        orderedQuantity: 1000,
                        rate: 100,
                        unit: 'KG',
                        deliveryDate: new Date(),
                        isActive: true,
                    };
                    const savedPO = await service.createPO(dto);
                    savedPO.status = config.status;
                }
                const pendingPOs = await service.getPendingAndPartialPOs(tenantId);
                for (const po of pendingPOs) {
                    expect(['PENDING', 'PARTIAL']).toContain(po.status);
                    expect(po.status).not.toBe('COMPLETED');
                    expect(po.status).not.toBe('CANCELLED');
                }
            }), { numRuns: 50 });
        });
    });
});
//# sourceMappingURL=po-persistence.property.spec.js.map