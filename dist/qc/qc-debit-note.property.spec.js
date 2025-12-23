"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fc = require("fast-check");
class DebitNoteNumberGenerator {
    constructor() {
        this.usedNumbers = new Set();
        this.sequenceByTenant = new Map();
    }
    generateDebitNoteNumber(tenantId) {
        const year = new Date().getFullYear();
        const prefix = `DN-${year}`;
        const currentSequence = this.sequenceByTenant.get(tenantId) || 0;
        const newSequence = currentSequence + 1;
        this.sequenceByTenant.set(tenantId, newSequence);
        const debitNoteNumber = `${prefix}-${newSequence.toString().padStart(4, '0')}`;
        this.usedNumbers.add(debitNoteNumber);
        return debitNoteNumber;
    }
    isUnique(debitNoteNumber) {
        const count = Array.from(this.usedNumbers).filter(n => n === debitNoteNumber).length;
        return count <= 1;
    }
    reset() {
        this.usedNumbers.clear();
        this.sequenceByTenant.clear();
    }
}
describe('QC Debit Note Property Tests', () => {
    describe('Property 13: Debit Note Number Uniqueness', () => {
        it('should generate unique debit note numbers for same tenant', () => {
            fc.assert(fc.property(fc.uuid(), fc.integer({ min: 1, max: 100 }), (tenantId, count) => {
                const generator = new DebitNoteNumberGenerator();
                const generatedNumbers = [];
                for (let i = 0; i < count; i++) {
                    const number = generator.generateDebitNoteNumber(tenantId);
                    generatedNumbers.push(number);
                }
                const uniqueNumbers = new Set(generatedNumbers);
                expect(uniqueNumbers.size).toBe(generatedNumbers.length);
            }), { numRuns: 100 });
        });
        it('should generate unique debit note numbers within each tenant', () => {
            fc.assert(fc.property(fc.array(fc.uuid(), { minLength: 2, maxLength: 5 }), fc.integer({ min: 1, max: 20 }), (tenantIds, countPerTenant) => {
                const generator = new DebitNoteNumberGenerator();
                const numbersByTenant = new Map();
                for (const tenantId of tenantIds) {
                    const tenantNumbers = [];
                    for (let i = 0; i < countPerTenant; i++) {
                        const number = generator.generateDebitNoteNumber(tenantId);
                        tenantNumbers.push(number);
                    }
                    numbersByTenant.set(tenantId, tenantNumbers);
                }
                for (const [tenantId, numbers] of numbersByTenant) {
                    const uniqueNumbers = new Set(numbers);
                    expect(uniqueNumbers.size).toBe(numbers.length);
                }
            }), { numRuns: 100 });
        });
        it('should follow the DN-YYYY-NNNN format', () => {
            fc.assert(fc.property(fc.uuid(), (tenantId) => {
                const generator = new DebitNoteNumberGenerator();
                const number = generator.generateDebitNoteNumber(tenantId);
                const pattern = /^DN-\d{4}-\d{4}$/;
                expect(number).toMatch(pattern);
            }), { numRuns: 100 });
        });
        it('should increment sequence numbers correctly', () => {
            fc.assert(fc.property(fc.uuid(), fc.integer({ min: 2, max: 50 }), (tenantId, count) => {
                const generator = new DebitNoteNumberGenerator();
                const numbers = [];
                for (let i = 0; i < count; i++) {
                    numbers.push(generator.generateDebitNoteNumber(tenantId));
                }
                const sequences = numbers.map(n => {
                    const match = n.match(/DN-\d{4}-(\d{4})/);
                    return match ? parseInt(match[1], 10) : 0;
                });
                for (let i = 1; i < sequences.length; i++) {
                    expect(sequences[i]).toBe(sequences[i - 1] + 1);
                }
            }), { numRuns: 100 });
        });
    });
    describe('Property 14: QC Approval Updates GRN Status', () => {
        function approveQCReport(qcReport, transaction, approverUserId) {
            if (qcReport.status === 'APPROVED') {
                throw new Error('QC Report is already approved');
            }
            const updatedQCReport = {
                ...qcReport,
                status: 'APPROVED',
                approvedAt: new Date(),
                approvedBy: approverUserId,
            };
            const updatedTransaction = {
                ...transaction,
                qcStatus: 'COMPLETED',
                qcReportId: qcReport.id,
            };
            return { qcReport: updatedQCReport, transaction: updatedTransaction };
        }
        it('should update transaction qcStatus to COMPLETED on approval', () => {
            fc.assert(fc.property(fc.uuid(), fc.uuid(), fc.uuid(), (qcReportId, transactionId, approverUserId) => {
                const qcReport = {
                    id: qcReportId,
                    transactionId,
                    status: 'DRAFT',
                    approvedAt: null,
                    approvedBy: null,
                };
                const transaction = {
                    id: transactionId,
                    qcStatus: 'PENDING',
                    qcReportId: null,
                };
                const result = approveQCReport(qcReport, transaction, approverUserId);
                expect(result.transaction.qcStatus).toBe('COMPLETED');
                expect(result.transaction.qcReportId).toBe(qcReportId);
            }), { numRuns: 100 });
        });
        it('should update QC Report status to APPROVED', () => {
            fc.assert(fc.property(fc.uuid(), fc.uuid(), fc.uuid(), (qcReportId, transactionId, approverUserId) => {
                const qcReport = {
                    id: qcReportId,
                    transactionId,
                    status: 'DRAFT',
                    approvedAt: null,
                    approvedBy: null,
                };
                const transaction = {
                    id: transactionId,
                    qcStatus: 'PENDING',
                    qcReportId: null,
                };
                const result = approveQCReport(qcReport, transaction, approverUserId);
                expect(result.qcReport.status).toBe('APPROVED');
                expect(result.qcReport.approvedBy).toBe(approverUserId);
                expect(result.qcReport.approvedAt).not.toBeNull();
            }), { numRuns: 100 });
        });
        it('should throw error when approving already approved QC Report', () => {
            fc.assert(fc.property(fc.uuid(), fc.uuid(), fc.uuid(), (qcReportId, transactionId, approverUserId) => {
                const qcReport = {
                    id: qcReportId,
                    transactionId,
                    status: 'APPROVED',
                    approvedAt: new Date(),
                    approvedBy: 'previous-approver',
                };
                const transaction = {
                    id: transactionId,
                    qcStatus: 'COMPLETED',
                    qcReportId: qcReportId,
                };
                expect(() => approveQCReport(qcReport, transaction, approverUserId)).toThrow('QC Report is already approved');
            }), { numRuns: 100 });
        });
        it('should link QC Report ID to transaction', () => {
            fc.assert(fc.property(fc.uuid(), fc.uuid(), fc.uuid(), (qcReportId, transactionId, approverUserId) => {
                const qcReport = {
                    id: qcReportId,
                    transactionId,
                    status: 'DRAFT',
                    approvedAt: null,
                    approvedBy: null,
                };
                const transaction = {
                    id: transactionId,
                    qcStatus: null,
                    qcReportId: null,
                };
                const result = approveQCReport(qcReport, transaction, approverUserId);
                expect(result.transaction.qcReportId).toBe(qcReportId);
            }), { numRuns: 100 });
        });
    });
});
//# sourceMappingURL=qc-debit-note.property.spec.js.map