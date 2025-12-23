import {
  Controller,
  Post,
  Get,
  Put,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../auth/guards/role.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { DocumentProcessingService, DocumentConfirmationDto } from './document-processing.service';

@Controller('documents')
@UseGuards(JwtAuthGuard, RoleGuard)
export class DocumentController {
  constructor(private documentProcessingService: DocumentProcessingService) {}

  @Post('upload')
  @Roles(UserRole.INSPECTOR, UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.OWNER)
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: {
      transactionId: string;
      operationalLevel: string;
      documentType: 'PO' | 'INVOICE' | 'CHALLAN' | 'OTHER';
      extractFields?: string;
    },
    @Request() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Validate file type
    const allowedMimeTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/jpg',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only PDF, JPEG, and PNG files are allowed.',
      );
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size too large. Maximum 10MB allowed.');
    }

    const result = await this.documentProcessingService.processDocument(
      {
        transactionId: body.transactionId,
        operationalLevel: parseInt(body.operationalLevel),
        file: file.buffer,
        fileName: file.originalname,
        mimeType: file.mimetype,
        documentType: body.documentType,
        extractFields: body.extractFields === 'true',
      },
      req.user.id,
      req.user.tenantId,
    );

    return {
      success: true,
      message: 'Document processed successfully. Manual confirmation required.',
      data: result,
    };
  }

  @Put(':documentId/confirm')
  @Roles(UserRole.INSPECTOR, UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.OWNER)
  async confirmDocumentData(
    @Param('documentId') documentId: string,
    @Body() confirmationDto: Omit<DocumentConfirmationDto, 'documentId' | 'confirmedBy'>,
    @Request() req: any,
  ) {
    const result = await this.documentProcessingService.confirmDocumentData(
      {
        documentId,
        confirmedData: confirmationDto.confirmedData,
        confirmedBy: req.user.id,
      },
      req.user.tenantId,
    );

    return {
      success: true,
      message: 'Document data confirmed successfully',
      data: result,
    };
  }

  @Get('transaction/:transactionId')
  @Roles(UserRole.SECURITY, UserRole.INSPECTOR, UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.OWNER)
  async getDocumentsByTransaction(
    @Param('transactionId') transactionId: string,
    @Request() req: any,
  ) {
    const documents = await this.documentProcessingService.getDocumentsByTransaction(
      transactionId,
      req.user.tenantId,
    );

    return {
      success: true,
      data: documents,
    };
  }

  @Get('unconfirmed')
  @Roles(UserRole.INSPECTOR, UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.OWNER)
  async getUnconfirmedDocuments(@Request() req: any) {
    const documents = await this.documentProcessingService.getUnconfirmedDocuments(
      req.user.tenantId,
    );

    return {
      success: true,
      data: documents,
      count: documents.length,
    };
  }

  @Put(':documentId/link/:transactionId')
  @Roles(UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.OWNER)
  async linkDocumentToTransaction(
    @Param('documentId') documentId: string,
    @Param('transactionId') transactionId: string,
    @Request() req: any,
  ) {
    await this.documentProcessingService.linkDocumentToTransaction(
      documentId,
      transactionId,
      req.user.tenantId,
    );

    return {
      success: true,
      message: 'Document linked to transaction successfully',
    };
  }
}