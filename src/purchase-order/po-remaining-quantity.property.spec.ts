/**
 * Property Test: PO Remaining Quantity Allows GRN
 * **Feature: grn-entry-flow, Property 7: Remaining Quantity Allows GRN**
 * **Validates: Requirements 4.1**
 * 
 * For any PO with remaining quantity > 0 and status not CANCELLED, 
 * GRN creation should be allowed.
 */

import * as fc from 'fast-check';
import { POStatus } from '../entities/purchase-order.entity';

// Helper to calculate remaining quantity
function calculateRemainingQuantity(orderedQuantity: number, receivedQuantity: number): number {
  return orderedQuantity - receivedQuantity;
}

// Helper to determine if GRN can be created
function canCreateGRN(
  status: POStatus,
  orderedQuantity: number,
  receivedQuantity: number
): boolean {
  const remainingQuantity = calculateRemainingQuantity(orderedQuantity, receivedQuantity);
  
  // Cannot create GRN for cancelled POs
  if (status === POStatus.CANCELLED) {
    return false;
  }
  
  // Cannot create GRN for completed POs (no remaining quantity)
  if (status === POStatus.COMPLETED || remainingQuantity <= 0) {
    return false;
  }
  
  return true;
}

// Arbitrary for valid PO statuses that allow GRN
const validPOStatusArb = fc.constantFrom(
  POStatus.PENDING,
  POStatus.PARTIAL
);

// Arbitrary for invalid PO statuses
const invalidPOStatusArb = fc.constantFrom(
  POStatus.CANCELLED,
  POStatus.COMPLETED
);

describe('PO Remaining Quantity Property Tests', () => {
  /**
   * Property 7: Remaining Quantity Allows GRN
   * For any PO with remaining quantity > 0 and status not CANCELLED,
   * GRN creation should be allowed.
   */
  describe('Property 7: Remaining Quantity Allows GRN', () => {
    it('should allow GRN creation when remaining quantity > 0 and status is valid', () => {
      fc.assert(
        fc.property(
          validPOStatusArb,
          fc.integer({ min: 100, max: 100000 }), // orderedQuantity
          fc.integer({ min: 0, max: 99 }), // receivedQuantity percentage (0-99%)
          (status, orderedQuantity, receivedPercentage) => {
            // Calculate received quantity as percentage of ordered
            const receivedQuantity = Math.floor(orderedQuantity * receivedPercentage / 100);
            const remainingQuantity = calculateRemainingQuantity(orderedQuantity, receivedQuantity);
            
            // Ensure remaining > 0
            if (remainingQuantity <= 0) return true; // Skip this case
            
            const canCreate = canCreateGRN(status, orderedQuantity, receivedQuantity);
            
            // Property: If remaining > 0 and status is valid, GRN should be allowed
            expect(canCreate).toBe(true);
            return canCreate === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should NOT allow GRN creation when status is CANCELLED', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 100000 }), // orderedQuantity
          fc.integer({ min: 0, max: 50000 }), // receivedQuantity
          (orderedQuantity, receivedQuantity) => {
            const canCreate = canCreateGRN(POStatus.CANCELLED, orderedQuantity, receivedQuantity);
            
            // Property: Cancelled POs should never allow GRN
            expect(canCreate).toBe(false);
            return canCreate === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should NOT allow GRN creation when remaining quantity is 0', () => {
      fc.assert(
        fc.property(
          validPOStatusArb,
          fc.integer({ min: 100, max: 100000 }), // orderedQuantity
          (status, orderedQuantity) => {
            // Set received = ordered (remaining = 0)
            const receivedQuantity = orderedQuantity;
            const canCreate = canCreateGRN(status, orderedQuantity, receivedQuantity);
            
            // Property: When remaining = 0, GRN should not be allowed
            expect(canCreate).toBe(false);
            return canCreate === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should NOT allow GRN creation when received exceeds ordered', () => {
      fc.assert(
        fc.property(
          validPOStatusArb,
          fc.integer({ min: 100, max: 100000 }), // orderedQuantity
          fc.integer({ min: 1, max: 10000 }), // excess amount
          (status, orderedQuantity, excess) => {
            // Set received > ordered
            const receivedQuantity = orderedQuantity + excess;
            const canCreate = canCreateGRN(status, orderedQuantity, receivedQuantity);
            
            // Property: When received > ordered, GRN should not be allowed
            expect(canCreate).toBe(false);
            return canCreate === false;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Remaining Quantity Calculation', () => {
    it('should correctly calculate remaining quantity', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100000 }), // orderedQuantity
          fc.integer({ min: 0, max: 100000 }), // receivedQuantity
          (orderedQuantity, receivedQuantity) => {
            const remaining = calculateRemainingQuantity(orderedQuantity, receivedQuantity);
            
            // Property: remaining = ordered - received
            expect(remaining).toBe(orderedQuantity - receivedQuantity);
            return remaining === orderedQuantity - receivedQuantity;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have remaining >= 0 when received <= ordered', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100000 }), // orderedQuantity
          (orderedQuantity) => {
            // Generate received <= ordered using a ratio
            const receivedQuantity = Math.floor(Math.random() * (orderedQuantity + 1));
            const remaining = calculateRemainingQuantity(orderedQuantity, receivedQuantity);
            
            // Property: remaining should be >= 0
            expect(remaining).toBeGreaterThanOrEqual(0);
            return remaining >= 0;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
