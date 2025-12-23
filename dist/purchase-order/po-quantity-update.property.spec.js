"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fc = require("fast-check");
const purchase_order_entity_1 = require("../entities/purchase-order.entity");
function calculateNetWeight(grossWeight, tareWeight) {
    return grossWeight - tareWeight;
}
function updatePOAfterCompletion(po, transaction) {
    if (transaction.status !== 'COMPLETED') {
        return po;
    }
    const newReceivedQuantity = po.receivedQuantity + transaction.netWeight;
    const newStatus = newReceivedQuantity >= po.orderedQuantity
        ? purchase_order_entity_1.POStatus.COMPLETED
        : purchase_order_entity_1.POStatus.PARTIAL;
    return {
        ...po,
        receivedQuantity: newReceivedQuantity,
        status: newStatus
    };
}
function shouldMarkPOComplete(po, additionalQuantity) {
    return (po.receivedQuantity + additionalQuantity) >= po.orderedQuantity;
}
describe('PO Quantity Update Property Tests', () => {
    describe('Property 6: Transaction Completion Updates PO Quantity', () => {
        it('should increment PO received quantity by transaction net weight', () => {
            fc.assert(fc.property(fc.uuid(), fc.uuid(), fc.integer({ min: 1000, max: 100000 }), fc.integer({ min: 0, max: 50000 }), fc.integer({ min: 5000, max: 50000 }), fc.integer({ min: 1000, max: 4000 }), (poId, transactionId, orderedQuantity, initialReceivedQuantity, grossWeight, tareWeight) => {
                const netWeight = calculateNetWeight(grossWeight, tareWeight);
                const po = {
                    id: poId,
                    poNumber: `PO-${poId.substring(0, 8)}`,
                    orderedQuantity,
                    receivedQuantity: initialReceivedQuantity,
                    status: purchase_order_entity_1.POStatus.PENDING
                };
                const transaction = {
                    id: transactionId,
                    poId,
                    grossWeight,
                    tareWeight,
                    netWeight,
                    status: 'COMPLETED'
                };
                const updatedPO = updatePOAfterCompletion(po, transaction);
                expect(updatedPO.receivedQuantity).toBe(initialReceivedQuantity + netWeight);
                return updatedPO.receivedQuantity === initialReceivedQuantity + netWeight;
            }), { numRuns: 100 });
        });
        it('should NOT update PO for non-completed transactions', () => {
            fc.assert(fc.property(fc.uuid(), fc.uuid(), fc.integer({ min: 1000, max: 100000 }), fc.integer({ min: 0, max: 50000 }), fc.integer({ min: 5000, max: 50000 }), fc.integer({ min: 1000, max: 4000 }), fc.constantFrom('DRAFT', 'IN_PROGRESS', 'CANCELLED'), (poId, transactionId, orderedQuantity, initialReceivedQuantity, grossWeight, tareWeight, txStatus) => {
                const netWeight = calculateNetWeight(grossWeight, tareWeight);
                const po = {
                    id: poId,
                    poNumber: `PO-${poId.substring(0, 8)}`,
                    orderedQuantity,
                    receivedQuantity: initialReceivedQuantity,
                    status: purchase_order_entity_1.POStatus.PENDING
                };
                const transaction = {
                    id: transactionId,
                    poId,
                    grossWeight,
                    tareWeight,
                    netWeight,
                    status: txStatus
                };
                const updatedPO = updatePOAfterCompletion(po, transaction);
                expect(updatedPO.receivedQuantity).toBe(initialReceivedQuantity);
                return updatedPO.receivedQuantity === initialReceivedQuantity;
            }), { numRuns: 100 });
        });
        it('should mark PO as COMPLETED when fully received', () => {
            fc.assert(fc.property(fc.uuid(), fc.uuid(), fc.integer({ min: 10000, max: 50000 }), (poId, transactionId, orderedQuantity) => {
                const initialReceivedQuantity = Math.floor(orderedQuantity * 0.9);
                const netWeight = orderedQuantity - initialReceivedQuantity + 100;
                const po = {
                    id: poId,
                    poNumber: `PO-${poId.substring(0, 8)}`,
                    orderedQuantity,
                    receivedQuantity: initialReceivedQuantity,
                    status: purchase_order_entity_1.POStatus.PARTIAL
                };
                const transaction = {
                    id: transactionId,
                    poId,
                    grossWeight: netWeight + 2000,
                    tareWeight: 2000,
                    netWeight,
                    status: 'COMPLETED'
                };
                const updatedPO = updatePOAfterCompletion(po, transaction);
                expect(updatedPO.status).toBe(purchase_order_entity_1.POStatus.COMPLETED);
                expect(updatedPO.receivedQuantity).toBeGreaterThanOrEqual(orderedQuantity);
                return updatedPO.status === purchase_order_entity_1.POStatus.COMPLETED;
            }), { numRuns: 100 });
        });
        it('should mark PO as PARTIAL when not fully received', () => {
            fc.assert(fc.property(fc.uuid(), fc.uuid(), fc.integer({ min: 50000, max: 100000 }), fc.integer({ min: 1000, max: 10000 }), (poId, transactionId, orderedQuantity, netWeight) => {
                const po = {
                    id: poId,
                    poNumber: `PO-${poId.substring(0, 8)}`,
                    orderedQuantity,
                    receivedQuantity: 0,
                    status: purchase_order_entity_1.POStatus.PENDING
                };
                const transaction = {
                    id: transactionId,
                    poId,
                    grossWeight: netWeight + 2000,
                    tareWeight: 2000,
                    netWeight,
                    status: 'COMPLETED'
                };
                const updatedPO = updatePOAfterCompletion(po, transaction);
                if (updatedPO.receivedQuantity < orderedQuantity) {
                    expect(updatedPO.status).toBe(purchase_order_entity_1.POStatus.PARTIAL);
                    return updatedPO.status === purchase_order_entity_1.POStatus.PARTIAL;
                }
                return true;
            }), { numRuns: 100 });
        });
        it('should correctly calculate net weight from gross and tare', () => {
            fc.assert(fc.property(fc.integer({ min: 5000, max: 100000 }), fc.integer({ min: 1000, max: 4999 }), (grossWeight, tareWeight) => {
                const netWeight = calculateNetWeight(grossWeight, tareWeight);
                expect(netWeight).toBe(grossWeight - tareWeight);
                expect(netWeight).toBeGreaterThan(0);
                return netWeight === grossWeight - tareWeight && netWeight > 0;
            }), { numRuns: 100 });
        });
        it('should handle multiple transactions updating same PO', () => {
            fc.assert(fc.property(fc.uuid(), fc.integer({ min: 100000, max: 500000 }), fc.array(fc.integer({ min: 1000, max: 20000 }), { minLength: 2, maxLength: 5 }), (poId, orderedQuantity, netWeights) => {
                let po = {
                    id: poId,
                    poNumber: `PO-${poId.substring(0, 8)}`,
                    orderedQuantity,
                    receivedQuantity: 0,
                    status: purchase_order_entity_1.POStatus.PENDING
                };
                netWeights.forEach((netWeight, index) => {
                    const transaction = {
                        id: `tx-${index}`,
                        poId,
                        grossWeight: netWeight + 2000,
                        tareWeight: 2000,
                        netWeight,
                        status: 'COMPLETED'
                    };
                    po = updatePOAfterCompletion(po, transaction);
                });
                const totalNetWeight = netWeights.reduce((sum, w) => sum + w, 0);
                expect(po.receivedQuantity).toBe(totalNetWeight);
                return po.receivedQuantity === totalNetWeight;
            }), { numRuns: 100 });
        });
    });
});
//# sourceMappingURL=po-quantity-update.property.spec.js.map