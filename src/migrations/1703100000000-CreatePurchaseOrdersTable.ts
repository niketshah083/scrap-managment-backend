import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreatePurchaseOrdersTable1703100000000 implements MigrationInterface {
  name = 'CreatePurchaseOrdersTable1703100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum type for PO status
    await queryRunner.query(`
      CREATE TYPE "po_status_enum" AS ENUM ('PENDING', 'PARTIAL', 'COMPLETED', 'CANCELLED', 'EXPIRED')
    `);

    // Create purchase_orders table
    await queryRunner.createTable(
      new Table({
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
      }),
      true,
    );

    // Create unique index on tenantId + poNumber
    await queryRunner.createIndex(
      'purchase_orders',
      new TableIndex({
        name: 'IDX_PO_TENANT_PONUMBER',
        columnNames: ['tenantId', 'poNumber'],
        isUnique: true,
      }),
    );

    // Create index on vendorId
    await queryRunner.createIndex(
      'purchase_orders',
      new TableIndex({
        name: 'IDX_PO_VENDOR',
        columnNames: ['vendorId'],
      }),
    );

    // Create index on status
    await queryRunner.createIndex(
      'purchase_orders',
      new TableIndex({
        name: 'IDX_PO_STATUS',
        columnNames: ['status'],
      }),
    );

    // Create composite index on tenantId + status
    await queryRunner.createIndex(
      'purchase_orders',
      new TableIndex({
        name: 'IDX_PO_TENANT_STATUS',
        columnNames: ['tenantId', 'status'],
      }),
    );

    // Create foreign key to tenants table
    await queryRunner.createForeignKey(
      'purchase_orders',
      new TableForeignKey({
        name: 'FK_PO_TENANT',
        columnNames: ['tenantId'],
        referencedTableName: 'tenants',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Create foreign key to vendors table
    await queryRunner.createForeignKey(
      'purchase_orders',
      new TableForeignKey({
        name: 'FK_PO_VENDOR',
        columnNames: ['vendorId'],
        referencedTableName: 'vendors',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys
    await queryRunner.dropForeignKey('purchase_orders', 'FK_PO_VENDOR');
    await queryRunner.dropForeignKey('purchase_orders', 'FK_PO_TENANT');

    // Drop indexes
    await queryRunner.dropIndex('purchase_orders', 'IDX_PO_TENANT_STATUS');
    await queryRunner.dropIndex('purchase_orders', 'IDX_PO_STATUS');
    await queryRunner.dropIndex('purchase_orders', 'IDX_PO_VENDOR');
    await queryRunner.dropIndex('purchase_orders', 'IDX_PO_TENANT_PONUMBER');

    // Drop table
    await queryRunner.dropTable('purchase_orders');

    // Drop enum type
    await queryRunner.query(`DROP TYPE "po_status_enum"`);
  }
}
