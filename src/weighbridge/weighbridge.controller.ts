import { 
  Controller, 
  Post, 
  Body, 
  Param, 
  UseInterceptors, 
  UploadedFile, 
  BadRequestException,
  UseGuards
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { WeighbridgeService, WeighbridgeReading, WeightCalculationResult } from './weighbridge.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../auth/guards/role.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';

export class CaptureWeightDto {
  weight: number;
  operatorId: string;
  equipmentId?: string;
  ticketNumber?: string;
}

@Controller('weighbridge')
@UseGuards(JwtAuthGuard, RoleGuard)
export class WeighbridgeController {
  constructor(private readonly weighbridgeService: WeighbridgeService) {}

  @Post(':transactionId/gross-weight')
  @Roles(UserRole.SECURITY, UserRole.INSPECTOR, UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.OWNER)
  @UseInterceptors(FileInterceptor('photo'))
  async captureGrossWeight(
    @Param('transactionId') transactionId: string,
    @Body() captureWeightDto: CaptureWeightDto,
    @UploadedFile() photo?: Express.Multer.File
  ) {
    const reading: WeighbridgeReading = {
      weight: captureWeightDto.weight,
      timestamp: new Date(),
      operatorId: captureWeightDto.operatorId,
      equipmentId: captureWeightDto.equipmentId,
      ticketNumber: captureWeightDto.ticketNumber
    };

    // Validate manual entry if no equipment integration
    if (!captureWeightDto.equipmentId && !photo) {
      throw new BadRequestException('Photo evidence is required for manual weight entry');
    }

    return await this.weighbridgeService.captureGrossWeight(transactionId, reading, photo);
  }

  @Post(':transactionId/tare-weight')
  @Roles(UserRole.SECURITY, UserRole.INSPECTOR, UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.OWNER)
  @UseInterceptors(FileInterceptor('photo'))
  async captureTareWeight(
    @Param('transactionId') transactionId: string,
    @Body() captureWeightDto: CaptureWeightDto,
    @UploadedFile() photo?: Express.Multer.File
  ): Promise<WeightCalculationResult> {
    const reading: WeighbridgeReading = {
      weight: captureWeightDto.weight,
      timestamp: new Date(),
      operatorId: captureWeightDto.operatorId,
      equipmentId: captureWeightDto.equipmentId,
      ticketNumber: captureWeightDto.ticketNumber
    };

    // Validate manual entry if no equipment integration
    if (!captureWeightDto.equipmentId && !photo) {
      throw new BadRequestException('Photo evidence is required for manual weight entry');
    }

    return await this.weighbridgeService.captureTareWeight(transactionId, reading, photo);
  }
}