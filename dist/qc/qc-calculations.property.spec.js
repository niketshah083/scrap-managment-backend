"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateNetWeight = calculateNetWeight;
exports.calculateFinalQuantity = calculateFinalQuantity;
exports.calculateAmount = calculateAmount;
exports.calculateDeliveryDifference = calculateDeliveryDifference;
exports.calculateLineItemTotals = calculateLineItemTotals;
const fc = require("fast-check");
function calculateNetWeight(grossWeight, bardana, rejection) {
    return grossWeight - bardana - rejection;
}
function calculateFinalQuantity(netWeight, expPercent, qualityDeductPercent) {
    return netWeight * (expPercent / 100) * (1 - qualityDeductPercent / 100);
}
function calculateAmount(finalQuantity, rate) {
    return finalQuantity * rate;
}
function calculateDeliveryDifference(finalQuantity, rate, deliveryRate) {
    return (deliveryRate - rate) * finalQuantity;
}
function calculateLineItemTotals(lineItems) {
    return lineItems.reduce((totals, item) => {
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
    }, {
        grossWeight: 0,
        bardana: 0,
        rejection: 0,
        netWeight: 0,
        finalQuantity: 0,
        amount: 0,
        deliveryDifference: 0,
    });
}
describe('QC Calculations Property Tests', () => {
    describe('Property 9: QC Net Weight Calculation', () => {
        it('should calculate net weight as gross - bardana - rejection for any valid inputs', () => {
            fc.assert(fc.property(fc.float({ min: 0, max: 100000, noNaN: true }), fc.float({ min: 0, max: 50000, noNaN: true }), fc.float({ min: 0, max: 50000, noNaN: true }), (grossWeight, bardana, rejection) => {
                const adjustedBardana = Math.min(bardana, grossWeight * 0.4);
                const adjustedRejection = Math.min(rejection, grossWeight * 0.4);
                const netWeight = calculateNetWeight(grossWeight, adjustedBardana, adjustedRejection);
                const expected = grossWeight - adjustedBardana - adjustedRejection;
                expect(Math.abs(netWeight - expected)).toBeLessThan(0.0001);
            }), { numRuns: 100 });
        });
        it('should return gross weight when bardana and rejection are zero', () => {
            fc.assert(fc.property(fc.float({ min: 0, max: 100000, noNaN: true }), (grossWeight) => {
                const netWeight = calculateNetWeight(grossWeight, 0, 0);
                expect(Math.abs(netWeight - grossWeight)).toBeLessThan(0.0001);
            }), { numRuns: 100 });
        });
        it('should return zero when bardana + rejection equals gross weight', () => {
            fc.assert(fc.property(fc.float({ min: 1, max: 100000, noNaN: true }), fc.float({ min: 0, max: 1, noNaN: true }), (grossWeight, ratio) => {
                const bardana = grossWeight * ratio;
                const rejection = grossWeight * (1 - ratio);
                const netWeight = calculateNetWeight(grossWeight, bardana, rejection);
                expect(Math.abs(netWeight)).toBeLessThan(0.0001);
            }), { numRuns: 100 });
        });
    });
    describe('Property 10: QC Final Quantity Calculation', () => {
        it('should calculate final quantity correctly for any valid inputs', () => {
            fc.assert(fc.property(fc.float({ min: 0, max: 100000, noNaN: true }), fc.float({ min: 0, max: 100, noNaN: true }), fc.float({ min: 0, max: 100, noNaN: true }), (netWeight, expPercent, qualityDeductPercent) => {
                const finalQuantity = calculateFinalQuantity(netWeight, expPercent, qualityDeductPercent);
                const expected = netWeight * (expPercent / 100) * (1 - qualityDeductPercent / 100);
                expect(Math.abs(finalQuantity - expected)).toBeLessThan(0.0001);
            }), { numRuns: 100 });
        });
        it('should return net weight when exp% is 100 and quality deduction is 0', () => {
            fc.assert(fc.property(fc.float({ min: 0, max: 100000, noNaN: true }), (netWeight) => {
                const finalQuantity = calculateFinalQuantity(netWeight, 100, 0);
                expect(Math.abs(finalQuantity - netWeight)).toBeLessThan(0.0001);
            }), { numRuns: 100 });
        });
        it('should return zero when quality deduction is 100%', () => {
            fc.assert(fc.property(fc.float({ min: 0, max: 100000, noNaN: true }), fc.float({ min: 0, max: 100, noNaN: true }), (netWeight, expPercent) => {
                const finalQuantity = calculateFinalQuantity(netWeight, expPercent, 100);
                expect(Math.abs(finalQuantity)).toBeLessThan(0.0001);
            }), { numRuns: 100 });
        });
        it('should return zero when exp% is 0', () => {
            fc.assert(fc.property(fc.float({ min: 0, max: 100000, noNaN: true }), fc.float({ min: 0, max: 100, noNaN: true }), (netWeight, qualityDeductPercent) => {
                const finalQuantity = calculateFinalQuantity(netWeight, 0, qualityDeductPercent);
                expect(Math.abs(finalQuantity)).toBeLessThan(0.0001);
            }), { numRuns: 100 });
        });
    });
    describe('Property 11: QC Amount Calculation', () => {
        it('should calculate amount as final quantity times rate', () => {
            fc.assert(fc.property(fc.float({ min: 0, max: 100000, noNaN: true }), fc.float({ min: 0, max: 10000, noNaN: true }), (finalQuantity, rate) => {
                const amount = calculateAmount(finalQuantity, rate);
                const expected = finalQuantity * rate;
                expect(Math.abs(amount - expected)).toBeLessThan(0.01);
            }), { numRuns: 100 });
        });
        it('should return zero when final quantity is zero', () => {
            fc.assert(fc.property(fc.float({ min: 0, max: 10000, noNaN: true }), (rate) => {
                const amount = calculateAmount(0, rate);
                expect(amount).toBe(0);
            }), { numRuns: 100 });
        });
        it('should return zero when rate is zero', () => {
            fc.assert(fc.property(fc.float({ min: 0, max: 100000, noNaN: true }), (finalQuantity) => {
                const amount = calculateAmount(finalQuantity, 0);
                expect(amount).toBe(0);
            }), { numRuns: 100 });
        });
    });
});
//# sourceMappingURL=qc-calculations.property.spec.js.map