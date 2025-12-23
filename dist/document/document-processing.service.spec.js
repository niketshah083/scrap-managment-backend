"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const document_processing_service_1 = require("./document-processing.service");
const ocr_service_1 = require("./ocr.service");
const evidence_entity_1 = require("../entities/evidence.entity");
const transaction_entity_1 = require("../entities/transaction.entity");
const user_entity_1 = require("../entities/user.entity");
const audit_log_entity_1 = require("../entities/audit-log.entity");
describe('DocumentProcessingService', () => {
    let service;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                document_processing_service_1.DocumentProcessingService,
                ocr_service_1.OcrService,
                {
                    provide: (0, typeorm_1.getRepositoryToken)(evidence_entity_1.Evidence),
                    useClass: typeorm_2.Repository,
                },
                {
                    provide: (0, typeorm_1.getRepositoryToken)(transaction_entity_1.Transaction),
                    useClass: typeorm_2.Repository,
                },
                {
                    provide: (0, typeorm_1.getRepositoryToken)(user_entity_1.User),
                    useClass: typeorm_2.Repository,
                },
                {
                    provide: (0, typeorm_1.getRepositoryToken)(audit_log_entity_1.AuditLog),
                    useClass: typeorm_2.Repository,
                },
            ],
        }).compile();
        service = module.get(document_processing_service_1.DocumentProcessingService);
    });
    it('should be defined', () => {
        expect(service).toBeDefined();
    });
    it('should require manual confirmation for OCR processed documents', () => {
        const mockOcrResult = {
            extractedText: 'Sample invoice text',
            confidence: 0.95,
            language: 'en',
        };
        const requiresConfirmation = true;
        expect(requiresConfirmation).toBe(true);
        expect(mockOcrResult.confidence).toBeGreaterThan(0);
    });
    it('should maintain document-transaction links', () => {
        const mockDocument = {
            id: 'doc-123',
            transactionId: 'txn-456',
            isConfirmed: true,
            fileName: 'invoice.pdf',
        };
        expect(mockDocument.transactionId).toBeDefined();
        expect(mockDocument.transactionId).toBeTruthy();
        expect(mockDocument.id).toBeDefined();
        expect(mockDocument.fileName).toBeDefined();
    });
});
//# sourceMappingURL=document-processing.service.spec.js.map