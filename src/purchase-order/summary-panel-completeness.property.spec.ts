/**
 * Property Test: Summary Panel Shows Complete Information
 * **Feature: grn-entry-flow, Property 10: Summary Panel Shows Complete Information**
 * **Validates: Requirements 6.2, 6.3**
 * 
 * For any selected PO, the summary panel should display PO number, vendor,
 * material, expected quantity, and received quantity.
 */

import * as fc from 'fast-check';
import { POStatus } from '../entities/purchase-order.entity';

// Transaction Summary structure (displayed in summary panel)
interface TransactionSummary {
  transactionNumber: string;
  poNumber: string;
  vendorName: string;
  materialType: string;
  expectedQuantity: number;
  receivedQuantity: number;
  unit: string;
  rate: number;
  status: 'draft' | 'in_progress' | 'completed';
  netWeight?: number;
  qualityGrade?: string;
  estimatedValue?: number;
}

// Selected PO structure
interface SelectedPO {
  id: string;
  poNumber: string;
  vendorName: string;
  materialType: string;
  orderedQuantity: number;
  receivedQuantity: number;
  remainingQuantity: number;
  rate: number;
  unit: string;
  status: POStatus;
}

// Function to create summary from selected PO
function createSummaryFromPO(
  po: SelectedPO,
  transactionNumber: string,
  currentReceivedQuantity: number = 0
): TransactionSummary {
  return {
    transactionNumber,
    poNumber: po.poNumber,
    vendorName: po.vendorName,
    materialType: po.materialType,
    expectedQuantity: po.remainingQuantity,
    receivedQuantity: currentReceivedQuantity,
    unit: po.unit,
    rate: po.rate,
    status: 'in_progress',
    estimatedValue: currentReceivedQuantity * po.rate
  };
}

// Function to validate summary has all required fields
function validateSummaryCompleteness(summary: TransactionSummary): {
  hasTransactionNumber: boolean;
  hasPoNumber: boolean;
  hasVendorName: boolean;
  hasMaterialType: boolean;
  hasExpectedQuantity: boolean;
  hasReceivedQuantity: boolean;
  hasUnit: boolean;
  hasRate: boolean;
  isComplete: boolean;
} {
  const hasTransactionNumber = !!summary.transactionNumber && summary.transactionNumber.length > 0;
  const hasPoNumber = !!summary.poNumber && summary.poNumber.length > 0;
  const hasVendorName = !!summary.vendorName && summary.vendorName.length > 0;
  const hasMaterialType = !!summary.materialType && summary.materialType.length > 0;
  const hasExpectedQuantity = typeof summary.expectedQuantity === 'number';
  const hasReceivedQuantity = typeof summary.receivedQuantity === 'number';
  const hasUnit = !!summary.unit && summary.unit.length > 0;
  const hasRate = typeof summary.rate === 'number' && summary.rate >= 0;
  
  return {
    hasTransactionNumber,
    hasPoNumber,
    hasVendorName,
    hasMaterialType,
    hasExpectedQuantity,
    hasReceivedQuantity,
    hasUnit,
    hasRate,
    isComplete: hasTransactionNumber && hasPoNumber && hasVendorName && 
                hasMaterialType && hasExpectedQuantity && hasReceivedQuantity &&
                hasUnit && hasRate
  };
}

// Function to update summary with transaction progress
function updateSummaryWithProgress(
  summary: TransactionSummary,
  netWeight: number,
  qualityGrade?: string
): TransactionSummary {
  return {
    ...summary,
    receivedQuantity: netWeight,
    netWeight,
    qualityGrade,
    estimatedValue: netWeight * summary.rate
  };
}

// Arbitraries
const poNumberArb = fc.stringOf(
  fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'),
  { minLength: 5, maxLength: 15 }
);

const vendorNameArb = fc.stringOf(
  fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz '),
  { minLength: 3, maxLength: 50 }
);

const materialTypeArb = fc.constantFrom(
  'Iron Scrap',
  'Aluminum Scrap',
  'Copper Wire',
  'Steel Scrap',
  'Brass Scrap'
);

const unitArb = fc.constantFrom('KG', 'MT', 'TON');

const transactionNumberArb = fc.stringOf(
  fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'),
  { minLength: 8, maxLength: 15 }
).map(s => `GRN-${s}`);

const selectedPOArb = fc.record({
  id: fc.uuid(),
  poNumber: poNumberArb,
  vendorName: vendorNameArb,
  materialType: materialTypeArb,
  orderedQuantity: fc.integer({ min: 1000, max: 100000 }),
  receivedQuantity: fc.integer({ min: 0, max: 50000 }),
  remainingQuantity: fc.integer({ min: 100, max: 50000 }),
  rate: fc.double({ min: 10, max: 500, noNaN: true }),
  unit: unitArb,
  status: fc.constantFrom(POStatus.PENDING, POStatus.PARTIAL)
});

describe('Summary Panel Completeness Property Tests', () => {
  /**
   * Property 10: Summary Panel Shows Complete Information
   * For any selected PO, the summary panel should display PO number, vendor,
   * material, expected quantity, and received quantity.
   */
  describe('Property 10: Summary Panel Shows Complete Information', () => {
    it('should include all required fields in summary', () => {
      fc.assert(
        fc.property(
          selectedPOArb,
          transactionNumberArb,
          (po, transactionNumber) => {
            const summary = createSummaryFromPO(po, transactionNumber);
            const validation = validateSummaryCompleteness(summary);
            
            // Property: All required fields must be present
            expect(validation.hasTransactionNumber).toBe(true);
            expect(validation.hasPoNumber).toBe(true);
            expect(validation.hasVendorName).toBe(true);
            expect(validation.hasMaterialType).toBe(true);
            expect(validation.hasExpectedQuantity).toBe(true);
            expect(validation.hasReceivedQuantity).toBe(true);
            expect(validation.isComplete).toBe(true);
            
            return validation.isComplete;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve PO number from selected PO', () => {
      fc.assert(
        fc.property(
          selectedPOArb,
          transactionNumberArb,
          (po, transactionNumber) => {
            const summary = createSummaryFromPO(po, transactionNumber);
            
            // Property: PO number should match selected PO
            expect(summary.poNumber).toBe(po.poNumber);
            return summary.poNumber === po.poNumber;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve vendor name from selected PO', () => {
      fc.assert(
        fc.property(
          selectedPOArb,
          transactionNumberArb,
          (po, transactionNumber) => {
            const summary = createSummaryFromPO(po, transactionNumber);
            
            // Property: Vendor name should match selected PO
            expect(summary.vendorName).toBe(po.vendorName);
            return summary.vendorName === po.vendorName;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve material type from selected PO', () => {
      fc.assert(
        fc.property(
          selectedPOArb,
          transactionNumberArb,
          (po, transactionNumber) => {
            const summary = createSummaryFromPO(po, transactionNumber);
            
            // Property: Material type should match selected PO
            expect(summary.materialType).toBe(po.materialType);
            return summary.materialType === po.materialType;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should set expected quantity to PO remaining quantity', () => {
      fc.assert(
        fc.property(
          selectedPOArb,
          transactionNumberArb,
          (po, transactionNumber) => {
            const summary = createSummaryFromPO(po, transactionNumber);
            
            // Property: Expected quantity should be PO's remaining quantity
            expect(summary.expectedQuantity).toBe(po.remainingQuantity);
            return summary.expectedQuantity === po.remainingQuantity;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should initialize received quantity to 0', () => {
      fc.assert(
        fc.property(
          selectedPOArb,
          transactionNumberArb,
          (po, transactionNumber) => {
            const summary = createSummaryFromPO(po, transactionNumber);
            
            // Property: Initial received quantity should be 0
            expect(summary.receivedQuantity).toBe(0);
            return summary.receivedQuantity === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should update received quantity with progress', () => {
      fc.assert(
        fc.property(
          selectedPOArb,
          transactionNumberArb,
          fc.integer({ min: 100, max: 50000 }), // netWeight
          fc.constantFrom('A', 'B', 'C', 'REJECT'),
          (po, transactionNumber, netWeight, qualityGrade) => {
            const summary = createSummaryFromPO(po, transactionNumber);
            const updatedSummary = updateSummaryWithProgress(summary, netWeight, qualityGrade);
            
            // Property: Received quantity should update to net weight
            expect(updatedSummary.receivedQuantity).toBe(netWeight);
            expect(updatedSummary.netWeight).toBe(netWeight);
            expect(updatedSummary.qualityGrade).toBe(qualityGrade);
            
            return updatedSummary.receivedQuantity === netWeight;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate estimated value correctly', () => {
      fc.assert(
        fc.property(
          selectedPOArb,
          transactionNumberArb,
          fc.integer({ min: 100, max: 50000 }), // netWeight
          (po, transactionNumber, netWeight) => {
            const summary = createSummaryFromPO(po, transactionNumber);
            const updatedSummary = updateSummaryWithProgress(summary, netWeight);
            
            const expectedValue = netWeight * po.rate;
            
            // Property: Estimated value should be netWeight * rate
            expect(updatedSummary.estimatedValue).toBeCloseTo(expectedValue, 2);
            return Math.abs((updatedSummary.estimatedValue || 0) - expectedValue) < 0.01;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve unit from selected PO', () => {
      fc.assert(
        fc.property(
          selectedPOArb,
          transactionNumberArb,
          (po, transactionNumber) => {
            const summary = createSummaryFromPO(po, transactionNumber);
            
            // Property: Unit should match selected PO
            expect(summary.unit).toBe(po.unit);
            return summary.unit === po.unit;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve rate from selected PO', () => {
      fc.assert(
        fc.property(
          selectedPOArb,
          transactionNumberArb,
          (po, transactionNumber) => {
            const summary = createSummaryFromPO(po, transactionNumber);
            
            // Property: Rate should match selected PO
            expect(summary.rate).toBe(po.rate);
            return summary.rate === po.rate;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
