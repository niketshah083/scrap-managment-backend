/**
 * Property Test: Over-Receipt Requires Approval
 * **Feature: grn-entry-flow, Property 8: Over-Receipt Requires Approval**
 * **Validates: Requirements 4.3**
 * 
 * For any GRN where received quantity exceeds PO remaining quantity,
 * the system should flag for supervisor approval.
 */

import * as fc from 'fast-check';
import { POStatus } from '../entities/purchase-order.entity';

// PO structure
interface MockPO {
  id: string;
  poNumber: string;
  orderedQuantity: number;
  receivedQuantity: number;
  remainingQuantity: number;
  status: POStatus;
}

// GRN validation result
interface GRNValidationResult {
  isValid: boolean;
  requiresApproval: boolean;
  approvalReason?: string;
  overReceiptAmount?: number;
  message: string;
}

// Function to validate GRN quantity against PO
function validateGRNQuantity(po: MockPO, receivedQuantity: number): GRNValidationResult {
  const remainingQuantity = po.orderedQuantity - po.receivedQuantity;
  
  // Check if PO is valid for GRN
  if (po.status === POStatus.CANCELLED) {
    return {
      isValid: false,
      requiresApproval: false,
      message: 'Cannot create GRN for cancelled PO'
    };
  }
  
  if (po.status === POStatus.COMPLETED || remainingQuantity <= 0) {
    return {
      isValid: false,
      requiresApproval: false,
      message: 'PO is fully received'
    };
  }
  
  // Check for over-receipt
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
  
  // Normal receipt within limits
  return {
    isValid: true,
    requiresApproval: false,
    message: 'GRN quantity is within PO limits'
  };
}

// Function to check if supervisor approval is needed
function needsSupervisorApproval(po: MockPO, receivedQuantity: number): boolean {
  const remainingQuantity = po.orderedQuantity - po.receivedQuantity;
  return receivedQuantity > remainingQuantity && po.status !== POStatus.CANCELLED;
}

// Function to calculate over-receipt amount
function calculateOverReceiptAmount(po: MockPO, receivedQuantity: number): number {
  const remainingQuantity = po.orderedQuantity - po.receivedQuantity;
  return Math.max(0, receivedQuantity - remainingQuantity);
}

// Arbitraries
const mockPOArb = fc.record({
  id: fc.uuid(),
  poNumber: fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'), { minLength: 5, maxLength: 15 }),
  orderedQuantity: fc.integer({ min: 10000, max: 100000 }),
  receivedQuantity: fc.integer({ min: 0, max: 50000 }),
  remainingQuantity: fc.integer({ min: 1000, max: 50000 }),
  status: fc.constantFrom(POStatus.PENDING, POStatus.PARTIAL)
}).map(po => ({
  ...po,
  remainingQuantity: po.orderedQuantity - po.receivedQuantity
}));

describe('Over-Receipt Property Tests', () => {
  /**
   * Property 8: Over-Receipt Requires Approval
   * For any GRN where received quantity exceeds PO remaining quantity,
   * the system should flag for supervisor approval.
   */
  describe('Property 8: Over-Receipt Requires Approval', () => {
    it('should require approval when received exceeds remaining', () => {
      fc.assert(
        fc.property(
          mockPOArb,
          fc.integer({ min: 1, max: 10000 }), // excess amount
          (po, excess) => {
            // Ensure remaining > 0
            if (po.remainingQuantity <= 0) return true;
            
            const receivedQuantity = po.remainingQuantity + excess;
            const result = validateGRNQuantity(po, receivedQuantity);
            
            // Property: Over-receipt should require approval
            expect(result.requiresApproval).toBe(true);
            expect(result.approvalReason).toContain('Over-receipt');
            expect(result.overReceiptAmount).toBe(excess);
            
            return result.requiresApproval === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should NOT require approval when received is within limits', () => {
      fc.assert(
        fc.property(
          mockPOArb,
          fc.integer({ min: 1, max: 99 }), // percentage of remaining
          (po, percentage) => {
            // Ensure remaining > 0
            if (po.remainingQuantity <= 0) return true;
            
            const receivedQuantity = Math.floor(po.remainingQuantity * percentage / 100);
            if (receivedQuantity <= 0) return true;
            
            const result = validateGRNQuantity(po, receivedQuantity);
            
            // Property: Within-limits receipt should not require approval
            expect(result.requiresApproval).toBe(false);
            expect(result.isValid).toBe(true);
            
            return result.requiresApproval === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should NOT require approval when received equals remaining', () => {
      fc.assert(
        fc.property(
          mockPOArb,
          (po) => {
            // Ensure remaining > 0
            if (po.remainingQuantity <= 0) return true;
            
            const receivedQuantity = po.remainingQuantity; // Exact match
            const result = validateGRNQuantity(po, receivedQuantity);
            
            // Property: Exact match should not require approval
            expect(result.requiresApproval).toBe(false);
            expect(result.isValid).toBe(true);
            
            return result.requiresApproval === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly calculate over-receipt amount', () => {
      fc.assert(
        fc.property(
          mockPOArb,
          fc.integer({ min: 1, max: 10000 }), // excess
          (po, excess) => {
            if (po.remainingQuantity <= 0) return true;
            
            const receivedQuantity = po.remainingQuantity + excess;
            const overReceiptAmount = calculateOverReceiptAmount(po, receivedQuantity);
            
            // Property: Over-receipt amount should equal excess
            expect(overReceiptAmount).toBe(excess);
            return overReceiptAmount === excess;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return zero over-receipt for within-limits quantity', () => {
      fc.assert(
        fc.property(
          mockPOArb,
          fc.integer({ min: 1, max: 99 }), // percentage
          (po, percentage) => {
            if (po.remainingQuantity <= 0) return true;
            
            const receivedQuantity = Math.floor(po.remainingQuantity * percentage / 100);
            const overReceiptAmount = calculateOverReceiptAmount(po, receivedQuantity);
            
            // Property: No over-receipt for within-limits
            expect(overReceiptAmount).toBe(0);
            return overReceiptAmount === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should flag approval need correctly', () => {
      fc.assert(
        fc.property(
          mockPOArb,
          fc.integer({ min: 100, max: 50000 }), // receivedQuantity
          (po, receivedQuantity) => {
            if (po.remainingQuantity <= 0) return true;
            
            const needsApproval = needsSupervisorApproval(po, receivedQuantity);
            const isOverReceipt = receivedQuantity > po.remainingQuantity;
            
            // Property: Approval flag should match over-receipt status
            expect(needsApproval).toBe(isOverReceipt);
            return needsApproval === isOverReceipt;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include approval reason in validation result', () => {
      fc.assert(
        fc.property(
          mockPOArb,
          fc.integer({ min: 1, max: 10000 }), // excess
          (po, excess) => {
            if (po.remainingQuantity <= 0) return true;
            
            const receivedQuantity = po.remainingQuantity + excess;
            const result = validateGRNQuantity(po, receivedQuantity);
            
            // Property: Over-receipt should have approval reason
            if (result.requiresApproval) {
              expect(result.approvalReason).toBeDefined();
              expect(result.approvalReason!.length).toBeGreaterThan(0);
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should still mark GRN as valid even with over-receipt', () => {
      fc.assert(
        fc.property(
          mockPOArb,
          fc.integer({ min: 1, max: 10000 }), // excess
          (po, excess) => {
            if (po.remainingQuantity <= 0) return true;
            
            const receivedQuantity = po.remainingQuantity + excess;
            const result = validateGRNQuantity(po, receivedQuantity);
            
            // Property: Over-receipt GRN is valid but needs approval
            expect(result.isValid).toBe(true);
            expect(result.requiresApproval).toBe(true);
            
            return result.isValid === true && result.requiresApproval === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle edge case of exactly 1 unit over', () => {
      fc.assert(
        fc.property(
          mockPOArb,
          (po) => {
            if (po.remainingQuantity <= 0) return true;
            
            const receivedQuantity = po.remainingQuantity + 1;
            const result = validateGRNQuantity(po, receivedQuantity);
            
            // Property: Even 1 unit over should require approval
            expect(result.requiresApproval).toBe(true);
            expect(result.overReceiptAmount).toBe(1);
            
            return result.requiresApproval === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not allow over-receipt for cancelled POs', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'), { minLength: 5, maxLength: 15 }),
          fc.integer({ min: 10000, max: 100000 }),
          fc.integer({ min: 0, max: 5000 }),
          fc.integer({ min: 1, max: 10000 }),
          (id, poNumber, orderedQuantity, receivedQuantity, excess) => {
            const po: MockPO = {
              id,
              poNumber,
              orderedQuantity,
              receivedQuantity,
              remainingQuantity: orderedQuantity - receivedQuantity,
              status: POStatus.CANCELLED
            };
            
            const receivedQty = po.remainingQuantity + excess;
            const result = validateGRNQuantity(po, receivedQty);
            
            // Property: Cancelled POs should not allow any GRN
            expect(result.isValid).toBe(false);
            expect(result.requiresApproval).toBe(false);
            
            return result.isValid === false;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
