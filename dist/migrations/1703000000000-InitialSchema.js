"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InitialSchema1703000000000 = void 0;
class InitialSchema1703000000000 {
    constructor() {
        this.name = 'InitialSchema1703000000000';
    }
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE TABLE \`tenants\` (
        \`id\` varchar(36) NOT NULL,
        \`companyName\` varchar(100) NOT NULL,
        \`gstNumber\` varchar(15) NOT NULL,
        \`panNumber\` varchar(10) NOT NULL,
        \`email\` varchar(255) NOT NULL,
        \`phone\` varchar(20) NULL,
        \`address\` text NULL,
        \`subscriptionPlan\` varchar(50) NOT NULL DEFAULT 'TRIAL',
        \`isActive\` tinyint NOT NULL DEFAULT 1,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`IDX_tenants_gstNumber\` (\`gstNumber\`),
        UNIQUE INDEX \`IDX_tenants_panNumber\` (\`panNumber\`),
        UNIQUE INDEX \`IDX_tenants_email\` (\`email\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);
        await queryRunner.query(`
      CREATE TABLE \`factories\` (
        \`id\` varchar(36) NOT NULL,
        \`tenantId\` varchar(36) NOT NULL,
        \`factoryName\` varchar(100) NOT NULL,
        \`factoryCode\` varchar(10) NOT NULL,
        \`address\` text NULL,
        \`latitude\` decimal(10,8) NULL,
        \`longitude\` decimal(11,8) NULL,
        \`weighbridgeConfig\` json NULL,
        \`isActive\` tinyint NOT NULL DEFAULT 1,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX \`IDX_factories_tenantId\` (\`tenantId\`),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_factories_tenantId\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenants\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
      ) ENGINE=InnoDB
    `);
        await queryRunner.query(`
      CREATE TABLE \`users\` (
        \`id\` varchar(36) NOT NULL,
        \`tenantId\` varchar(36) NOT NULL,
        \`factoryId\` varchar(36) NULL,
        \`email\` varchar(255) NOT NULL,
        \`passwordHash\` varchar(255) NOT NULL,
        \`name\` varchar(100) NOT NULL,
        \`phone\` varchar(20) NULL,
        \`role\` enum('Security', 'Inspector', 'Supervisor', 'Manager', 'Owner') NOT NULL DEFAULT 'Security',
        \`permissions\` json NULL,
        \`isActive\` tinyint NOT NULL DEFAULT 1,
        \`lastLoginAt\` timestamp NULL,
        \`lastLoginIp\` varchar(45) NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`IDX_users_email\` (\`email\`),
        INDEX \`IDX_users_tenantId\` (\`tenantId\`),
        INDEX \`IDX_users_factoryId\` (\`factoryId\`),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_users_tenantId\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenants\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT \`FK_users_factoryId\` FOREIGN KEY (\`factoryId\`) REFERENCES \`factories\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION
      ) ENGINE=InnoDB
    `);
        await queryRunner.query(`
      CREATE TABLE \`vendors\` (
        \`id\` varchar(36) NOT NULL,
        \`tenantId\` varchar(36) NOT NULL,
        \`vendorName\` varchar(100) NOT NULL,
        \`gstNumber\` varchar(15) NOT NULL,
        \`panNumber\` varchar(10) NOT NULL,
        \`contactPersonName\` varchar(100) NULL,
        \`contactEmail\` varchar(255) NULL,
        \`contactPhone\` varchar(20) NULL,
        \`address\` text NULL,
        \`scrapTypesSupplied\` json NULL,
        \`performanceMetrics\` json NULL,
        \`isBlacklisted\` tinyint NOT NULL DEFAULT 0,
        \`blacklistReason\` text NULL,
        \`isActive\` tinyint NOT NULL DEFAULT 1,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX \`IDX_vendors_tenantId\` (\`tenantId\`),
        INDEX \`IDX_vendors_gstNumber\` (\`gstNumber\`),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_vendors_tenantId\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenants\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
      ) ENGINE=InnoDB
    `);
        await queryRunner.query(`
      CREATE TABLE \`vehicles\` (
        \`id\` varchar(36) NOT NULL,
        \`tenantId\` varchar(36) NOT NULL,
        \`vehicleNumber\` varchar(20) NOT NULL,
        \`driverName\` varchar(100) NULL,
        \`driverMobile\` varchar(20) NULL,
        \`driverPhotoUrl\` varchar(500) NULL,
        \`vehicleType\` varchar(50) NULL,
        \`visitHistory\` json NULL,
        \`isBlacklisted\` tinyint NOT NULL DEFAULT 0,
        \`blacklistReason\` text NULL,
        \`isActive\` tinyint NOT NULL DEFAULT 1,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`IDX_vehicles_vehicleNumber\` (\`vehicleNumber\`),
        INDEX \`IDX_vehicles_tenantId\` (\`tenantId\`),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_vehicles_tenantId\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenants\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
      ) ENGINE=InnoDB
    `);
        await queryRunner.query(`
      CREATE TABLE \`transactions\` (
        \`id\` varchar(36) NOT NULL,
        \`tenantId\` varchar(36) NOT NULL,
        \`factoryId\` varchar(36) NOT NULL,
        \`vendorId\` varchar(36) NOT NULL,
        \`vehicleId\` varchar(36) NOT NULL,
        \`transactionNumber\` varchar(50) NOT NULL,
        \`currentLevel\` int NOT NULL DEFAULT 1,
        \`status\` enum('ACTIVE', 'COMPLETED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
        \`levelData\` json NULL,
        \`weighbridgeData\` json NULL,
        \`inspectionData\` json NULL,
        \`grnDocumentUrl\` varchar(500) NULL,
        \`gatePassQrCode\` varchar(500) NULL,
        \`gatePassExpiresAt\` timestamp NULL,
        \`isLocked\` tinyint NOT NULL DEFAULT 0,
        \`completedAt\` timestamp NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`IDX_transactions_transactionNumber\` (\`transactionNumber\`),
        INDEX \`IDX_transactions_tenantId\` (\`tenantId\`),
        INDEX \`IDX_transactions_factoryId\` (\`factoryId\`),
        INDEX \`IDX_transactions_vendorId\` (\`vendorId\`),
        INDEX \`IDX_transactions_vehicleId\` (\`vehicleId\`),
        INDEX \`IDX_transactions_status\` (\`status\`),
        INDEX \`IDX_transactions_currentLevel\` (\`currentLevel\`),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_transactions_tenantId\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenants\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT \`FK_transactions_factoryId\` FOREIGN KEY (\`factoryId\`) REFERENCES \`factories\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT \`FK_transactions_vendorId\` FOREIGN KEY (\`vendorId\`) REFERENCES \`vendors\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT \`FK_transactions_vehicleId\` FOREIGN KEY (\`vehicleId\`) REFERENCES \`vehicles\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
      ) ENGINE=InnoDB
    `);
        await queryRunner.query(`
      CREATE TABLE \`evidence\` (
        \`id\` varchar(36) NOT NULL,
        \`transactionId\` varchar(36) NOT NULL,
        \`capturedBy\` varchar(36) NOT NULL,
        \`operationalLevel\` int NOT NULL,
        \`evidenceType\` enum('PHOTO', 'DOCUMENT', 'VIDEO', 'AUDIO', 'GPS_LOCATION', 'TIMESTAMP', 'WEIGHBRIDGE_TICKET', 'INSPECTION_REPORT', 'GRN_DOCUMENT', 'GATE_PASS') NOT NULL,
        \`filePath\` varchar(500) NOT NULL,
        \`fileName\` varchar(255) NULL,
        \`mimeType\` varchar(100) NULL,
        \`fileSize\` bigint NULL,
        \`metadata\` json NULL,
        \`fileHash\` varchar(64) NULL,
        \`isProcessed\` tinyint NOT NULL DEFAULT 0,
        \`description\` text NULL,
        \`tags\` json NULL,
        \`capturedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX \`IDX_evidence_transactionId\` (\`transactionId\`),
        INDEX \`IDX_evidence_capturedBy\` (\`capturedBy\`),
        INDEX \`IDX_evidence_operationalLevel\` (\`operationalLevel\`),
        INDEX \`IDX_evidence_evidenceType\` (\`evidenceType\`),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_evidence_transactionId\` FOREIGN KEY (\`transactionId\`) REFERENCES \`transactions\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT \`FK_evidence_capturedBy\` FOREIGN KEY (\`capturedBy\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
      ) ENGINE=InnoDB
    `);
        await queryRunner.query(`
      CREATE TABLE \`audit_logs\` (
        \`id\` varchar(36) NOT NULL,
        \`userId\` varchar(36) NOT NULL,
        \`transactionId\` varchar(36) NULL,
        \`action\` enum('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'LEVEL_COMPLETE', 'EVIDENCE_CAPTURE', 'APPROVAL', 'REJECTION', 'CONFIGURATION_CHANGE', 'EXPORT', 'PRINT') NOT NULL,
        \`entityType\` varchar(100) NOT NULL,
        \`entityId\` varchar(36) NULL,
        \`description\` text NULL,
        \`oldValues\` json NULL,
        \`newValues\` json NULL,
        \`metadata\` json NULL,
        \`isSensitive\` tinyint NOT NULL DEFAULT 0,
        \`severity\` varchar(50) NULL,
        \`timestamp\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX \`IDX_audit_logs_userId\` (\`userId\`),
        INDEX \`IDX_audit_logs_transactionId\` (\`transactionId\`),
        INDEX \`IDX_audit_logs_action\` (\`action\`),
        INDEX \`IDX_audit_logs_entityType\` (\`entityType\`),
        INDEX \`IDX_audit_logs_timestamp\` (\`timestamp\`),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_audit_logs_userId\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT \`FK_audit_logs_transactionId\` FOREIGN KEY (\`transactionId\`) REFERENCES \`transactions\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
      ) ENGINE=InnoDB
    `);
        await queryRunner.query(`
      CREATE TABLE \`workflow_configurations\` (
        \`id\` varchar(36) NOT NULL,
        \`tenantId\` varchar(36) NOT NULL,
        \`operationalLevel\` int NOT NULL,
        \`fieldName\` varchar(100) NOT NULL,
        \`fieldLabel\` varchar(255) NULL,
        \`fieldType\` varchar(50) NOT NULL,
        \`captureType\` enum('MANUAL', 'OCR', 'CAMERA', 'AUTO') NOT NULL DEFAULT 'MANUAL',
        \`validationType\` enum('REQUIRED', 'OPTIONAL') NOT NULL DEFAULT 'REQUIRED',
        \`editability\` enum('EDITABLE', 'READ_ONLY') NOT NULL DEFAULT 'EDITABLE',
        \`minPhotoCount\` int NOT NULL DEFAULT 0,
        \`maxPhotoCount\` int NOT NULL DEFAULT 10,
        \`validationRules\` json NULL,
        \`rolePermissions\` json NULL,
        \`displayOrder\` int NOT NULL DEFAULT 0,
        \`helpText\` varchar(255) NULL,
        \`placeholder\` varchar(255) NULL,
        \`conditionalLogic\` json NULL,
        \`isActive\` tinyint NOT NULL DEFAULT 1,
        \`version\` int NOT NULL DEFAULT 1,
        \`effectiveFrom\` timestamp NOT NULL,
        \`effectiveTo\` timestamp NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX \`IDX_workflow_configurations_tenantId\` (\`tenantId\`),
        INDEX \`IDX_workflow_configurations_operationalLevel\` (\`operationalLevel\`),
        INDEX \`IDX_workflow_configurations_effectiveFrom\` (\`effectiveFrom\`),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_workflow_configurations_tenantId\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenants\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
      ) ENGINE=InnoDB
    `);
        await queryRunner.query(`
      CREATE TABLE \`notification_templates\` (
        \`id\` varchar(36) NOT NULL,
        \`tenantId\` varchar(36) NOT NULL,
        \`type\` enum('inspection_complete', 'material_rejected', 'grn_generated', 'weight_deviation', 'gate_pass_issued') NOT NULL,
        \`channel\` enum('whatsapp', 'email', 'sms') NOT NULL,
        \`name\` varchar(100) NOT NULL,
        \`subject\` varchar(255) NOT NULL,
        \`template\` text NOT NULL,
        \`variables\` json NULL,
        \`isActive\` tinyint NOT NULL DEFAULT 1,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX \`IDX_notification_templates_tenantId\` (\`tenantId\`),
        INDEX \`IDX_notification_templates_type\` (\`type\`),
        INDEX \`IDX_notification_templates_channel\` (\`channel\`),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_notification_templates_tenantId\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenants\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
      ) ENGINE=InnoDB
    `);
        await queryRunner.query(`
      CREATE TABLE \`notification_logs\` (
        \`id\` varchar(36) NOT NULL,
        \`tenantId\` varchar(36) NOT NULL,
        \`transactionId\` varchar(36) NULL,
        \`templateId\` varchar(36) NOT NULL,
        \`type\` enum('inspection_complete', 'material_rejected', 'grn_generated', 'weight_deviation', 'gate_pass_issued') NOT NULL,
        \`channel\` enum('whatsapp', 'email', 'sms') NOT NULL,
        \`recipient\` varchar(255) NOT NULL,
        \`subject\` varchar(255) NOT NULL,
        \`content\` text NOT NULL,
        \`status\` enum('pending', 'sent', 'delivered', 'failed', 'read') NOT NULL DEFAULT 'pending',
        \`externalId\` varchar(255) NULL,
        \`metadata\` json NULL,
        \`errorMessage\` text NULL,
        \`sentAt\` timestamp NULL,
        \`deliveredAt\` timestamp NULL,
        \`readAt\` timestamp NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX \`IDX_notification_logs_tenantId\` (\`tenantId\`),
        INDEX \`IDX_notification_logs_transactionId\` (\`transactionId\`),
        INDEX \`IDX_notification_logs_templateId\` (\`templateId\`),
        INDEX \`IDX_notification_logs_type\` (\`type\`),
        INDEX \`IDX_notification_logs_channel\` (\`channel\`),
        INDEX \`IDX_notification_logs_status\` (\`status\`),
        INDEX \`IDX_notification_logs_externalId\` (\`externalId\`),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_notification_logs_tenantId\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenants\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT \`FK_notification_logs_transactionId\` FOREIGN KEY (\`transactionId\`) REFERENCES \`transactions\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT \`FK_notification_logs_templateId\` FOREIGN KEY (\`templateId\`) REFERENCES \`notification_templates\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
      ) ENGINE=InnoDB
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE \`notification_logs\``);
        await queryRunner.query(`DROP TABLE \`notification_templates\``);
        await queryRunner.query(`DROP TABLE \`workflow_configurations\``);
        await queryRunner.query(`DROP TABLE \`audit_logs\``);
        await queryRunner.query(`DROP TABLE \`evidence\``);
        await queryRunner.query(`DROP TABLE \`transactions\``);
        await queryRunner.query(`DROP TABLE \`vehicles\``);
        await queryRunner.query(`DROP TABLE \`vendors\``);
        await queryRunner.query(`DROP TABLE \`users\``);
        await queryRunner.query(`DROP TABLE \`factories\``);
        await queryRunner.query(`DROP TABLE \`tenants\``);
    }
}
exports.InitialSchema1703000000000 = InitialSchema1703000000000;
//# sourceMappingURL=1703000000000-InitialSchema.js.map