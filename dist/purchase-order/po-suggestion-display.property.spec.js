"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fc = require("fast-check");
const purchase_order_entity_1 = require("../entities/purchase-order.entity");
function transformToSuggestion(po) {
    return {
        id: po.id,
        poNumber: po.poNumber,
        vendorName: po.vendorName,
        materialType: po.materialType,
        status: po.status,
        remainingQuantity: po.orderedQuantity - po.receivedQuantity,
        unit: po.unit
    };
}
function renderSuggestionDisplay(suggestion) {
    return `${suggestion.poNumber} | ${suggestion.vendorName} | ${suggestion.materialType} | ${suggestion.status}`;
}
function validateSuggestionFields(suggestion) {
    const hasPoNumber = !!suggestion.poNumber && suggestion.poNumber.length > 0;
    const hasVendorName = !!suggestion.vendorName && suggestion.vendorName.length > 0;
    const hasMaterialType = !!suggestion.materialType && suggestion.materialType.length > 0;
    const hasStatus = !!suggestion.status;
    return {
        hasPoNumber,
        hasVendorName,
        hasMaterialType,
        hasStatus,
        isComplete: hasPoNumber && hasVendorName && hasMaterialType && hasStatus
    };
}
const poNumberArb = fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'), { minLength: 5, maxLength: 15 });
const vendorNameArb = fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz '), { minLength: 3, maxLength: 50 });
const materialTypeArb = fc.constantFrom('Iron Scrap', 'Aluminum Scrap', 'Copper Wire', 'Steel Scrap', 'Brass Scrap', 'Stainless Steel', 'Mixed Metal');
const statusArb = fc.constantFrom(purchase_order_entity_1.POStatus.PENDING, purchase_order_entity_1.POStatus.PARTIAL, purchase_order_entity_1.POStatus.COMPLETED, purchase_order_entity_1.POStatus.CANCELLED);
const unitArb = fc.constantFrom('KG', 'MT', 'TON', 'LBS');
const fullPOArb = fc.record({
    id: fc.uuid(),
    poNumber: poNumberArb,
    vendorId: fc.uuid(),
    vendorName: vendorNameArb,
    materialType: materialTypeArb,
    materialDescription: fc.string({ minLength: 10, maxLength: 100 }),
    orderedQuantity: fc.integer({ min: 1000, max: 100000 }),
    receivedQuantity: fc.integer({ min: 0, max: 50000 }),
    rate: fc.double({ min: 10, max: 1000, noNaN: true }),
    unit: unitArb,
    status: statusArb,
    deliveryDate: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
    notes: fc.string({ minLength: 0, maxLength: 200 }),
    tenantId: fc.uuid()
});
describe('PO Suggestion Display Property Tests', () => {
    describe('Property 9: PO Suggestions Show Required Fields', () => {
        it('should include all required fields in suggestion', () => {
            fc.assert(fc.property(fullPOArb, (fullPO) => {
                const suggestion = transformToSuggestion(fullPO);
                const validation = validateSuggestionFields(suggestion);
                expect(validation.hasPoNumber).toBe(true);
                expect(validation.hasVendorName).toBe(true);
                expect(validation.hasMaterialType).toBe(true);
                expect(validation.hasStatus).toBe(true);
                expect(validation.isComplete).toBe(true);
                return validation.isComplete;
            }), { numRuns: 100 });
        });
        it('should preserve PO number exactly from source', () => {
            fc.assert(fc.property(fullPOArb, (fullPO) => {
                const suggestion = transformToSuggestion(fullPO);
                expect(suggestion.poNumber).toBe(fullPO.poNumber);
                return suggestion.poNumber === fullPO.poNumber;
            }), { numRuns: 100 });
        });
        it('should preserve vendor name exactly from source', () => {
            fc.assert(fc.property(fullPOArb, (fullPO) => {
                const suggestion = transformToSuggestion(fullPO);
                expect(suggestion.vendorName).toBe(fullPO.vendorName);
                return suggestion.vendorName === fullPO.vendorName;
            }), { numRuns: 100 });
        });
        it('should preserve material type exactly from source', () => {
            fc.assert(fc.property(fullPOArb, (fullPO) => {
                const suggestion = transformToSuggestion(fullPO);
                expect(suggestion.materialType).toBe(fullPO.materialType);
                return suggestion.materialType === fullPO.materialType;
            }), { numRuns: 100 });
        });
        it('should preserve status exactly from source', () => {
            fc.assert(fc.property(fullPOArb, (fullPO) => {
                const suggestion = transformToSuggestion(fullPO);
                expect(suggestion.status).toBe(fullPO.status);
                return suggestion.status === fullPO.status;
            }), { numRuns: 100 });
        });
        it('should include all required fields in rendered display string', () => {
            fc.assert(fc.property(fullPOArb, (fullPO) => {
                const suggestion = transformToSuggestion(fullPO);
                const displayString = renderSuggestionDisplay(suggestion);
                expect(displayString).toContain(suggestion.poNumber);
                expect(displayString).toContain(suggestion.vendorName);
                expect(displayString).toContain(suggestion.materialType);
                expect(displayString).toContain(suggestion.status);
                return (displayString.includes(suggestion.poNumber) &&
                    displayString.includes(suggestion.vendorName) &&
                    displayString.includes(suggestion.materialType) &&
                    displayString.includes(suggestion.status));
            }), { numRuns: 100 });
        });
        it('should correctly calculate remaining quantity', () => {
            fc.assert(fc.property(fullPOArb, (fullPO) => {
                const suggestion = transformToSuggestion(fullPO);
                const expectedRemaining = fullPO.orderedQuantity - fullPO.receivedQuantity;
                expect(suggestion.remainingQuantity).toBe(expectedRemaining);
                return suggestion.remainingQuantity === expectedRemaining;
            }), { numRuns: 100 });
        });
        it('should handle array of suggestions correctly', () => {
            fc.assert(fc.property(fc.array(fullPOArb, { minLength: 1, maxLength: 10 }), (fullPOs) => {
                const suggestions = fullPOs.map(transformToSuggestion);
                const allComplete = suggestions.every(s => validateSuggestionFields(s).isComplete);
                expect(allComplete).toBe(true);
                expect(suggestions.length).toBe(fullPOs.length);
                return allComplete && suggestions.length === fullPOs.length;
            }), { numRuns: 100 });
        });
    });
});
//# sourceMappingURL=po-suggestion-display.property.spec.js.map