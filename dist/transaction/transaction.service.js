"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const transaction_entity_1 = require("../entities/transaction.entity");
const purchase_order_entity_1 = require("../entities/purchase-order.entity");
const vendor_entity_1 = require("../entities/vendor.entity");
const audit_service_1 = require("../audit/audit.service");
let TransactionService = class TransactionService {
    constructor(transactionRepository, poRepository, vendorRepository, auditService) {
        this.transactionRepository = transactionRepository;
        this.poRepository = poRepository;
        this.vendorRepository = vendorRepository;
        this.auditService = auditService;
    }
    generateTransactionNumber() {
        const timestamp = Date.now().toString().slice(-8);
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `GRN-${timestamp}-${random}`;
    }
    async createTransaction(dto) {
        const transactionNumber = this.generateTransactionNumber();
        const vehicleId = dto.vehicleId || `VEH-${Date.now()}`;
        const transaction = this.transactionRepository.create({
            tenantId: dto.tenantId,
            factoryId: dto.factoryId,
            vendorId: dto.vendorId,
            vehicleId: vehicleId,
            purchaseOrderId: dto.purchaseOrderId,
            transactionNumber,
            currentLevel: transaction_entity_1.OperationalLevel.L1_VENDOR_DISPATCH,
            status: transaction_entity_1.TransactionStatus.ACTIVE,
            stepData: {},
            levelData: {},
        });
        if (dto.vehicleNumber || dto.driverName) {
            transaction.stepData = {
                0: {
                    stepNumber: 0,
                    data: {
                        vehicleNumber: dto.vehicleNumber,
                        driverName: dto.driverName,
                        driverMobile: dto.driverMobile,
                    },
                    files: {},
                    timestamp: new Date(),
                    userId: dto.createdBy || 'system',
                }
            };
        }
        const savedTransaction = await this.transactionRepository.save(transaction);
        await this.auditService.logTransactionCreation(dto.createdBy || 'system', savedTransaction.id, {
            transactionNumber: savedTransaction.transactionNumber,
            tenantId: savedTransaction.tenantId,
            factoryId: savedTransaction.factoryId,
            vendorId: savedTransaction.vendorId,
            purchaseOrderId: savedTransaction.purchaseOrderId,
            vehicleNumber: dto.vehicleNumber,
            driverName: dto.driverName,
        });
        return savedTransaction;
    }
    async getActiveTransactions(tenantId) {
        const transactions = await this.transactionRepository.find({
            where: {
                tenantId,
                status: (0, typeorm_2.In)([transaction_entity_1.TransactionStatus.ACTIVE]),
            },
            relations: ['vendor', 'purchaseOrder'],
            order: { createdAt: 'DESC' },
            take: 20,
        });
        return transactions.map(tx => ({
            ...tx,
            vendorName: tx.vendor?.vendorName || 'Unknown Vendor',
            vehicleNumber: tx.stepData?.[1]?.data?.truck_number || tx.stepData?.[0]?.data?.vehicleNumber || 'N/A',
            poNumber: tx.purchaseOrder?.poNumber,
            materialType: tx.purchaseOrder?.materialType,
        }));
    }
    async getTransactionById(id) {
        const transaction = await this.transactionRepository.findOne({
            where: { id },
            relations: ['vendor', 'purchaseOrder'],
        });
        if (!transaction) {
            throw new common_1.NotFoundException(`Transaction ${id} not found`);
        }
        return {
            ...transaction,
            vendorName: transaction.vendor?.vendorName || 'Unknown Vendor',
            vehicleNumber: transaction.stepData?.[1]?.data?.truck_number || 'N/A',
            poNumber: transaction.purchaseOrder?.poNumber,
            materialType: transaction.purchaseOrder?.materialType,
        };
    }
    async saveStepData(transactionId, dto) {
        const transaction = await this.transactionRepository.findOne({
            where: { id: transactionId },
        });
        if (!transaction) {
            throw new common_1.NotFoundException(`Transaction ${transactionId} not found`);
        }
        if (transaction.isLocked) {
            throw new common_1.BadRequestException('Transaction is locked and cannot be modified');
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
        const levelMapping = {
            0: transaction_entity_1.OperationalLevel.L1_VENDOR_DISPATCH,
            1: transaction_entity_1.OperationalLevel.L2_GATE_ENTRY,
            2: transaction_entity_1.OperationalLevel.L3_WEIGHBRIDGE_GROSS,
            3: transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION,
            4: transaction_entity_1.OperationalLevel.L5_WEIGHBRIDGE_TARE,
            5: transaction_entity_1.OperationalLevel.L6_GRN_GENERATION,
            6: transaction_entity_1.OperationalLevel.L7_GATE_PASS_EXIT,
        };
        if (levelMapping[dto.stepNumber + 1]) {
            transaction.currentLevel = levelMapping[dto.stepNumber + 1];
        }
        if (dto.stepNumber === 2 && dto.data.gross_weight) {
            transaction.weighbridgeData = {
                ...transaction.weighbridgeData,
                grossWeight: parseFloat(dto.data.gross_weight),
                grossWeightTimestamp: new Date(),
                grossWeightOperator: dto.userId,
            };
        }
        if (dto.stepNumber === 4 && dto.data.tare_weight) {
            transaction.weighbridgeData = {
                ...transaction.weighbridgeData,
                tareWeight: parseFloat(dto.data.tare_weight),
                netWeight: (transaction.weighbridgeData?.grossWeight || 0) - parseFloat(dto.data.tare_weight),
                tareWeightTimestamp: new Date(),
                tareWeightOperator: dto.userId,
            };
        }
        if (dto.stepNumber === 3) {
            transaction.inspectionData = {
                ...transaction.inspectionData,
                grade: dto.data.quality_grade,
                contaminationLevel: dto.data.contamination ? parseFloat(dto.data.contamination) : undefined,
                moistureLevel: dto.data.moisture ? parseFloat(dto.data.moisture) : undefined,
                inspectorId: dto.userId,
                inspectionTimestamp: new Date(),
                qualityNotes: dto.data.inspection_notes,
            };
        }
        const savedTransaction = await this.transactionRepository.save(transaction);
        await this.auditService.logGRNStepSave(dto.userId, savedTransaction.id, dto.stepNumber, {
            data: dto.data,
            hasFiles: dto.files && Object.keys(dto.files).length > 0,
            currentLevel: savedTransaction.currentLevel,
        });
        return savedTransaction;
    }
    async completeTransaction(transactionId, userId) {
        const transaction = await this.transactionRepository.findOne({
            where: { id: transactionId },
            relations: ['purchaseOrder'],
        });
        if (!transaction) {
            throw new common_1.NotFoundException(`Transaction ${transactionId} not found`);
        }
        transaction.status = transaction_entity_1.TransactionStatus.COMPLETED;
        transaction.completedAt = new Date();
        transaction.isLocked = true;
        transaction.currentLevel = transaction_entity_1.OperationalLevel.L7_GATE_PASS_EXIT;
        if (transaction.purchaseOrderId && transaction.weighbridgeData?.netWeight) {
            const po = await this.poRepository.findOne({
                where: { id: transaction.purchaseOrderId },
            });
            if (po) {
                po.receivedQuantity = (po.receivedQuantity || 0) + transaction.weighbridgeData.netWeight;
                if (po.receivedQuantity >= po.orderedQuantity) {
                    po.status = purchase_order_entity_1.POStatus.COMPLETED;
                }
                else if (po.receivedQuantity > 0) {
                    po.status = purchase_order_entity_1.POStatus.PARTIAL;
                }
                await this.poRepository.save(po);
            }
        }
        const savedTransaction = await this.transactionRepository.save(transaction);
        await this.auditService.logGRNCompletion(userId, savedTransaction.id, {
            transactionNumber: savedTransaction.transactionNumber,
            status: savedTransaction.status,
            completedAt: savedTransaction.completedAt,
            netWeight: savedTransaction.weighbridgeData?.netWeight,
            purchaseOrderId: savedTransaction.purchaseOrderId,
        });
        return savedTransaction;
    }
    async getDashboardStats(tenantId) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [todayTransactions, activeTransactions, rejectedTransactions] = await Promise.all([
            this.transactionRepository.count({
                where: {
                    tenantId,
                    createdAt: today,
                },
            }),
            this.transactionRepository.find({
                where: {
                    tenantId,
                    status: transaction_entity_1.TransactionStatus.ACTIVE,
                },
            }),
            this.transactionRepository.count({
                where: {
                    tenantId,
                    status: transaction_entity_1.TransactionStatus.REJECTED,
                    createdAt: today,
                },
            }),
        ]);
        const completedToday = await this.transactionRepository.find({
            where: {
                tenantId,
                status: transaction_entity_1.TransactionStatus.COMPLETED,
            },
        });
        const totalWeight = completedToday.reduce((sum, tx) => {
            return sum + (tx.weighbridgeData?.netWeight || 0);
        }, 0);
        const pendingInspections = activeTransactions.filter(tx => tx.currentLevel === transaction_entity_1.OperationalLevel.L4_MATERIAL_INSPECTION).length;
        return {
            todayInward: todayTransactions || activeTransactions.length,
            totalWeight: totalWeight / 1000,
            pendingInspections,
            rejectedMaterials: rejectedTransactions,
        };
    }
    async getDraftTransaction(transactionId) {
        return this.transactionRepository.findOne({
            where: {
                id: transactionId,
                status: transaction_entity_1.TransactionStatus.ACTIVE,
            },
            relations: ['vendor', 'purchaseOrder'],
        });
    }
    async loadDraftTransaction(transactionId) {
        const transaction = await this.transactionRepository.findOne({
            where: { id: transactionId },
            relations: ['vendor', 'purchaseOrder'],
        });
        if (!transaction) {
            throw new common_1.NotFoundException(`Transaction ${transactionId} not found`);
        }
        const stepData = transaction.stepData || {};
        const completedSteps = Object.keys(stepData).map(Number).filter(n => !isNaN(n));
        const lastCompletedStep = completedSteps.length > 0 ? Math.max(...completedSteps) : -1;
        return {
            transaction: {
                ...transaction,
                vendorName: transaction.vendor?.vendorName || 'Unknown Vendor',
                vehicleNumber: stepData[1]?.data?.truck_number || stepData[0]?.data?.vehicleNumber || 'N/A',
                poNumber: transaction.purchaseOrder?.poNumber,
                materialType: transaction.purchaseOrder?.materialType,
            },
            stepData,
            lastCompletedStep,
        };
    }
    async getLastIncompleteStep(transactionId) {
        const transaction = await this.transactionRepository.findOne({
            where: { id: transactionId },
        });
        if (!transaction) {
            throw new common_1.NotFoundException(`Transaction ${transactionId} not found`);
        }
        const stepData = transaction.stepData || {};
        const completedSteps = Object.keys(stepData).map(Number).filter(n => !isNaN(n));
        if (completedSteps.length === 0) {
            return 1;
        }
        const maxCompletedStep = Math.max(...completedSteps);
        return maxCompletedStep + 1;
    }
    async getCompletedTransactionsForQC(tenantId) {
        const transactions = await this.transactionRepository.find({
            where: {
                tenantId,
                status: transaction_entity_1.TransactionStatus.COMPLETED,
            },
            relations: ['vendor', 'purchaseOrder'],
            order: { completedAt: 'DESC' },
        });
        return transactions
            .filter(tx => !tx.qcStatus || tx.qcStatus === 'PENDING')
            .map(tx => ({
            ...tx,
            vendorName: tx.vendor?.vendorName || 'Unknown Vendor',
            vehicleNumber: tx.stepData?.[1]?.data?.truck_number || 'N/A',
            poNumber: tx.purchaseOrder?.poNumber,
            materialType: tx.purchaseOrder?.materialType,
        }));
    }
    async getDraftTransactions(tenantId) {
        const transactions = await this.transactionRepository.find({
            where: {
                tenantId,
                status: transaction_entity_1.TransactionStatus.ACTIVE,
            },
            relations: ['vendor', 'purchaseOrder'],
            order: { updatedAt: 'DESC' },
        });
        return transactions.map(tx => ({
            ...tx,
            vendorName: tx.vendor?.vendorName || 'Unknown Vendor',
            vehicleNumber: tx.stepData?.[1]?.data?.truck_number || tx.stepData?.[0]?.data?.vehicleNumber || 'N/A',
            poNumber: tx.purchaseOrder?.poNumber,
            materialType: tx.purchaseOrder?.materialType,
        }));
    }
    async getCompletedTransactions(tenantId) {
        const where = { status: transaction_entity_1.TransactionStatus.COMPLETED };
        if (tenantId) {
            where.tenantId = tenantId;
        }
        const transactions = await this.transactionRepository.find({
            where,
            relations: ['vendor', 'purchaseOrder'],
            order: { completedAt: 'DESC' },
            take: 50,
        });
        return transactions.map(tx => ({
            ...tx,
            vendorName: tx.vendor?.vendorName || 'Unknown Vendor',
            vehicleNumber: tx.stepData?.[1]?.data?.truck_number || 'N/A',
            poNumber: tx.purchaseOrder?.poNumber,
            materialType: tx.purchaseOrder?.materialType,
        }));
    }
    async getAllTransactions(tenantId) {
        const where = {};
        if (tenantId) {
            where.tenantId = tenantId;
        }
        const transactions = await this.transactionRepository.find({
            where,
            relations: ['vendor', 'purchaseOrder'],
            order: { createdAt: 'DESC' },
            take: 100,
        });
        return transactions.map(tx => ({
            ...tx,
            vendorName: tx.vendor?.vendorName || 'Unknown Vendor',
            vehicleNumber: tx.stepData?.[1]?.data?.truck_number || tx.stepData?.[0]?.data?.vehicleNumber || 'N/A',
            poNumber: tx.purchaseOrder?.poNumber,
            materialType: tx.purchaseOrder?.materialType,
        }));
    }
};
exports.TransactionService = TransactionService;
exports.TransactionService = TransactionService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(transaction_entity_1.Transaction)),
    __param(1, (0, typeorm_1.InjectRepository)(purchase_order_entity_1.PurchaseOrder)),
    __param(2, (0, typeorm_1.InjectRepository)(vendor_entity_1.Vendor)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        audit_service_1.AuditService])
], TransactionService);
//# sourceMappingURL=transaction.service.js.map