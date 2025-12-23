import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../auth/guards/role.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { InspectionService, InspectionData } from './inspection.service';

export interface ConductInspectionDto {
  grade: 'A' | 'B' | 'C' | 'REJECTED';
  contaminationLevel: number;
  moistureLevel?: number;
  qualityNotes?: string;
  rejectionReason?: string;
  gpsCoordinates?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  deviceInfo?: {
    deviceId: string;
    deviceModel: string;
    osVersion: string;
    appVersion: string;
  };
}

@Controller('inspection')
@UseGuards(JwtAuthGuard, RoleGuard)
export class InspectionController {
  constructor(private readonly inspectionService: InspectionService) {}

  @Post(':transactionId/conduct')
  @Roles(UserRole.INSPECTOR, UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.OWNER)
  @UseInterceptors(FilesInterceptor('photos', 10)) // Max 10 photos
  async conductInspection(
    @Param('transactionId') transactionId: string,
    @Body() conductInspectionDto: ConductInspectionDto,
    @UploadedFiles() photos: Express.Multer.File[],
    @Request() req: any,
  ) {
    if (!photos || photos.length < 2) {
      throw new BadRequestException('At least 2 photos are required for inspection');
    }

    if (photos.length > 10) {
      throw new BadRequestException('Maximum 10 photos allowed');
    }

    // Validate that all uploaded files are images
    for (const photo of photos) {
      if (!photo.mimetype.startsWith('image/')) {
        throw new BadRequestException(`File ${photo.originalname} is not an image`);
      }
    }

    const inspectionData: InspectionData = {
      ...conductInspectionDto,
      inspectorId: req.user.userId,
      photos: photos.map((photo, index) => ({
        file: photo.buffer,
        fileName: photo.originalname || `inspection-photo-${index + 1}.jpg`,
        mimeType: photo.mimetype,
        description: `Inspection photo ${index + 1}`,
      })),
    };

    return await this.inspectionService.conductInspection(
      transactionId,
      inspectionData,
      req.user.tenantId,
    );
  }

  @Get(':transactionId/data')
  @Roles(UserRole.INSPECTOR, UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.OWNER, UserRole.SECURITY)
  async getInspectionData(
    @Param('transactionId') transactionId: string,
    @Request() req: any,
  ) {
    return await this.inspectionService.getInspectionData(
      transactionId,
      req.user.tenantId,
    );
  }

  @Get(':transactionId/evidence')
  @Roles(UserRole.INSPECTOR, UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.OWNER, UserRole.SECURITY)
  async getInspectionEvidence(
    @Param('transactionId') transactionId: string,
    @Request() req: any,
  ) {
    return await this.inspectionService.getInspectionEvidence(
      transactionId,
      req.user.tenantId,
    );
  }

  @Get(':transactionId/requirements')
  @Roles(UserRole.INSPECTOR, UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.OWNER, UserRole.SECURITY)
  async validateInspectionRequirements(
    @Param('transactionId') transactionId: string,
    @Request() req: any,
  ) {
    return await this.inspectionService.validateInspectionRequirements(
      transactionId,
      req.user.tenantId,
    );
  }

  @Get('configuration')
  @Roles(UserRole.INSPECTOR, UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.OWNER)
  async getInspectionConfiguration(@Request() req: any) {
    return await this.inspectionService.getInspectionConfiguration(
      req.user.tenantId,
    );
  }
}