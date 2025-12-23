import { DocumentProcessingService, DocumentConfirmationDto } from './document-processing.service';
export declare class DocumentController {
    private documentProcessingService;
    constructor(documentProcessingService: DocumentProcessingService);
    uploadDocument(file: Express.Multer.File, body: {
        transactionId: string;
        operationalLevel: string;
        documentType: 'PO' | 'INVOICE' | 'CHALLAN' | 'OTHER';
        extractFields?: string;
    }, req: any): Promise<{
        success: boolean;
        message: string;
        data: import("./document-processing.service").ProcessedDocument;
    }>;
    confirmDocumentData(documentId: string, confirmationDto: Omit<DocumentConfirmationDto, 'documentId' | 'confirmedBy'>, req: any): Promise<{
        success: boolean;
        message: string;
        data: import("./document-processing.service").ProcessedDocument;
    }>;
    getDocumentsByTransaction(transactionId: string, req: any): Promise<{
        success: boolean;
        data: import("./document-processing.service").ProcessedDocument[];
    }>;
    getUnconfirmedDocuments(req: any): Promise<{
        success: boolean;
        data: import("./document-processing.service").ProcessedDocument[];
        count: number;
    }>;
    linkDocumentToTransaction(documentId: string, transactionId: string, req: any): Promise<{
        success: boolean;
        message: string;
    }>;
}
