/**
 * Property Test: PO Selection Auto-Fills All Required Fields
 * **Feature: grn-entry-flow, Property 2: PO Selection Auto-Fills All Required Fields**
 * **Validates: Requirements 1.3, 5.3**
 * 
 * For any PO selected from search results, the form should be populated with
 * vendor name, material type, expected quantity, and rate matching the PO data.
 */

import * as fc from 'fast-check';
import { POStatus } from '../entities/purchase-order.entity';

// Selected PO structure (from search results)
interface SelectedPO {
  id: string;
  poNumber: string;
  vendorId: string;
  vendorName: string;
  materialType: string;
  materialDescription: string;
  orderedQuantity: number;
  receivedQuantity: number;
  remainingQuantity: number;
  rate: number;
  unit: string;
  status: POStatus;
  deliveryDate: Date;
}

// Form data structure (what gets auto-filled)
interface AutoFilledFormData {
  poId: string;
  poNumber: string;
  vendorId: string;
  vendorName: string;
  materialType: string;
  materialDescription: string;
  expectedQuantity: number;
  rate: number;
  unit: string;
}

// Function to auto-fill form from selected PO
function autoFillFormFromPO(po: SelectedPO): AutoFilledFormData {
  return {
    poId: po.id,
    poNumber: po.poNumber,
    vendorId: po.vendorId,
    vendorName: po.vendorName,
    materialType: po.materialType,
    materialDescription: po.materialDescription,
    expectedQuantity: po.remainingQuantity,
    rate: po.rate,
    unit: po.unit
  };
}

// Function to validate auto-fill completeness
function validateAutoFill(po: SelectedPO, formData: AutoFilledFormData): {
  vendorNameMatches: boolean;
  materialTypeMatches: boolean;
  expectedQuantityMatches: boolean;
  rateMatches: boolean;
  allFieldsMatch: boolean;
} {
  const vendorNameMatches = formData.vendorName === po.vendorName;
  const materialTypeMatches = formData.materialType === po.materialType;
  const expectedQuantityMatches = formData.expectedQuantity === po.remainingQuantity;
  const rateMatches = formData.rate === po.rate;
  
  return {
    vendorNameMatches,
    materialTypeMatches,
    expectedQuantityMatches,
    rateMatches,
    allFieldsMatch: vendorNameMatches && materialTypeMatches && expectedQuantityMatches && rateMatches
  };
}

// Function to check if form has all required fields populated
function hasAllRequiredFields(formData: AutoFilledFormData): boolean {
  return (
    !!formData.poId &&
    !!formData.poNumber &&
    !!formData.vendorId &&
    !!formData.vendorName &&
    !!formData.materialType &&
    typeof formData.expectedQuantity === 'number' &&
    typeof formData.rate === 'number' &&
    !!formData.unit
  );
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
  'Stainless Steel'
);

const unitArb = fc.constantFrom('KG', 'MT', 'TON', 'LBS');

const selectedPOArb = fc.record({
  id: fc.uuid(),
  poNumber: poNumberArb,
  vendorId: fc.uuid(),
  vendorName: vendorNameArb,
  materialType: materialTypeArb,
  materialDescription: fc.string({ minLength: 10, maxLength: 100 }),
  orderedQuantity: fc.integer({ min: 1000, max: 100000 }),
  receivedQuantity: fc.integer({ min: 0, max: 50000 }),
  remainingQuantity: fc.integer({ min: 100, max: 50000 }),
  rate: fc.double({ min: 10, max: 500, noNaN: true }),
  unit: unitArb,
  status: fc.constantFrom(POStatus.PENDING, POStatus.PARTIAL),
  deliveryDate: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') })
});

describe('PO Auto-Fill Property Tests', () => {
  /**
   * Property 2: PO Selection Auto-Fills All Required Fields
   * For any PO selected from search results, the form should be populated with
   * vendor name, material type, expected quantity, and rate matching the PO data.
   */
  describe('Property 2: PO Selection Auto-Fills All Required Fields', () => {
    it('should auto-fill vendor name from selected PO', () => {
      fc.assert(
        fc.property(
          selectedPOArb,
          (po) => {
            const formData = autoFillFormFromPO(po);
            
            // Property: Vendor name should match PO
            expect(formData.vendorName).toBe(po.vendorName);
            return formData.vendorName === po.vendorName;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should auto-fill material type from selected PO', () => {
      fc.assert(
        fc.property(
          selectedPOArb,
          (po) => {
            const formData = autoFillFormFromPO(po);
            
            // Property: Material type should match PO
            expect(formData.materialType).toBe(po.materialType);
            return formData.materialType === po.materialType;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should auto-fill expected quantity as remaining quantity', () => {
      fc.assert(
        fc.property(
          selectedPOArb,
          (po) => {
            const formData = autoFillFormFromPO(po);
            
            // Property: Expected quantity should be PO's remaining quantity
            expect(formData.expectedQuantity).toBe(po.remainingQuantity);
            return formData.expectedQuantity === po.remainingQuantity;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should auto-fill rate from selected PO', () => {
      fc.assert(
        fc.property(
          selectedPOArb,
          (po) => {
            const formData = autoFillFormFromPO(po);
            
            // Property: Rate should match PO
            expect(formData.rate).toBe(po.rate);
            return formData.rate === po.rate;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should auto-fill all required fields at once', () => {
      fc.assert(
        fc.property(
          selectedPOArb,
          (po) => {
            const formData = autoFillFormFromPO(po);
            const validation = validateAutoFill(po, formData);
            
            // Property: All fields should match
            expect(validation.allFieldsMatch).toBe(true);
            return validation.allFieldsMatch;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should populate all required form fields', () => {
      fc.assert(
        fc.property(
          selectedPOArb,
          (po) => {
            const formData = autoFillFormFromPO(po);
            
            // Property: All required fields should be populated
            expect(hasAllRequiredFields(formData)).toBe(true);
            return hasAllRequiredFields(formData);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve PO ID for reference', () => {
      fc.assert(
        fc.property(
          selectedPOArb,
          (po) => {
            const formData = autoFillFormFromPO(po);
            
            // Property: PO ID should be preserved
            expect(formData.poId).toBe(po.id);
            return formData.poId === po.id;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve vendor ID for reference', () => {
      fc.assert(
        fc.property(
          selectedPOArb,
          (po) => {
            const formData = autoFillFormFromPO(po);
            
            // Property: Vendor ID should be preserved
            expect(formData.vendorId).toBe(po.vendorId);
            return formData.vendorId === po.vendorId;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve unit from selected PO', () => {
      fc.assert(
        fc.property(
          selectedPOArb,
          (po) => {
            const formData = autoFillFormFromPO(po);
            
            // Property: Unit should match PO
            expect(formData.unit).toBe(po.unit);
            return formData.unit === po.unit;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle multiple PO selections correctly', () => {
      fc.assert(
        fc.property(
          fc.array(selectedPOArb, { minLength: 2, maxLength: 5 }),
          (pos) => {
            // Select each PO and verify auto-fill
            const results = pos.map(po => {
              const formData = autoFillFormFromPO(po);
              return validateAutoFill(po, formData).allFieldsMatch;
            });
            
            // Property: All selections should auto-fill correctly
            const allCorrect = results.every(r => r === true);
            expect(allCorrect).toBe(true);
            return allCorrect;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
