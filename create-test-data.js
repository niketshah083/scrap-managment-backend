const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function createTestData() {
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

    // Clear existing test data (order matters due to foreign keys)
    console.log('🧹 Cleaning existing test data...');
    
    // First, delete QC-related data that references transactions
    try { 
      await connection.execute('DELETE FROM debit_notes WHERE transactionId IN (SELECT id FROM transactions WHERE tenantId LIKE "test-%")'); 
    } catch(e) { console.log('  Note: debit_notes cleanup skipped'); }
    try { 
      await connection.execute('DELETE FROM qc_reports WHERE transactionId IN (SELECT id FROM transactions WHERE tenantId LIKE "test-%")'); 
    } catch(e) { console.log('  Note: qc_reports cleanup skipped'); }
    
    // Delete evidence
    await connection.execute('DELETE FROM evidence WHERE transactionId IN (SELECT id FROM transactions WHERE tenantId LIKE "test-%")');
    
    // Delete workflow configs
    await connection.execute('DELETE FROM workflow_configurations WHERE tenantId LIKE "test-%"');
    
    // Delete transactions BEFORE purchase_orders (foreign key constraint)
    await connection.execute('DELETE FROM transactions WHERE tenantId LIKE "test-%"');
    await connection.execute('DELETE FROM purchase_orders WHERE tenantId LIKE "test-%"');
    
    // Delete users, factories, vendors, vehicles
    await connection.execute('DELETE FROM users WHERE tenantId LIKE "test-%"');
    await connection.execute('DELETE FROM factories WHERE tenantId LIKE "test-%"');
    await connection.execute('DELETE FROM vendors WHERE tenantId LIKE "test-%"');
    await connection.execute('DELETE FROM vehicles WHERE tenantId LIKE "test-%"');
    
    // Finally delete tenants
    await connection.execute('DELETE FROM tenants WHERE id LIKE "test-%"');

    // ============================================
    // TENANTS
    // ============================================
    console.log('🏢 Creating test tenants...');
    
    const tenant1Id = 'test-tenant-1';
    const tenant2Id = 'test-tenant-2';
    
    await connection.execute(`
      INSERT INTO tenants (id, companyName, gstNumber, panNumber, email, phone, address, subscriptionPlan, isActive, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [tenant1Id, 'ABC Scrap Industries Ltd', '27ABCDE1234F1Z5', 'ABCDE1234F', 'admin@abcscrap.com', '+91 9876543210', 'Industrial Area, Phase 1, Mumbai, Maharashtra 400001', 'PREMIUM', true]);

    await connection.execute(`
      INSERT INTO tenants (id, companyName, gstNumber, panNumber, email, phone, address, subscriptionPlan, isActive, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [tenant2Id, 'XYZ Metal Recyclers Pvt Ltd', '29XYZAB5678G2H6', 'XYZAB5678G', 'admin@xyzmetal.com', '+91 9876543211', 'Industrial Estate, Sector 5, Pune, Maharashtra 411019', 'STANDARD', true]);

    // ============================================
    // FACTORIES
    // ============================================
    console.log('🏭 Creating test factories...');
    
    await connection.execute(`
      INSERT INTO factories (id, tenantId, factoryName, factoryCode, address, latitude, longitude, weighbridgeConfig, isActive, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, ['test-factory-1a', tenant1Id, 'ABC Main Processing Unit', 'ABC-01', 'Plot 15, Industrial Area, Mumbai', 19.0760, 72.8777, JSON.stringify({ enabled: true, ip: '192.168.1.100', port: 9001 }), true]);

    await connection.execute(`
      INSERT INTO factories (id, tenantId, factoryName, factoryCode, address, latitude, longitude, weighbridgeConfig, isActive, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, ['test-factory-2a', tenant2Id, 'XYZ Processing Center', 'XYZ-01', 'Building 5, Industrial Estate, Pune', 18.5204, 73.8567, JSON.stringify({ enabled: true, ip: '192.168.2.100', port: 9001 }), true]);

    // ============================================
    // USERS
    // ============================================
    console.log('👥 Creating test users...');
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    // ABC Scrap Users
    await connection.execute(`INSERT INTO users (id, tenantId, factoryId, email, passwordHash, name, phone, role, permissions, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      ['test-user-1-owner', tenant1Id, null, 'owner@abcscrap.com', hashedPassword, 'Rajesh Kumar', '+91 9876543210', 'Owner', JSON.stringify({}), true]);
    
    // XYZ Metal Users
    await connection.execute(`INSERT INTO users (id, tenantId, factoryId, email, passwordHash, name, phone, role, permissions, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      ['test-user-2-owner', tenant2Id, null, 'owner@xyzmetal.com', hashedPassword, 'Priya Sharma', '+91 9876543220', 'Owner', JSON.stringify({}), true]);
    await connection.execute(`INSERT INTO users (id, tenantId, factoryId, email, passwordHash, name, phone, role, permissions, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      ['test-user-2-supervisor', tenant2Id, 'test-factory-2a', 'supervisor@xyzmetal.com', hashedPassword, 'Vikram Joshi', '+91 9876543221', 'Supervisor', JSON.stringify({}), true]);
    await connection.execute(`INSERT INTO users (id, tenantId, factoryId, email, passwordHash, name, phone, role, permissions, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      ['test-user-2-lab', tenant2Id, 'test-factory-2a', 'lab@xyzmetal.com', hashedPassword, 'Anil Deshmukh', '+91 9876543222', 'Lab Technician', JSON.stringify({}), true]);


    // ============================================
    // VENDORS (Each vendor has unique materials they supply)
    // ============================================
    console.log('🚚 Creating test vendors...');
    
    // Vendor 1: Gujarat Metal Works - Aluminum & Brass specialist
    await connection.execute(`
      INSERT INTO vendors (id, tenantId, vendorName, gstNumber, panNumber, contactPersonName, contactEmail, contactPhone, address, scrapTypesSupplied, performanceMetrics, isBlacklisted, isActive, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, ['test-vendor-gmw', tenant2Id, 'Gujarat Metal Works', '24GMETAL456B3C4', 'GMETAL456B', 'Kiran Shah', 'kiran@gujaratmetal.com', '+91 9876543240', 'GIDC Industrial Estate, Ahmedabad, Gujarat',
      JSON.stringify(['Aluminum Scrap', 'Brass Scrap']),
      JSON.stringify({ rejectionPercentage: 4.2, weightDeviationPercentage: 2.1, inspectionFailureCount: 3, totalTransactions: 45, lastUpdated: new Date().toISOString() }),
      false, true]);

    // Vendor 2: Maharashtra Steel Traders - Steel specialist
    await connection.execute(`
      INSERT INTO vendors (id, tenantId, vendorName, gstNumber, panNumber, contactPersonName, contactEmail, contactPhone, address, scrapTypesSupplied, performanceMetrics, isBlacklisted, isActive, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, ['test-vendor-mst', tenant2Id, 'Maharashtra Steel Traders', '27MSTEEL789D5E6', 'MSTEEL789D', 'Sunil Patil', 'sunil@mahasteel.com', '+91 9876543241', 'MIDC Bhosari, Pune, Maharashtra',
      JSON.stringify(['HMS 1 Steel', 'HMS 2 Steel', 'Shredded Steel']),
      JSON.stringify({ rejectionPercentage: 2.8, weightDeviationPercentage: 1.5, inspectionFailureCount: 2, totalTransactions: 68, lastUpdated: new Date().toISOString() }),
      false, true]);

    // Vendor 3: Rajasthan Copper Industries - Copper specialist
    await connection.execute(`
      INSERT INTO vendors (id, tenantId, vendorName, gstNumber, panNumber, contactPersonName, contactEmail, contactPhone, address, scrapTypesSupplied, performanceMetrics, isBlacklisted, isActive, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, ['test-vendor-rci', tenant2Id, 'Rajasthan Copper Industries', '08RCOPPER12F7G8', 'RCOPPER12F', 'Mahesh Sharma', 'mahesh@rajcopper.com', '+91 9876543242', 'Industrial Area, Jaipur, Rajasthan',
      JSON.stringify(['Copper Wire', 'Copper Cathode', 'Copper Scrap']),
      JSON.stringify({ rejectionPercentage: 3.5, weightDeviationPercentage: 1.8, inspectionFailureCount: 4, totalTransactions: 52, lastUpdated: new Date().toISOString() }),
      false, true]);

    // Vendor 4: Karnataka Recyclers - Mixed metals (Blacklisted)
    await connection.execute(`
      INSERT INTO vendors (id, tenantId, vendorName, gstNumber, panNumber, contactPersonName, contactEmail, contactPhone, address, scrapTypesSupplied, performanceMetrics, isBlacklisted, isActive, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, ['test-vendor-kr', tenant2Id, 'Karnataka Recyclers Pvt Ltd', '29KRECYC34H9I0', 'KRECYC34H9', 'Venkatesh Rao', 'venkatesh@krecyclers.com', '+91 9876543243', 'Peenya Industrial Area, Bangalore',
      JSON.stringify(['Mixed Metal', 'E-Waste']),
      JSON.stringify({ rejectionPercentage: 15.2, weightDeviationPercentage: 8.5, inspectionFailureCount: 12, totalTransactions: 18, lastUpdated: new Date().toISOString() }),
      true, true]);

    // ============================================
    // VEHICLES (Linked to specific vendors for realism)
    // ============================================
    console.log('🚛 Creating test vehicles...');
    
    // Gujarat Metal Works vehicles
    await connection.execute(`INSERT INTO vehicles (id, tenantId, vehicleNumber, driverName, driverMobile, visitHistory, isBlacklisted, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      ['test-vehicle-gj01', tenant2Id, 'GJ05CD5678', 'Mohan Patel', '+91 9876543251', JSON.stringify([]), false, true]);
    await connection.execute(`INSERT INTO vehicles (id, tenantId, vehicleNumber, driverName, driverMobile, visitHistory, isBlacklisted, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      ['test-vehicle-gj02', tenant2Id, 'GJ01AB1234', 'Jayesh Modi', '+91 9876543252', JSON.stringify([]), false, true]);
    
    // Maharashtra Steel Traders vehicles
    await connection.execute(`INSERT INTO vehicles (id, tenantId, vehicleNumber, driverName, driverMobile, visitHistory, isBlacklisted, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      ['test-vehicle-mh01', tenant2Id, 'MH14EF9012', 'Santosh Jadhav', '+91 9876543253', JSON.stringify([]), false, true]);
    await connection.execute(`INSERT INTO vehicles (id, tenantId, vehicleNumber, driverName, driverMobile, visitHistory, isBlacklisted, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      ['test-vehicle-mh02', tenant2Id, 'MH12GH3456', 'Prakash Shinde', '+91 9876543254', JSON.stringify([]), false, true]);
    
    // Rajasthan Copper Industries vehicles
    await connection.execute(`INSERT INTO vehicles (id, tenantId, vehicleNumber, driverName, driverMobile, visitHistory, isBlacklisted, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      ['test-vehicle-rj01', tenant2Id, 'RJ14GH7890', 'Ramesh Meena', '+91 9876543255', JSON.stringify([]), false, true]);


    // ============================================
    // PURCHASE ORDERS (Each PO linked to ONE specific vendor)
    // ============================================
    console.log('📦 Creating purchase orders...');
    
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const twoDaysAgo = new Date(today); twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const nextWeek = new Date(today); nextWeek.setDate(nextWeek.getDate() + 7);
    const nextMonth = new Date(today); nextMonth.setDate(nextMonth.getDate() + 30);
    
    // PO-001: Gujarat Metal Works - Aluminum Scrap (PARTIAL - some received)
    await connection.execute(`
      INSERT INTO purchase_orders (id, tenantId, poNumber, vendorId, materialType, materialDescription, orderedQuantity, receivedQuantity, rate, unit, status, deliveryDate, notes, isActive, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, ['test-po-001', tenant2Id, 'PO-XYZ-2024-001', 'test-vendor-gmw', 'Aluminum Scrap', 'High grade aluminum scrap from industrial waste - 6063 alloy', 15000, 8500, 185.50, 'KG', 'PARTIAL', nextMonth, 'Multiple deliveries expected. Quality grade A required.', true]);

    // PO-002: Maharashtra Steel Traders - HMS 1 Steel (PARTIAL)
    await connection.execute(`
      INSERT INTO purchase_orders (id, tenantId, poNumber, vendorId, materialType, materialDescription, orderedQuantity, receivedQuantity, rate, unit, status, deliveryDate, notes, isActive, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, ['test-po-002', tenant2Id, 'PO-XYZ-2024-002', 'test-vendor-mst', 'HMS 1 Steel', 'Heavy Melting Steel Grade 1 - Auto body scrap', 30000, 13700, 42.75, 'KG', 'PARTIAL', nextWeek, 'Urgent requirement for furnace batch.', true]);

    // PO-003: Rajasthan Copper Industries - Copper Wire (COMPLETED)
    await connection.execute(`
      INSERT INTO purchase_orders (id, tenantId, poNumber, vendorId, materialType, materialDescription, orderedQuantity, receivedQuantity, rate, unit, status, deliveryDate, notes, isActive, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, ['test-po-003', tenant2Id, 'PO-XYZ-2024-003', 'test-vendor-rci', 'Copper Wire', 'Insulated copper wire scrap - 99% purity after stripping', 5000, 5000, 520.00, 'KG', 'COMPLETED', yesterday, 'Completed successfully. Quality verified.', true]);

    // PO-004: Gujarat Metal Works - Brass Scrap (PENDING - new order)
    await connection.execute(`
      INSERT INTO purchase_orders (id, tenantId, poNumber, vendorId, materialType, materialDescription, orderedQuantity, receivedQuantity, rate, unit, status, deliveryDate, notes, isActive, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, ['test-po-004', tenant2Id, 'PO-XYZ-2024-004', 'test-vendor-gmw', 'Brass Scrap', 'Mixed brass scrap - Yellow brass preferred', 8000, 0, 380.25, 'KG', 'PENDING', nextMonth, 'New order. First delivery expected next week.', true]);

    // PO-005: Maharashtra Steel Traders - Shredded Steel (PENDING)
    await connection.execute(`
      INSERT INTO purchase_orders (id, tenantId, poNumber, vendorId, materialType, materialDescription, orderedQuantity, receivedQuantity, rate, unit, status, deliveryDate, notes, isActive, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, ['test-po-005', tenant2Id, 'PO-XYZ-2024-005', 'test-vendor-mst', 'Shredded Steel', 'Shredded automobile steel - Clean and dry', 20000, 0, 38.50, 'KG', 'PENDING', nextWeek, 'Awaiting first delivery.', true]);

    // PO-006: Rajasthan Copper Industries - Copper Cathode (PARTIAL)
    await connection.execute(`
      INSERT INTO purchase_orders (id, tenantId, poNumber, vendorId, materialType, materialDescription, orderedQuantity, receivedQuantity, rate, unit, status, deliveryDate, notes, isActive, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, ['test-po-006', tenant2Id, 'PO-XYZ-2024-006', 'test-vendor-rci', 'Copper Cathode', 'Electrolytic copper cathode - LME grade', 3000, 1200, 750.00, 'KG', 'PARTIAL', nextMonth, 'Premium grade copper. Handle with care.', true]);


    // ============================================
    // TRANSACTIONS - Properly linked to correct PO and Vendor
    // ============================================
    console.log('📋 Creating transactions...');

    // Helper function to generate GRN number
    const generateGRN = (seq) => `GRN-XYZ-2024-${String(seq).padStart(4, '0')}`;
    const generateGatePass = (seq) => `GP-XYZ-2024-${String(seq).padStart(4, '0')}`;

    // ============================================
    // COMPLETED TRANSACTIONS (For Lab QC Testing)
    // ============================================

    // TXN-001: Gujarat Metal Works - Aluminum Scrap (COMPLETED - Ready for QC)
    await connection.execute(`
      INSERT INTO transactions (id, tenantId, factoryId, vendorId, vehicleId, transactionNumber, purchaseOrderId, currentLevel, status, stepData, weighbridgeData, inspectionData, isLocked, completedAt, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      'test-txn-001', tenant2Id, 'test-factory-2a', 'test-vendor-gmw', 'test-vehicle-gj01',
      'TXN-XYZ-2024-001', 'test-po-001', 6, 'COMPLETED',
      JSON.stringify({
        1: { stepNumber: 1, data: { truck_number: 'GJ05CD5678', driver_name: 'Mohan Patel', driver_mobile: '+91 9876543251', po_number: 'PO-XYZ-2024-001', vendor_name: 'Gujarat Metal Works', material_type: 'Aluminum Scrap' }, files: { po_document: ['evidence-001-po.jpg'], invoice_document: ['evidence-001-inv.jpg'] }, timestamp: twoDaysAgo, userId: 'test-user-2-supervisor' },
        2: { stepNumber: 2, data: { gross_weight: 16800 }, files: { weighbridge_photo: ['evidence-001-wb1.jpg'] }, timestamp: twoDaysAgo, userId: 'test-user-2-supervisor' },
        3: { stepNumber: 3, data: { unloading_notes: 'Aluminum scrap unloaded. Good quality material.' }, files: { driver_photo: ['evidence-001-driver.jpg'], driver_license_photo: ['evidence-001-license.jpg'], unloading_photos: ['evidence-001-unload1.jpg', 'evidence-001-unload2.jpg', 'evidence-001-unload3.jpg'] }, timestamp: twoDaysAgo, userId: 'test-user-2-supervisor' },
        4: { stepNumber: 4, data: { tare_weight: 8300, material_count: 1 }, files: { empty_weighbridge_photo: ['evidence-001-wb2.jpg'] }, timestamp: twoDaysAgo, userId: 'test-user-2-supervisor' },
        5: { stepNumber: 5, data: { supervisor_review_notes: 'Quality verified. All documents in order.', document_verification_status: 'VERIFIED', approval_status: 'APPROVED' }, files: {}, timestamp: twoDaysAgo, userId: 'test-user-2-owner' },
        6: { stepNumber: 6, data: { gate_pass_number: generateGatePass(1), exit_time: twoDaysAgo.toISOString(), grn_number: generateGRN(1) }, files: {}, timestamp: twoDaysAgo, userId: 'test-user-2-supervisor' }
      }),
      JSON.stringify({ grossWeight: 16800, tareWeight: 8300, netWeight: 8500 }),
      JSON.stringify({ grade: 'A', contamination: 2.1, inspector: 'test-user-2-supervisor' }),
      true, twoDaysAgo, twoDaysAgo
    ]);

    // TXN-002: Maharashtra Steel Traders - HMS 1 Steel (COMPLETED - Ready for QC)
    await connection.execute(`
      INSERT INTO transactions (id, tenantId, factoryId, vendorId, vehicleId, transactionNumber, purchaseOrderId, currentLevel, status, stepData, weighbridgeData, inspectionData, isLocked, completedAt, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      'test-txn-002', tenant2Id, 'test-factory-2a', 'test-vendor-mst', 'test-vehicle-mh01',
      'TXN-XYZ-2024-002', 'test-po-002', 6, 'COMPLETED',
      JSON.stringify({
        1: { stepNumber: 1, data: { truck_number: 'MH14EF9012', driver_name: 'Santosh Jadhav', driver_mobile: '+91 9876543253', po_number: 'PO-XYZ-2024-002', vendor_name: 'Maharashtra Steel Traders', material_type: 'HMS 1 Steel' }, files: { po_document: ['evidence-002-po.jpg'], invoice_document: ['evidence-002-inv.jpg'] }, timestamp: yesterday, userId: 'test-user-2-supervisor' },
        2: { stepNumber: 2, data: { gross_weight: 22500 }, files: { weighbridge_photo: ['evidence-002-wb1.jpg'] }, timestamp: yesterday, userId: 'test-user-2-supervisor' },
        3: { stepNumber: 3, data: { unloading_notes: 'Heavy melting steel unloaded. Minor rust present.' }, files: { driver_photo: ['evidence-002-driver.jpg'], driver_license_photo: ['evidence-002-license.jpg'], unloading_photos: ['evidence-002-unload1.jpg', 'evidence-002-unload2.jpg', 'evidence-002-unload3.jpg', 'evidence-002-unload4.jpg'] }, timestamp: yesterday, userId: 'test-user-2-supervisor' },
        4: { stepNumber: 4, data: { tare_weight: 8800, material_count: 1 }, files: { empty_weighbridge_photo: ['evidence-002-wb2.jpg'] }, timestamp: yesterday, userId: 'test-user-2-supervisor' },
        5: { stepNumber: 5, data: { supervisor_review_notes: 'Steel quality acceptable. Approved for processing.', document_verification_status: 'VERIFIED', approval_status: 'APPROVED' }, files: {}, timestamp: yesterday, userId: 'test-user-2-owner' },
        6: { stepNumber: 6, data: { gate_pass_number: generateGatePass(2), exit_time: yesterday.toISOString(), grn_number: generateGRN(2) }, files: {}, timestamp: yesterday, userId: 'test-user-2-supervisor' }
      }),
      JSON.stringify({ grossWeight: 22500, tareWeight: 8800, netWeight: 13700 }),
      JSON.stringify({ grade: 'A', contamination: 1.8, inspector: 'test-user-2-supervisor' }),
      true, yesterday, yesterday
    ]);

    // TXN-003: Rajasthan Copper Industries - Copper Wire (COMPLETED - Ready for QC)
    await connection.execute(`
      INSERT INTO transactions (id, tenantId, factoryId, vendorId, vehicleId, transactionNumber, purchaseOrderId, currentLevel, status, stepData, weighbridgeData, inspectionData, isLocked, completedAt, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      'test-txn-003', tenant2Id, 'test-factory-2a', 'test-vendor-rci', 'test-vehicle-rj01',
      'TXN-XYZ-2024-003', 'test-po-003', 6, 'COMPLETED',
      JSON.stringify({
        1: { stepNumber: 1, data: { truck_number: 'RJ14GH7890', driver_name: 'Ramesh Meena', driver_mobile: '+91 9876543255', po_number: 'PO-XYZ-2024-003', vendor_name: 'Rajasthan Copper Industries', material_type: 'Copper Wire' }, files: { po_document: ['evidence-003-po.jpg'], invoice_document: ['evidence-003-inv.jpg'] }, timestamp: yesterday, userId: 'test-user-2-supervisor' },
        2: { stepNumber: 2, data: { gross_weight: 13500 }, files: { weighbridge_photo: ['evidence-003-wb1.jpg'] }, timestamp: yesterday, userId: 'test-user-2-supervisor' },
        3: { stepNumber: 3, data: { unloading_notes: 'Copper wire bundles unloaded carefully. Premium quality.' }, files: { driver_photo: ['evidence-003-driver.jpg'], driver_license_photo: ['evidence-003-license.jpg'], unloading_photos: ['evidence-003-unload1.jpg', 'evidence-003-unload2.jpg', 'evidence-003-unload3.jpg'] }, timestamp: yesterday, userId: 'test-user-2-supervisor' },
        4: { stepNumber: 4, data: { tare_weight: 8500, material_count: 25 }, files: { empty_weighbridge_photo: ['evidence-003-wb2.jpg'] }, timestamp: yesterday, userId: 'test-user-2-supervisor' },
        5: { stepNumber: 5, data: { supervisor_review_notes: 'Excellent copper quality. Full PO quantity received.', document_verification_status: 'VERIFIED', approval_status: 'APPROVED' }, files: {}, timestamp: yesterday, userId: 'test-user-2-owner' },
        6: { stepNumber: 6, data: { gate_pass_number: generateGatePass(3), exit_time: yesterday.toISOString(), grn_number: generateGRN(3) }, files: {}, timestamp: yesterday, userId: 'test-user-2-supervisor' }
      }),
      JSON.stringify({ grossWeight: 13500, tareWeight: 8500, netWeight: 5000 }),
      JSON.stringify({ grade: 'A', contamination: 0.5, inspector: 'test-user-2-supervisor' }),
      true, yesterday, yesterday
    ]);

    // TXN-004: Rajasthan Copper Industries - Copper Cathode (COMPLETED - Ready for QC)
    await connection.execute(`
      INSERT INTO transactions (id, tenantId, factoryId, vendorId, vehicleId, transactionNumber, purchaseOrderId, currentLevel, status, stepData, weighbridgeData, inspectionData, isLocked, completedAt, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      'test-txn-004', tenant2Id, 'test-factory-2a', 'test-vendor-rci', 'test-vehicle-rj01',
      'TXN-XYZ-2024-004', 'test-po-006', 6, 'COMPLETED',
      JSON.stringify({
        1: { stepNumber: 1, data: { truck_number: 'RJ14GH7890', driver_name: 'Ramesh Meena', driver_mobile: '+91 9876543255', po_number: 'PO-XYZ-2024-006', vendor_name: 'Rajasthan Copper Industries', material_type: 'Copper Cathode' }, files: { po_document: ['evidence-004-po.jpg'], invoice_document: ['evidence-004-inv.jpg'] }, timestamp: today, userId: 'test-user-2-supervisor' },
        2: { stepNumber: 2, data: { gross_weight: 9700 }, files: { weighbridge_photo: ['evidence-004-wb1.jpg'] }, timestamp: today, userId: 'test-user-2-supervisor' },
        3: { stepNumber: 3, data: { unloading_notes: 'Copper cathode sheets unloaded. LME grade verified.' }, files: { driver_photo: ['evidence-004-driver.jpg'], driver_license_photo: ['evidence-004-license.jpg'], unloading_photos: ['evidence-004-unload1.jpg', 'evidence-004-unload2.jpg'] }, timestamp: today, userId: 'test-user-2-supervisor' },
        4: { stepNumber: 4, data: { tare_weight: 8500, material_count: 12 }, files: { empty_weighbridge_photo: ['evidence-004-wb2.jpg'] }, timestamp: today, userId: 'test-user-2-supervisor' },
        5: { stepNumber: 5, data: { supervisor_review_notes: 'Premium copper cathode. Approved.', document_verification_status: 'VERIFIED', approval_status: 'APPROVED' }, files: {}, timestamp: today, userId: 'test-user-2-owner' },
        6: { stepNumber: 6, data: { gate_pass_number: generateGatePass(4), exit_time: today.toISOString(), grn_number: generateGRN(4) }, files: {}, timestamp: today, userId: 'test-user-2-supervisor' }
      }),
      JSON.stringify({ grossWeight: 9700, tareWeight: 8500, netWeight: 1200 }),
      JSON.stringify({ grade: 'A', contamination: 0.2, inspector: 'test-user-2-supervisor' }),
      true, today, today
    ]);


    // ============================================
    // IN-PROGRESS TRANSACTIONS (At various stages)
    // ============================================

    // TXN-005: Gujarat Metal Works - Aluminum (Step 2 - Initial Weighing)
    await connection.execute(`
      INSERT INTO transactions (id, tenantId, factoryId, vendorId, vehicleId, transactionNumber, purchaseOrderId, currentLevel, status, stepData, isLocked, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      'test-txn-005', tenant2Id, 'test-factory-2a', 'test-vendor-gmw', 'test-vehicle-gj02',
      'TXN-XYZ-2024-005', 'test-po-001', 2, 'ACTIVE',
      JSON.stringify({
        1: { stepNumber: 1, data: { truck_number: 'GJ01AB1234', driver_name: 'Jayesh Modi', driver_mobile: '+91 9876543252', po_number: 'PO-XYZ-2024-001', vendor_name: 'Gujarat Metal Works', material_type: 'Aluminum Scrap' }, files: { po_document: ['evidence-005-po.jpg'] }, timestamp: today, userId: 'test-user-2-supervisor' }
      }),
      false, today
    ]);

    // TXN-006: Maharashtra Steel Traders - Shredded Steel (Step 3 - Unloading)
    await connection.execute(`
      INSERT INTO transactions (id, tenantId, factoryId, vendorId, vehicleId, transactionNumber, purchaseOrderId, currentLevel, status, stepData, weighbridgeData, isLocked, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      'test-txn-006', tenant2Id, 'test-factory-2a', 'test-vendor-mst', 'test-vehicle-mh02',
      'TXN-XYZ-2024-006', 'test-po-005', 3, 'ACTIVE',
      JSON.stringify({
        1: { stepNumber: 1, data: { truck_number: 'MH12GH3456', driver_name: 'Prakash Shinde', driver_mobile: '+91 9876543254', po_number: 'PO-XYZ-2024-005', vendor_name: 'Maharashtra Steel Traders', material_type: 'Shredded Steel' }, files: { po_document: ['evidence-006-po.jpg'], invoice_document: ['evidence-006-inv.jpg'] }, timestamp: today, userId: 'test-user-2-supervisor' },
        2: { stepNumber: 2, data: { gross_weight: 18500 }, files: { weighbridge_photo: ['evidence-006-wb1.jpg'] }, timestamp: today, userId: 'test-user-2-supervisor' }
      }),
      JSON.stringify({ grossWeight: 18500 }),
      false, today
    ]);

    // TXN-007: Gujarat Metal Works - Brass (Step 4 - Final Weighing)
    await connection.execute(`
      INSERT INTO transactions (id, tenantId, factoryId, vendorId, vehicleId, transactionNumber, purchaseOrderId, currentLevel, status, stepData, weighbridgeData, isLocked, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      'test-txn-007', tenant2Id, 'test-factory-2a', 'test-vendor-gmw', 'test-vehicle-gj01',
      'TXN-XYZ-2024-007', 'test-po-004', 4, 'ACTIVE',
      JSON.stringify({
        1: { stepNumber: 1, data: { truck_number: 'GJ05CD5678', driver_name: 'Mohan Patel', driver_mobile: '+91 9876543251', po_number: 'PO-XYZ-2024-004', vendor_name: 'Gujarat Metal Works', material_type: 'Brass Scrap' }, files: { po_document: ['evidence-007-po.jpg'], invoice_document: ['evidence-007-inv.jpg'] }, timestamp: yesterday, userId: 'test-user-2-supervisor' },
        2: { stepNumber: 2, data: { gross_weight: 14250 }, files: { weighbridge_photo: ['evidence-007-wb1.jpg'] }, timestamp: yesterday, userId: 'test-user-2-supervisor' },
        3: { stepNumber: 3, data: { unloading_notes: 'Brass scrap being unloaded. Mixed grades.' }, files: { driver_photo: ['evidence-007-driver.jpg'], unloading_photos: ['evidence-007-unload1.jpg', 'evidence-007-unload2.jpg'] }, timestamp: today, userId: 'test-user-2-supervisor' }
      }),
      JSON.stringify({ grossWeight: 14250 }),
      false, yesterday
    ]);

    // TXN-008: Maharashtra Steel Traders - HMS 1 (Step 5 - Supervisor Review)
    await connection.execute(`
      INSERT INTO transactions (id, tenantId, factoryId, vendorId, vehicleId, transactionNumber, purchaseOrderId, currentLevel, status, stepData, weighbridgeData, isLocked, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      'test-txn-008', tenant2Id, 'test-factory-2a', 'test-vendor-mst', 'test-vehicle-mh01',
      'TXN-XYZ-2024-008', 'test-po-002', 5, 'ACTIVE',
      JSON.stringify({
        1: { stepNumber: 1, data: { truck_number: 'MH14EF9012', driver_name: 'Santosh Jadhav', driver_mobile: '+91 9876543253', po_number: 'PO-XYZ-2024-002', vendor_name: 'Maharashtra Steel Traders', material_type: 'HMS 1 Steel' }, files: { po_document: ['evidence-008-po.jpg'], invoice_document: ['evidence-008-inv.jpg'] }, timestamp: yesterday, userId: 'test-user-2-supervisor' },
        2: { stepNumber: 2, data: { gross_weight: 19800 }, files: { weighbridge_photo: ['evidence-008-wb1.jpg'] }, timestamp: yesterday, userId: 'test-user-2-supervisor' },
        3: { stepNumber: 3, data: { unloading_notes: 'HMS steel unloaded. Good condition.' }, files: { driver_photo: ['evidence-008-driver.jpg'], driver_license_photo: ['evidence-008-license.jpg'], unloading_photos: ['evidence-008-unload1.jpg', 'evidence-008-unload2.jpg', 'evidence-008-unload3.jpg'] }, timestamp: yesterday, userId: 'test-user-2-supervisor' },
        4: { stepNumber: 4, data: { tare_weight: 8400, material_count: 1 }, files: { empty_weighbridge_photo: ['evidence-008-wb2.jpg'] }, timestamp: today, userId: 'test-user-2-supervisor' }
      }),
      JSON.stringify({ grossWeight: 19800, tareWeight: 8400, netWeight: 11400 }),
      false, yesterday
    ]);


    // ============================================
    // EVIDENCE RECORDS (Demo photos for completed transactions)
    // ============================================
    console.log('📸 Creating evidence records with demo photos...');

    // Demo image URLs (using placeholder images that look realistic)
    const demoImages = {
      po_document: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&h=600&fit=crop',
      invoice: 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=800&h=600&fit=crop',
      weighbridge: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=600&fit=crop',
      driver: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
      license: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800&h=500&fit=crop',
      unloading_aluminum: 'https://images.unsplash.com/photo-1558618047-f4b511e7e5e6?w=800&h=600&fit=crop',
      unloading_steel: 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?w=800&h=600&fit=crop',
      unloading_copper: 'https://images.unsplash.com/photo-1605000797499-95a51c5269ae?w=800&h=600&fit=crop',
      truck: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=800&h=600&fit=crop'
    };

    // Evidence for TXN-001 (Gujarat Metal Works - Aluminum)
    const txn001Evidence = [
      { id: 'ev-001-01', type: 'DOCUMENT', filename: 'PO-XYZ-2024-001.jpg', url: demoImages.po_document, level: 1 },
      { id: 'ev-001-02', type: 'DOCUMENT', filename: 'INV-GMW-2024-156.jpg', url: demoImages.invoice, level: 1 },
      { id: 'ev-001-03', type: 'WEIGHBRIDGE_TICKET', filename: 'weighbridge-gross-16800kg.jpg', url: demoImages.weighbridge, level: 2 },
      { id: 'ev-001-04', type: 'PHOTO', filename: 'driver-mohan-patel.jpg', url: demoImages.driver, level: 3 },
      { id: 'ev-001-05', type: 'DOCUMENT', filename: 'license-mohan-patel.jpg', url: demoImages.license, level: 3 },
      { id: 'ev-001-06', type: 'PHOTO', filename: 'aluminum-unload-1.jpg', url: demoImages.unloading_aluminum, level: 3 },
      { id: 'ev-001-07', type: 'PHOTO', filename: 'aluminum-unload-2.jpg', url: demoImages.unloading_aluminum, level: 3 },
      { id: 'ev-001-08', type: 'WEIGHBRIDGE_TICKET', filename: 'weighbridge-tare-8300kg.jpg', url: demoImages.weighbridge, level: 4 }
    ];

    for (const ev of txn001Evidence) {
      await connection.execute(`
        INSERT INTO evidence (id, transactionId, capturedBy, operationalLevel, evidenceType, filePath, fileName, mimeType, fileSize, metadata, capturedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [ev.id, 'test-txn-001', 'test-user-2-supervisor', ev.level, ev.type, ev.url, ev.filename, 'image/jpeg', 245000, JSON.stringify({ gpsCoordinates: { latitude: 18.5204, longitude: 73.8567 } }), twoDaysAgo]);
    }

    // Evidence for TXN-002 (Maharashtra Steel - HMS Steel)
    const txn002Evidence = [
      { id: 'ev-002-01', type: 'DOCUMENT', filename: 'PO-XYZ-2024-002.jpg', url: demoImages.po_document, level: 1 },
      { id: 'ev-002-02', type: 'DOCUMENT', filename: 'INV-MST-2024-089.jpg', url: demoImages.invoice, level: 1 },
      { id: 'ev-002-03', type: 'WEIGHBRIDGE_TICKET', filename: 'weighbridge-gross-22500kg.jpg', url: demoImages.weighbridge, level: 2 },
      { id: 'ev-002-04', type: 'PHOTO', filename: 'driver-santosh-jadhav.jpg', url: demoImages.driver, level: 3 },
      { id: 'ev-002-05', type: 'DOCUMENT', filename: 'license-santosh-jadhav.jpg', url: demoImages.license, level: 3 },
      { id: 'ev-002-06', type: 'PHOTO', filename: 'steel-unload-1.jpg', url: demoImages.unloading_steel, level: 3 },
      { id: 'ev-002-07', type: 'PHOTO', filename: 'steel-unload-2.jpg', url: demoImages.unloading_steel, level: 3 },
      { id: 'ev-002-08', type: 'PHOTO', filename: 'steel-unload-3.jpg', url: demoImages.unloading_steel, level: 3 },
      { id: 'ev-002-09', type: 'WEIGHBRIDGE_TICKET', filename: 'weighbridge-tare-8800kg.jpg', url: demoImages.weighbridge, level: 4 }
    ];

    for (const ev of txn002Evidence) {
      await connection.execute(`
        INSERT INTO evidence (id, transactionId, capturedBy, operationalLevel, evidenceType, filePath, fileName, mimeType, fileSize, metadata, capturedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [ev.id, 'test-txn-002', 'test-user-2-supervisor', ev.level, ev.type, ev.url, ev.filename, 'image/jpeg', 285000, JSON.stringify({ gpsCoordinates: { latitude: 18.5204, longitude: 73.8567 } }), yesterday]);
    }

    // Evidence for TXN-003 (Rajasthan Copper - Copper Wire)
    const txn003Evidence = [
      { id: 'ev-003-01', type: 'DOCUMENT', filename: 'PO-XYZ-2024-003.jpg', url: demoImages.po_document, level: 1 },
      { id: 'ev-003-02', type: 'DOCUMENT', filename: 'INV-RCI-2024-234.jpg', url: demoImages.invoice, level: 1 },
      { id: 'ev-003-03', type: 'WEIGHBRIDGE_TICKET', filename: 'weighbridge-gross-13500kg.jpg', url: demoImages.weighbridge, level: 2 },
      { id: 'ev-003-04', type: 'PHOTO', filename: 'driver-ramesh-meena.jpg', url: demoImages.driver, level: 3 },
      { id: 'ev-003-05', type: 'DOCUMENT', filename: 'license-ramesh-meena.jpg', url: demoImages.license, level: 3 },
      { id: 'ev-003-06', type: 'PHOTO', filename: 'copper-wire-unload-1.jpg', url: demoImages.unloading_copper, level: 3 },
      { id: 'ev-003-07', type: 'PHOTO', filename: 'copper-wire-unload-2.jpg', url: demoImages.unloading_copper, level: 3 },
      { id: 'ev-003-08', type: 'WEIGHBRIDGE_TICKET', filename: 'weighbridge-tare-8500kg.jpg', url: demoImages.weighbridge, level: 4 }
    ];

    for (const ev of txn003Evidence) {
      await connection.execute(`
        INSERT INTO evidence (id, transactionId, capturedBy, operationalLevel, evidenceType, filePath, fileName, mimeType, fileSize, metadata, capturedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [ev.id, 'test-txn-003', 'test-user-2-supervisor', ev.level, ev.type, ev.url, ev.filename, 'image/jpeg', 265000, JSON.stringify({ gpsCoordinates: { latitude: 18.5204, longitude: 73.8567 } }), yesterday]);
    }

    // Evidence for TXN-004 (Rajasthan Copper - Copper Cathode)
    const txn004Evidence = [
      { id: 'ev-004-01', type: 'DOCUMENT', filename: 'PO-XYZ-2024-006.jpg', url: demoImages.po_document, level: 1 },
      { id: 'ev-004-02', type: 'DOCUMENT', filename: 'INV-RCI-2024-267.jpg', url: demoImages.invoice, level: 1 },
      { id: 'ev-004-03', type: 'WEIGHBRIDGE_TICKET', filename: 'weighbridge-gross-9700kg.jpg', url: demoImages.weighbridge, level: 2 },
      { id: 'ev-004-04', type: 'PHOTO', filename: 'driver-ramesh-meena-2.jpg', url: demoImages.driver, level: 3 },
      { id: 'ev-004-05', type: 'PHOTO', filename: 'copper-cathode-unload-1.jpg', url: demoImages.unloading_copper, level: 3 },
      { id: 'ev-004-06', type: 'WEIGHBRIDGE_TICKET', filename: 'weighbridge-tare-8500kg.jpg', url: demoImages.weighbridge, level: 4 }
    ];

    for (const ev of txn004Evidence) {
      await connection.execute(`
        INSERT INTO evidence (id, transactionId, capturedBy, operationalLevel, evidenceType, filePath, fileName, mimeType, fileSize, metadata, capturedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [ev.id, 'test-txn-004', 'test-user-2-supervisor', ev.level, ev.type, ev.url, ev.filename, 'image/jpeg', 225000, JSON.stringify({ gpsCoordinates: { latitude: 18.5204, longitude: 73.8567 } }), today]);
    }


    // ============================================
    // WORKFLOW CONFIGURATIONS
    // ============================================
    console.log('⚙️ Creating workflow configurations...');
    
    const workflowFields = [
      // L1 - Gate Entry
      { level: 1, name: 'po_document', label: 'PO Document', type: 'FILE', capture: 'CAMERA', validation: 'REQUIRED', edit: 'EDITABLE', minPhoto: 1, maxPhoto: 3, order: 1, help: 'Upload PO document photo' },
      { level: 1, name: 'invoice_document', label: 'Invoice Copy', type: 'FILE', capture: 'CAMERA', validation: 'REQUIRED', edit: 'EDITABLE', minPhoto: 1, maxPhoto: 3, order: 2, help: 'Upload invoice photo' },
      { level: 1, name: 'truck_number', label: 'Truck Number', type: 'TEXT', capture: 'MANUAL', validation: 'REQUIRED', edit: 'EDITABLE', order: 3, help: 'Enter vehicle registration' },
      { level: 1, name: 'driver_name', label: 'Driver Name', type: 'TEXT', capture: 'MANUAL', validation: 'REQUIRED', edit: 'EDITABLE', order: 4, help: 'Enter driver name' },
      { level: 1, name: 'driver_mobile', label: 'Driver Mobile', type: 'TEXT', capture: 'MANUAL', validation: 'REQUIRED', edit: 'EDITABLE', order: 5, help: 'Enter driver mobile' },
      // L2 - Initial Weighing
      { level: 2, name: 'gross_weight', label: 'Gross Weight (KG)', type: 'NUMBER', capture: 'MANUAL', validation: 'REQUIRED', edit: 'EDITABLE', order: 1, help: 'Enter loaded truck weight' },
      { level: 2, name: 'weighbridge_photo', label: 'Weighbridge Photo', type: 'FILE', capture: 'CAMERA', validation: 'REQUIRED', edit: 'EDITABLE', minPhoto: 1, maxPhoto: 2, order: 2, help: 'Photo of weighbridge display' },
      // L3 - Unloading
      { level: 3, name: 'driver_photo', label: 'Driver Photo', type: 'FILE', capture: 'CAMERA', validation: 'REQUIRED', edit: 'EDITABLE', minPhoto: 1, maxPhoto: 1, order: 1, help: 'Driver face photo' },
      { level: 3, name: 'driver_license_photo', label: 'License Photo', type: 'FILE', capture: 'CAMERA', validation: 'REQUIRED', edit: 'EDITABLE', minPhoto: 1, maxPhoto: 2, order: 2, help: 'Driver license photo' },
      { level: 3, name: 'unloading_photos', label: 'Unloading Photos', type: 'FILE', capture: 'CAMERA', validation: 'REQUIRED', edit: 'EDITABLE', minPhoto: 3, maxPhoto: 10, order: 3, help: 'Photos during unloading' },
      { level: 3, name: 'unloading_notes', label: 'Unloading Notes', type: 'TEXT', capture: 'MANUAL', validation: 'OPTIONAL', edit: 'EDITABLE', order: 4, help: 'Observations during unloading' },
      // L4 - Final Weighing
      { level: 4, name: 'tare_weight', label: 'Tare Weight (KG)', type: 'NUMBER', capture: 'MANUAL', validation: 'REQUIRED', edit: 'EDITABLE', order: 1, help: 'Enter empty truck weight' },
      { level: 4, name: 'empty_weighbridge_photo', label: 'Empty Weight Photo', type: 'FILE', capture: 'CAMERA', validation: 'REQUIRED', edit: 'EDITABLE', minPhoto: 1, maxPhoto: 2, order: 2, help: 'Photo of empty weight display' },
      { level: 4, name: 'material_count', label: 'Material Count', type: 'NUMBER', capture: 'MANUAL', validation: 'OPTIONAL', edit: 'EDITABLE', order: 3, help: 'Final material count' },
      // L5 - Supervisor Review
      { level: 5, name: 'supervisor_review_notes', label: 'Review Notes', type: 'TEXT', capture: 'MANUAL', validation: 'REQUIRED', edit: 'EDITABLE', order: 1, help: 'Supervisor comments' },
      { level: 5, name: 'document_verification_status', label: 'Document Status', type: 'SELECT', capture: 'MANUAL', validation: 'REQUIRED', edit: 'EDITABLE', order: 2, help: 'Verification status' },
      { level: 5, name: 'approval_status', label: 'Approval Status', type: 'SELECT', capture: 'MANUAL', validation: 'REQUIRED', edit: 'EDITABLE', order: 3, help: 'Final approval' },
      // L6 - Gate Pass
      { level: 6, name: 'gate_pass_number', label: 'Gate Pass Number', type: 'TEXT', capture: 'AUTO', validation: 'REQUIRED', edit: 'READ_ONLY', order: 1, help: 'Auto-generated gate pass' },
      { level: 6, name: 'exit_time', label: 'Exit Time', type: 'DATE', capture: 'AUTO', validation: 'REQUIRED', edit: 'READ_ONLY', order: 2, help: 'Exit timestamp' }
    ];

    for (const field of workflowFields) {
      for (const tenantId of [tenant1Id, tenant2Id]) {
        await connection.execute(`
          INSERT INTO workflow_configurations (id, tenantId, operationalLevel, fieldName, fieldLabel, fieldType, captureType, validationType, editability, minPhotoCount, maxPhotoCount, displayOrder, helpText, version, isActive, effectiveFrom, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())
        `, [
          `wf-${tenantId}-${field.level}-${field.name}`,
          tenantId, field.level, field.name, field.label, field.type, field.capture, field.validation, field.edit,
          field.minPhoto || 0, field.maxPhoto || 5, field.order, field.help, 1, true
        ]);
      }
    }

    // ============================================
    // SUMMARY
    // ============================================
    console.log('\n✅ Test data created successfully!');
    console.log('\n📊 DATA SUMMARY:');
    console.log('================');
    console.log('TENANTS: 2');
    console.log('  - ABC Scrap Industries Ltd (test-tenant-1)');
    console.log('  - XYZ Metal Recyclers Pvt Ltd (test-tenant-2)');
    console.log('');
    console.log('VENDORS (XYZ Metal - test-tenant-2): 4');
    console.log('  - Gujarat Metal Works (Aluminum, Brass)');
    console.log('  - Maharashtra Steel Traders (HMS Steel, Shredded Steel)');
    console.log('  - Rajasthan Copper Industries (Copper Wire, Copper Cathode)');
    console.log('  - Karnataka Recyclers [BLACKLISTED] (Mixed Metal, E-Waste)');
    console.log('');
    console.log('PURCHASE ORDERS: 6 (Each linked to ONE vendor)');
    console.log('  - PO-XYZ-2024-001: Gujarat Metal Works → Aluminum Scrap (PARTIAL)');
    console.log('  - PO-XYZ-2024-002: Maharashtra Steel → HMS 1 Steel (PARTIAL)');
    console.log('  - PO-XYZ-2024-003: Rajasthan Copper → Copper Wire (COMPLETED)');
    console.log('  - PO-XYZ-2024-004: Gujarat Metal Works → Brass Scrap (PENDING)');
    console.log('  - PO-XYZ-2024-005: Maharashtra Steel → Shredded Steel (PENDING)');
    console.log('  - PO-XYZ-2024-006: Rajasthan Copper → Copper Cathode (PARTIAL)');
    console.log('');
    console.log('TRANSACTIONS: 8');
    console.log('  COMPLETED (Ready for Lab QC): 4');
    console.log('    - TXN-XYZ-2024-001: Gujarat Metal → Aluminum (GRN-XYZ-2024-0001)');
    console.log('    - TXN-XYZ-2024-002: Maharashtra Steel → HMS Steel (GRN-XYZ-2024-0002)');
    console.log('    - TXN-XYZ-2024-003: Rajasthan Copper → Copper Wire (GRN-XYZ-2024-0003)');
    console.log('    - TXN-XYZ-2024-004: Rajasthan Copper → Copper Cathode (GRN-XYZ-2024-0004)');
    console.log('  IN-PROGRESS: 4');
    console.log('    - TXN-XYZ-2024-005: Step 2 (Initial Weighing)');
    console.log('    - TXN-XYZ-2024-006: Step 3 (Unloading)');
    console.log('    - TXN-XYZ-2024-007: Step 4 (Final Weighing)');
    console.log('    - TXN-XYZ-2024-008: Step 5 (Supervisor Review)');
    console.log('');
    console.log('EVIDENCE PHOTOS: 31 demo images attached to completed transactions');
    console.log('');
    console.log('🔑 LOGIN CREDENTIALS:');
    console.log('  XYZ Metal Recyclers:');
    console.log('    Owner: owner@xyzmetal.com / password123');
    console.log('    Supervisor: supervisor@xyzmetal.com / password123');
    console.log('    Lab Tech: lab@xyzmetal.com / password123');

  } catch (error) {
    console.error('❌ Error creating test data:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

createTestData();
