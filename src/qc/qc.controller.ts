import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { QCService, CreateQCReportDto, UpdateQCReportDto } from './qc.service';
import { QCReportStatus } from '../entities/qc-report.entity';

@Controller('qc')
export class QCController {
  constructor(private readonly qcService: QCService) {}

  /**
   * Create a new QC Report
   * POST /qc/reports
   */
  @Post('reports')
  @HttpCode(HttpStatus.CREATED)
  async createQCReport(@Body() dto: CreateQCReportDto) {
    return this.qcService.createQCReport(dto);
  }

  /**
   * Get QC Report by ID
   * GET /qc/reports/:id
   */
  @Get('reports/:id')
  async getQCReportById(@Param('id') id: string) {
    return this.qcService.getQCReportById(id);
  }

  /**
   * Get QC Report by Transaction ID
   * GET /qc/reports/transaction/:transactionId
   */
  @Get('reports/transaction/:transactionId')
  async getQCReportByTransaction(@Param('transactionId') transactionId: string) {
    return this.qcService.getQCReportByTransaction(transactionId);
  }

  /**
   * Get all QC Reports for a tenant
   * GET /qc/reports?tenantId=xxx&status=DRAFT|APPROVED
   */
  @Get('reports')
  async getQCReports(
    @Query('tenantId') tenantId: string,
    @Query('status') status?: QCReportStatus,
  ) {
    return this.qcService.getQCReportsByTenant(tenantId, status);
  }

  /**
   * Update QC Report
   * PUT /qc/reports/:id
   */
  @Put('reports/:id')
  async updateQCReport(@Param('id') id: string, @Body() dto: UpdateQCReportDto) {
    return this.qcService.updateQCReport(id, dto);
  }

  /**
   * Approve QC Report
   * POST /qc/reports/:id/approve
   */
  @Post('reports/:id/approve')
  @HttpCode(HttpStatus.OK)
  async approveQCReport(
    @Param('id') id: string,
    @Body('approverUserId') approverUserId: string,
  ) {
    return this.qcService.approveQCReport(id, approverUserId);
  }

  /**
   * Generate Debit Note for QC Report
   * POST /qc/reports/:id/debit-note
   */
  @Post('reports/:id/debit-note')
  @HttpCode(HttpStatus.CREATED)
  async generateDebitNote(@Param('id') id: string) {
    return this.qcService.generateDebitNote(id);
  }

  /**
   * Get Debit Note by ID
   * GET /qc/debit-notes/:id
   */
  @Get('debit-notes/:id')
  async getDebitNoteById(@Param('id') id: string) {
    return this.qcService.getDebitNoteById(id);
  }

  /**
   * Send QC Report to Vendor
   * POST /qc/reports/:id/send
   */
  @Post('reports/:id/send')
  @HttpCode(HttpStatus.OK)
  async sendQCReportToVendor(
    @Param('id') id: string,
    @Body('sendMethod') sendMethod: 'EMAIL' | 'WHATSAPP' | 'BOTH',
    @Body('userId') userId?: string,
  ) {
    return this.qcService.sendQCReportToVendor(id, sendMethod, userId);
  }
}
