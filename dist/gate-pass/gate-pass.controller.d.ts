import { GatePassService, GatePassData, GatePassValidationResult } from './gate-pass.service';
export interface GenerateGatePassDto {
    transactionId: string;
    validityHours?: number;
}
export interface ValidateGatePassDto {
    qrCodeData: string;
}
export interface ProcessExitDto {
    transactionId: string;
    supervisorOverride?: boolean;
}
export interface SupervisorOverrideDto {
    transactionId: string;
    justification: string;
}
export declare class GatePassController {
    private readonly gatePassService;
    constructor(gatePassService: GatePassService);
    generateGatePass(generateDto: GenerateGatePassDto, req: any): Promise<GatePassData>;
    validateGatePass(validateDto: ValidateGatePassDto): Promise<GatePassValidationResult>;
    processVehicleExit(processDto: ProcessExitDto, req: any): Promise<{
        success: boolean;
        message: string;
    }>;
    supervisorOverride(overrideDto: SupervisorOverrideDto, req: any): Promise<{
        success: boolean;
        message: string;
    }>;
    getGatePassByTransaction(transactionId: string): Promise<{
        qrCode: string;
        expiresAt: Date;
    } | null>;
}
