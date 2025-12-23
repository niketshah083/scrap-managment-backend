"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreatePurchaseOrdersTable1703100000000 = void 0;
const typeorm_1 = require("typeorm");
class CreatePurchaseOrdersTable1703100000000 {
    constructor() {
        this.name = 'CreatePurchaseOrdersTable1703100000000';
    }
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE TYPE "po_status_enum" AS ENUM ('PENDING', 'PARTIAL', 'COMPLETED', 'CANCELLED', 'EXPIRED')
    `);
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'purchase_orders',
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    generationStrategy: 'uuid',
                    default: 'uuid_generate_v4()',
                },
                {
                    name: 'tenantId',
                    type: 'uuid',
                    isNullable: false,
                },
                {
                    name: 'poNumber',
                    type: 'varchar',
                    length: '50',
                    isNullable: false,
                },
                {
                    name: 'vendorId',
                    type: 'uuid',
                    isNullable: false,
                },
                {
                    name: 'materialType',
                    type: 'varchar',
                    length: '100',
                    isNullable: false,
                },
                {
                    name: 'materialDescription',
                    type: 'varchar',
                    length: '255',
                    isNullable: true,
                },
                {
                    name: 'orderedQuantity',
                    type: 'decimal',
                    precision: 12,
                    scale: 2,
                    isNullable: false,
                },
                {
                    name: 'receivedQuantity',
                    type: 'decimal',
                    precision: 12,
                    scale: 2,
                    default: 0,
                },
                {
                    name: 'rate',
                    type: 'decimal',
                    precision: 12,
                    scale: 2,
                    isNullable: false,
                },
                {
                    name: 'unit',
                    type: 'varchar',
                    length: '20',
                    default: "'KG'",
                },
                {
                    name: 'status',
                    type: 'po_status_enum',
                    default: "'PENDING'",
                },
                {
                    name: 'deliveryDate',
                    type: 'date',
                    isNullable: false,
                },
                {
                    name: 'notes',
                    type: 'text',
                    isNullable: true,
                },
                {
                    name: 'createdBy',
                    type: 'varchar',
                    length: '100',
                    isNullable: true,
                },
                {
                    name: 'isActive',
                    type: 'boolean',
                    default: true,
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
        await queryRunner.createIndex('purchase_orders', new typeorm_1.TableIndex({
            name: 'IDX_PO_TENANT_PONUMBER',
            columnNames: ['tenantId', 'poNumber'],
            isUnique: true,
        }));
        await queryRunner.createIndex('purchase_orders', new typeorm_1.TableIndex({
            name: 'IDX_PO_VENDOR',
            columnNames: ['vendorId'],
        }));
        await queryRunner.createIndex('purchase_orders', new typeorm_1.TableIndex({
            name: 'IDX_PO_STATUS',
            columnNames: ['status'],
        }));
        await queryRunner.createIndex('purchase_orders', new typeorm_1.TableIndex({
            name: 'IDX_PO_TENANT_STATUS',
            columnNames: ['tenantId', 'status'],
        }));
        await queryRunner.createForeignKey('purchase_orders', new typeorm_1.TableForeignKey({
            name: 'FK_PO_TENANT',
            columnNames: ['tenantId'],
            referencedTableName: 'tenants',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
        }));
        await queryRunner.createForeignKey('purchase_orders', new typeorm_1.TableForeignKey({
            name: 'FK_PO_VENDOR',
            columnNames: ['vendorId'],
            referencedTableName: 'vendors',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropForeignKey('purchase_orders', 'FK_PO_VENDOR');
        await queryRunner.dropForeignKey('purchase_orders', 'FK_PO_TENANT');
        await queryRunner.dropIndex('purchase_orders', 'IDX_PO_TENANT_STATUS');
        await queryRunner.dropIndex('purchase_orders', 'IDX_PO_STATUS');
        await queryRunner.dropIndex('purchase_orders', 'IDX_PO_VENDOR');
        await queryRunner.dropIndex('purchase_orders', 'IDX_PO_TENANT_PONUMBER');
        await queryRunner.dropTable('purchase_orders');
        await queryRunner.query(`DROP TYPE "po_status_enum"`);
    }
}
exports.CreatePurchaseOrdersTable1703100000000 = CreatePurchaseOrdersTable1703100000000;
//# sourceMappingURL=1703100000000-CreatePurchaseOrdersTable.js.map