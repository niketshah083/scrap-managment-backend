/**
 * Property Tests for PO Search and Validation
 * **Feature: grn-entry-flow**
 * 
 * Property 1: PO Search Returns Valid Results
 * Property 3: Completed PO Blocks GRN Creation
 * Property 4: Cancelled PO Prevents GRN
 */

import * as fc from 'fast-check';
import { POStatus } from '../entities/purchase-order.entity';

// Mock PO data structure
interface MockPO {
  id: string;
  poNumber: string;
  vendorName: string;
  materialType: string;
  status: POStatus;
  orderedQuantity: number;
  receivedQuantity: number;
}

// Search function that matches query against PO fields
function searchPOs(pos: MockPO[], query: string): MockPO[] {
  if (!query || query.length < 2) return [];
  
  const lowerQuery = query.toLowerCase();
  return pos.filter(po =>
    po.poNumber.toLowerCase().includes(lowerQuery) ||
    po.vendorName.toLowerCase().includes(lowerQuery) ||
    po.materialType.toLowerCase().includes(lowerQuery)
  );
}

// Validation function for GRN creation
function validatePOForGRN(po: MockPO): { isValid: boolean; message: string } {
  const remainingQuantity = po.orderedQuantity - po.receivedQuantity;
  
  if (po.status === POStatus.CANCELLED) {
    return {
      isValid: false,
      message: 'This Purchase Order has been cancelled and cannot be used for GRN'
    };
  }
  
  if (po.status === POStatus.COMPLETED || remainingQuantity <= 0) {
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

// Arbitraries
const poNumberArb = fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'), { minLength: 5, maxLength: 15 });
const vendorNameArb = fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz '), { minLength: 3, maxLength: 30 });
const materialTypeArb = fc.constantFrom('Iron Scrap', 'Aluminum Scrap', 'Copper Wire', 'Steel Scrap', 'Brass Scrap');
const statusArb = fc.constantFrom(POStatus.PENDING, POStatus.PARTIAL, POStatus.COMPLETED, POStatus.CANCELLED);

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
  /**
   * Property 1: PO Search Returns Valid Results
   * **Validates: Requirements 1.2, 5.1**
   * For any search query of 2+ characters, all returned POs should contain
   * the query string in either PO number, vendor name, or material type.
   */
  describe('Property 1: PO Search Returns Valid Results', () => {
    it('should return only POs that match the query in poNumber, vendorName, or materialType', () => {
      fc.assert(
        fc.property(
          fc.array(mockPOArb, { minLength: 1, maxLength: 20 }),
          fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'), { minLength: 2, maxLength: 10 }),
          (pos, query) => {
            const results = searchPOs(pos, query);
            const lowerQuery = query.toLowerCase();
            
            // Property: All results must contain the query in at least one field
            const allMatch = results.every(po =>
              po.poNumber.toLowerCase().includes(lowerQuery) ||
              po.vendorName.toLowerCase().includes(lowerQuery) ||
              po.materialType.toLowerCase().includes(lowerQuery)
            );
            
            expect(allMatch).toBe(true);
            return allMatch;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return empty array for queries less than 2 characters', () => {
      fc.assert(
        fc.property(
          fc.array(mockPOArb, { minLength: 1, maxLength: 10 }),
          fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'), { minLength: 0, maxLength: 1 }),
          (pos, query) => {
            const results = searchPOs(pos, query);
            
            // Property: Short queries should return empty results
            expect(results.length).toBe(0);
            return results.length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should find PO when searching by exact poNumber', () => {
      fc.assert(
        fc.property(
          mockPOArb,
          fc.array(mockPOArb, { minLength: 0, maxLength: 10 }),
          (targetPO, otherPOs) => {
            const allPOs = [targetPO, ...otherPOs];
            const query = targetPO.poNumber.substring(0, Math.max(2, targetPO.poNumber.length));
            
            if (query.length < 2) return true; // Skip if poNumber too short
            
            const results = searchPOs(allPOs, query);
            
            // Property: Target PO should be in results
            const found = results.some(po => po.id === targetPO.id);
            expect(found).toBe(true);
            return found;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


describe('PO Validation Property Tests', () => {
  /**
   * Property 3: Completed PO Blocks GRN Creation
   * **Validates: Requirements 1.5, 4.2**
   * For any PO with status "COMPLETED" or remaining quantity = 0,
   * the system should block GRN creation.
   */
  describe('Property 3: Completed PO Blocks GRN Creation', () => {
    it('should block GRN for POs with COMPLETED status', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          poNumberArb,
          vendorNameArb,
          materialTypeArb,
          fc.integer({ min: 100, max: 100000 }),
          fc.integer({ min: 0, max: 100000 }),
          (id, poNumber, vendorName, materialType, orderedQuantity, receivedQuantity) => {
            const po: MockPO = {
              id,
              poNumber,
              vendorName,
              materialType,
              status: POStatus.COMPLETED,
              orderedQuantity,
              receivedQuantity
            };
            
            const result = validatePOForGRN(po);
            
            // Property: Completed POs should not allow GRN
            expect(result.isValid).toBe(false);
            expect(result.message).toContain('fully received');
            return result.isValid === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should block GRN when remaining quantity is 0', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          poNumberArb,
          vendorNameArb,
          materialTypeArb,
          fc.constantFrom(POStatus.PENDING, POStatus.PARTIAL),
          fc.integer({ min: 100, max: 100000 }),
          (id, poNumber, vendorName, materialType, status, orderedQuantity) => {
            const po: MockPO = {
              id,
              poNumber,
              vendorName,
              materialType,
              status,
              orderedQuantity,
              receivedQuantity: orderedQuantity // remaining = 0
            };
            
            const result = validatePOForGRN(po);
            
            // Property: Zero remaining should not allow GRN
            expect(result.isValid).toBe(false);
            return result.isValid === false;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 4: Cancelled PO Prevents GRN
   * **Validates: Requirements 1.6**
   * For any PO with status "CANCELLED", the system should prevent GRN creation entirely.
   */
  describe('Property 4: Cancelled PO Prevents GRN', () => {
    it('should prevent GRN for cancelled POs regardless of quantity', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          poNumberArb,
          vendorNameArb,
          materialTypeArb,
          fc.integer({ min: 100, max: 100000 }),
          fc.integer({ min: 0, max: 50000 }),
          (id, poNumber, vendorName, materialType, orderedQuantity, receivedQuantity) => {
            const po: MockPO = {
              id,
              poNumber,
              vendorName,
              materialType,
              status: POStatus.CANCELLED,
              orderedQuantity,
              receivedQuantity
            };
            
            const result = validatePOForGRN(po);
            
            // Property: Cancelled POs should never allow GRN
            expect(result.isValid).toBe(false);
            expect(result.message).toContain('cancelled');
            return result.isValid === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should prevent GRN for cancelled POs even with remaining quantity', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          poNumberArb,
          vendorNameArb,
          materialTypeArb,
          fc.integer({ min: 1000, max: 100000 }),
          (id, poNumber, vendorName, materialType, orderedQuantity) => {
            const po: MockPO = {
              id,
              poNumber,
              vendorName,
              materialType,
              status: POStatus.CANCELLED,
              orderedQuantity,
              receivedQuantity: 0 // Full remaining quantity
            };
            
            const result = validatePOForGRN(po);
            
            // Property: Even with full remaining, cancelled should block
            expect(result.isValid).toBe(false);
            return result.isValid === false;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Valid PO allows GRN', () => {
    it('should allow GRN for pending POs with remaining quantity', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          poNumberArb,
          vendorNameArb,
          materialTypeArb,
          fc.constantFrom(POStatus.PENDING, POStatus.PARTIAL),
          fc.integer({ min: 1000, max: 100000 }),
          fc.integer({ min: 0, max: 99 }), // percentage received
          (id, poNumber, vendorName, materialType, status, orderedQuantity, receivedPercentage) => {
            const receivedQuantity = Math.floor(orderedQuantity * receivedPercentage / 100);
            
            const po: MockPO = {
              id,
              poNumber,
              vendorName,
              materialType,
              status,
              orderedQuantity,
              receivedQuantity
            };
            
            const result = validatePOForGRN(po);
            
            // Property: Valid POs should allow GRN
            expect(result.isValid).toBe(true);
            return result.isValid === true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
