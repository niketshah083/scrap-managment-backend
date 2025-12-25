const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");

async function createTenantAdmin() {
  const connection = await mysql.createConnection({
    host: "staging-accomation-db.c0ra5fjyyxny.ap-south-1.rds.amazonaws.com",
    user: "acco_lotus",
    password: "Accomation@123",
    database: "scrap-management",
  });

  try {
    // Check if tenant admin already exists for test-tenant-2
    const [existing] = await connection.execute(
      "SELECT id, email, role FROM users WHERE tenantId = 'test-tenant-2' AND role = 'TenantAdmin'"
    );

    if (existing.length > 0) {
      console.log("Tenant admin already exists:", existing[0]);
      return;
    }

    // Create password hash for 'TenantAdmin@123'
    const passwordHash = await bcrypt.hash("TenantAdmin@123", 12);
    console.log("Generated password hash");

    const permissions = JSON.stringify({
      levels: [1, 2, 3, 4, 5, 6, 7],
      actions: [
        "view",
        "create",
        "update",
        "delete",
        "approve",
        "reject",
        "override",
        "configure",
        "admin",
        "manage_users",
        "manage_settings",
      ],
    });

    const [result] = await connection.execute(
      `INSERT INTO users (id, tenantId, factoryId, email, passwordHash, name, role, permissions, isActive, createdAt, updatedAt) 
       VALUES (UUID(), 'test-tenant-2', 'test-factory-2a', 'admin@test-tenant-2.com', ?, 'Test Tenant Admin', 'TenantAdmin', ?, true, NOW(), NOW())`,
      [passwordHash, permissions]
    );

    console.log("Tenant admin created successfully");

    // Verify
    const [verify] = await connection.execute(
      "SELECT id, email, name, role, permissions FROM users WHERE tenantId = 'test-tenant-2' AND role = 'TenantAdmin'"
    );
    console.log("Created tenant admin:", verify[0]);
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await connection.end();
  }
}

createTenantAdmin();
