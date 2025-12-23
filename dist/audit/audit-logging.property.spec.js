"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fc = require("fast-check");
const audit_service_1 = require("./audit.service");
const audit_log_entity_1 = require("../entities/audit-log.entity");
class MockAuditLogRepository {
    constructor() {
        this.logs = [];
    }
    create(dto) {
        return {
            id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            ...dto,
        };
    }
    async save(log) {
        this.logs.push(log);
        return log;
    }
    async find(options) {
        let result = [...this.logs];
        if (options.where) {
            if (options.where.entityType) {
                result = result.filter(l => l.entityType === options.where.entityType);
            }
            if (options.where.entityId) {
                result = result.filter(l => l.entityId === options.where.entityId);
            }
            if (options.where.transactionId) {
                result = result.filter(l => l.transactionId === options.where.transactionId);
            }
            if (options.where.userId) {
                result = result.filter(l => l.userId === options.where.userId);
            }
        }
        return result;
    }
    getLogs() {
        return this.logs;
    }
    clear() {
        this.logs = [];
    }
}
function createAuditService() {
    const repository = new MockAuditLogRepository();
    const service = new audit_service_1.AuditService(repository);
    return { service, repository };
}
const userIdArb = fc.uuid();
const entityIdArb = fc.uuid();
const transactionIdArb = fc.uuid();
const poNumberArb = fc.stringOf(fc.constantFrom('P', 'O', '-', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'), { minLength: 5, maxLength: 15 });
const materialTypeArb = fc.constantFrom('Steel Scrap', 'Copper Wire', 'Aluminum', 'Iron', 'Brass');
const quantityArb = fc.float({ min: 1, max: 100000, noNaN: true });
const rateArb = fc.float({ min: 1, max: 10000, noNaN: true });
const stepNumberArb = fc.integer({ min: 0, max: 6 });
describe('Audit Logging Property Tests', () => {
    describe('Property 15: Audit Log Creation on Save', () => {
        it('should create audit log with required fields for PO creation', async () => {
            await fc.assert(fc.asyncProperty(userIdArb, entityIdArb, poNumberArb, materialTypeArb, quantityArb, rateArb, async (userId, poId, poNumber, materialType, quantity, rate) => {
                const { service, repository } = createAuditService();
                repository.clear();
                const poData = {
                    poNumber,
                    materialType,
                    orderedQuantity: quantity,
                    rate,
                    status: 'PENDING',
                };
                const auditLog = await service.logPOCreation(userId, poId, poData);
                expect(auditLog).toBeDefined();
                expect(auditLog.id).toBeDefined();
                expect(auditLog.userId).toBe(userId);
                expect(auditLog.action).toBe(audit_log_entity_1.AuditAction.PO_CREATED);
                expect(auditLog.entityType).toBe('PurchaseOrder');
                expect(auditLog.entityId).toBe(poId);
                expect(auditLog.timestamp).toBeDefined();
                expect(auditLog.timestamp instanceof Date).toBe(true);
                expect(auditLog.newValues).toBeDefined();
                expect(auditLog.newValues.poNumber).toBe(poNumber);
            }), { numRuns: 100 });
        });
        it('should create audit log with required fields for GRN step save', async () => {
            await fc.assert(fc.asyncProperty(userIdArb, transactionIdArb, stepNumberArb, fc.record({
                truck_number: fc.string({ minLength: 5, maxLength: 15 }),
                driver_name: fc.string({ minLength: 2, maxLength: 50 }),
            }), async (userId, transactionId, stepNumber, stepData) => {
                const { service, repository } = createAuditService();
                repository.clear();
                const auditLog = await service.logGRNStepSave(userId, transactionId, stepNumber, stepData);
                expect(auditLog).toBeDefined();
                expect(auditLog.id).toBeDefined();
                expect(auditLog.userId).toBe(userId);
                expect(auditLog.action).toBe(audit_log_entity_1.AuditAction.GRN_STEP_SAVED);
                expect(auditLog.entityType).toBe('Transaction');
                expect(auditLog.entityId).toBe(transactionId);
                expect(auditLog.transactionId).toBe(transactionId);
                expect(auditLog.timestamp).toBeDefined();
                expect(auditLog.timestamp instanceof Date).toBe(true);
                expect(auditLog.newValues).toBeDefined();
                expect(auditLog.newValues.stepNumber).toBe(stepNumber);
            }), { numRuns: 100 });
        });
        it('should create audit log with required fields for QC report creation', async () => {
            await fc.assert(fc.asyncProperty(userIdArb, entityIdArb, transactionIdArb, fc.record({
                lineItemCount: fc.integer({ min: 1, max: 10 }),
                totals: fc.record({
                    grossWeight: quantityArb,
                    netWeight: quantityArb,
                    amount: fc.float({ min: 0, max: 1000000, noNaN: true }),
                }),
                status: fc.constant('DRAFT'),
            }), async (userId, qcReportId, transactionId, qcData) => {
                const { service, repository } = createAuditService();
                repository.clear();
                const auditLog = await service.logQCReportCreation(userId, qcReportId, transactionId, qcData);
                expect(auditLog).toBeDefined();
                expect(auditLog.id).toBeDefined();
                expect(auditLog.userId).toBe(userId);
                expect(auditLog.action).toBe(audit_log_entity_1.AuditAction.QC_REPORT_CREATED);
                expect(auditLog.entityType).toBe('QCReport');
                expect(auditLog.entityId).toBe(qcReportId);
                expect(auditLog.transactionId).toBe(transactionId);
                expect(auditLog.timestamp).toBeDefined();
                expect(auditLog.timestamp instanceof Date).toBe(true);
                expect(auditLog.newValues).toBeDefined();
                expect(auditLog.newValues.lineItemCount).toBe(qcData.lineItemCount);
            }), { numRuns: 100 });
        });
        it('should create audit log with required fields for QC report approval', async () => {
            await fc.assert(fc.asyncProperty(userIdArb, entityIdArb, transactionIdArb, fc.record({
                status: fc.constant('APPROVED'),
                approvedAt: fc.date(),
                totals: fc.record({
                    grossWeight: quantityArb,
                    netWeight: quantityArb,
                    amount: fc.float({ min: 0, max: 1000000, noNaN: true }),
                }),
            }), async (userId, qcReportId, transactionId, approvalData) => {
                const { service, repository } = createAuditService();
                repository.clear();
                const auditLog = await service.logQCReportApproval(userId, qcReportId, transactionId, approvalData);
                expect(auditLog).toBeDefined();
                expect(auditLog.id).toBeDefined();
                expect(auditLog.userId).toBe(userId);
                expect(auditLog.action).toBe(audit_log_entity_1.AuditAction.QC_REPORT_APPROVED);
                expect(auditLog.entityType).toBe('QCReport');
                expect(auditLog.entityId).toBe(qcReportId);
                expect(auditLog.transactionId).toBe(transactionId);
                expect(auditLog.timestamp).toBeDefined();
                expect(auditLog.timestamp instanceof Date).toBe(true);
                expect(auditLog.severity).toBe('HIGH');
            }), { numRuns: 100 });
        });
        it('should create audit log with required fields for debit note generation', async () => {
            await fc.assert(fc.asyncProperty(userIdArb, entityIdArb, entityIdArb, transactionIdArb, fc.record({
                debitNoteNumber: fc.stringOf(fc.constantFrom('D', 'N', '-', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'), { minLength: 5, maxLength: 15 }),
                qualityDifference: fc.float({ min: 0, max: 100000, noNaN: true }),
                bardanaDeduction: fc.float({ min: 0, max: 50000, noNaN: true }),
                rejectionAmount: fc.float({ min: 0, max: 50000, noNaN: true }),
                grandTotal: fc.float({ min: -200000, max: 0, noNaN: true }),
                status: fc.constant('GENERATED'),
            }), async (userId, debitNoteId, qcReportId, transactionId, debitNoteData) => {
                const { service, repository } = createAuditService();
                repository.clear();
                const auditLog = await service.logDebitNoteGeneration(userId, debitNoteId, qcReportId, transactionId, debitNoteData);
                expect(auditLog).toBeDefined();
                expect(auditLog.id).toBeDefined();
                expect(auditLog.userId).toBe(userId);
                expect(auditLog.action).toBe(audit_log_entity_1.AuditAction.DEBIT_NOTE_GENERATED);
                expect(auditLog.entityType).toBe('DebitNote');
                expect(auditLog.entityId).toBe(debitNoteId);
                expect(auditLog.transactionId).toBe(transactionId);
                expect(auditLog.timestamp).toBeDefined();
                expect(auditLog.timestamp instanceof Date).toBe(true);
                expect(auditLog.severity).toBe('HIGH');
                expect(auditLog.newValues).toBeDefined();
                expect(auditLog.newValues.debitNoteNumber).toBe(debitNoteData.debitNoteNumber);
            }), { numRuns: 100 });
        });
        it('should create audit log with required fields for PO update', async () => {
            await fc.assert(fc.asyncProperty(userIdArb, entityIdArb, fc.record({
                materialType: materialTypeArb,
                orderedQuantity: quantityArb,
                rate: rateArb,
            }), fc.record({
                materialType: materialTypeArb,
                orderedQuantity: quantityArb,
                rate: rateArb,
            }), async (userId, poId, oldValues, newValues) => {
                const { service, repository } = createAuditService();
                repository.clear();
                const auditLog = await service.logPOUpdate(userId, poId, oldValues, newValues);
                expect(auditLog).toBeDefined();
                expect(auditLog.id).toBeDefined();
                expect(auditLog.userId).toBe(userId);
                expect(auditLog.action).toBe(audit_log_entity_1.AuditAction.PO_UPDATED);
                expect(auditLog.entityType).toBe('PurchaseOrder');
                expect(auditLog.entityId).toBe(poId);
                expect(auditLog.timestamp).toBeDefined();
                expect(auditLog.timestamp instanceof Date).toBe(true);
                expect(auditLog.oldValues).toBeDefined();
                expect(auditLog.newValues).toBeDefined();
            }), { numRuns: 100 });
        });
        it('should create audit log with required fields for transaction creation', async () => {
            await fc.assert(fc.asyncProperty(userIdArb, transactionIdArb, fc.record({
                transactionNumber: fc.string({ minLength: 10, maxLength: 20 }),
                tenantId: fc.uuid(),
                factoryId: fc.uuid(),
                vendorId: fc.uuid(),
            }), async (userId, transactionId, transactionData) => {
                const { service, repository } = createAuditService();
                repository.clear();
                const auditLog = await service.logTransactionCreation(userId, transactionId, transactionData);
                expect(auditLog).toBeDefined();
                expect(auditLog.id).toBeDefined();
                expect(auditLog.userId).toBe(userId);
                expect(auditLog.action).toBe(audit_log_entity_1.AuditAction.TRANSACTION_CREATED);
                expect(auditLog.entityType).toBe('Transaction');
                expect(auditLog.entityId).toBe(transactionId);
                expect(auditLog.transactionId).toBe(transactionId);
                expect(auditLog.timestamp).toBeDefined();
                expect(auditLog.timestamp instanceof Date).toBe(true);
            }), { numRuns: 100 });
        });
        it('should create audit log with required fields for GRN completion', async () => {
            await fc.assert(fc.asyncProperty(userIdArb, transactionIdArb, fc.record({
                transactionNumber: fc.string({ minLength: 10, maxLength: 20 }),
                status: fc.constant('COMPLETED'),
                completedAt: fc.date(),
                netWeight: quantityArb,
            }), async (userId, transactionId, transactionData) => {
                const { service, repository } = createAuditService();
                repository.clear();
                const auditLog = await service.logGRNCompletion(userId, transactionId, transactionData);
                expect(auditLog).toBeDefined();
                expect(auditLog.id).toBeDefined();
                expect(auditLog.userId).toBe(userId);
                expect(auditLog.action).toBe(audit_log_entity_1.AuditAction.GRN_COMPLETED);
                expect(auditLog.entityType).toBe('Transaction');
                expect(auditLog.entityId).toBe(transactionId);
                expect(auditLog.transactionId).toBe(transactionId);
                expect(auditLog.timestamp).toBeDefined();
                expect(auditLog.timestamp instanceof Date).toBe(true);
                expect(auditLog.severity).toBe('HIGH');
            }), { numRuns: 100 });
        });
    });
    describe('Audit Log Retrieval', () => {
        it('should retrieve audit logs by entity type and ID', async () => {
            await fc.assert(fc.asyncProperty(userIdArb, entityIdArb, fc.integer({ min: 1, max: 5 }), async (userId, entityId, logCount) => {
                const { service, repository } = createAuditService();
                repository.clear();
                for (let i = 0; i < logCount; i++) {
                    await service.logPOCreation(userId, entityId, { poNumber: `PO-${i}` });
                }
                const logs = await service.getAuditLogsForEntity('PurchaseOrder', entityId);
                expect(logs.length).toBe(logCount);
                logs.forEach(log => {
                    expect(log.entityType).toBe('PurchaseOrder');
                    expect(log.entityId).toBe(entityId);
                });
            }), { numRuns: 50 });
        });
        it('should retrieve audit logs by transaction ID', async () => {
            await fc.assert(fc.asyncProperty(userIdArb, transactionIdArb, fc.integer({ min: 1, max: 5 }), async (userId, transactionId, logCount) => {
                const { service, repository } = createAuditService();
                repository.clear();
                for (let i = 0; i < logCount; i++) {
                    await service.logGRNStepSave(userId, transactionId, i, { step: i });
                }
                const logs = await service.getAuditLogsForTransaction(transactionId);
                expect(logs.length).toBe(logCount);
                logs.forEach(log => {
                    expect(log.transactionId).toBe(transactionId);
                });
            }), { numRuns: 50 });
        });
    });
});
//# sourceMappingURL=audit-logging.property.spec.js.map