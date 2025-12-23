import { Injectable, Logger } from '@nestjs/common';

export interface OcrExtractionResult {
  extractedText: string;
  confidence: number;
  language: string;
  fields?: {
    vendorName?: string;
    invoiceNumber?: string;
    date?: string;
    amount?: string;
    materialLines?: Array<{
      description: string;
      quantity: string;
      unit: string;
    }>;
  };
  rawData?: any;
}

export interface DocumentProcessingOptions {
  language?: string;
  extractFields?: boolean;
  confidenceThreshold?: number;
}

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  async extractTextFromDocument(
    fileBuffer: Buffer,
    mimeType: string,
    options: DocumentProcessingOptions = {}
  ): Promise<OcrExtractionResult> {
    this.logger.log(`Processing document of type: ${mimeType}`);

    // For now, we'll simulate OCR processing
    // In a real implementation, this would integrate with AWS Textract or Tesseract
    
    const mockResult: OcrExtractionResult = {
      extractedText: this.generateMockExtractedText(mimeType),
      confidence: Math.random() * 0.3 + 0.7, // 70-100% confidence
      language: options.language || 'en',
      fields: options.extractFields ? this.extractStructuredFields() : undefined,
      rawData: {
        processingTime: Math.random() * 2000 + 500, // 500-2500ms
        engine: 'mock-ocr-engine',
        version: '1.0.0'
      }
    };

    this.logger.log(`OCR extraction completed with ${mockResult.confidence * 100}% confidence`);
    return mockResult;
  }

  async validateExtractionQuality(result: OcrExtractionResult): Promise<boolean> {
    // Check minimum confidence threshold
    if (result.confidence < 0.6) {
      this.logger.warn(`Low confidence OCR result: ${result.confidence}`);
      return false;
    }

    // Check if extracted text is not empty
    if (!result.extractedText || result.extractedText.trim().length === 0) {
      this.logger.warn('Empty OCR extraction result');
      return false;
    }

    // Check for minimum text length (basic quality check)
    if (result.extractedText.trim().length < 10) {
      this.logger.warn('OCR result too short, likely poor quality');
      return false;
    }

    return true;
  }

  private generateMockExtractedText(mimeType: string): string {
    if (mimeType === 'application/pdf') {
      return `INVOICE
ABC Scrap Industries Pvt Ltd
GST: 27ABCDE1234F1Z5
PAN: ABCDE1234F

Invoice No: INV-2024-001
Date: ${new Date().toLocaleDateString()}

Bill To:
XYZ Factory Ltd
Factory Address Line 1
City, State - 123456

Material Details:
1. Iron Scrap - Grade A    500 KG    @Rs 45/KG    Rs 22,500
2. Copper Wire Scrap       50 KG     @Rs 650/KG   Rs 32,500
3. Aluminum Scrap          200 KG    @Rs 180/KG   Rs 36,000

Total Amount: Rs 91,000
GST (18%): Rs 16,380
Grand Total: Rs 1,07,380

Terms & Conditions:
- Payment within 30 days
- Material subject to inspection
- Prices as per market rates`;
    }

    return `Vendor: ABC Scrap Industries
PO Number: PO-2024-${Math.floor(Math.random() * 1000)}
Date: ${new Date().toLocaleDateString()}
Material: Mixed Scrap Metal
Quantity: ${Math.floor(Math.random() * 1000) + 100} KG
Vehicle: MH ${Math.floor(Math.random() * 99) + 1} AB ${Math.floor(Math.random() * 9999) + 1000}`;
  }

  private extractStructuredFields(): OcrExtractionResult['fields'] {
    return {
      vendorName: 'ABC Scrap Industries Pvt Ltd',
      invoiceNumber: `INV-2024-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      date: new Date().toLocaleDateString(),
      amount: `Rs ${(Math.random() * 100000 + 10000).toFixed(2)}`,
      materialLines: [
        {
          description: 'Iron Scrap - Grade A',
          quantity: '500',
          unit: 'KG'
        },
        {
          description: 'Copper Wire Scrap',
          quantity: '50',
          unit: 'KG'
        }
      ]
    };
  }
}