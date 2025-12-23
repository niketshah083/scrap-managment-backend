const mysql = require('mysql2/promise');
require('dotenv').config();

async function seedVendors() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  console.log('Connected to database');

  // Get the default tenant ID
  const [tenants] = await connection.execute('SELECT id FROM tenants LIMIT 1');
  const tenantId = tenants.length > 0 ? tenants[0].id : 'default-tenant';
  console.log('Using tenant ID:', tenantId);

  // Check if vendors already exist
  const [existingVendors] = await connection.execute(
    'SELECT COUNT(*) as count FROM vendors WHERE tenantId = ?',
    [tenantId]
  );

  if (existingVendors[0].count > 0) {
    console.log(`${existingVendors[0].count} vendors already exist. Skipping seed.`);
    await connection.end();
    return;
  }

  const vendors = [
    {
      id: require('crypto').randomUUID(),
      tenantId,
      vendorName: 'Delhi Scrap Suppliers',
      gstNumber: '07AABCU9603R1ZM',
      panNumber: 'AABCU9603R',
      contactPersonName: 'Rajesh Kumar',
      contactEmail: 'rajesh@delhiscrap.com',
      contactPhone: '+91 98765 43210',
      address: '123 Industrial Area, Phase 2',
      city: 'Delhi',
      state: 'Delhi',
      pincode: '110001',
      bankName: 'HDFC Bank',
      bankAccount: '1234567890123',
      ifscCode: 'HDFC0001234',
      rating: 4.5,
      scrapTypesSupplied: JSON.stringify(['Copper', 'Aluminum', 'Steel', 'Brass']),
      performanceMetrics: JSON.stringify({
        rejectionPercentage: 5,
        weightDeviationPercentage: 2,
        inspectionFailureCount: 3,
        totalTransactions: 156,
        qualityScore: 92,
        avgDeliveryTime: 3,
        lastUpdated: new Date(),
      }),
      poSummary: JSON.stringify({
        totalPOs: 45,
        pendingPOs: 8,
        completedPOs: 37,
        totalValue: 125,
        pendingValue: 28,
      }),
      isBlacklisted: false,
      isActive: true,
    },
    {
      id: require('crypto').randomUUID(),
      tenantId,
      vendorName: 'Mumbai Metal Works',
      gstNumber: '27AABCU9603R1ZM',
      panNumber: 'BBCDU9603R',
      contactPersonName: 'Amit Shah',
      contactEmail: 'amit@mumbaimetal.com',
      contactPhone: '+91 98765 43211',
      address: '456 MIDC Industrial Estate',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      bankName: 'ICICI Bank',
      bankAccount: '9876543210123',
      ifscCode: 'ICIC0001234',
      rating: 4.2,
      scrapTypesSupplied: JSON.stringify(['Steel', 'Iron', 'Stainless Steel']),
      performanceMetrics: JSON.stringify({
        rejectionPercentage: 8,
        weightDeviationPercentage: 3,
        inspectionFailureCount: 5,
        totalTransactions: 89,
        qualityScore: 85,
        avgDeliveryTime: 4,
        lastUpdated: new Date(),
      }),
      poSummary: JSON.stringify({
        totalPOs: 32,
        pendingPOs: 5,
        completedPOs: 27,
        totalValue: 89,
        pendingValue: 15,
      }),
      isBlacklisted: false,
      isActive: true,
    },
    {
      id: require('crypto').randomUUID(),
      tenantId,
      vendorName: 'Jaipur Recyclers',
      gstNumber: '08AABCU9603R1ZM',
      panNumber: 'CCDEU9603R',
      contactPersonName: 'Suresh Sharma',
      contactEmail: 'suresh@jaipurrecycle.com',
      contactPhone: '+91 98765 43212',
      address: '789 Sitapura Industrial Area',
      city: 'Jaipur',
      state: 'Rajasthan',
      pincode: '302022',
      bankName: 'SBI',
      bankAccount: '5678901234567',
      ifscCode: 'SBIN0001234',
      rating: 3.2,
      scrapTypesSupplied: JSON.stringify(['Copper', 'Brass', 'Bronze']),
      performanceMetrics: JSON.stringify({
        rejectionPercentage: 12,
        weightDeviationPercentage: 5,
        inspectionFailureCount: 8,
        totalTransactions: 45,
        qualityScore: 78,
        avgDeliveryTime: 5,
        lastUpdated: new Date(),
      }),
      poSummary: JSON.stringify({
        totalPOs: 18,
        pendingPOs: 3,
        completedPOs: 15,
        totalValue: 45,
        pendingValue: 8,
      }),
      isBlacklisted: true,
      isActive: false,
    },
    {
      id: require('crypto').randomUUID(),
      tenantId,
      vendorName: 'Chennai Scrap Traders',
      gstNumber: '33AABCU9603R1ZM',
      panNumber: 'DDEFU9603R',
      contactPersonName: 'Venkat Raman',
      contactEmail: 'venkat@chennaiscrap.com',
      contactPhone: '+91 98765 43213',
      address: '321 Ambattur Industrial Estate',
      city: 'Chennai',
      state: 'Tamil Nadu',
      pincode: '600058',
      bankName: 'Axis Bank',
      bankAccount: '3456789012345',
      ifscCode: 'UTIB0001234',
      rating: 4.8,
      scrapTypesSupplied: JSON.stringify(['Aluminum', 'Steel', 'Zinc']),
      performanceMetrics: JSON.stringify({
        rejectionPercentage: 3,
        weightDeviationPercentage: 1,
        inspectionFailureCount: 2,
        totalTransactions: 234,
        qualityScore: 96,
        avgDeliveryTime: 2,
        lastUpdated: new Date(),
      }),
      poSummary: JSON.stringify({
        totalPOs: 67,
        pendingPOs: 12,
        completedPOs: 55,
        totalValue: 198,
        pendingValue: 42,
      }),
      isBlacklisted: false,
      isActive: true,
    },
  ];

  const insertQuery = `
    INSERT INTO vendors (
      id, tenantId, vendorName, gstNumber, panNumber, 
      contactPersonName, contactEmail, contactPhone, address,
      city, state, pincode, bankName, bankAccount, ifscCode,
      rating, scrapTypesSupplied, performanceMetrics, poSummary,
      isBlacklisted, isActive, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  `;

  for (const vendor of vendors) {
    try {
      await connection.execute(insertQuery, [
        vendor.id,
        vendor.tenantId,
        vendor.vendorName,
        vendor.gstNumber,
        vendor.panNumber,
        vendor.contactPersonName,
        vendor.contactEmail,
        vendor.contactPhone,
        vendor.address,
        vendor.city,
        vendor.state,
        vendor.pincode,
        vendor.bankName,
        vendor.bankAccount,
        vendor.ifscCode,
        vendor.rating,
        vendor.scrapTypesSupplied,
        vendor.performanceMetrics,
        vendor.poSummary,
        vendor.isBlacklisted,
        vendor.isActive,
      ]);
      console.log(`✓ Inserted vendor: ${vendor.vendorName}`);
    } catch (error) {
      console.error(`✗ Failed to insert ${vendor.vendorName}:`, error.message);
    }
  }

  console.log('\nVendor seeding completed!');
  await connection.end();
}

seedVendors().catch(console.error);
