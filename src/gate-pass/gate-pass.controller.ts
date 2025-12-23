import { Controller, Post, Get, Body, Param, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { GatePassService, GatePassData, GatePassValidationResult } from './gate-pass.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../auth/guards/role.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';

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

@Controller('gate-pass')
@UseGuards(JwtAuthGuard, RoleGuard)
export class GatePassController {
  constructor(private readonly gatePassService: GatePassService) {}

  @Post('generate')
  @Roles(UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.OWNER)
  async generateGatePass(
    @Body() generateDto: GenerateGatePassDto,
    @Request() req: any
  ): Promise<GatePassData> {
    const { transactionId, validityHours = 24 } = generateDto;
    
    if (validityHours < 1 || validityHours > 72) {
      throw new BadRequestException('Validity hours must be between 1 and 72');
    }

    return await this.gatePassService.generateGatePass(
      transactionId,
      req.user.id,
      validityHours
    );
  }

  @Post('validate')
  @Roles(UserRole.SECURITY, UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.OWNER)
  async validateGatePass(
    @Body() validateDto: ValidateGatePassDto
  ): Promise<GatePassValidationResult> {
    return await this.gatePassService.validateGatePass(validateDto.qrCodeData);
  }

  @Post('process-exit')
  @Roles(UserRole.SECURITY, UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.OWNER)
  async processVehicleExit(
    @Body() processDto: ProcessExitDto,
    @Request() req: any
  ): Promise<{ success: boolean; message: string }> {
    await this.gatePassService.processVehicleExit(
      processDto.transactionId,
      req.user.id,
      processDto.supervisorOverride || false
    );

    return {
      success: true,
      message: 'Vehicle exit processed successfully'
    };
  }

  @Post('supervisor-override')
  @Roles(UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.OWNER)
  async supervisorOverride(
    @Body() overrideDto: SupervisorOverrideDto,
    @Request() req: any
  ): Promise<{ success: boolean; message: string }> {
    if (!overrideDto.justification || overrideDto.justification.trim().length < 10) {
      throw new BadRequestException('Justification must be at least 10 characters long');
    }

    await this.gatePassService.supervisorOverrideExpiredGatePass(
      overrideDto.transactionId,
      req.user.id,
      overrideDto.justification
    );

    return {
      success: true,
      message: 'Supervisor override processed successfully'
    };
  }

  @Get('transaction/:transactionId')
  @Roles(UserRole.SECURITY, UserRole.INSPECTOR, UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.OWNER)
  async getGatePassByTransaction(
    @Param('transactionId') transactionId: string
  ): Promise<{ qrCode: string; expiresAt: Date } | null> {
    // This would be implemented to retrieve gate pass data for a transaction
    // For now, returning a placeholder
    return null;
  }
}