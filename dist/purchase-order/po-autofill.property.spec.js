"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fc = require("fast-check");
const purchase_order_entity_1 = require("../entities/purchase-order.entity");
function autoFillFormFromPO(po) {
    return {
        poId: po.id,
        poNumber: po.poNumber,
        vendorId: po.vendorId,
        vendorName: po.vendorName,
        materialType: po.materialType,
        materialDescription: po.materialDescription,
        expectedQuantity: po.remainingQuantity,
        rate: po.rate,
        unit: po.unit
    };
}
function validateAutoFill(po, formData) {
    const vendorNameMatches = formData.vendorName === po.vendorName;
    const materialTypeMatches = formData.materialType === po.materialType;
    const expectedQuantityMatches = formData.expectedQuantity === po.remainingQuantity;
    const rateMatches = formData.rate === po.rate;
    return {
        vendorNameMatches,
        materialTypeMatches,
        expectedQuantityMatches,
        rateMatches,
        allFieldsMatch: vendorNameMatches && materialTypeMatches && expectedQuantityMatches && rateMatches
    };
}
function hasAllRequiredFields(formData) {
    return (!!formData.poId &&
        !!formData.poNumber &&
        !!formData.vendorId &&
        !!formData.vendorName &&
        !!formData.materialType &&
        typeof formData.expectedQuantity === 'number' &&
        typeof formData.rate === 'number' &&
        !!formData.unit);
}
const poNumberArb = fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'), { minLength: 5, maxLength: 15 });
const vendorNameArb = fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz '), { minLength: 3, maxLength: 50 });
const materialTypeArb = fc.constantFrom('Iron Scrap', 'Aluminum Scrap', 'Copper Wire', 'Steel Scrap', 'Brass Scrap', 'Stainless Steel');
const unitArb = fc.constantFrom('KG', 'MT', 'TON', 'LBS');
const selectedPOArb = fc.record({
    id: fc.uuid(),
    poNumber: poNumberArb,
    vendorId: fc.uuid(),
    vendorName: vendorNameArb,
    materialType: materialTypeArb,
    materialDescription: fc.string({ minLength: 10, maxLength: 100 }),
    orderedQuantity: fc.integer({ min: 1000, max: 100000 }),
    receivedQuantity: fc.integer({ min: 0, max: 50000 }),
    remainingQuantity: fc.integer({ min: 100, max: 50000 }),
    rate: fc.double({ min: 10, max: 500, noNaN: true }),
    unit: unitArb,
    status: fc.constantFrom(purchase_order_entity_1.POStatus.PENDING, purchase_order_entity_1.POStatus.PARTIAL),
    deliveryDate: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') })
});
describe('PO Auto-Fill Property Tests', () => {
    describe('Property 2: PO Selection Auto-Fills All Required Fields', () => {
        it('should auto-fill vendor name from selected PO', () => {
            fc.assert(fc.property(selectedPOArb, (po) => {
                const formData = autoFillFormFromPO(po);
                expect(formData.vendorName).toBe(po.vendorName);
                return formData.vendorName === po.vendorName;
            }), { numRuns: 100 });
        });
        it('should auto-fill material type from selected PO', () => {
            fc.assert(fc.property(selectedPOArb, (po) => {
                const formData = autoFillFormFromPO(po);
                expect(formData.materialType).toBe(po.materialType);
                return formData.materialType === po.materialType;
            }), { numRuns: 100 });
        });
        it('should auto-fill expected quantity as remaining quantity', () => {
            fc.assert(fc.property(selectedPOArb, (po) => {
                const formData = autoFillFormFromPO(po);
                expect(formData.expectedQuantity).toBe(po.remainingQuantity);
                return formData.expectedQuantity === po.remainingQuantity;
            }), { numRuns: 100 });
        });
        it('should auto-fill rate from selected PO', () => {
            fc.assert(fc.property(selectedPOArb, (po) => {
                const formData = autoFillFormFromPO(po);
                expect(formData.rate).toBe(po.rate);
                return formData.rate === po.rate;
            }), { numRuns: 100 });
        });
        it('should auto-fill all required fields at once', () => {
            fc.assert(fc.property(selectedPOArb, (po) => {
                const formData = autoFillFormFromPO(po);
                const validation = validateAutoFill(po, formData);
                expect(validation.allFieldsMatch).toBe(true);
                return validation.allFieldsMatch;
            }), { numRuns: 100 });
        });
        it('should populate all required form fields', () => {
            fc.assert(fc.property(selectedPOArb, (po) => {
                const formData = autoFillFormFromPO(po);
                expect(hasAllRequiredFields(formData)).toBe(true);
                return hasAllRequiredFields(formData);
            }), { numRuns: 100 });
        });
        it('should preserve PO ID for reference', () => {
            fc.assert(fc.property(selectedPOArb, (po) => {
                const formData = autoFillFormFromPO(po);
                expect(formData.poId).toBe(po.id);
                return formData.poId === po.id;
            }), { numRuns: 100 });
        });
        it('should preserve vendor ID for reference', () => {
            fc.assert(fc.property(selectedPOArb, (po) => {
                const formData = autoFillFormFromPO(po);
                expect(formData.vendorId).toBe(po.vendorId);
                return formData.vendorId === po.vendorId;
            }), { numRuns: 100 });
        });
        it('should preserve unit from selected PO', () => {
            fc.assert(fc.property(selectedPOArb, (po) => {
                const formData = autoFillFormFromPO(po);
                expect(formData.unit).toBe(po.unit);
                return formData.unit === po.unit;
            }), { numRuns: 100 });
        });
        it('should handle multiple PO selections correctly', () => {
            fc.assert(fc.property(fc.array(selectedPOArb, { minLength: 2, maxLength: 5 }), (pos) => {
                const results = pos.map(po => {
                    const formData = autoFillFormFromPO(po);
                    return validateAutoFill(po, formData).allFieldsMatch;
                });
                const allCorrect = results.every(r => r === true);
                expect(allCorrect).toBe(true);
                return allCorrect;
            }), { numRuns: 100 });
        });
    });
});
//# sourceMappingURL=po-autofill.property.spec.js.map