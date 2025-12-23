import * as fc from 'fast-check';
import { AuditService, CreateAuditLogDto } from './audit.service';
import { AuditLog, AuditAction } from '../entities/audit-log.entity';
import { Repository } from 'typeorm';

/**
 * Mock repository for testing
 */
class MockAuditLogRepository {
  private logs: AuditLog[] = [];

  create(dto: Partial<AuditLog>): AuditLog {
    return {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...dto,
    } as AuditLog;
  }

  async save(log: AuditLog): Promise<AuditLog> {
    this.logs.push(log);
    return log;
  }

  async find(options: any): Promise<AuditLog[]> {
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

  getLogs(): AuditLog[] {
    return this.logs;
  }

  clear(): void {
    this.logs = [];
  }
}

/**
 * Helper to create AuditService with mock repository
 */
function createAuditService(): { service: AuditService; repository: MockAuditLogRepository } {
  const repository = new MockAuditLogRepository();
  const service = new AuditService(repository as unknown as Repository<AuditLog>);
  return { service, repository };
}

/**
 * Arbitraries for generating test data
 */
const userIdArb = fc.uuid();
const entityIdArb = fc.uuid();
const transactionIdArb = fc.uuid();
const poNumberArb = fc.stringOf(fc.constantFrom('P', 'O', '-', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'), { minLength: 5, maxLength: 15 });
const materialTypeArb = fc.constantFrom('Steel Scrap', 'Copper Wire', 'Aluminum', 'Iron', 'Brass');
const quantityArb = fc.float({ min: 1, max: 100000, noNaN: true });
const rateArb = fc.float({ min: 1, max: 10000, noNaN: true });
const stepNumberArb = fc.integer({ min: 0, max: 6 });

describe('Audit Logging Property Tests', () => {
  /**
   * **Feature: lab-qc-report, Property 15: Audit Log Creation on Save**
   * *For any* save operation (PO, GRN step, QC), an audit log entry should be created
   * with user ID, timestamp, and action type.
   * **Validates: Requirements 8.5**
   */
  describe('Property 15: Audit Log Creation on Save', () => {
    it('should create audit log with required fields for PO creation', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          entityIdArb,
          poNumberArb,
          materialTypeArb,
          quantityArb,
          rateArb,
          async (userId, poId, poNumber, materialType, quantity, rate) => {
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

            // Verify audit log was created
            expect(auditLog).toBeDefined();
            expect(auditLog.id).toBeDefined();

            // Verify required fields
            expect(auditLog.userId).toBe(userId);
            expect(auditLog.action).toBe(AuditAction.PO_CREATED);
            expect(auditLog.entityType).toBe('PurchaseOrder');
            expect(auditLog.entityId).toBe(poId);
            expect(auditLog.timestamp).toBeDefined();
            expect(auditLog.timestamp instanceof Date).toBe(true);

            // Verify newValues contains PO data
            expect(auditLog.newValues).toBeDefined();
            expect(auditLog.newValues.poNumber).toBe(poNumber);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should create audit log with required fields for GRN step save', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          transactionIdArb,
          stepNumberArb,
          fc.record({
            truck_number: fc.string({ minLength: 5, maxLength: 15 }),
            driver_name: fc.string({ minLength: 2, maxLength: 50 }),
          }),
          async (userId, transactionId, stepNumber, stepData) => {
            const { service, repository } = createAuditService();
            repository.clear();

            const auditLog = await service.logGRNStepSave(userId, transactionId, stepNumber, stepData);

            // Verify audit log was created
            expect(auditLog).toBeDefined();
            expect(auditLog.id).toBeDefined();

            // Verify required fields
            expect(auditLog.userId).toBe(userId);
            expect(auditLog.action).toBe(AuditAction.GRN_STEP_SAVED);
            expect(auditLog.entityType).toBe('Transaction');
            expect(auditLog.entityId).toBe(transactionId);
            expect(auditLog.transactionId).toBe(transactionId);
            expect(auditLog.timestamp).toBeDefined();
            expect(auditLog.timestamp instanceof Date).toBe(true);

            // Verify newValues contains step data
            expect(auditLog.newValues).toBeDefined();
            expect(auditLog.newValues.stepNumber).toBe(stepNumber);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should create audit log with required fields for QC report creation', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          entityIdArb,
          transactionIdArb,
          fc.record({
            lineItemCount: fc.integer({ min: 1, max: 10 }),
            totals: fc.record({
              grossWeight: quantityArb,
              netWeight: quantityArb,
              amount: fc.float({ min: 0, max: 1000000, noNaN: true }),
            }),
            status: fc.constant('DRAFT'),
          }),
          async (userId, qcReportId, transactionId, qcData) => {
            const { service, repository } = createAuditService();
            repository.clear();

            const auditLog = await service.logQCReportCreation(userId, qcReportId, transactionId, qcData);

            // Verify audit log was created
            expect(auditLog).toBeDefined();
            expect(auditLog.id).toBeDefined();

            // Verify required fields
            expect(auditLog.userId).toBe(userId);
            expect(auditLog.action).toBe(AuditAction.QC_REPORT_CREATED);
            expect(auditLog.entityType).toBe('QCReport');
            expect(auditLog.entityId).toBe(qcReportId);
            expect(auditLog.transactionId).toBe(transactionId);
            expect(auditLog.timestamp).toBeDefined();
            expect(auditLog.timestamp instanceof Date).toBe(true);

            // Verify newValues contains QC data
            expect(auditLog.newValues).toBeDefined();
            expect(auditLog.newValues.lineItemCount).toBe(qcData.lineItemCount);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should create audit log with required fields for QC report approval', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          entityIdArb,
          transactionIdArb,
          fc.record({
            status: fc.constant('APPROVED'),
            approvedAt: fc.date(),
            totals: fc.record({
              grossWeight: quantityArb,
              netWeight: quantityArb,
              amount: fc.float({ min: 0, max: 1000000, noNaN: true }),
            }),
          }),
          async (userId, qcReportId, transactionId, approvalData) => {
            const { service, repository } = createAuditService();
            repository.clear();

            const auditLog = await service.logQCReportApproval(userId, qcReportId, transactionId, approvalData);

            // Verify audit log was created
            expect(auditLog).toBeDefined();
            expect(auditLog.id).toBeDefined();

            // Verify required fields
            expect(auditLog.userId).toBe(userId);
            expect(auditLog.action).toBe(AuditAction.QC_REPORT_APPROVED);
            expect(auditLog.entityType).toBe('QCReport');
            expect(auditLog.entityId).toBe(qcReportId);
            expect(auditLog.transactionId).toBe(transactionId);
            expect(auditLog.timestamp).toBeDefined();
            expect(auditLog.timestamp instanceof Date).toBe(true);
            expect(auditLog.severity).toBe('HIGH');
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should create audit log with required fields for debit note generation', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          entityIdArb,
          entityIdArb,
          transactionIdArb,
          fc.record({
            debitNoteNumber: fc.stringOf(fc.constantFrom('D', 'N', '-', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'), { minLength: 5, maxLength: 15 }),
            qualityDifference: fc.float({ min: 0, max: 100000, noNaN: true }),
            bardanaDeduction: fc.float({ min: 0, max: 50000, noNaN: true }),
            rejectionAmount: fc.float({ min: 0, max: 50000, noNaN: true }),
            grandTotal: fc.float({ min: -200000, max: 0, noNaN: true }),
            status: fc.constant('GENERATED'),
          }),
          async (userId, debitNoteId, qcReportId, transactionId, debitNoteData) => {
            const { service, repository } = createAuditService();
            repository.clear();

            const auditLog = await service.logDebitNoteGeneration(
              userId,
              debitNoteId,
              qcReportId,
              transactionId,
              debitNoteData,
            );

            // Verify audit log was created
            expect(auditLog).toBeDefined();
            expect(auditLog.id).toBeDefined();

            // Verify required fields
            expect(auditLog.userId).toBe(userId);
            expect(auditLog.action).toBe(AuditAction.DEBIT_NOTE_GENERATED);
            expect(auditLog.entityType).toBe('DebitNote');
            expect(auditLog.entityId).toBe(debitNoteId);
            expect(auditLog.transactionId).toBe(transactionId);
            expect(auditLog.timestamp).toBeDefined();
            expect(auditLog.timestamp instanceof Date).toBe(true);
            expect(auditLog.severity).toBe('HIGH');

            // Verify newValues contains debit note data
            expect(auditLog.newValues).toBeDefined();
            expect(auditLog.newValues.debitNoteNumber).toBe(debitNoteData.debitNoteNumber);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should create audit log with required fields for PO update', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          entityIdArb,
          fc.record({
            materialType: materialTypeArb,
            orderedQuantity: quantityArb,
            rate: rateArb,
          }),
          fc.record({
            materialType: materialTypeArb,
            orderedQuantity: quantityArb,
            rate: rateArb,
          }),
          async (userId, poId, oldValues, newValues) => {
            const { service, repository } = createAuditService();
            repository.clear();

            const auditLog = await service.logPOUpdate(userId, poId, oldValues, newValues);

            // Verify audit log was created
            expect(auditLog).toBeDefined();
            expect(auditLog.id).toBeDefined();

            // Verify required fields
            expect(auditLog.userId).toBe(userId);
            expect(auditLog.action).toBe(AuditAction.PO_UPDATED);
            expect(auditLog.entityType).toBe('PurchaseOrder');
            expect(auditLog.entityId).toBe(poId);
            expect(auditLog.timestamp).toBeDefined();
            expect(auditLog.timestamp instanceof Date).toBe(true);

            // Verify old and new values are captured
            expect(auditLog.oldValues).toBeDefined();
            expect(auditLog.newValues).toBeDefined();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should create audit log with required fields for transaction creation', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          transactionIdArb,
          fc.record({
            transactionNumber: fc.string({ minLength: 10, maxLength: 20 }),
            tenantId: fc.uuid(),
            factoryId: fc.uuid(),
            vendorId: fc.uuid(),
          }),
          async (userId, transactionId, transactionData) => {
            const { service, repository } = createAuditService();
            repository.clear();

            const auditLog = await service.logTransactionCreation(userId, transactionId, transactionData);

            // Verify audit log was created
            expect(auditLog).toBeDefined();
            expect(auditLog.id).toBeDefined();

            // Verify required fields
            expect(auditLog.userId).toBe(userId);
            expect(auditLog.action).toBe(AuditAction.TRANSACTION_CREATED);
            expect(auditLog.entityType).toBe('Transaction');
            expect(auditLog.entityId).toBe(transactionId);
            expect(auditLog.transactionId).toBe(transactionId);
            expect(auditLog.timestamp).toBeDefined();
            expect(auditLog.timestamp instanceof Date).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should create audit log with required fields for GRN completion', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          transactionIdArb,
          fc.record({
            transactionNumber: fc.string({ minLength: 10, maxLength: 20 }),
            status: fc.constant('COMPLETED'),
            completedAt: fc.date(),
            netWeight: quantityArb,
          }),
          async (userId, transactionId, transactionData) => {
            const { service, repository } = createAuditService();
            repository.clear();

            const auditLog = await service.logGRNCompletion(userId, transactionId, transactionData);

            // Verify audit log was created
            expect(auditLog).toBeDefined();
            expect(auditLog.id).toBeDefined();

            // Verify required fields
            expect(auditLog.userId).toBe(userId);
            expect(auditLog.action).toBe(AuditAction.GRN_COMPLETED);
            expect(auditLog.entityType).toBe('Transaction');
            expect(auditLog.entityId).toBe(transactionId);
            expect(auditLog.transactionId).toBe(transactionId);
            expect(auditLog.timestamp).toBeDefined();
            expect(auditLog.timestamp instanceof Date).toBe(true);
            expect(auditLog.severity).toBe('HIGH');
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Audit Log Retrieval', () => {
    it('should retrieve audit logs by entity type and ID', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          entityIdArb,
          fc.integer({ min: 1, max: 5 }),
          async (userId, entityId, logCount) => {
            const { service, repository } = createAuditService();
            repository.clear();

            // Create multiple audit logs for the same entity
            for (let i = 0; i < logCount; i++) {
              await service.logPOCreation(userId, entityId, { poNumber: `PO-${i}` });
            }

            const logs = await service.getAuditLogsForEntity('PurchaseOrder', entityId);

            expect(logs.length).toBe(logCount);
            logs.forEach(log => {
              expect(log.entityType).toBe('PurchaseOrder');
              expect(log.entityId).toBe(entityId);
            });
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should retrieve audit logs by transaction ID', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          transactionIdArb,
          fc.integer({ min: 1, max: 5 }),
          async (userId, transactionId, logCount) => {
            const { service, repository } = createAuditService();
            repository.clear();

            // Create multiple audit logs for the same transaction
            for (let i = 0; i < logCount; i++) {
              await service.logGRNStepSave(userId, transactionId, i, { step: i });
            }

            const logs = await service.getAuditLogsForTransaction(transactionId);

            expect(logs.length).toBe(logCount);
            logs.forEach(log => {
              expect(log.transactionId).toBe(transactionId);
            });
          },
        ),
        { numRuns: 50 },
      );
    });
  });
});
