import { WeighbridgeService, WeightCalculationResult } from './weighbridge.service';
export declare class CaptureWeightDto {
    weight: number;
    operatorId: string;
    equipmentId?: string;
    ticketNumber?: string;
}
export declare class WeighbridgeController {
    private readonly weighbridgeService;
    constructor(weighbridgeService: WeighbridgeService);
    captureGrossWeight(transactionId: string, captureWeightDto: CaptureWeightDto, photo?: Express.Multer.File): Promise<import("../entities").Transaction>;
    captureTareWeight(transactionId: string, captureWeightDto: CaptureWeightDto, photo?: Express.Multer.File): Promise<WeightCalculationResult>;
}
