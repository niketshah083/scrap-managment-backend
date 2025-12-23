const mysql = require('mysql2/promise');

async function checkSchema() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: 'staging-accomation-db.c0ra5fjyyxny.ap-south-1.rds.amazonaws.com',
      port: 3306,
      user: 'acco_lotus',
      password: 'Accomation@123',
      database: 'scrap-management'
    });

    console.log('✅ Connected to database');

    // Check table structures
    const tables = ['tenants', 'factories', 'users', 'vendors', 'vehicles', 'transactions', 'workflow_configurations'];
    
    for (const table of tables) {
      console.log(`\n📋 Table: ${table}`);
      const [columns] = await connection.execute(`DESCRIBE ${table}`);
      columns.forEach(col => {
        console.log(`  ${col.Field} (${col.Type}) ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? col.Key : ''}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkSchema();