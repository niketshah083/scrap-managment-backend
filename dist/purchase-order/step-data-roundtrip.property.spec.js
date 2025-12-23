"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fc = require("fast-check");
class MockTransactionStorage {
    constructor() {
        this.storage = new Map();
    }
    saveStepData(transactionId, stepData) {
        if (!this.storage.has(transactionId)) {
            this.storage.set(transactionId, {});
        }
        const txData = this.storage.get(transactionId);
        txData[stepData.stepNumber] = {
            ...stepData,
            timestamp: new Date(stepData.timestamp.toISOString())
        };
    }
    loadStepData(transactionId, stepNumber) {
        const txData = this.storage.get(transactionId);
        if (!txData || !txData[stepNumber])
            return null;
        return txData[stepNumber];
    }
    loadAllStepData(transactionId) {
        return this.storage.get(transactionId) || null;
    }
    clear() {
        this.storage.clear();
    }
}
function serializeStepData(stepData) {
    return JSON.stringify({
        ...stepData,
        timestamp: stepData.timestamp.toISOString()
    });
}
function deserializeStepData(json) {
    const parsed = JSON.parse(json);
    return {
        ...parsed,
        timestamp: new Date(parsed.timestamp)
    };
}
const fileMetadataArb = fc.record({
    id: fc.uuid(),
    name: fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789._-'), { minLength: 5, maxLength: 30 }),
    size: fc.integer({ min: 1024, max: 10485760 }),
    mimeType: fc.constantFrom('image/jpeg', 'image/png', 'application/pdf', 'image/webp')
});
const stepDataValueArb = fc.oneof(fc.string({ minLength: 1, maxLength: 100 }), fc.integer({ min: 0, max: 100000 }), fc.double({ min: 0, max: 100000, noNaN: true }), fc.boolean());
const stepDataRecordArb = fc.dictionary(fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz_'), { minLength: 3, maxLength: 20 }), stepDataValueArb, { minKeys: 1, maxKeys: 10 });
const stepDataArb = fc.record({
    stepNumber: fc.integer({ min: 0, max: 10 }),
    data: stepDataRecordArb,
    files: fc.array(fileMetadataArb, { minLength: 0, maxLength: 5 }),
    timestamp: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
    userId: fc.uuid()
});
describe('Step Data Persistence Property Tests', () => {
    describe('Property 5: Step Data Persistence Round-Trip', () => {
        let storage;
        beforeEach(() => {
            storage = new MockTransactionStorage();
        });
        it('should preserve all step data fields after save and load', () => {
            fc.assert(fc.property(fc.uuid(), stepDataArb, (transactionId, stepData) => {
                storage.saveStepData(transactionId, stepData);
                const loaded = storage.loadStepData(transactionId, stepData.stepNumber);
                expect(loaded).not.toBeNull();
                expect(loaded.stepNumber).toBe(stepData.stepNumber);
                expect(loaded.userId).toBe(stepData.userId);
                expect(loaded.timestamp.getTime()).toBe(stepData.timestamp.getTime());
                expect(loaded.data).toEqual(stepData.data);
                expect(loaded.files).toEqual(stepData.files);
                return true;
            }), { numRuns: 100 });
        });
        it('should preserve step data through JSON serialization round-trip', () => {
            fc.assert(fc.property(stepDataArb, (stepData) => {
                const serialized = serializeStepData(stepData);
                const deserialized = deserializeStepData(serialized);
                expect(deserialized.stepNumber).toBe(stepData.stepNumber);
                expect(deserialized.userId).toBe(stepData.userId);
                expect(deserialized.timestamp.getTime()).toBe(stepData.timestamp.getTime());
                expect(deserialized.data).toEqual(stepData.data);
                expect(deserialized.files).toEqual(stepData.files);
                return true;
            }), { numRuns: 100 });
        });
        it('should preserve multiple steps for same transaction', () => {
            fc.assert(fc.property(fc.uuid(), fc.array(stepDataArb, { minLength: 2, maxLength: 7 }), (transactionId, stepsData) => {
                const uniqueSteps = stepsData.reduce((acc, step, index) => {
                    acc.push({ ...step, stepNumber: index });
                    return acc;
                }, []);
                uniqueSteps.forEach(step => storage.saveStepData(transactionId, step));
                const allLoaded = storage.loadAllStepData(transactionId);
                expect(allLoaded).not.toBeNull();
                expect(Object.keys(allLoaded).length).toBe(uniqueSteps.length);
                uniqueSteps.forEach(step => {
                    const loaded = allLoaded[step.stepNumber];
                    expect(loaded).toBeDefined();
                    expect(loaded.userId).toBe(step.userId);
                    expect(loaded.data).toEqual(step.data);
                });
                return true;
            }), { numRuns: 100 });
        });
        it('should preserve file metadata exactly', () => {
            fc.assert(fc.property(fc.uuid(), fc.integer({ min: 0, max: 10 }), fc.array(fileMetadataArb, { minLength: 1, maxLength: 5 }), fc.uuid(), (transactionId, stepNumber, files, userId) => {
                const stepData = {
                    stepNumber,
                    data: { test: 'value' },
                    files,
                    timestamp: new Date(),
                    userId
                };
                storage.saveStepData(transactionId, stepData);
                const loaded = storage.loadStepData(transactionId, stepNumber);
                expect(loaded.files.length).toBe(files.length);
                files.forEach((file, index) => {
                    expect(loaded.files[index].id).toBe(file.id);
                    expect(loaded.files[index].name).toBe(file.name);
                    expect(loaded.files[index].size).toBe(file.size);
                    expect(loaded.files[index].mimeType).toBe(file.mimeType);
                });
                return true;
            }), { numRuns: 100 });
        });
        it('should preserve timestamp precision', () => {
            fc.assert(fc.property(fc.uuid(), stepDataArb, (transactionId, stepData) => {
                storage.saveStepData(transactionId, stepData);
                const loaded = storage.loadStepData(transactionId, stepData.stepNumber);
                const originalMs = stepData.timestamp.getTime();
                const loadedMs = loaded.timestamp.getTime();
                expect(loadedMs).toBe(originalMs);
                return loadedMs === originalMs;
            }), { numRuns: 100 });
        });
    });
});
//# sourceMappingURL=step-data-roundtrip.property.spec.js.map