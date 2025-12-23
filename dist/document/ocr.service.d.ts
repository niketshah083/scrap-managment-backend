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
export declare class OcrService {
    private readonly logger;
    extractTextFromDocument(fileBuffer: Buffer, mimeType: string, options?: DocumentProcessingOptions): Promise<OcrExtractionResult>;
    validateExtractionQuality(result: OcrExtractionResult): Promise<boolean>;
    private generateMockExtractedText;
    private extractStructuredFields;
}
