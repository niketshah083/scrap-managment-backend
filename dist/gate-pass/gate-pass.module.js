"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GatePassModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const gate_pass_service_1 = require("./gate-pass.service");
const gate_pass_controller_1 = require("./gate-pass.controller");
const transaction_entity_1 = require("../entities/transaction.entity");
const vehicle_entity_1 = require("../entities/vehicle.entity");
const audit_log_entity_1 = require("../entities/audit-log.entity");
let GatePassModule = class GatePassModule {
};
exports.GatePassModule = GatePassModule;
exports.GatePassModule = GatePassModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([transaction_entity_1.Transaction, vehicle_entity_1.Vehicle, audit_log_entity_1.AuditLog])
        ],
        controllers: [gate_pass_controller_1.GatePassController],
        providers: [gate_pass_service_1.GatePassService],
        exports: [gate_pass_service_1.GatePassService]
    })
], GatePassModule);
//# sourceMappingURL=gate-pass.module.js.map