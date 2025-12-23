"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QCModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const qc_controller_1 = require("./qc.controller");
const qc_service_1 = require("./qc.service");
const qc_report_entity_1 = require("../entities/qc-report.entity");
const debit_note_entity_1 = require("../entities/debit-note.entity");
const transaction_entity_1 = require("../entities/transaction.entity");
let QCModule = class QCModule {
};
exports.QCModule = QCModule;
exports.QCModule = QCModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([qc_report_entity_1.QCReport, debit_note_entity_1.DebitNote, transaction_entity_1.Transaction]),
        ],
        controllers: [qc_controller_1.QCController],
        providers: [qc_service_1.QCService],
        exports: [qc_service_1.QCService],
    })
], QCModule);
//# sourceMappingURL=qc.module.js.map