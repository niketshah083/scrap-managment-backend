import { 
  Controller, 
  Post, 
  Get, 
  Param, 
  Body, 
  UseGuards, 
  Request, 
  UseInterceptors, 
  UploadedFile,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EvidenceService, CreateEvidenceDto } from './evidence.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../auth/guards/role.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { EvidenceType } from '../entities/evidence.entity';

@Controller('evidence')
@UseGuards(JwtAuthGuard)
export class EvidenceController {
  constructor(private evidenceService: EvidenceService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @RequirePermissions({ level: 1, action: 'create' }) // Minimum level 1 to create evidence
  async createEvidence(
    @Body() createEvidenceDto: Omit<CreateEvidenceDto, 'file'>,
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ) {
    // Validate required fields
    if (!createEvidenceDto.transactionId) {
      throw new BadRequestException('Transaction ID is required');
    }

    if (!createEvidenceDto.operationalLevel || createEvidenceDto.operationalLevel < 1 || createEvidenceDto.operationalLevel > 7) {
      throw new BadRequestException('Valid operational level (1-7) is required');
    }

    if (!createEvidenceDto.evidenceType) {
      throw new BadRequestException('Evidence type is required');
    }

    // Parse metadata if it's a string
    let metadata = createEvidenceDto.metadata;
    if (typeof metadata === 'string') {
      try {
        metadata = JSON.parse(metadata);
      } catch (error) {
        throw new BadRequestException('Invalid metadata format');
      }
    }

    // Parse tags if it's a string
    let tags: string[] | undefined = createEvidenceDto.tags;
    if (typeof createEvidenceDto.tags === 'string') {
      try {
        tags = JSON.parse(createEvidenceDto.tags);
      } catch (error) {
        tags = [createEvidenceDto.tags]; // Treat as single tag if not valid JSON
      }
    }

    const evidenceData: CreateEvidenceDto = {
      ...createEvidenceDto,
      metadata,
      tags,
      file: file?.buffer,
      fileName: file?.originalname,
      mimeType: file?.mimetype,
    };

    const evidence = await this.evidenceService.createEvidence(
      evidenceData,
      req.user.sub,
      req.user.tenantId,
    );

    return evidence;
  }

  @Get('transaction/:transactionId')
  @RequirePermissions({ level: 1, action: 'view' })
  async getEvidenceByTransaction(
    @Param('transactionId') transactionId: string,
    @Request() req,
  ) {
    return await this.evidenceService.getEvidenceByTransaction(
      transactionId,
      req.user.tenantId,
    );
  }

  @Get('transaction/:transactionId/level/:level')
  @RequirePermissions({ level: 1, action: 'view' })
  async getEvidenceByLevel(
    @Param('transactionId') transactionId: string,
    @Param('level') level: string,
    @Request() req,
  ) {
    const operationalLevel = parseInt(level, 10);
    if (isNaN(operationalLevel) || operationalLevel < 1 || operationalLevel > 7) {
      throw new BadRequestException('Valid operational level (1-7) is required');
    }

    return await this.evidenceService.getEvidenceByLevel(
      transactionId,
      operationalLevel,
      req.user.tenantId,
    );
  }

  @Get('transaction/:transactionId/stats')
  @RequirePermissions({ level: 1, action: 'view' })
  async getEvidenceStats(
    @Param('transactionId') transactionId: string,
    @Request() req,
  ) {
    return await this.evidenceService.getEvidenceStats(
      transactionId,
      req.user.tenantId,
    );
  }

  @Get(':id')
  @RequirePermissions({ level: 1, action: 'view' })
  async getEvidenceById(
    @Param('id') id: string,
    @Request() req,
  ) {
    return await this.evidenceService.getEvidenceById(id, req.user.tenantId);
  }

  @Get(':id/verify')
  @RequirePermissions({ level: 1, action: 'view' })
  async verifyEvidenceIntegrity(@Param('id') id: string) {
    const isValid = await this.evidenceService.verifyEvidenceIntegrity(id);
    return { evidenceId: id, isValid };
  }

  @Get('transaction/:transactionId/chronological-integrity')
  @RequirePermissions({ level: 1, action: 'view' })
  async validateChronologicalIntegrity(
    @Param('transactionId') transactionId: string,
  ) {
    const isValid = await this.evidenceService.validateChronologicalIntegrity(transactionId);
    return { transactionId, chronologicalIntegrityValid: isValid };
  }

  @Post('validate-timestamp')
  @RequirePermissions({ level: 1, action: 'create' })
  async validateTimestamp(
    @Body() body: { 
      timestamp: string; 
      transactionId: string; 
      operationalLevel: number; 
    },
  ) {
    const proposedTimestamp = new Date(body.timestamp);
    const isValid = await this.evidenceService.preventBackdating(
      proposedTimestamp,
      body.transactionId,
      body.operationalLevel,
    );
    return { 
      timestamp: body.timestamp,
      isValid,
      serverTimestamp: new Date().toISOString(),
    };
  }

  @Post(':id/mark-processed')
  @RequirePermissions({ level: 4, action: 'update' }) // Require inspector level or higher
  async markAsProcessed(@Param('id') id: string) {
    await this.evidenceService.markAsProcessed(id);
    return { message: 'Evidence marked as processed' };
  }
}