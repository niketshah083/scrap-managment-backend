/**
 * Property Test: PO Suggestions Show Required Fields
 * **Feature: grn-entry-flow, Property 9: PO Suggestions Show Required Fields**
 * **Validates: Requirements 5.2**
 * 
 * For any PO suggestion displayed, it should include PO number, vendor name,
 * material type, and status.
 */

import * as fc from 'fast-check';
import { POStatus } from '../entities/purchase-order.entity';

// PO Suggestion structure (what's displayed in dropdown)
interface POSuggestion {
  id: string;
  poNumber: string;
  vendorName: string;
  materialType: string;
  status: POStatus;
  remainingQuantity: number;
  unit: string;
}

// Full PO structure (from database)
interface FullPO {
  id: string;
  poNumber: string;
  vendorId: string;
  vendorName: string;
  materialType: string;
  materialDescription: string;
  orderedQuantity: number;
  receivedQuantity: number;
  rate: number;
  unit: string;
  status: POStatus;
  deliveryDate: Date;
  notes: string;
  tenantId: string;
}

// Function to transform full PO to suggestion (what UI displays)
function transformToSuggestion(po: FullPO): POSuggestion {
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

// Function to render suggestion as display string
function renderSuggestionDisplay(suggestion: POSuggestion): string {
  return `${suggestion.poNumber} | ${suggestion.vendorName} | ${suggestion.materialType} | ${suggestion.status}`;
}

// Function to validate suggestion has all required fields
function validateSuggestionFields(suggestion: POSuggestion): {
  hasPoNumber: boolean;
  hasVendorName: boolean;
  hasMaterialType: boolean;
  hasStatus: boolean;
  isComplete: boolean;
} {
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
  'Brass Scrap',
  'Stainless Steel',
  'Mixed Metal'
);

const statusArb = fc.constantFrom(
  POStatus.PENDING,
  POStatus.PARTIAL,
  POStatus.COMPLETED,
  POStatus.CANCELLED
);

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
  /**
   * Property 9: PO Suggestions Show Required Fields
   * For any PO suggestion displayed, it should include PO number, vendor name,
   * material type, and status.
   */
  describe('Property 9: PO Suggestions Show Required Fields', () => {
    it('should include all required fields in suggestion', () => {
      fc.assert(
        fc.property(
          fullPOArb,
          (fullPO) => {
            const suggestion = transformToSuggestion(fullPO);
            const validation = validateSuggestionFields(suggestion);
            
            // Property: All required fields must be present
            expect(validation.hasPoNumber).toBe(true);
            expect(validation.hasVendorName).toBe(true);
            expect(validation.hasMaterialType).toBe(true);
            expect(validation.hasStatus).toBe(true);
            expect(validation.isComplete).toBe(true);
            
            return validation.isComplete;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve PO number exactly from source', () => {
      fc.assert(
        fc.property(
          fullPOArb,
          (fullPO) => {
            const suggestion = transformToSuggestion(fullPO);
            
            // Property: PO number should match exactly
            expect(suggestion.poNumber).toBe(fullPO.poNumber);
            return suggestion.poNumber === fullPO.poNumber;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve vendor name exactly from source', () => {
      fc.assert(
        fc.property(
          fullPOArb,
          (fullPO) => {
            const suggestion = transformToSuggestion(fullPO);
            
            // Property: Vendor name should match exactly
            expect(suggestion.vendorName).toBe(fullPO.vendorName);
            return suggestion.vendorName === fullPO.vendorName;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve material type exactly from source', () => {
      fc.assert(
        fc.property(
          fullPOArb,
          (fullPO) => {
            const suggestion = transformToSuggestion(fullPO);
            
            // Property: Material type should match exactly
            expect(suggestion.materialType).toBe(fullPO.materialType);
            return suggestion.materialType === fullPO.materialType;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve status exactly from source', () => {
      fc.assert(
        fc.property(
          fullPOArb,
          (fullPO) => {
            const suggestion = transformToSuggestion(fullPO);
            
            // Property: Status should match exactly
            expect(suggestion.status).toBe(fullPO.status);
            return suggestion.status === fullPO.status;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include all required fields in rendered display string', () => {
      fc.assert(
        fc.property(
          fullPOArb,
          (fullPO) => {
            const suggestion = transformToSuggestion(fullPO);
            const displayString = renderSuggestionDisplay(suggestion);
            
            // Property: Display string should contain all required fields
            expect(displayString).toContain(suggestion.poNumber);
            expect(displayString).toContain(suggestion.vendorName);
            expect(displayString).toContain(suggestion.materialType);
            expect(displayString).toContain(suggestion.status);
            
            return (
              displayString.includes(suggestion.poNumber) &&
              displayString.includes(suggestion.vendorName) &&
              displayString.includes(suggestion.materialType) &&
              displayString.includes(suggestion.status)
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly calculate remaining quantity', () => {
      fc.assert(
        fc.property(
          fullPOArb,
          (fullPO) => {
            const suggestion = transformToSuggestion(fullPO);
            const expectedRemaining = fullPO.orderedQuantity - fullPO.receivedQuantity;
            
            // Property: Remaining quantity should be calculated correctly
            expect(suggestion.remainingQuantity).toBe(expectedRemaining);
            return suggestion.remainingQuantity === expectedRemaining;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle array of suggestions correctly', () => {
      fc.assert(
        fc.property(
          fc.array(fullPOArb, { minLength: 1, maxLength: 10 }),
          (fullPOs) => {
            const suggestions = fullPOs.map(transformToSuggestion);
            
            // Property: All suggestions should have complete fields
            const allComplete = suggestions.every(s => validateSuggestionFields(s).isComplete);
            expect(allComplete).toBe(true);
            
            // Property: Suggestions count should match input count
            expect(suggestions.length).toBe(fullPOs.length);
            
            return allComplete && suggestions.length === fullPOs.length;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
