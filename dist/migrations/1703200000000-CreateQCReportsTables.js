"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateQCReportsTables1703200000000 = void 0;
const typeorm_1 = require("typeorm");
class CreateQCReportsTables1703200000000 {
    constructor() {
        this.name = 'CreateQCReportsTables1703200000000';
    }
    async up(queryRunner) {
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'qc_reports',
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    generationStrategy: 'uuid',
                    default: 'uuid_generate_v4()',
                },
                {
                    name: 'transactionId',
                    type: 'uuid',
                    isNullable: false,
                },
                {
                    name: 'tenantId',
                    type: 'uuid',
                    isNullable: false,
                },
                {
                    name: 'lineItems',
                    type: 'json',
                    isNullable: false,
                },
                {
                    name: 'totals',
                    type: 'json',
                    isNullable: false,
                },
                {
                    name: 'remarks',
                    type: 'text',
                    isNullable: true,
                },
                {
                    name: 'labTechnician',
                    type: 'varchar',
                    length: '100',
                    isNullable: false,
                },
                {
                    name: 'verifiedBy',
                    type: 'varchar',
                    length: '100',
                    isNullable: true,
                },
                {
                    name: 'status',
                    type: 'enum',
                    enum: ['DRAFT', 'APPROVED'],
                    default: "'DRAFT'",
                },
                {
                    name: 'approvedAt',
                    type: 'timestamp',
                    isNullable: true,
                },
                {
                    name: 'approvedBy',
                    type: 'uuid',
                    isNullable: true,
                },
                {
                    name: 'debitNoteId',
                    type: 'uuid',
                    isNullable: true,
                },
                {
                    name: 'createdAt',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP',
                },
                {
                    name: 'updatedAt',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP',
                    onUpdate: 'CURRENT_TIMESTAMP',
                },
            ],
        }), true);
        await queryRunner.createIndex('qc_reports', new typeorm_1.TableIndex({
            name: 'IDX_qc_reports_transactionId',
            columnNames: ['transactionId'],
        }));
        await queryRunner.createIndex('qc_reports', new typeorm_1.TableIndex({
            name: 'IDX_qc_reports_tenantId',
            columnNames: ['tenantId'],
        }));
        await queryRunner.createIndex('qc_reports', new typeorm_1.TableIndex({
            name: 'IDX_qc_reports_status',
            columnNames: ['status'],
        }));
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'debit_notes',
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    generationStrategy: 'uuid',
                    default: 'uuid_generate_v4()',
                },
                {
                    name: 'debitNoteNumber',
                    type: 'varchar',
                    length: '50',
                    isUnique: true,
                    isNullable: false,
                },
                {
                    name: 'qcReportId',
                    type: 'uuid',
                    isNullable: false,
                },
                {
                    name: 'transactionId',
                    type: 'uuid',
                    isNullable: false,
                },
                {
                    name: 'vendorId',
                    type: 'uuid',
                    isNullable: false,
                },
                {
                    name: 'tenantId',
                    type: 'uuid',
                    isNullable: false,
                },
                {
                    name: 'weightDifference',
                    type: 'decimal',
                    precision: 12,
                    scale: 2,
                    default: 0,
                },
                {
                    name: 'qualityDifference',
                    type: 'decimal',
                    precision: 12,
                    scale: 2,
                    default: 0,
                },
                {
                    name: 'bardanaDeduction',
                    type: 'decimal',
                    precision: 12,
                    scale: 2,
                    default: 0,
                },
                {
                    name: 'rejectionAmount',
                    type: 'decimal',
                    precision: 12,
                    scale: 2,
                    default: 0,
                },
                {
                    name: 'grandTotal',
                    type: 'decimal',
                    precision: 12,
                    scale: 2,
                    default: 0,
                },
                {
                    name: 'status',
                    type: 'enum',
                    enum: ['GENERATED', 'SENT', 'ACKNOWLEDGED'],
                    default: "'GENERATED'",
                },
                {
                    name: 'createdAt',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP',
                },
                {
                    name: 'updatedAt',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP',
                    onUpdate: 'CURRENT_TIMESTAMP',
                },
            ],
        }), true);
        await queryRunner.createIndex('debit_notes', new typeorm_1.TableIndex({
            name: 'IDX_debit_notes_qcReportId',
            columnNames: ['qcReportId'],
        }));
        await queryRunner.createIndex('debit_notes', new typeorm_1.TableIndex({
            name: 'IDX_debit_notes_transactionId',
            columnNames: ['transactionId'],
        }));
        await queryRunner.createIndex('debit_notes', new typeorm_1.TableIndex({
            name: 'IDX_debit_notes_vendorId',
            columnNames: ['vendorId'],
        }));
        await queryRunner.createIndex('debit_notes', new typeorm_1.TableIndex({
            name: 'IDX_debit_notes_tenantId',
            columnNames: ['tenantId'],
        }));
        await queryRunner.query(`
      ALTER TABLE transactions 
      ADD COLUMN IF NOT EXISTS qcStatus VARCHAR(20) DEFAULT NULL
    `);
        await queryRunner.query(`
      ALTER TABLE transactions 
      ADD COLUMN IF NOT EXISTS qcReportId UUID DEFAULT NULL
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE transactions DROP COLUMN IF EXISTS qcStatus`);
        await queryRunner.query(`ALTER TABLE transactions DROP COLUMN IF EXISTS qcReportId`);
        await queryRunner.dropIndex('debit_notes', 'IDX_debit_notes_tenantId');
        await queryRunner.dropIndex('debit_notes', 'IDX_debit_notes_vendorId');
        await queryRunner.dropIndex('debit_notes', 'IDX_debit_notes_transactionId');
        await queryRunner.dropIndex('debit_notes', 'IDX_debit_notes_qcReportId');
        await queryRunner.dropTable('debit_notes');
        await queryRunner.dropIndex('qc_reports', 'IDX_qc_reports_status');
        await queryRunner.dropIndex('qc_reports', 'IDX_qc_reports_tenantId');
        await queryRunner.dropIndex('qc_reports', 'IDX_qc_reports_transactionId');
        await queryRunner.dropTable('qc_reports');
    }
}
exports.CreateQCReportsTables1703200000000 = CreateQCReportsTables1703200000000;
//# sourceMappingURL=1703200000000-CreateQCReportsTables.js.map