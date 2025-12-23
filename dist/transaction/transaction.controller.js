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
exports.TransactionController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const transaction_service_1 = require("./transaction.service");
let TransactionController = class TransactionController {
    constructor(transactionService) {
        this.transactionService = transactionService;
    }
    async createTransaction(dto) {
        return this.transactionService.createTransaction(dto);
    }
    async getActiveTransactions(tenantId) {
        const tenant = tenantId || 'test-tenant-2';
        return this.transactionService.getActiveTransactions(tenant);
    }
    async getDashboardStats(tenantId) {
        const tenant = tenantId || 'test-tenant-2';
        return this.transactionService.getDashboardStats(tenant);
    }
    async getCompletedTransactionsForQC(tenantId) {
        const tenant = tenantId || 'test-tenant-2';
        return this.transactionService.getCompletedTransactionsForQC(tenant);
    }
    async getCompletedTransactions(tenantId) {
        const tenant = tenantId || 'test-tenant-2';
        return this.transactionService.getCompletedTransactions(tenant);
    }
    async getTransactionById(id) {
        return this.transactionService.getTransactionById(id);
    }
    async saveStepData(id, dto) {
        return this.transactionService.saveStepData(id, dto);
    }
    async completeTransaction(id, userId) {
        return this.transactionService.completeTransaction(id, userId || 'system');
    }
    async getDraftTransaction(id) {
        return this.transactionService.getDraftTransaction(id);
    }
    async getTransactions(tenantId, status) {
        const tenant = tenantId || 'test-tenant-2';
        if (status === 'completed') {
            return this.transactionService.getCompletedTransactions(tenant);
        }
        else if (status === 'active') {
            return this.transactionService.getActiveTransactions(tenant);
        }
        return this.transactionService.getAllTransactions(tenant);
    }
};
exports.TransactionController = TransactionController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new transaction' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Transaction created successfully' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TransactionController.prototype, "createTransaction", null);
__decorate([
    (0, common_1.Get)('active'),
    (0, swagger_1.ApiOperation)({ summary: 'Get active transactions for dashboard' }),
    (0, swagger_1.ApiQuery)({ name: 'tenantId', required: false }),
    __param(0, (0, common_1.Query)('tenantId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TransactionController.prototype, "getActiveTransactions", null);
__decorate([
    (0, common_1.Get)('stats'),
    (0, swagger_1.ApiOperation)({ summary: 'Get dashboard statistics' }),
    (0, swagger_1.ApiQuery)({ name: 'tenantId', required: false }),
    __param(0, (0, common_1.Query)('tenantId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TransactionController.prototype, "getDashboardStats", null);
__decorate([
    (0, common_1.Get)('completed-for-qc'),
    (0, swagger_1.ApiOperation)({ summary: 'Get completed transactions pending QC' }),
    (0, swagger_1.ApiQuery)({ name: 'tenantId', required: false }),
    __param(0, (0, common_1.Query)('tenantId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TransactionController.prototype, "getCompletedTransactionsForQC", null);
__decorate([
    (0, common_1.Get)('completed'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all completed transactions' }),
    (0, swagger_1.ApiQuery)({ name: 'tenantId', required: false }),
    __param(0, (0, common_1.Query)('tenantId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TransactionController.prototype, "getCompletedTransactions", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get transaction by ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Transaction found' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Transaction not found' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TransactionController.prototype, "getTransactionById", null);
__decorate([
    (0, common_1.Put)(':id/step'),
    (0, swagger_1.ApiOperation)({ summary: 'Save step data for a transaction' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Step data saved successfully' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], TransactionController.prototype, "saveStepData", null);
__decorate([
    (0, common_1.Put)(':id/complete'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Complete a transaction' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Transaction completed successfully' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], TransactionController.prototype, "completeTransaction", null);
__decorate([
    (0, common_1.Get)(':id/draft'),
    (0, swagger_1.ApiOperation)({ summary: 'Get draft transaction for restoration' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TransactionController.prototype, "getDraftTransaction", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get all transactions' }),
    (0, swagger_1.ApiQuery)({ name: 'tenantId', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'status', required: false }),
    __param(0, (0, common_1.Query)('tenantId')),
    __param(1, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], TransactionController.prototype, "getTransactions", null);
exports.TransactionController = TransactionController = __decorate([
    (0, swagger_1.ApiTags)('Transactions'),
    (0, common_1.Controller)('transactions'),
    __metadata("design:paramtypes", [transaction_service_1.TransactionService])
], TransactionController);
//# sourceMappingURL=transaction.controller.js.map