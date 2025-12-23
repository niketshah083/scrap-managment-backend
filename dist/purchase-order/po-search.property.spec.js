"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fc = require("fast-check");
const purchase_order_entity_1 = require("../entities/purchase-order.entity");
function searchPOs(pos, query) {
    if (!query || query.length < 2)
        return [];
    const lowerQuery = query.toLowerCase();
    return pos.filter(po => po.poNumber.toLowerCase().includes(lowerQuery) ||
        po.vendorName.toLowerCase().includes(lowerQuery) ||
        po.materialType.toLowerCase().includes(lowerQuery));
}
function validatePOForGRN(po) {
    const remainingQuantity = po.orderedQuantity - po.receivedQuantity;
    if (po.status === purchase_order_entity_1.POStatus.CANCELLED) {
        return {
            isValid: false,
            message: 'This Purchase Order has been cancelled and cannot be used for GRN'
        };
    }
    if (po.status === purchase_order_entity_1.POStatus.COMPLETED || remainingQuantity <= 0) {
        return {
            isValid: false,
            message: 'This Purchase Order is fully received. No more deliveries can be accepted.'
        };
    }
    return {
        isValid: true,
        message: 'Purchase Order is valid for GRN creation'
    };
}
const poNumberArb = fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'), { minLength: 5, maxLength: 15 });
const vendorNameArb = fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz '), { minLength: 3, maxLength: 30 });
const materialTypeArb = fc.constantFrom('Iron Scrap', 'Aluminum Scrap', 'Copper Wire', 'Steel Scrap', 'Brass Scrap');
const statusArb = fc.constantFrom(purchase_order_entity_1.POStatus.PENDING, purchase_order_entity_1.POStatus.PARTIAL, purchase_order_entity_1.POStatus.COMPLETED, purchase_order_entity_1.POStatus.CANCELLED);
const mockPOArb = fc.record({
    id: fc.uuid(),
    poNumber: poNumberArb,
    vendorName: vendorNameArb,
    materialType: materialTypeArb,
    status: statusArb,
    orderedQuantity: fc.integer({ min: 100, max: 100000 }),
    receivedQuantity: fc.integer({ min: 0, max: 100000 })
});
describe('PO Search Property Tests', () => {
    describe('Property 1: PO Search Returns Valid Results', () => {
        it('should return only POs that match the query in poNumber, vendorName, or materialType', () => {
            fc.assert(fc.property(fc.array(mockPOArb, { minLength: 1, maxLength: 20 }), fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'), { minLength: 2, maxLength: 10 }), (pos, query) => {
                const results = searchPOs(pos, query);
                const lowerQuery = query.toLowerCase();
                const allMatch = results.every(po => po.poNumber.toLowerCase().includes(lowerQuery) ||
                    po.vendorName.toLowerCase().includes(lowerQuery) ||
                    po.materialType.toLowerCase().includes(lowerQuery));
                expect(allMatch).toBe(true);
                return allMatch;
            }), { numRuns: 100 });
        });
        it('should return empty array for queries less than 2 characters', () => {
            fc.assert(fc.property(fc.array(mockPOArb, { minLength: 1, maxLength: 10 }), fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'), { minLength: 0, maxLength: 1 }), (pos, query) => {
                const results = searchPOs(pos, query);
                expect(results.length).toBe(0);
                return results.length === 0;
            }), { numRuns: 100 });
        });
        it('should find PO when searching by exact poNumber', () => {
            fc.assert(fc.property(mockPOArb, fc.array(mockPOArb, { minLength: 0, maxLength: 10 }), (targetPO, otherPOs) => {
                const allPOs = [targetPO, ...otherPOs];
                const query = targetPO.poNumber.substring(0, Math.max(2, targetPO.poNumber.length));
                if (query.length < 2)
                    return true;
                const results = searchPOs(allPOs, query);
                const found = results.some(po => po.id === targetPO.id);
                expect(found).toBe(true);
                return found;
            }), { numRuns: 100 });
        });
    });
});
describe('PO Validation Property Tests', () => {
    describe('Property 3: Completed PO Blocks GRN Creation', () => {
        it('should block GRN for POs with COMPLETED status', () => {
            fc.assert(fc.property(fc.uuid(), poNumberArb, vendorNameArb, materialTypeArb, fc.integer({ min: 100, max: 100000 }), fc.integer({ min: 0, max: 100000 }), (id, poNumber, vendorName, materialType, orderedQuantity, receivedQuantity) => {
                const po = {
                    id,
                    poNumber,
                    vendorName,
                    materialType,
                    status: purchase_order_entity_1.POStatus.COMPLETED,
                    orderedQuantity,
                    receivedQuantity
                };
                const result = validatePOForGRN(po);
                expect(result.isValid).toBe(false);
                expect(result.message).toContain('fully received');
                return result.isValid === false;
            }), { numRuns: 100 });
        });
        it('should block GRN when remaining quantity is 0', () => {
            fc.assert(fc.property(fc.uuid(), poNumberArb, vendorNameArb, materialTypeArb, fc.constantFrom(purchase_order_entity_1.POStatus.PENDING, purchase_order_entity_1.POStatus.PARTIAL), fc.integer({ min: 100, max: 100000 }), (id, poNumber, vendorName, materialType, status, orderedQuantity) => {
                const po = {
                    id,
                    poNumber,
                    vendorName,
                    materialType,
                    status,
                    orderedQuantity,
                    receivedQuantity: orderedQuantity
                };
                const result = validatePOForGRN(po);
                expect(result.isValid).toBe(false);
                return result.isValid === false;
            }), { numRuns: 100 });
        });
    });
    describe('Property 4: Cancelled PO Prevents GRN', () => {
        it('should prevent GRN for cancelled POs regardless of quantity', () => {
            fc.assert(fc.property(fc.uuid(), poNumberArb, vendorNameArb, materialTypeArb, fc.integer({ min: 100, max: 100000 }), fc.integer({ min: 0, max: 50000 }), (id, poNumber, vendorName, materialType, orderedQuantity, receivedQuantity) => {
                const po = {
                    id,
                    poNumber,
                    vendorName,
                    materialType,
                    status: purchase_order_entity_1.POStatus.CANCELLED,
                    orderedQuantity,
                    receivedQuantity
                };
                const result = validatePOForGRN(po);
                expect(result.isValid).toBe(false);
                expect(result.message).toContain('cancelled');
                return result.isValid === false;
            }), { numRuns: 100 });
        });
        it('should prevent GRN for cancelled POs even with remaining quantity', () => {
            fc.assert(fc.property(fc.uuid(), poNumberArb, vendorNameArb, materialTypeArb, fc.integer({ min: 1000, max: 100000 }), (id, poNumber, vendorName, materialType, orderedQuantity) => {
                const po = {
                    id,
                    poNumber,
                    vendorName,
                    materialType,
                    status: purchase_order_entity_1.POStatus.CANCELLED,
                    orderedQuantity,
                    receivedQuantity: 0
                };
                const result = validatePOForGRN(po);
                expect(result.isValid).toBe(false);
                return result.isValid === false;
            }), { numRuns: 100 });
        });
    });
    describe('Valid PO allows GRN', () => {
        it('should allow GRN for pending POs with remaining quantity', () => {
            fc.assert(fc.property(fc.uuid(), poNumberArb, vendorNameArb, materialTypeArb, fc.constantFrom(purchase_order_entity_1.POStatus.PENDING, purchase_order_entity_1.POStatus.PARTIAL), fc.integer({ min: 1000, max: 100000 }), fc.integer({ min: 0, max: 99 }), (id, poNumber, vendorName, materialType, status, orderedQuantity, receivedPercentage) => {
                const receivedQuantity = Math.floor(orderedQuantity * receivedPercentage / 100);
                const po = {
                    id,
                    poNumber,
                    vendorName,
                    materialType,
                    status,
                    orderedQuantity,
                    receivedQuantity
                };
                const result = validatePOForGRN(po);
                expect(result.isValid).toBe(true);
                return result.isValid === true;
            }), { numRuns: 100 });
        });
    });
});
//# sourceMappingURL=po-search.property.spec.js.map