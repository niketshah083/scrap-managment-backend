export declare function calculateNetWeight(grossWeight: number, bardana: number, rejection: number): number;
export declare function calculateFinalQuantity(netWeight: number, expPercent: number, qualityDeductPercent: number): number;
export declare function calculateAmount(finalQuantity: number, rate: number): number;
export declare function calculateDeliveryDifference(finalQuantity: number, rate: number, deliveryRate: number): number;
export interface QCLineItem {
    grossWeight: number;
    bardana: number;
    rejection: number;
    expPercent: number;
    qualityDeductPercent: number;
    rate: number;
    deliveryRate: number;
}
export declare function calculateLineItemTotals(lineItems: QCLineItem[]): {
    grossWeight: number;
    bardana: number;
    rejection: number;
    netWeight: number;
    finalQuantity: number;
    amount: number;
    deliveryDifference: number;
};
