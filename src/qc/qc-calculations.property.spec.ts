import * as fc from 'fast-check';

/**
 * QC Calculation Functions
 * These are the pure calculation functions that will be tested
 */

export function calculateNetWeight(grossWeight: number, bardana: number, rejection: number): number {
  return grossWeight - bardana - rejection;
}

export function calculateFinalQuantity(netWeight: number, expPercent: number, qualityDeductPercent: number): number {
  return netWeight * (expPercent / 100) * (1 - qualityDeductPercent / 100);
}

export function calculateAmount(finalQuantity: number, rate: number): number {
  return finalQuantity * rate;
}

export function calculateDeliveryDifference(finalQuantity: number, rate: number, deliveryRate: number): number {
  return (deliveryRate - rate) * finalQuantity;
}

export interface QCLineItem {
  grossWeight: number;
  bardana: number;
  rejection: number;
  expPercent: number;
  qualityDeductPercent: number;
  rate: number;
  deliveryRate: number;
}

export function calculateLineItemTotals(lineItems: QCLineItem[]): {
  grossWeight: number;
  bardana: number;
  rejection: number;
  netWeight: number;
  finalQuantity: number;
  amount: number;
  deliveryDifference: number;
} {
  return lineItems.reduce(
    (totals, item) => {
      const netWeight = calculateNetWeight(item.grossWeight, item.bardana, item.rejection);
      const finalQuantity = calculateFinalQuantity(netWeight, item.expPercent, item.qualityDeductPercent);
      const amount = calculateAmount(finalQuantity, item.rate);
      const deliveryDiff = calculateDeliveryDifference(finalQuantity, item.rate, item.deliveryRate);

      return {
        grossWeight: totals.grossWeight + item.grossWeight,
        bardana: totals.bardana + item.bardana,
        rejection: totals.rejection + item.rejection,
        netWeight: totals.netWeight + netWeight,
        finalQuantity: totals.finalQuantity + finalQuantity,
        amount: totals.amount + amount,
        deliveryDifference: totals.deliveryDifference + deliveryDiff,
      };
    },
    {
      grossWeight: 0,
      bardana: 0,
      rejection: 0,
      netWeight: 0,
      finalQuantity: 0,
      amount: 0,
      deliveryDifference: 0,
    },
  );
}

describe('QC Calculations Property Tests', () => {
  /**
   * **Feature: lab-qc-report, Property 9: QC Net Weight Calculation**
   * *For any* QC line item with gross weight G, bardana B, and rejection R,
   * the net weight should equal (G - B - R).
   * **Validates: Requirements 6.3**
   */
  describe('Property 9: QC Net Weight Calculation', () => {
    it('should calculate net weight as gross - bardana - rejection for any valid inputs', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 100000, noNaN: true }),
          fc.float({ min: 0, max: 50000, noNaN: true }),
          fc.float({ min: 0, max: 50000, noNaN: true }),
          (grossWeight, bardana, rejection) => {
            // Ensure bardana + rejection doesn't exceed gross weight for realistic scenarios
            const adjustedBardana = Math.min(bardana, grossWeight * 0.4);
            const adjustedRejection = Math.min(rejection, grossWeight * 0.4);

            const netWeight = calculateNetWeight(grossWeight, adjustedBardana, adjustedRejection);
            const expected = grossWeight - adjustedBardana - adjustedRejection;

            // Use approximate equality for floating point
            expect(Math.abs(netWeight - expected)).toBeLessThan(0.0001);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return gross weight when bardana and rejection are zero', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 100000, noNaN: true }),
          (grossWeight) => {
            const netWeight = calculateNetWeight(grossWeight, 0, 0);
            expect(Math.abs(netWeight - grossWeight)).toBeLessThan(0.0001);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return zero when bardana + rejection equals gross weight', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 1, max: 100000, noNaN: true }),
          fc.float({ min: 0, max: 1, noNaN: true }),
          (grossWeight, ratio) => {
            const bardana = grossWeight * ratio;
            const rejection = grossWeight * (1 - ratio);
            const netWeight = calculateNetWeight(grossWeight, bardana, rejection);
            expect(Math.abs(netWeight)).toBeLessThan(0.0001);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Feature: lab-qc-report, Property 10: QC Final Quantity Calculation**
   * *For any* QC line item with net weight N, expected percentage E, and quality deduction percentage Q,
   * the final quantity should equal N × (E/100) × (1 - Q/100).
   * **Validates: Requirements 6.4**
   */
  describe('Property 10: QC Final Quantity Calculation', () => {
    it('should calculate final quantity correctly for any valid inputs', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 100000, noNaN: true }),
          fc.float({ min: 0, max: 100, noNaN: true }),
          fc.float({ min: 0, max: 100, noNaN: true }),
          (netWeight, expPercent, qualityDeductPercent) => {
            const finalQuantity = calculateFinalQuantity(netWeight, expPercent, qualityDeductPercent);
            const expected = netWeight * (expPercent / 100) * (1 - qualityDeductPercent / 100);

            expect(Math.abs(finalQuantity - expected)).toBeLessThan(0.0001);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return net weight when exp% is 100 and quality deduction is 0', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 100000, noNaN: true }),
          (netWeight) => {
            const finalQuantity = calculateFinalQuantity(netWeight, 100, 0);
            expect(Math.abs(finalQuantity - netWeight)).toBeLessThan(0.0001);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return zero when quality deduction is 100%', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 100000, noNaN: true }),
          fc.float({ min: 0, max: 100, noNaN: true }),
          (netWeight, expPercent) => {
            const finalQuantity = calculateFinalQuantity(netWeight, expPercent, 100);
            expect(Math.abs(finalQuantity)).toBeLessThan(0.0001);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return zero when exp% is 0', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 100000, noNaN: true }),
          fc.float({ min: 0, max: 100, noNaN: true }),
          (netWeight, qualityDeductPercent) => {
            const finalQuantity = calculateFinalQuantity(netWeight, 0, qualityDeductPercent);
            expect(Math.abs(finalQuantity)).toBeLessThan(0.0001);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Feature: lab-qc-report, Property 11: QC Amount Calculation**
   * *For any* QC line item with final quantity F and rate R, the amount should equal F × R.
   * **Validates: Requirements 6.5**
   */
  describe('Property 11: QC Amount Calculation', () => {
    it('should calculate amount as final quantity times rate', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 100000, noNaN: true }),
          fc.float({ min: 0, max: 10000, noNaN: true }),
          (finalQuantity, rate) => {
            const amount = calculateAmount(finalQuantity, rate);
            const expected = finalQuantity * rate;

            expect(Math.abs(amount - expected)).toBeLessThan(0.01);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return zero when final quantity is zero', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 10000, noNaN: true }),
          (rate) => {
            const amount = calculateAmount(0, rate);
            expect(amount).toBe(0);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return zero when rate is zero', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 100000, noNaN: true }),
          (finalQuantity) => {
            const amount = calculateAmount(finalQuantity, 0);
            expect(amount).toBe(0);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
