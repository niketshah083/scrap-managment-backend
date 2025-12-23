"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fc = require("fast-check");
const purchase_order_entity_1 = require("../entities/purchase-order.entity");
function validateGRNQuantity(po, receivedQuantity) {
    const remainingQuantity = po.orderedQuantity - po.receivedQuantity;
    if (po.status === purchase_order_entity_1.POStatus.CANCELLED) {
        return {
            isValid: false,
            requiresApproval: false,
            message: 'Cannot create GRN for cancelled PO'
        };
    }
    if (po.status === purchase_order_entity_1.POStatus.COMPLETED || remainingQuantity <= 0) {
        return {
            isValid: false,
            requiresApproval: false,
            message: 'PO is fully received'
        };
    }
    if (receivedQuantity > remainingQuantity) {
        const overReceiptAmount = receivedQuantity - remainingQuantity;
        return {
            isValid: true,
            requiresApproval: true,
            approvalReason: 'Over-receipt: Received quantity exceeds PO remaining quantity',
            overReceiptAmount,
            message: `Over-receipt of ${overReceiptAmount} units requires supervisor approval`
        };
    }
    return {
        isValid: true,
        requiresApproval: false,
        message: 'GRN quantity is within PO limits'
    };
}
function needsSupervisorApproval(po, receivedQuantity) {
    const remainingQuantity = po.orderedQuantity - po.receivedQuantity;
    return receivedQuantity > remainingQuantity && po.status !== purchase_order_entity_1.POStatus.CANCELLED;
}
function calculateOverReceiptAmount(po, receivedQuantity) {
    const remainingQuantity = po.orderedQuantity - po.receivedQuantity;
    return Math.max(0, receivedQuantity - remainingQuantity);
}
const mockPOArb = fc.record({
    id: fc.uuid(),
    poNumber: fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'), { minLength: 5, maxLength: 15 }),
    orderedQuantity: fc.integer({ min: 10000, max: 100000 }),
    receivedQuantity: fc.integer({ min: 0, max: 50000 }),
    remainingQuantity: fc.integer({ min: 1000, max: 50000 }),
    status: fc.constantFrom(purchase_order_entity_1.POStatus.PENDING, purchase_order_entity_1.POStatus.PARTIAL)
}).map(po => ({
    ...po,
    remainingQuantity: po.orderedQuantity - po.receivedQuantity
}));
describe('Over-Receipt Property Tests', () => {
    describe('Property 8: Over-Receipt Requires Approval', () => {
        it('should require approval when received exceeds remaining', () => {
            fc.assert(fc.property(mockPOArb, fc.integer({ min: 1, max: 10000 }), (po, excess) => {
                if (po.remainingQuantity <= 0)
                    return true;
                const receivedQuantity = po.remainingQuantity + excess;
                const result = validateGRNQuantity(po, receivedQuantity);
                expect(result.requiresApproval).toBe(true);
                expect(result.approvalReason).toContain('Over-receipt');
                expect(result.overReceiptAmount).toBe(excess);
                return result.requiresApproval === true;
            }), { numRuns: 100 });
        });
        it('should NOT require approval when received is within limits', () => {
            fc.assert(fc.property(mockPOArb, fc.integer({ min: 1, max: 99 }), (po, percentage) => {
                if (po.remainingQuantity <= 0)
                    return true;
                const receivedQuantity = Math.floor(po.remainingQuantity * percentage / 100);
                if (receivedQuantity <= 0)
                    return true;
                const result = validateGRNQuantity(po, receivedQuantity);
                expect(result.requiresApproval).toBe(false);
                expect(result.isValid).toBe(true);
                return result.requiresApproval === false;
            }), { numRuns: 100 });
        });
        it('should NOT require approval when received equals remaining', () => {
            fc.assert(fc.property(mockPOArb, (po) => {
                if (po.remainingQuantity <= 0)
                    return true;
                const receivedQuantity = po.remainingQuantity;
                const result = validateGRNQuantity(po, receivedQuantity);
                expect(result.requiresApproval).toBe(false);
                expect(result.isValid).toBe(true);
                return result.requiresApproval === false;
            }), { numRuns: 100 });
        });
        it('should correctly calculate over-receipt amount', () => {
            fc.assert(fc.property(mockPOArb, fc.integer({ min: 1, max: 10000 }), (po, excess) => {
                if (po.remainingQuantity <= 0)
                    return true;
                const receivedQuantity = po.remainingQuantity + excess;
                const overReceiptAmount = calculateOverReceiptAmount(po, receivedQuantity);
                expect(overReceiptAmount).toBe(excess);
                return overReceiptAmount === excess;
            }), { numRuns: 100 });
        });
        it('should return zero over-receipt for within-limits quantity', () => {
            fc.assert(fc.property(mockPOArb, fc.integer({ min: 1, max: 99 }), (po, percentage) => {
                if (po.remainingQuantity <= 0)
                    return true;
                const receivedQuantity = Math.floor(po.remainingQuantity * percentage / 100);
                const overReceiptAmount = calculateOverReceiptAmount(po, receivedQuantity);
                expect(overReceiptAmount).toBe(0);
                return overReceiptAmount === 0;
            }), { numRuns: 100 });
        });
        it('should flag approval need correctly', () => {
            fc.assert(fc.property(mockPOArb, fc.integer({ min: 100, max: 50000 }), (po, receivedQuantity) => {
                if (po.remainingQuantity <= 0)
                    return true;
                const needsApproval = needsSupervisorApproval(po, receivedQuantity);
                const isOverReceipt = receivedQuantity > po.remainingQuantity;
                expect(needsApproval).toBe(isOverReceipt);
                return needsApproval === isOverReceipt;
            }), { numRuns: 100 });
        });
        it('should include approval reason in validation result', () => {
            fc.assert(fc.property(mockPOArb, fc.integer({ min: 1, max: 10000 }), (po, excess) => {
                if (po.remainingQuantity <= 0)
                    return true;
                const receivedQuantity = po.remainingQuantity + excess;
                const result = validateGRNQuantity(po, receivedQuantity);
                if (result.requiresApproval) {
                    expect(result.approvalReason).toBeDefined();
                    expect(result.approvalReason.length).toBeGreaterThan(0);
                }
                return true;
            }), { numRuns: 100 });
        });
        it('should still mark GRN as valid even with over-receipt', () => {
            fc.assert(fc.property(mockPOArb, fc.integer({ min: 1, max: 10000 }), (po, excess) => {
                if (po.remainingQuantity <= 0)
                    return true;
                const receivedQuantity = po.remainingQuantity + excess;
                const result = validateGRNQuantity(po, receivedQuantity);
                expect(result.isValid).toBe(true);
                expect(result.requiresApproval).toBe(true);
                return result.isValid === true && result.requiresApproval === true;
            }), { numRuns: 100 });
        });
        it('should handle edge case of exactly 1 unit over', () => {
            fc.assert(fc.property(mockPOArb, (po) => {
                if (po.remainingQuantity <= 0)
                    return true;
                const receivedQuantity = po.remainingQuantity + 1;
                const result = validateGRNQuantity(po, receivedQuantity);
                expect(result.requiresApproval).toBe(true);
                expect(result.overReceiptAmount).toBe(1);
                return result.requiresApproval === true;
            }), { numRuns: 100 });
        });
        it('should not allow over-receipt for cancelled POs', () => {
            fc.assert(fc.property(fc.uuid(), fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'), { minLength: 5, maxLength: 15 }), fc.integer({ min: 10000, max: 100000 }), fc.integer({ min: 0, max: 5000 }), fc.integer({ min: 1, max: 10000 }), (id, poNumber, orderedQuantity, receivedQuantity, excess) => {
                const po = {
                    id,
                    poNumber,
                    orderedQuantity,
                    receivedQuantity,
                    remainingQuantity: orderedQuantity - receivedQuantity,
                    status: purchase_order_entity_1.POStatus.CANCELLED
                };
                const receivedQty = po.remainingQuantity + excess;
                const result = validateGRNQuantity(po, receivedQty);
                expect(result.isValid).toBe(false);
                expect(result.requiresApproval).toBe(false);
                return result.isValid === false;
            }), { numRuns: 100 });
        });
    });
});
//# sourceMappingURL=over-receipt.property.spec.js.map