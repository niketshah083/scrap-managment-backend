"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fc = require("fast-check");
const purchase_order_entity_1 = require("../entities/purchase-order.entity");
function autoFillGRNFormFromPO(po) {
    return {
        vendorName: po.vendorName,
        materialType: po.materialType,
        rate: po.rate,
        expectedQuantity: po.remainingQuantity
    };
}
function validateAutoFillMatchesPO(po, formData) {
    return (formData.vendorName === po.vendorName &&
        formData.materialType === po.materialType &&
        formData.rate === po.rate &&
        formData.expectedQuantity === po.remainingQuantity);
}
const poNumberArb = fc.string({ minLength: 5, maxLength: 15 })
    .filter(s => /^[A-Z0-9-]+$/i.test(s) || s.length === 0)
    .map(s => s.length > 0 ? `PO-${s}` : 'PO-DEFAULT');
const vendorNameArb = fc.string({ minLength: 3, maxLength: 50 })
    .filter(s => s.trim().length > 0)
    .map(s => s.trim());
const materialTypeArb = fc.constantFrom('Iron Scrap', 'Aluminum Scrap', 'Copper Wire', 'Steel Scrap', 'Brass Scrap', 'Stainless Steel', 'Mixed Metal');
const unitArb = fc.constantFrom('KG', 'MT', 'TON');
const pendingPOArb = fc.record({
    id: fc.uuid(),
    poNumber: poNumberArb,
    vendorId: fc.uuid(),
    vendorName: vendorNameArb,
    materialType: materialTypeArb,
    materialDescription: fc.string({ minLength: 5, maxLength: 100 }),
    orderedQuantity: fc.integer({ min: 1000, max: 100000 }),
    receivedQuantity: fc.integer({ min: 0, max: 50000 }),
    remainingQuantity: fc.integer({ min: 100, max: 50000 }),
    rate: fc.double({ min: 10, max: 1000, noNaN: true }),
    unit: unitArb,
    status: fc.constantFrom(purchase_order_entity_1.POStatus.PENDING, purchase_order_entity_1.POStatus.PARTIAL),
    deliveryDate: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') })
});
describe('GRN PO Auto-Fill Property Tests', () => {
    describe('Property 5: PO Selection Auto-Fills Form Fields', () => {
        it('should auto-fill vendor name from selected PO', () => {
            fc.assert(fc.property(pendingPOArb, (po) => {
                const formData = autoFillGRNFormFromPO(po);
                expect(formData.vendorName).toBe(po.vendorName);
                return formData.vendorName === po.vendorName;
            }), { numRuns: 100 });
        });
        it('should auto-fill material type from selected PO', () => {
            fc.assert(fc.property(pendingPOArb, (po) => {
                const formData = autoFillGRNFormFromPO(po);
                expect(formData.materialType).toBe(po.materialType);
                return formData.materialType === po.materialType;
            }), { numRuns: 100 });
        });
        it('should auto-fill rate from selected PO', () => {
            fc.assert(fc.property(pendingPOArb, (po) => {
                const formData = autoFillGRNFormFromPO(po);
                expect(formData.rate).toBe(po.rate);
                return formData.rate === po.rate;
            }), { numRuns: 100 });
        });
        it('should auto-fill expected quantity as remaining quantity from PO', () => {
            fc.assert(fc.property(pendingPOArb, (po) => {
                const formData = autoFillGRNFormFromPO(po);
                expect(formData.expectedQuantity).toBe(po.remainingQuantity);
                return formData.expectedQuantity === po.remainingQuantity;
            }), { numRuns: 100 });
        });
        it('should auto-fill all four required fields correctly', () => {
            fc.assert(fc.property(pendingPOArb, (po) => {
                const formData = autoFillGRNFormFromPO(po);
                const allMatch = validateAutoFillMatchesPO(po, formData);
                expect(allMatch).toBe(true);
                return allMatch;
            }), { numRuns: 100 });
        });
        it('should handle POs with zero received quantity (PENDING status)', () => {
            const pendingOnlyArb = pendingPOArb.filter(po => po.status === purchase_order_entity_1.POStatus.PENDING);
            fc.assert(fc.property(pendingOnlyArb, (po) => {
                const formData = autoFillGRNFormFromPO(po);
                expect(formData.expectedQuantity).toBe(po.remainingQuantity);
                return formData.expectedQuantity === po.remainingQuantity;
            }), { numRuns: 100 });
        });
        it('should handle POs with partial delivery (PARTIAL status)', () => {
            const partialOnlyArb = pendingPOArb.filter(po => po.status === purchase_order_entity_1.POStatus.PARTIAL);
            fc.assert(fc.property(partialOnlyArb, (po) => {
                const formData = autoFillGRNFormFromPO(po);
                expect(formData.expectedQuantity).toBe(po.remainingQuantity);
                return formData.expectedQuantity === po.remainingQuantity;
            }), { numRuns: 100 });
        });
        it('should correctly auto-fill when switching between different POs', () => {
            fc.assert(fc.property(fc.array(pendingPOArb, { minLength: 2, maxLength: 5 }), (pos) => {
                const results = pos.map(po => {
                    const formData = autoFillGRNFormFromPO(po);
                    return validateAutoFillMatchesPO(po, formData);
                });
                const allCorrect = results.every(r => r === true);
                expect(allCorrect).toBe(true);
                return allCorrect;
            }), { numRuns: 100 });
        });
        it('should preserve numeric precision for rate', () => {
            fc.assert(fc.property(pendingPOArb, (po) => {
                const formData = autoFillGRNFormFromPO(po);
                expect(formData.rate).toBe(po.rate);
                return formData.rate === po.rate;
            }), { numRuns: 100 });
        });
        it('should preserve integer precision for expected quantity', () => {
            fc.assert(fc.property(pendingPOArb, (po) => {
                const formData = autoFillGRNFormFromPO(po);
                expect(Number.isInteger(formData.expectedQuantity)).toBe(true);
                expect(formData.expectedQuantity).toBe(po.remainingQuantity);
                return formData.expectedQuantity === po.remainingQuantity;
            }), { numRuns: 100 });
        });
    });
});
//# sourceMappingURL=grn-po-autofill.property.spec.js.map