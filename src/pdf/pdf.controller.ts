import { Controller, Get, Post, Body, Param, Res, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { PdfService } from './pdf.service';
import { TransactionService } from '../transaction/transaction.service';
import { PurchaseOrderService } from '../purchase-order/purchase-order.service';

@Controller('pdf')
export class PdfController {
  constructor(
    private readonly pdfService: PdfService,
    private readonly transactionService: TransactionService,
    private readonly purchaseOrderService: PurchaseOrderService,
  ) {}

  @Get('grn/:id')
  async generateGrnPdf(@Param('id') id: string, @Res() res: Response) {
    try {
      const transaction = await this.transactionService.getTransactionById(id);
      if (!transaction) {
        throw new HttpException('Transaction not found', HttpStatus.NOT_FOUND);
      }

      const pdfBuffer = await this.pdfService.generatePdf('grn', transaction);

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="GRN-${transaction.transactionNumber}.pdf"`,
        'Content-Length': pdfBuffer.length,
      });

      res.end(pdfBuffer);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException('Failed to generate PDF', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // POST endpoint to generate PDF from provided data (for mock/demo data)
  @Post('grn/generate')
  async generateGrnPdfFromData(@Body() data: any, @Res() res: Response) {
    try {
      const pdfBuffer = await this.pdfService.generatePdf('grn', data);

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="GRN-${data.transactionNumber || 'report'}.pdf"`,
        'Content-Length': pdfBuffer.length,
      });

      res.end(pdfBuffer);
    } catch (error) {
      console.error('PDF generation error:', error);
      throw new HttpException('Failed to generate PDF', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('purchase-order/:id')
  async generatePurchaseOrderPdf(@Param('id') id: string, @Res() res: Response) {
    try {
      const po = await this.purchaseOrderService.getPOById(id);
      if (!po) {
        throw new HttpException('Purchase Order not found', HttpStatus.NOT_FOUND);
      }

      const pdfBuffer = await this.pdfService.generatePdf('purchase-order', po);

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="PO-${po.poNumber}.pdf"`,
        'Content-Length': pdfBuffer.length,
      });

      res.end(pdfBuffer);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException('Failed to generate PDF', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('gate-pass/:id')
  async generateGatePassPdf(@Param('id') id: string, @Res() res: Response) {
    try {
      const transaction = await this.transactionService.getTransactionById(id);
      if (!transaction) {
        throw new HttpException('Transaction not found', HttpStatus.NOT_FOUND);
      }

      const pdfBuffer = await this.pdfService.generatePdf('gate-pass', transaction);

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="GatePass-${transaction.transactionNumber}.pdf"`,
        'Content-Length': pdfBuffer.length,
      });

      res.end(pdfBuffer);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException('Failed to generate PDF', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
