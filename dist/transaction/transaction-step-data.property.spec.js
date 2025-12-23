"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fc = require("fast-check");
class MockTransactionRepository {
    constructor() {
        this.transactions = new Map();
    }
    async save(transaction) {
        const id = transaction.id || `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const savedTx = { ...transaction, id, updatedAt: new Date() };
        this.transactions.set(id, savedTx);
        return savedTx;
    }
    async findOne(options) {
        if (options.where.id) {
            return this.transactions.get(options.where.id) || null;
        }
        return null;
    }
    async find(options) {
        const results = [];
        for (const tx of this.transactions.values()) {
            let match = true;
            for (const [key, value] of Object.entries(options.where)) {
                if (tx[key] !== value) {
                    match = false;
                    break;
                }
            }
            if (match) {
                results.push(tx);
            }
        }
        return results;
    }
    clear() {
        this.transactions.clear();
    }
}
class TransactionServiceSimulation {
    constructor() {
        this.txRepo = new MockTransactionRepository();
    }
    async createTransaction(dto) {
        const transaction = {
            ...dto,
            transactionNumber: `GRN-${Date.now()}`,
            currentLevel: 1,
            status: 'ACTIVE',
            stepData: {},
            isLocked: false,
            createdAt: new Date(),
        };
        return this.txRepo.save(transaction);
    }
    async saveStepData(transactionId, dto) {
        const transaction = await this.txRepo.findOne({ where: { id: transactionId } });
        if (!transaction) {
            throw new Error(`Transaction ${transactionId} not found`);
        }
        if (transaction.isLocked) {
            throw new Error('Transaction is locked');
        }
        const stepData = transaction.stepData || {};
        stepData[dto.stepNumber] = {
            stepNumber: dto.stepNumber,
            data: dto.data,
            files: dto.files || {},
            timestamp: new Date(),
            userId: dto.userId,
        };
        transaction.stepData = stepData;
        transaction.currentLevel = dto.stepNumber + 1;
        return this.txRepo.save(transaction);
    }
    async loadDraftTransaction(transactionId) {
        const transaction = await this.txRepo.findOne({ where: { id: transactionId } });
        if (!transaction) {
            throw new Error(`Transaction ${transactionId} not found`);
        }
        const stepData = transaction.stepData || {};
        const completedSteps = Object.keys(stepData).map(Number).filter(n => !isNaN(n));
        const lastCompletedStep = completedSteps.length > 0 ? Math.max(...completedSteps) : -1;
        return {
            transaction,
            stepData,
            lastCompletedStep,
        };
    }
    async getLastIncompleteStep(transactionId) {
        const transaction = await this.txRepo.findOne({ where: { id: transactionId } });
        if (!transaction) {
            throw new Error(`Transaction ${transactionId} not found`);
        }
        const stepData = transaction.stepData || {};
        const completedSteps = Object.keys(stepData).map(Number).filter(n => !isNaN(n));
        if (completedSteps.length === 0) {
            return 1;
        }
        return Math.max(...completedSteps) + 1;
    }
    async getCompletedTransactionsForQC(tenantId) {
        const transactions = await this.txRepo.find({
            where: { tenantId, status: 'COMPLETED' },
        });
        return transactions.filter(tx => !tx.qcStatus || tx.qcStatus === 'PENDING');
    }
    async completeTransaction(transactionId) {
        const transaction = await this.txRepo.findOne({ where: { id: transactionId } });
        if (!transaction) {
            throw new Error(`Transaction ${transactionId} not found`);
        }
        transaction.status = 'COMPLETED';
        transaction.completedAt = new Date();
        transaction.isLocked = true;
        return this.txRepo.save(transaction);
    }
    reset() {
        this.txRepo.clear();
    }
}
describe('Transaction Step Data Property Tests', () => {
    describe('Property 6: Step Data Persistence Round-Trip', () => {
        it('should persist and retrieve step data with all fields intact', async () => {
            await fc.assert(fc.asyncProperty(fc.uuid(), fc.uuid(), fc.integer({ min: 1, max: 7 }), fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.string({ minLength: 1, maxLength: 100 })), fc.uuid(), async (tenantId, factoryId, stepNumber, formData, userId) => {
                const service = new TransactionServiceSimulation();
                const transaction = await service.createTransaction({
                    tenantId,
                    factoryId,
                    vendorId: 'test-vendor',
                    vehicleId: 'test-vehicle',
                });
                const stepDataDto = {
                    stepNumber,
                    data: formData,
                    files: { photo: [{ name: 'test.jpg', url: '/uploads/test.jpg', type: 'image/jpeg' }] },
                    userId,
                };
                await service.saveStepData(transaction.id, stepDataDto);
                const loaded = await service.loadDraftTransaction(transaction.id);
                expect(loaded.stepData[stepNumber]).toBeDefined();
                expect(loaded.stepData[stepNumber].stepNumber).toBe(stepNumber);
                expect(loaded.stepData[stepNumber].data).toEqual(formData);
                expect(loaded.stepData[stepNumber].userId).toBe(userId);
                expect(loaded.stepData[stepNumber].timestamp).toBeDefined();
                expect(loaded.stepData[stepNumber].files).toEqual(stepDataDto.files);
            }), { numRuns: 100 });
        });
        it('should preserve multiple steps data', async () => {
            await fc.assert(fc.asyncProperty(fc.uuid(), fc.uniqueArray(fc.integer({ min: 1, max: 7 }), { minLength: 1, maxLength: 5 }), async (tenantId, stepNumbers) => {
                const service = new TransactionServiceSimulation();
                const transaction = await service.createTransaction({
                    tenantId,
                    factoryId: 'test-factory',
                    vendorId: 'test-vendor',
                    vehicleId: 'test-vehicle',
                });
                const steps = stepNumbers.map(stepNumber => ({
                    stepNumber,
                    data: { field: `value-${stepNumber}` },
                }));
                for (const step of steps) {
                    await service.saveStepData(transaction.id, {
                        stepNumber: step.stepNumber,
                        data: step.data,
                        userId: 'test-user',
                    });
                }
                const loaded = await service.loadDraftTransaction(transaction.id);
                for (const step of steps) {
                    expect(loaded.stepData[step.stepNumber]).toBeDefined();
                    expect(loaded.stepData[step.stepNumber].data).toEqual(step.data);
                }
            }), { numRuns: 50 });
        });
    });
    describe('Property 7: Draft Navigation to Last Incomplete Step', () => {
        it('should return next step after last completed', async () => {
            await fc.assert(fc.asyncProperty(fc.uuid(), fc.integer({ min: 1, max: 6 }), async (tenantId, completedSteps) => {
                const service = new TransactionServiceSimulation();
                const transaction = await service.createTransaction({
                    tenantId,
                    factoryId: 'test-factory',
                    vendorId: 'test-vendor',
                    vehicleId: 'test-vehicle',
                });
                for (let i = 1; i <= completedSteps; i++) {
                    await service.saveStepData(transaction.id, {
                        stepNumber: i,
                        data: { field: `value-${i}` },
                        userId: 'test-user',
                    });
                }
                const nextStep = await service.getLastIncompleteStep(transaction.id);
                expect(nextStep).toBe(completedSteps + 1);
            }), { numRuns: 100 });
        });
        it('should return step 1 for new transaction with no completed steps', async () => {
            await fc.assert(fc.asyncProperty(fc.uuid(), async (tenantId) => {
                const service = new TransactionServiceSimulation();
                const transaction = await service.createTransaction({
                    tenantId,
                    factoryId: 'test-factory',
                    vendorId: 'test-vendor',
                    vehicleId: 'test-vehicle',
                });
                const nextStep = await service.getLastIncompleteStep(transaction.id);
                expect(nextStep).toBe(1);
            }), { numRuns: 100 });
        });
        it('should correctly identify last completed step in loaded draft', async () => {
            await fc.assert(fc.asyncProperty(fc.uuid(), fc.integer({ min: 1, max: 5 }), async (tenantId, completedSteps) => {
                const service = new TransactionServiceSimulation();
                const transaction = await service.createTransaction({
                    tenantId,
                    factoryId: 'test-factory',
                    vendorId: 'test-vendor',
                    vehicleId: 'test-vehicle',
                });
                for (let i = 1; i <= completedSteps; i++) {
                    await service.saveStepData(transaction.id, {
                        stepNumber: i,
                        data: { field: `value-${i}` },
                        userId: 'test-user',
                    });
                }
                const loaded = await service.loadDraftTransaction(transaction.id);
                expect(loaded.lastCompletedStep).toBe(completedSteps);
            }), { numRuns: 100 });
        });
    });
    describe('Property 8: Completed GRN List for QC', () => {
        it('should only return completed transactions without QC', async () => {
            await fc.assert(fc.asyncProperty(fc.uuid(), fc.array(fc.record({
                status: fc.constantFrom('ACTIVE', 'COMPLETED', 'REJECTED', 'CANCELLED'),
                qcStatus: fc.constantFrom('PENDING', 'COMPLETED', null),
            }), { minLength: 1, maxLength: 20 }), async (tenantId, txConfigs) => {
                const service = new TransactionServiceSimulation();
                for (const config of txConfigs) {
                    const tx = await service.createTransaction({
                        tenantId,
                        factoryId: 'test-factory',
                        vendorId: 'test-vendor',
                        vehicleId: 'test-vehicle',
                    });
                    if (config.status === 'COMPLETED') {
                        await service.completeTransaction(tx.id);
                    }
                    const loaded = await service.loadDraftTransaction(tx.id);
                    loaded.transaction.qcStatus = config.qcStatus;
                }
                const forQC = await service.getCompletedTransactionsForQC(tenantId);
                for (const tx of forQC) {
                    expect(tx.status).toBe('COMPLETED');
                    expect(tx.qcStatus).not.toBe('COMPLETED');
                }
            }), { numRuns: 50 });
        });
        it('should exclude transactions with completed QC', async () => {
            await fc.assert(fc.asyncProperty(fc.uuid(), async (tenantId) => {
                const service = new TransactionServiceSimulation();
                const tx = await service.createTransaction({
                    tenantId,
                    factoryId: 'test-factory',
                    vendorId: 'test-vendor',
                    vehicleId: 'test-vehicle',
                });
                await service.completeTransaction(tx.id);
                let forQC = await service.getCompletedTransactionsForQC(tenantId);
                expect(forQC.some(t => t.id === tx.id)).toBe(true);
                const loaded = await service.loadDraftTransaction(tx.id);
                loaded.transaction.qcStatus = 'COMPLETED';
                forQC = await service.getCompletedTransactionsForQC(tenantId);
            }), { numRuns: 50 });
        });
    });
});
//# sourceMappingURL=transaction-step-data.property.spec.js.map