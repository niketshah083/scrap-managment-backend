import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpStatus,
  HttpCode,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { 
  PurchaseOrderService, 
  CreatePODto, 
  UpdatePODto, 
  POSearchResult, 
  POValidationResult 
} from './purchase-order.service';

@ApiTags('Purchase Orders')
@Controller('po')
export class PurchaseOrderController {
  constructor(private readonly poService: PurchaseOrderService) {}

  @Get()
  @ApiOperation({ summary: 'Get all purchase orders for a tenant' })
  @ApiQuery({ name: 'tenantId', description: 'Tenant UUID', required: true })
  @ApiResponse({ status: 200, description: 'Returns all purchase orders' })
  async getAllPOs(
    @Query('tenantId') tenantId: string,
  ): Promise<POSearchResult[]> {
    return this.poService.getAllPOs(tenantId);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search purchase orders by query string' })
  @ApiQuery({ name: 'query', description: 'Search query (min 2 characters)', required: true })
  @ApiQuery({ name: 'tenantId', description: 'Tenant UUID', required: true })
  @ApiQuery({ name: 'limit', description: 'Max results to return', required: false })
  @ApiResponse({ status: 200, description: 'Returns matching purchase orders' })
  async searchPOs(
    @Query('query') query: string,
    @Query('tenantId') tenantId: string,
    @Query('limit') limit?: number,
  ): Promise<POSearchResult[]> {
    return this.poService.searchPOs(query, tenantId, limit || 10);
  }

  @Get('pending')
  @ApiOperation({ summary: 'Get all pending and partial purchase orders for a tenant' })
  @ApiQuery({ name: 'tenantId', description: 'Tenant UUID', required: true })
  @ApiResponse({ status: 200, description: 'Returns pending and partial purchase orders' })
  async getPendingPOs(
    @Query('tenantId') tenantId: string,
  ): Promise<POSearchResult[]> {
    return this.poService.getPendingAndPartialPOs(tenantId);
  }

  @Get('vendor/:vendorId')
  @ApiOperation({ summary: 'Get all purchase orders for a vendor' })
  @ApiParam({ name: 'vendorId', description: 'Vendor UUID' })
  @ApiQuery({ name: 'tenantId', description: 'Tenant UUID', required: true })
  @ApiResponse({ status: 200, description: 'Returns vendor purchase orders' })
  async getPOsByVendor(
    @Param('vendorId', ParseUUIDPipe) vendorId: string,
    @Query('tenantId') tenantId: string,
  ): Promise<POSearchResult[]> {
    return this.poService.getPOsByVendor(vendorId, tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get purchase order by ID' })
  @ApiParam({ name: 'id', description: 'Purchase Order UUID' })
  @ApiResponse({ status: 200, description: 'Returns the purchase order' })
  @ApiResponse({ status: 404, description: 'Purchase order not found' })
  async getPOById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<POSearchResult> {
    return this.poService.getPOById(id);
  }

  @Get('number/:poNumber')
  @ApiOperation({ summary: 'Get purchase order by PO number' })
  @ApiParam({ name: 'poNumber', description: 'Purchase Order Number' })
  @ApiQuery({ name: 'tenantId', description: 'Tenant UUID', required: true })
  @ApiResponse({ status: 200, description: 'Returns the purchase order' })
  @ApiResponse({ status: 404, description: 'Purchase order not found' })
  async getPOByNumber(
    @Param('poNumber') poNumber: string,
    @Query('tenantId') tenantId: string,
  ): Promise<POSearchResult> {
    return this.poService.getPOByNumber(poNumber, tenantId);
  }

  @Post(':id/validate')
  @ApiOperation({ summary: 'Validate if PO can be used for GRN creation' })
  @ApiParam({ name: 'id', description: 'Purchase Order UUID' })
  @ApiResponse({ status: 200, description: 'Returns validation result' })
  @ApiResponse({ status: 404, description: 'Purchase order not found' })
  async validatePOForGRN(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { requestedQuantity?: number },
  ): Promise<POValidationResult> {
    return this.poService.validatePOForGRN(id, body.requestedQuantity);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new purchase order' })
  @ApiResponse({ status: 201, description: 'Purchase order created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input or PO number already exists' })
  async createPO(@Body() dto: CreatePODto) {
    return this.poService.createPO(dto);
  }

  @Post(':id/documents')
  @UseInterceptors(FilesInterceptor('files', 10))
  @ApiOperation({ summary: 'Upload documents for a purchase order' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', description: 'Purchase Order UUID' })
  @ApiResponse({ status: 200, description: 'Documents uploaded successfully' })
  @ApiResponse({ status: 404, description: 'Purchase order not found' })
  async uploadDocuments(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('uploadedBy') uploadedBy?: string,
  ) {
    return this.poService.uploadDocuments(id, files, uploadedBy);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a purchase order' })
  @ApiParam({ name: 'id', description: 'Purchase Order UUID' })
  @ApiResponse({ status: 200, description: 'Purchase order updated successfully' })
  @ApiResponse({ status: 404, description: 'Purchase order not found' })
  @ApiResponse({ status: 400, description: 'Cannot update completed/cancelled PO' })
  async updatePO(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePODto,
  ) {
    return this.poService.updatePO(id, dto);
  }

  @Put(':id/receive')
  @ApiOperation({ summary: 'Update received quantity after GRN completion' })
  @ApiParam({ name: 'id', description: 'Purchase Order UUID' })
  @ApiResponse({ status: 200, description: 'Received quantity updated' })
  @ApiResponse({ status: 404, description: 'Purchase order not found' })
  async updateReceivedQuantity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { quantity: number },
  ) {
    return this.poService.updateReceivedQuantity(id, body.quantity);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel a purchase order' })
  @ApiParam({ name: 'id', description: 'Purchase Order UUID' })
  @ApiResponse({ status: 204, description: 'Purchase order cancelled' })
  @ApiResponse({ status: 404, description: 'Purchase order not found' })
  @ApiResponse({ status: 400, description: 'Cannot cancel completed PO' })
  async cancelPO(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason?: string },
  ) {
    await this.poService.cancelPO(id, body.reason);
  }
}
