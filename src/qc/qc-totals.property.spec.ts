import * as fc from 'fast-check';
import {
  calculateNetWeight,
  calculateFinalQuantity,
  calculateAmount,
  calculateLineItemTotals,
  QCLineItem,
} from './qc-calculations.property.spec';

/**
 * Arbitrary generator for valid QC line items
 */
const qcLineItemArbitrary = fc.record({
  grossWeight: fc.float({ min: 100, max: 10000, noNaN: true }),
  bardana: fc.float({ min: 0, max: 500, noNaN: true }),
  rejection: fc.float({ min: 0, max: 500, noNaN: true }),
  expPercent: fc.float({ min: 50, max: 100, noNaN: true }),
  qualityDeductPercent: fc.float({ min: 0, max: 30, noNaN: true }),
  rate: fc.float({ min: 10, max: 1000, noNaN: true }),
  deliveryRate: fc.float({ min: 10, max: 1000, noNaN: true }),
});

describe('QC Totals Property Tests', () => {
  /**
   * **Feature: lab-qc-report, Property 12: QC Totals Sum Correctly**
   * *For any* QC report with multiple line items, the totals should equal
   * the sum of corresponding values across all line items.
   * **Validates: Requirements 7.1**
   */
  describe('Property 12: QC Totals Sum Correctly', () => {
    it('should calculate totals as sum of all line item values', () => {
      fc.assert(
        fc.property(
          fc.array(qcLineItemArbitrary, { minLength: 1, maxLength: 10 }),
          (lineItems) => {
            const totals = calculateLineItemTotals(lineItems);

            // Calculate expected totals manually
            let expectedGrossWeight = 0;
            let expectedBardana = 0;
            let expectedRejection = 0;
            let expectedNetWeight = 0;
            let expectedFinalQuantity = 0;
            let expectedAmount = 0;
            let expectedDeliveryDiff = 0;

            for (const item of lineItems) {
              const netWeight = calculateNetWeight(item.grossWeight, item.bardana, item.rejection);
              const finalQuantity = calculateFinalQuantity(netWeight, item.expPercent, item.qualityDeductPercent);
              const amount = calculateAmount(finalQuantity, item.rate);
              const deliveryDiff = (item.deliveryRate - item.rate) * finalQuantity;

              expectedGrossWeight += item.grossWeight;
              expectedBardana += item.bardana;
              expectedRejection += item.rejection;
              expectedNetWeight += netWeight;
              expectedFinalQuantity += finalQuantity;
              expectedAmount += amount;
              expectedDeliveryDiff += deliveryDiff;
            }

            // Verify totals match (with floating point tolerance)
            expect(Math.abs(totals.grossWeight - expectedGrossWeight)).toBeLessThan(0.01);
            expect(Math.abs(totals.bardana - expectedBardana)).toBeLessThan(0.01);
            expect(Math.abs(totals.rejection - expectedRejection)).toBeLessThan(0.01);
            expect(Math.abs(totals.netWeight - expectedNetWeight)).toBeLessThan(0.01);
            expect(Math.abs(totals.finalQuantity - expectedFinalQuantity)).toBeLessThan(0.01);
            expect(Math.abs(totals.amount - expectedAmount)).toBeLessThan(0.01);
            expect(Math.abs(totals.deliveryDifference - expectedDeliveryDiff)).toBeLessThan(0.01);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return zeros for empty line items array', () => {
      const totals = calculateLineItemTotals([]);

      expect(totals.grossWeight).toBe(0);
      expect(totals.bardana).toBe(0);
      expect(totals.rejection).toBe(0);
      expect(totals.netWeight).toBe(0);
      expect(totals.finalQuantity).toBe(0);
      expect(totals.amount).toBe(0);
      expect(totals.deliveryDifference).toBe(0);
    });

    it('should handle single line item correctly', () => {
      fc.assert(
        fc.property(qcLineItemArbitrary, (item) => {
          const totals = calculateLineItemTotals([item]);

          const netWeight = calculateNetWeight(item.grossWeight, item.bardana, item.rejection);
          const finalQuantity = calculateFinalQuantity(netWeight, item.expPercent, item.qualityDeductPercent);
          const amount = calculateAmount(finalQuantity, item.rate);
          const deliveryDiff = (item.deliveryRate - item.rate) * finalQuantity;

          expect(Math.abs(totals.grossWeight - item.grossWeight)).toBeLessThan(0.01);
          expect(Math.abs(totals.bardana - item.bardana)).toBeLessThan(0.01);
          expect(Math.abs(totals.rejection - item.rejection)).toBeLessThan(0.01);
          expect(Math.abs(totals.netWeight - netWeight)).toBeLessThan(0.01);
          expect(Math.abs(totals.finalQuantity - finalQuantity)).toBeLessThan(0.01);
          expect(Math.abs(totals.amount - amount)).toBeLessThan(0.01);
          expect(Math.abs(totals.deliveryDifference - deliveryDiff)).toBeLessThan(0.01);
        }),
        { numRuns: 100 },
      );
    });

    it('totals should be additive (combining two sets equals sum of individual totals)', () => {
      fc.assert(
        fc.property(
          fc.array(qcLineItemArbitrary, { minLength: 1, maxLength: 5 }),
          fc.array(qcLineItemArbitrary, { minLength: 1, maxLength: 5 }),
          (items1, items2) => {
            const totals1 = calculateLineItemTotals(items1);
            const totals2 = calculateLineItemTotals(items2);
            const combinedTotals = calculateLineItemTotals([...items1, ...items2]);

            expect(Math.abs(combinedTotals.grossWeight - (totals1.grossWeight + totals2.grossWeight))).toBeLessThan(0.01);
            expect(Math.abs(combinedTotals.bardana - (totals1.bardana + totals2.bardana))).toBeLessThan(0.01);
            expect(Math.abs(combinedTotals.rejection - (totals1.rejection + totals2.rejection))).toBeLessThan(0.01);
            expect(Math.abs(combinedTotals.netWeight - (totals1.netWeight + totals2.netWeight))).toBeLessThan(0.01);
            expect(Math.abs(combinedTotals.finalQuantity - (totals1.finalQuantity + totals2.finalQuantity))).toBeLessThan(0.01);
            expect(Math.abs(combinedTotals.amount - (totals1.amount + totals2.amount))).toBeLessThan(0.01);
            expect(Math.abs(combinedTotals.deliveryDifference - (totals1.deliveryDifference + totals2.deliveryDifference))).toBeLessThan(0.01);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
