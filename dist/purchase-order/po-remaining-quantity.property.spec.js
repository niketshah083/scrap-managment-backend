"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fc = require("fast-check");
const purchase_order_entity_1 = require("../entities/purchase-order.entity");
function calculateRemainingQuantity(orderedQuantity, receivedQuantity) {
    return orderedQuantity - receivedQuantity;
}
function canCreateGRN(status, orderedQuantity, receivedQuantity) {
    const remainingQuantity = calculateRemainingQuantity(orderedQuantity, receivedQuantity);
    if (status === purchase_order_entity_1.POStatus.CANCELLED) {
        return false;
    }
    if (status === purchase_order_entity_1.POStatus.COMPLETED || remainingQuantity <= 0) {
        return false;
    }
    return true;
}
const validPOStatusArb = fc.constantFrom(purchase_order_entity_1.POStatus.PENDING, purchase_order_entity_1.POStatus.PARTIAL);
const invalidPOStatusArb = fc.constantFrom(purchase_order_entity_1.POStatus.CANCELLED, purchase_order_entity_1.POStatus.COMPLETED);
describe('PO Remaining Quantity Property Tests', () => {
    describe('Property 7: Remaining Quantity Allows GRN', () => {
        it('should allow GRN creation when remaining quantity > 0 and status is valid', () => {
            fc.assert(fc.property(validPOStatusArb, fc.integer({ min: 100, max: 100000 }), fc.integer({ min: 0, max: 99 }), (status, orderedQuantity, receivedPercentage) => {
                const receivedQuantity = Math.floor(orderedQuantity * receivedPercentage / 100);
                const remainingQuantity = calculateRemainingQuantity(orderedQuantity, receivedQuantity);
                if (remainingQuantity <= 0)
                    return true;
                const canCreate = canCreateGRN(status, orderedQuantity, receivedQuantity);
                expect(canCreate).toBe(true);
                return canCreate === true;
            }), { numRuns: 100 });
        });
        it('should NOT allow GRN creation when status is CANCELLED', () => {
            fc.assert(fc.property(fc.integer({ min: 100, max: 100000 }), fc.integer({ min: 0, max: 50000 }), (orderedQuantity, receivedQuantity) => {
                const canCreate = canCreateGRN(purchase_order_entity_1.POStatus.CANCELLED, orderedQuantity, receivedQuantity);
                expect(canCreate).toBe(false);
                return canCreate === false;
            }), { numRuns: 100 });
        });
        it('should NOT allow GRN creation when remaining quantity is 0', () => {
            fc.assert(fc.property(validPOStatusArb, fc.integer({ min: 100, max: 100000 }), (status, orderedQuantity) => {
                const receivedQuantity = orderedQuantity;
                const canCreate = canCreateGRN(status, orderedQuantity, receivedQuantity);
                expect(canCreate).toBe(false);
                return canCreate === false;
            }), { numRuns: 100 });
        });
        it('should NOT allow GRN creation when received exceeds ordered', () => {
            fc.assert(fc.property(validPOStatusArb, fc.integer({ min: 100, max: 100000 }), fc.integer({ min: 1, max: 10000 }), (status, orderedQuantity, excess) => {
                const receivedQuantity = orderedQuantity + excess;
                const canCreate = canCreateGRN(status, orderedQuantity, receivedQuantity);
                expect(canCreate).toBe(false);
                return canCreate === false;
            }), { numRuns: 100 });
        });
    });
    describe('Remaining Quantity Calculation', () => {
        it('should correctly calculate remaining quantity', () => {
            fc.assert(fc.property(fc.integer({ min: 0, max: 100000 }), fc.integer({ min: 0, max: 100000 }), (orderedQuantity, receivedQuantity) => {
                const remaining = calculateRemainingQuantity(orderedQuantity, receivedQuantity);
                expect(remaining).toBe(orderedQuantity - receivedQuantity);
                return remaining === orderedQuantity - receivedQuantity;
            }), { numRuns: 100 });
        });
        it('should have remaining >= 0 when received <= ordered', () => {
            fc.assert(fc.property(fc.integer({ min: 0, max: 100000 }), (orderedQuantity) => {
                const receivedQuantity = Math.floor(Math.random() * (orderedQuantity + 1));
                const remaining = calculateRemainingQuantity(orderedQuantity, receivedQuantity);
                expect(remaining).toBeGreaterThanOrEqual(0);
                return remaining >= 0;
            }), { numRuns: 100 });
        });
    });
});
//# sourceMappingURL=po-remaining-quantity.property.spec.js.map