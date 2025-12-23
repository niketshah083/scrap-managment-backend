/**
 * Property Test: Transaction Completion Updates PO Quantity
 * **Feature: grn-entry-flow, Property 6: Transaction Completion Updates PO Quantity**
 * **Validates: Requirements 3.5**
 * 
 * For any completed transaction, the associated PO's received quantity
 * should be incremented by the transaction's net weight.
 */

import * as fc from 'fast-check';
import { POStatus } from '../entities/purchase-order.entity';

// Mock PO structure
interface MockPO {
  id: string;
  poNumber: string;
  orderedQuantity: number;
  receivedQuantity: number;
  status: POStatus;
}

// Mock Transaction structure
interface MockTransaction {
  id: string;
  poId: string;
  grossWeight: number;
  tareWeight: number;
  netWeight: number;
  status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
}

// Function to calculate net weight
function calculateNetWeight(grossWeight: number, tareWeight: number): number {
  return grossWeight - tareWeight;
}

// Function to update PO after transaction completion
function updatePOAfterCompletion(po: MockPO, transaction: MockTransaction): MockPO {
  if (transaction.status !== 'COMPLETED') {
    return po; // No update for non-completed transactions
  }
  
  const newReceivedQuantity = po.receivedQuantity + transaction.netWeight;
  const newStatus = newReceivedQuantity >= po.orderedQuantity 
    ? POStatus.COMPLETED 
    : POStatus.PARTIAL;
  
  return {
    ...po,
    receivedQuantity: newReceivedQuantity,
    status: newStatus
  };
}

// Function to determine if PO should be marked complete
function shouldMarkPOComplete(po: MockPO, additionalQuantity: number): boolean {
  return (po.receivedQuantity + additionalQuantity) >= po.orderedQuantity;
}

describe('PO Quantity Update Property Tests', () => {
  /**
   * Property 6: Transaction Completion Updates PO Quantity
   * For any completed transaction, the associated PO's received quantity
   * should be incremented by the transaction's net weight.
   */
  describe('Property 6: Transaction Completion Updates PO Quantity', () => {
    it('should increment PO received quantity by transaction net weight', () => {
      fc.assert(
        fc.property(
          fc.uuid(), // poId
          fc.uuid(), // transactionId
          fc.integer({ min: 1000, max: 100000 }), // orderedQuantity
          fc.integer({ min: 0, max: 50000 }), // initialReceivedQuantity
          fc.integer({ min: 5000, max: 50000 }), // grossWeight
          fc.integer({ min: 1000, max: 4000 }), // tareWeight
          (poId, transactionId, orderedQuantity, initialReceivedQuantity, grossWeight, tareWeight) => {
            const netWeight = calculateNetWeight(grossWeight, tareWeight);
            
            const po: MockPO = {
              id: poId,
              poNumber: `PO-${poId.substring(0, 8)}`,
              orderedQuantity,
              receivedQuantity: initialReceivedQuantity,
              status: POStatus.PENDING
            };
            
            const transaction: MockTransaction = {
              id: transactionId,
              poId,
              grossWeight,
              tareWeight,
              netWeight,
              status: 'COMPLETED'
            };
            
            const updatedPO = updatePOAfterCompletion(po, transaction);
            
            // Property: Received quantity should increase by net weight
            expect(updatedPO.receivedQuantity).toBe(initialReceivedQuantity + netWeight);
            return updatedPO.receivedQuantity === initialReceivedQuantity + netWeight;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should NOT update PO for non-completed transactions', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.integer({ min: 1000, max: 100000 }),
          fc.integer({ min: 0, max: 50000 }),
          fc.integer({ min: 5000, max: 50000 }),
          fc.integer({ min: 1000, max: 4000 }),
          fc.constantFrom('DRAFT', 'IN_PROGRESS', 'CANCELLED') as fc.Arbitrary<'DRAFT' | 'IN_PROGRESS' | 'CANCELLED'>,
          (poId, transactionId, orderedQuantity, initialReceivedQuantity, grossWeight, tareWeight, txStatus) => {
            const netWeight = calculateNetWeight(grossWeight, tareWeight);
            
            const po: MockPO = {
              id: poId,
              poNumber: `PO-${poId.substring(0, 8)}`,
              orderedQuantity,
              receivedQuantity: initialReceivedQuantity,
              status: POStatus.PENDING
            };
            
            const transaction: MockTransaction = {
              id: transactionId,
              poId,
              grossWeight,
              tareWeight,
              netWeight,
              status: txStatus
            };
            
            const updatedPO = updatePOAfterCompletion(po, transaction);
            
            // Property: Non-completed transactions should not change PO
            expect(updatedPO.receivedQuantity).toBe(initialReceivedQuantity);
            return updatedPO.receivedQuantity === initialReceivedQuantity;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should mark PO as COMPLETED when fully received', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.integer({ min: 10000, max: 50000 }), // orderedQuantity
          (poId, transactionId, orderedQuantity) => {
            // Set up PO with 90% received
            const initialReceivedQuantity = Math.floor(orderedQuantity * 0.9);
            // Transaction will complete the remaining 10%+
            const netWeight = orderedQuantity - initialReceivedQuantity + 100;
            
            const po: MockPO = {
              id: poId,
              poNumber: `PO-${poId.substring(0, 8)}`,
              orderedQuantity,
              receivedQuantity: initialReceivedQuantity,
              status: POStatus.PARTIAL
            };
            
            const transaction: MockTransaction = {
              id: transactionId,
              poId,
              grossWeight: netWeight + 2000,
              tareWeight: 2000,
              netWeight,
              status: 'COMPLETED'
            };
            
            const updatedPO = updatePOAfterCompletion(po, transaction);
            
            // Property: PO should be marked COMPLETED when fully received
            expect(updatedPO.status).toBe(POStatus.COMPLETED);
            expect(updatedPO.receivedQuantity).toBeGreaterThanOrEqual(orderedQuantity);
            return updatedPO.status === POStatus.COMPLETED;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should mark PO as PARTIAL when not fully received', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.integer({ min: 50000, max: 100000 }), // orderedQuantity (large)
          fc.integer({ min: 1000, max: 10000 }), // netWeight (small)
          (poId, transactionId, orderedQuantity, netWeight) => {
            const po: MockPO = {
              id: poId,
              poNumber: `PO-${poId.substring(0, 8)}`,
              orderedQuantity,
              receivedQuantity: 0,
              status: POStatus.PENDING
            };
            
            const transaction: MockTransaction = {
              id: transactionId,
              poId,
              grossWeight: netWeight + 2000,
              tareWeight: 2000,
              netWeight,
              status: 'COMPLETED'
            };
            
            const updatedPO = updatePOAfterCompletion(po, transaction);
            
            // Property: PO should be PARTIAL when not fully received
            if (updatedPO.receivedQuantity < orderedQuantity) {
              expect(updatedPO.status).toBe(POStatus.PARTIAL);
              return updatedPO.status === POStatus.PARTIAL;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly calculate net weight from gross and tare', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 5000, max: 100000 }), // grossWeight
          fc.integer({ min: 1000, max: 4999 }), // tareWeight (always less than gross)
          (grossWeight, tareWeight) => {
            const netWeight = calculateNetWeight(grossWeight, tareWeight);
            
            // Property: Net weight = Gross - Tare
            expect(netWeight).toBe(grossWeight - tareWeight);
            expect(netWeight).toBeGreaterThan(0);
            return netWeight === grossWeight - tareWeight && netWeight > 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle multiple transactions updating same PO', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.integer({ min: 100000, max: 500000 }), // orderedQuantity
          fc.array(fc.integer({ min: 1000, max: 20000 }), { minLength: 2, maxLength: 5 }), // netWeights
          (poId, orderedQuantity, netWeights) => {
            let po: MockPO = {
              id: poId,
              poNumber: `PO-${poId.substring(0, 8)}`,
              orderedQuantity,
              receivedQuantity: 0,
              status: POStatus.PENDING
            };
            
            // Apply multiple transactions
            netWeights.forEach((netWeight, index) => {
              const transaction: MockTransaction = {
                id: `tx-${index}`,
                poId,
                grossWeight: netWeight + 2000,
                tareWeight: 2000,
                netWeight,
                status: 'COMPLETED'
              };
              po = updatePOAfterCompletion(po, transaction);
            });
            
            // Property: Total received should equal sum of all net weights
            const totalNetWeight = netWeights.reduce((sum, w) => sum + w, 0);
            expect(po.receivedQuantity).toBe(totalNetWeight);
            return po.receivedQuantity === totalNetWeight;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
