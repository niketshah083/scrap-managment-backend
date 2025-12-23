const mysql = require('mysql2/promise');

async function testConnection() {
  try {
    const connection = await mysql.createConnection({
      host: 'staging-accomation-db.c0ra5fjyyxny.ap-south-1.rds.amazonaws.com',
      port: 3306,
      user: 'acco_lotus',
      password: 'Accomation@123',
      database: 'scrap-management'
    });

    console.log('✅ Database connection successful!');
    
    // Test if tables exist
    const [tables] = await connection.execute('SHOW TABLES');
    console.log('📋 Available tables:', tables.map(t => Object.values(t)[0]));
    
    await connection.end();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  }
}

testConnection();