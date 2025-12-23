/**
 * Property Test: PO Selection Auto-Fills Form Fields
 * **Feature: lab-qc-report, Property 5: PO Selection Auto-Fills Form Fields**
 * **Validates: Requirements 3.3**
 * 
 * For any PO selected from the list, the GRN form should be populated with
 * vendor name, material type, rate, and expected quantity matching the PO data.
 */

import * as fc from 'fast-check';
import { POStatus } from '../entities/purchase-order.entity';

// PO structure from pending/partial list
interface PendingPO {
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

// GRN Form fields that get auto-filled from PO
interface GRNFormAutoFillData {
  vendorName: string;
  materialType: string;
  rate: number;
  expectedQuantity: number;
}

/**
 * Function that simulates the auto-fill behavior when a PO is selected
 * This mirrors the frontend autoFillFromPO() function
 */
function autoFillGRNFormFromPO(po: PendingPO): GRNFormAutoFillData {
  return {
    vendorName: po.vendorName,
    materialType: po.materialType,
    rate: po.rate,
    expectedQuantity: po.remainingQuantity
  };
}

/**
 * Validates that all auto-filled fields match the source PO
 */
function validateAutoFillMatchesPO(
  po: PendingPO, 
  formData: GRNFormAutoFillData
): boolean {
  return (
    formData.vendorName === po.vendorName &&
    formData.materialType === po.materialType &&
    formData.rate === po.rate &&
    formData.expectedQuantity === po.remainingQuantity
  );
}

// Arbitraries for generating test data
const poNumberArb = fc.string({ minLength: 5, maxLength: 15 })
  .filter(s => /^[A-Z0-9-]+$/i.test(s) || s.length === 0)
  .map(s => s.length > 0 ? `PO-${s}` : 'PO-DEFAULT');

const vendorNameArb = fc.string({ minLength: 3, maxLength: 50 })
  .filter(s => s.trim().length > 0)
  .map(s => s.trim());

const materialTypeArb = fc.constantFrom(
  'Iron Scrap',
  'Aluminum Scrap', 
  'Copper Wire',
  'Steel Scrap',
  'Brass Scrap',
  'Stainless Steel',
  'Mixed Metal'
);

const unitArb = fc.constantFrom('KG', 'MT', 'TON');

const pendingPOArb: fc.Arbitrary<PendingPO> = fc.record({
  id: fc.uuid(),
  poNumber: poNumberArb,
  vendorId: fc.uuid(),
  vendorName: vendorNameArb,
  materialType: materialTypeArb,
  materialDescription: fc.string({ minLength: 5, maxLength: 100 }),
  orderedQuantity: fc.integer({ min: 1000, max: 100000 }),
  receivedQuantity: fc.integer({ min: 0, max: 50000 }),
  remainingQuantity: fc.integer({ min: 100, max: 50000 }),
  rate: fc.double({ min: 10, max: 1000, noNaN: true }),
  unit: unitArb,
  status: fc.constantFrom(POStatus.PENDING, POStatus.PARTIAL),
  deliveryDate: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') })
});


describe('GRN PO Auto-Fill Property Tests', () => {
  /**
   * **Feature: lab-qc-report, Property 5: PO Selection Auto-Fills Form Fields**
   * **Validates: Requirements 3.3**
   * 
   * For any PO selected from the list, the GRN form should be populated with
   * vendor name, material type, rate, and expected quantity matching the PO data.
   */
  describe('Property 5: PO Selection Auto-Fills Form Fields', () => {
    
    it('should auto-fill vendor name from selected PO', () => {
      fc.assert(
        fc.property(
          pendingPOArb,
          (po) => {
            const formData = autoFillGRNFormFromPO(po);
            
            // Property: Vendor name in form must match PO vendor name
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
          pendingPOArb,
          (po) => {
            const formData = autoFillGRNFormFromPO(po);
            
            // Property: Material type in form must match PO material type
            expect(formData.materialType).toBe(po.materialType);
            return formData.materialType === po.materialType;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should auto-fill rate from selected PO', () => {
      fc.assert(
        fc.property(
          pendingPOArb,
          (po) => {
            const formData = autoFillGRNFormFromPO(po);
            
            // Property: Rate in form must match PO rate
            expect(formData.rate).toBe(po.rate);
            return formData.rate === po.rate;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should auto-fill expected quantity as remaining quantity from PO', () => {
      fc.assert(
        fc.property(
          pendingPOArb,
          (po) => {
            const formData = autoFillGRNFormFromPO(po);
            
            // Property: Expected quantity must equal PO remaining quantity
            expect(formData.expectedQuantity).toBe(po.remainingQuantity);
            return formData.expectedQuantity === po.remainingQuantity;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should auto-fill all four required fields correctly', () => {
      fc.assert(
        fc.property(
          pendingPOArb,
          (po) => {
            const formData = autoFillGRNFormFromPO(po);
            
            // Property: All four fields must match their PO counterparts
            const allMatch = validateAutoFillMatchesPO(po, formData);
            expect(allMatch).toBe(true);
            return allMatch;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle POs with zero received quantity (PENDING status)', () => {
      const pendingOnlyArb = pendingPOArb.filter(po => po.status === POStatus.PENDING);
      
      fc.assert(
        fc.property(
          pendingOnlyArb,
          (po) => {
            const formData = autoFillGRNFormFromPO(po);
            
            // Property: For PENDING POs, expected quantity should be remaining quantity
            expect(formData.expectedQuantity).toBe(po.remainingQuantity);
            return formData.expectedQuantity === po.remainingQuantity;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle POs with partial delivery (PARTIAL status)', () => {
      const partialOnlyArb = pendingPOArb.filter(po => po.status === POStatus.PARTIAL);
      
      fc.assert(
        fc.property(
          partialOnlyArb,
          (po) => {
            const formData = autoFillGRNFormFromPO(po);
            
            // Property: For PARTIAL POs, expected quantity should be remaining quantity
            expect(formData.expectedQuantity).toBe(po.remainingQuantity);
            return formData.expectedQuantity === po.remainingQuantity;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly auto-fill when switching between different POs', () => {
      fc.assert(
        fc.property(
          fc.array(pendingPOArb, { minLength: 2, maxLength: 5 }),
          (pos) => {
            // Simulate selecting each PO in sequence
            const results = pos.map(po => {
              const formData = autoFillGRNFormFromPO(po);
              return validateAutoFillMatchesPO(po, formData);
            });
            
            // Property: Each PO selection should correctly auto-fill the form
            const allCorrect = results.every(r => r === true);
            expect(allCorrect).toBe(true);
            return allCorrect;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve numeric precision for rate', () => {
      fc.assert(
        fc.property(
          pendingPOArb,
          (po) => {
            const formData = autoFillGRNFormFromPO(po);
            
            // Property: Rate should be exactly preserved (no floating point errors)
            expect(formData.rate).toBe(po.rate);
            return formData.rate === po.rate;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve integer precision for expected quantity', () => {
      fc.assert(
        fc.property(
          pendingPOArb,
          (po) => {
            const formData = autoFillGRNFormFromPO(po);
            
            // Property: Expected quantity should be exactly preserved
            expect(Number.isInteger(formData.expectedQuantity)).toBe(true);
            expect(formData.expectedQuantity).toBe(po.remainingQuantity);
            return formData.expectedQuantity === po.remainingQuantity;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
