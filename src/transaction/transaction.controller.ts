import { Controller, Get, Post, Put, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { TransactionService, CreateTransactionDto, SaveStepDataDto } from './transaction.service';

@ApiTags('Transactions')
@Controller('transactions')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new transaction' })
  @ApiResponse({ status: 201, description: 'Transaction created successfully' })
  async createTransaction(@Body() dto: CreateTransactionDto) {
    return this.transactionService.createTransaction(dto);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get active transactions for dashboard' })
  @ApiQuery({ name: 'tenantId', required: false })
  async getActiveTransactions(@Query('tenantId') tenantId?: string) {
    const tenant = tenantId || 'test-tenant-2';
    return this.transactionService.getActiveTransactions(tenant);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  @ApiQuery({ name: 'tenantId', required: false })
  async getDashboardStats(@Query('tenantId') tenantId?: string) {
    const tenant = tenantId || 'test-tenant-2';
    return this.transactionService.getDashboardStats(tenant);
  }

  // IMPORTANT: Static routes must come BEFORE parameterized routes
  @Get('completed-for-qc')
  @ApiOperation({ summary: 'Get completed transactions pending QC' })
  @ApiQuery({ name: 'tenantId', required: false })
  async getCompletedTransactionsForQC(@Query('tenantId') tenantId?: string) {
    const tenant = tenantId || 'test-tenant-2';
    return this.transactionService.getCompletedTransactionsForQC(tenant);
  }

  @Get('completed')
  @ApiOperation({ summary: 'Get all completed transactions' })
  @ApiQuery({ name: 'tenantId', required: false })
  async getCompletedTransactions(@Query('tenantId') tenantId?: string) {
    const tenant = tenantId || 'test-tenant-2';
    return this.transactionService.getCompletedTransactions(tenant);
  }

  // Parameterized routes must come AFTER static routes
  @Get(':id')
  @ApiOperation({ summary: 'Get transaction by ID' })
  @ApiResponse({ status: 200, description: 'Transaction found' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async getTransactionById(@Param('id') id: string) {
    return this.transactionService.getTransactionById(id);
  }

  @Put(':id/step')
  @ApiOperation({ summary: 'Save step data for a transaction' })
  @ApiResponse({ status: 200, description: 'Step data saved successfully' })
  async saveStepData(
    @Param('id') id: string,
    @Body() dto: SaveStepDataDto
  ) {
    return this.transactionService.saveStepData(id, dto);
  }

  @Put(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete a transaction' })
  @ApiResponse({ status: 200, description: 'Transaction completed successfully' })
  async completeTransaction(
    @Param('id') id: string,
    @Body('userId') userId: string
  ) {
    return this.transactionService.completeTransaction(id, userId || 'system');
  }

  @Get(':id/draft')
  @ApiOperation({ summary: 'Get draft transaction for restoration' })
  async getDraftTransaction(@Param('id') id: string) {
    return this.transactionService.getDraftTransaction(id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all transactions' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'status', required: false })
  async getTransactions(
    @Query('tenantId') tenantId?: string,
    @Query('status') status?: string
  ) {
    const tenant = tenantId || 'test-tenant-2';
    if (status === 'completed') {
      return this.transactionService.getCompletedTransactions(tenant);
    } else if (status === 'active') {
      return this.transactionService.getActiveTransactions(tenant);
    }
    // Return all transactions (both active and completed)
    return this.transactionService.getAllTransactions(tenant);
  }
}
