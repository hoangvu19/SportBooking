/**
 * Comprehensive Booking System Database Test
 * Tests all tables and relationships related to booking
 * Usage: node scripts/test-booking-database.js
 */

const { poolPromise } = require('../config/db');
const sql = require('mssql');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  console.log('\n' + '='.repeat(70));
  log(title, 'cyan');
  console.log('='.repeat(70));
}

function subsection(title) {
  console.log('\n' + '-'.repeat(70));
  log(title, 'yellow');
  console.log('-'.repeat(70));
}

async function testTableStructure(pool, tableName) {
  try {
    const result = await pool.request().query(`
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        CHARACTER_MAXIMUM_LENGTH,
        IS_NULLABLE,
        COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '${tableName}'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log(`\n📋 Table: ${tableName}`);
    console.log(`   Columns: ${result.recordset.length}`);
    result.recordset.forEach(col => {
      const nullable = col.IS_NULLABLE === 'YES' ? '(nullable)' : '(required)';
      const length = col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : '';
      console.log(`   - ${col.COLUMN_NAME}: ${col.DATA_TYPE}${length} ${nullable}`);
    });
    
    return { success: true, columns: result.recordset.length };
  } catch (error) {
    log(`   ❌ Error: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function testTableData(pool, tableName, displayName) {
  try {
    const countResult = await pool.request().query(`SELECT COUNT(*) as count FROM ${tableName}`);
    const count = countResult.recordset[0].count;
    
    const sampleResult = await pool.request().query(`SELECT TOP 5 * FROM ${tableName}`);
    
    console.log(`\n📊 ${displayName}:`);
    console.log(`   Total records: ${count}`);
    
    if (sampleResult.recordset.length > 0) {
      console.log(`   Sample data (first ${Math.min(5, count)} records):`);
      sampleResult.recordset.forEach((record, index) => {
        console.log(`\n   ${index + 1}. Record:`, JSON.stringify(record, null, 6).replace(/\n/g, '\n   '));
      });
    } else {
      log('   ⚠️  No data found', 'yellow');
    }
    
    return { success: true, count };
  } catch (error) {
    log(`   ❌ Error: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function testForeignKeys(pool) {
  try {
    const result = await pool.request().query(`
      SELECT 
        fk.name AS FK_Name,
        tp.name AS Parent_Table,
        cp.name AS Parent_Column,
        tr.name AS Referenced_Table,
        cr.name AS Referenced_Column
      FROM sys.foreign_keys AS fk
      INNER JOIN sys.tables AS tp ON fk.parent_object_id = tp.object_id
      INNER JOIN sys.tables AS tr ON fk.referenced_object_id = tr.object_id
      INNER JOIN sys.foreign_key_columns AS fkc ON fk.object_id = fkc.constraint_object_id
      INNER JOIN sys.columns AS cp ON fkc.parent_column_id = cp.column_id AND fkc.parent_object_id = cp.object_id
      INNER JOIN sys.columns AS cr ON fkc.referenced_column_id = cr.column_id AND fkc.referenced_object_id = cr.object_id
      WHERE tp.name IN ('Booking', 'Invoice', 'SportField', 'Facility')
      ORDER BY tp.name, fk.name
    `);
    
    console.log(`\n🔗 Foreign Key Relationships:`);
    console.log(`   Total constraints: ${result.recordset.length}`);
    
    result.recordset.forEach(fk => {
      console.log(`\n   ${fk.Parent_Table}.${fk.Parent_Column}`);
      console.log(`     → ${fk.Referenced_Table}.${fk.Referenced_Column}`);
      console.log(`     (${fk.FK_Name})`);
    });
    
    return { success: true, count: result.recordset.length };
  } catch (error) {
    log(`   ❌ Error: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function testBookingQueries(pool) {
  subsection('Testing Booking Queries');
  
  const tests = [];
  
  // Test 1: Get all bookings with customer info
  try {
    console.log('\n🧪 Test 1: Get all bookings with customer details');
    const result = await pool.request().query(`
      SELECT TOP 5
        b.BookingID,
        b.StartTime,
        b.EndTime,
        b.Status,
        b.TotalAmount,
        a.Username,
        a.FullName,
        a.Email,
        sf.FieldName,
        f.FacilityName
      FROM Booking b
      JOIN Account a ON b.CustomerID = a.AccountID
      JOIN SportField sf ON b.FieldID = sf.FieldID
      JOIN Facility f ON sf.FacilityID = f.FacilityID
      ORDER BY b.BookingID DESC
    `);
    
    console.log(`   ✅ Found ${result.recordset.length} bookings`);
    result.recordset.forEach((booking, index) => {
      console.log(`\n   ${index + 1}. Booking #${booking.BookingID}`);
      console.log(`      Customer: ${booking.FullName} (${booking.Username})`);
      console.log(`      Field: ${booking.FieldName} at ${booking.FacilityName}`);
      console.log(`      Time: ${booking.StartTime} → ${booking.EndTime}`);
      console.log(`      Status: ${booking.Status} | Amount: ${booking.TotalAmount?.toLocaleString('vi-VN')}đ`);
    });
    tests.push({ name: 'Get bookings with details', success: true });
  } catch (error) {
    log(`   ❌ Failed: ${error.message}`, 'red');
    tests.push({ name: 'Get bookings with details', success: false, error: error.message });
  }
  
  // Test 2: Get booking statistics
  try {
    console.log('\n🧪 Test 2: Booking statistics');
    const result = await pool.request().query(`
      SELECT 
        Status,
        COUNT(*) as Count,
        SUM(TotalAmount) as TotalRevenue,
        AVG(TotalAmount) as AvgAmount
      FROM Booking
      GROUP BY Status
    `);
    
    console.log('   ✅ Statistics by status:');
    result.recordset.forEach(stat => {
      console.log(`\n      ${stat.Status}:`);
      console.log(`      - Count: ${stat.Count} bookings`);
      console.log(`      - Total Revenue: ${stat.TotalRevenue?.toLocaleString('vi-VN')}đ`);
      console.log(`      - Average: ${stat.AvgAmount?.toLocaleString('vi-VN')}đ`);
    });
    tests.push({ name: 'Booking statistics', success: true });
  } catch (error) {
    log(`   ❌ Failed: ${error.message}`, 'red');
    tests.push({ name: 'Booking statistics', success: false, error: error.message });
  }
  
  // Test 3: Check for booking conflicts
  try {
    console.log('\n🧪 Test 3: Check for overlapping bookings (conflicts)');
    const result = await pool.request().query(`
      SELECT 
        b1.BookingID as Booking1,
        b2.BookingID as Booking2,
        b1.FieldID,
        sf.FieldName,
        b1.StartTime as Start1,
        b1.EndTime as End1,
        b2.StartTime as Start2,
        b2.EndTime as End2
      FROM Booking b1
      JOIN Booking b2 ON b1.FieldID = b2.FieldID 
        AND b1.BookingID < b2.BookingID
        AND b1.Status != 'Cancelled'
        AND b2.Status != 'Cancelled'
        AND (
          (b1.StartTime < b2.EndTime AND b1.EndTime > b2.StartTime)
        )
      JOIN SportField sf ON b1.FieldID = sf.FieldID
    `);
    
    if (result.recordset.length === 0) {
      log('   ✅ No booking conflicts found!', 'green');
    } else {
      log(`   ⚠️  Found ${result.recordset.length} potential conflicts:`, 'yellow');
      result.recordset.forEach((conflict, index) => {
        console.log(`\n      ${index + 1}. Field: ${conflict.FieldName}`);
        console.log(`         Booking #${conflict.Booking1}: ${conflict.Start1} → ${conflict.End1}`);
        console.log(`         Booking #${conflict.Booking2}: ${conflict.Start2} → ${conflict.End2}`);
      });
    }
    tests.push({ name: 'Check booking conflicts', success: true, conflicts: result.recordset.length });
  } catch (error) {
    log(`   ❌ Failed: ${error.message}`, 'red');
    tests.push({ name: 'Check booking conflicts', success: false, error: error.message });
  }
  
  // Test 4: Popular fields (most bookings)
  try {
    console.log('\n🧪 Test 4: Most popular sport fields');
    const result = await pool.request().query(`
      SELECT TOP 5
        sf.FieldID,
        sf.FieldName,
        f.FacilityName,
        st.SportName,
        COUNT(b.BookingID) as BookingCount,
        SUM(b.TotalAmount) as TotalRevenue
      FROM SportField sf
      LEFT JOIN Booking b ON sf.FieldID = b.FieldID
      LEFT JOIN Facility f ON sf.FacilityID = f.FacilityID
      LEFT JOIN SportType st ON sf.SportTypeID = st.SportTypeID
      GROUP BY sf.FieldID, sf.FieldName, f.FacilityName, st.SportName
      ORDER BY BookingCount DESC
    `);
    
    console.log('   ✅ Top 5 most booked fields:');
    result.recordset.forEach((field, index) => {
      console.log(`\n      ${index + 1}. ${field.FieldName} (${field.SportName})`);
      console.log(`         Facility: ${field.FacilityName}`);
      console.log(`         Bookings: ${field.BookingCount}`);
      console.log(`         Revenue: ${field.TotalRevenue?.toLocaleString('vi-VN')}đ`);
    });
    tests.push({ name: 'Popular fields', success: true });
  } catch (error) {
    log(`   ❌ Failed: ${error.message}`, 'red');
    tests.push({ name: 'Popular fields', success: false, error: error.message });
  }
  
  // Test 5: Active customers
  try {
    console.log('\n🧪 Test 5: Most active customers');
    const result = await pool.request().query(`
      SELECT TOP 5
        a.AccountID,
        a.Username,
        a.FullName,
        a.Email,
        COUNT(b.BookingID) as BookingCount,
        SUM(b.TotalAmount) as TotalSpent
      FROM Account a
      LEFT JOIN Booking b ON a.AccountID = b.CustomerID
      GROUP BY a.AccountID, a.Username, a.FullName, a.Email
      HAVING COUNT(b.BookingID) > 0
      ORDER BY BookingCount DESC
    `);
    
    console.log('   ✅ Top 5 customers:');
    result.recordset.forEach((customer, index) => {
      console.log(`\n      ${index + 1}. ${customer.FullName} (@${customer.Username})`);
      console.log(`         Email: ${customer.Email}`);
      console.log(`         Total bookings: ${customer.BookingCount}`);
      console.log(`         Total spent: ${customer.TotalSpent?.toLocaleString('vi-VN')}đ`);
    });
    tests.push({ name: 'Active customers', success: true });
  } catch (error) {
    log(`   ❌ Failed: ${error.message}`, 'red');
    tests.push({ name: 'Active customers', success: false, error: error.message });
  }
  
  return tests;
}

async function testInvoiceIntegration(pool) {
  subsection('Testing Invoice Integration');
  
  const tests = [];
  
  // Test 1: Bookings with invoices
  try {
    console.log('\n🧪 Test 1: Bookings with invoice details');
    const result = await pool.request().query(`
      SELECT TOP 5
        b.BookingID,
        b.StartTime,
        b.Status,
        b.TotalAmount as BookingAmount,
        i.InvoiceID,
        i.TotalAmount as InvoiceAmount,
        i.Status as PaymentStatus,
        i.PaymentMethod,
        i.CreatedDate
      FROM Booking b
      LEFT JOIN Invoice i ON b.BookingID = i.BookingID
      ORDER BY b.BookingID DESC
    `);
    
    console.log(`   ✅ Found ${result.recordset.length} bookings`);
    result.recordset.forEach((record, index) => {
      console.log(`\n      ${index + 1}. Booking #${record.BookingID}`);
      console.log(`         Status: ${record.Status}`);
      console.log(`         Booking Amount: ${record.BookingAmount?.toLocaleString('vi-VN')}đ`);
      if (record.InvoiceID) {
        console.log(`         Invoice #${record.InvoiceID}:`);
        console.log(`         - Amount: ${record.InvoiceAmount?.toLocaleString('vi-VN')}đ`);
        console.log(`         - Payment: ${record.PaymentStatus} (${record.PaymentMethod || 'N/A'})`);
        console.log(`         - Created: ${record.CreatedDate}`);
      } else {
        log('         ⚠️  No invoice found', 'yellow');
      }
    });
    tests.push({ name: 'Bookings with invoices', success: true });
  } catch (error) {
    log(`   ❌ Failed: ${error.message}`, 'red');
    tests.push({ name: 'Bookings with invoices', success: false, error: error.message });
  }
  
  // Test 2: Payment statistics
  try {
    console.log('\n🧪 Test 2: Payment statistics');
    const result = await pool.request().query(`
      SELECT 
        Status as PaymentStatus,
        COUNT(*) as Count,
        SUM(TotalAmount) as TotalAmount
      FROM Invoice
      GROUP BY Status
    `);
    
    console.log('   ✅ Payment statistics:');
    result.recordset.forEach(stat => {
      console.log(`\n      ${stat.PaymentStatus}:`);
      console.log(`      - Count: ${stat.Count} invoices`);
      console.log(`      - Total: ${stat.TotalAmount?.toLocaleString('vi-VN')}đ`);
    });
    tests.push({ name: 'Payment statistics', success: true });
  } catch (error) {
    log(`   ❌ Failed: ${error.message}`, 'red');
    tests.push({ name: 'Payment statistics', success: false, error: error.message });
  }
  
  return tests;
}

async function testDataIntegrity(pool) {
  subsection('Testing Data Integrity');
  
  const tests = [];
  
  // Test 1: Orphaned bookings (no customer)
  try {
    console.log('\n🧪 Test 1: Check for orphaned bookings');
    const result = await pool.request().query(`
      SELECT b.*
      FROM Booking b
      LEFT JOIN Account a ON b.CustomerID = a.AccountID
      WHERE a.AccountID IS NULL
    `);
    
    if (result.recordset.length === 0) {
      log('   ✅ No orphaned bookings found', 'green');
    } else {
      log(`   ⚠️  Found ${result.recordset.length} orphaned bookings`, 'yellow');
    }
    tests.push({ name: 'Orphaned bookings', success: true, issues: result.recordset.length });
  } catch (error) {
    log(`   ❌ Failed: ${error.message}`, 'red');
    tests.push({ name: 'Orphaned bookings', success: false, error: error.message });
  }
  
  // Test 2: Bookings with invalid field references
  try {
    console.log('\n🧪 Test 2: Check for invalid field references');
    const result = await pool.request().query(`
      SELECT b.*
      FROM Booking b
      LEFT JOIN SportField sf ON b.FieldID = sf.FieldID
      WHERE sf.FieldID IS NULL
    `);
    
    if (result.recordset.length === 0) {
      log('   ✅ All bookings have valid field references', 'green');
    } else {
      log(`   ⚠️  Found ${result.recordset.length} bookings with invalid fields`, 'yellow');
    }
    tests.push({ name: 'Invalid field refs', success: true, issues: result.recordset.length });
  } catch (error) {
    log(`   ❌ Failed: ${error.message}`, 'red');
    tests.push({ name: 'Invalid field refs', success: false, error: error.message });
  }
  
  // Test 3: Check for invalid time ranges
  try {
    console.log('\n🧪 Test 3: Check for invalid booking times');
    const result = await pool.request().query(`
      SELECT BookingID, StartTime, EndTime, Status
      FROM Booking
      WHERE EndTime <= StartTime
    `);
    
    if (result.recordset.length === 0) {
      log('   ✅ All booking times are valid', 'green');
    } else {
      log(`   ⚠️  Found ${result.recordset.length} bookings with invalid times`, 'yellow');
      result.recordset.forEach(b => {
        console.log(`      Booking #${b.BookingID}: ${b.StartTime} → ${b.EndTime} (${b.Status})`);
      });
    }
    tests.push({ name: 'Invalid time ranges', success: true, issues: result.recordset.length });
  } catch (error) {
    log(`   ❌ Failed: ${error.message}`, 'red');
    tests.push({ name: 'Invalid time ranges', success: false, error: error.message });
  }
  
  // Test 4: Check for NULL TotalAmount
  try {
    console.log('\n🧪 Test 4: Check for bookings with NULL TotalAmount');
    const result = await pool.request().query(`
      SELECT BookingID, StartTime, EndTime, Status, TotalAmount
      FROM Booking
      WHERE TotalAmount IS NULL OR TotalAmount <= 0
    `);
    
    if (result.recordset.length === 0) {
      log('   ✅ All bookings have valid amounts', 'green');
    } else {
      log(`   ⚠️  Found ${result.recordset.length} bookings with invalid amounts`, 'yellow');
      result.recordset.forEach(b => {
        console.log(`      Booking #${b.BookingID}: Amount = ${b.TotalAmount} (${b.Status})`);
      });
    }
    tests.push({ name: 'Invalid amounts', success: true, issues: result.recordset.length });
  } catch (error) {
    log(`   ❌ Failed: ${error.message}`, 'red');
    tests.push({ name: 'Invalid amounts', success: false, error: error.message });
  }
  
  return tests;
}

async function runAllTests() {
  section('🚀 BOOKING SYSTEM DATABASE TESTING');
  console.log(`Time: ${new Date().toLocaleString('vi-VN')}`);
  
  let allTests = [];
  
  try {
    const pool = await poolPromise;
    log('\n✅ Database connection successful', 'green');
    
    // Test 1: Table Structures
    section('📋 STEP 1: Testing Table Structures');
    const tables = [
      'Account',
      'Area', 
      'SportType',
      'Facility',
      'SportField',
      'Booking',
      'Invoice'
    ];
    
    for (const table of tables) {
      await testTableStructure(pool, table);
    }
    
    // Test 2: Foreign Keys
    section('🔗 STEP 2: Testing Foreign Key Relationships');
    await testForeignKeys(pool);
    
    // Test 3: Table Data
    section('📊 STEP 3: Testing Table Data');
    await testTableData(pool, 'Account', 'User Accounts');
    await testTableData(pool, 'SportType', 'Sport Types');
    await testTableData(pool, 'Area', 'Areas');
    await testTableData(pool, 'Facility', 'Facilities');
    await testTableData(pool, 'SportField', 'Sport Fields');
    await testTableData(pool, 'Booking', 'Bookings');
    await testTableData(pool, 'Invoice', 'Invoices');
    
    // Test 4: Booking Queries
    section('🧪 STEP 4: Testing Booking Queries');
    const bookingTests = await testBookingQueries(pool);
    allTests = allTests.concat(bookingTests);
    
    // Test 5: Invoice Integration
    section('💰 STEP 5: Testing Invoice Integration');
    const invoiceTests = await testInvoiceIntegration(pool);
    allTests = allTests.concat(invoiceTests);
    
    // Test 6: Data Integrity
    section('🛡️  STEP 6: Testing Data Integrity');
    const integrityTests = await testDataIntegrity(pool);
    allTests = allTests.concat(integrityTests);
    
    // Summary
    section('📊 TEST SUMMARY');
    const passed = allTests.filter(t => t.success).length;
    const failed = allTests.filter(t => !t.success).length;
    
    console.log(`\n✅ Passed: ${passed} tests`);
    console.log(`❌ Failed: ${failed} tests`);
    console.log(`📈 Total: ${allTests.length} tests\n`);
    
    if (failed === 0) {
      log('✅ All tests passed successfully!', 'green');
    } else {
      log('⚠️  Some tests failed. Check logs above.', 'yellow');
      console.log('\nFailed tests:');
      allTests.filter(t => !t.success).forEach(t => {
        console.log(`  ❌ ${t.name}: ${t.error}`);
      });
    }
    
    // Data integrity issues summary
    const integrityIssues = integrityTests.filter(t => t.issues > 0);
    if (integrityIssues.length > 0) {
      console.log('\n⚠️  Data Integrity Issues:');
      integrityIssues.forEach(issue => {
        console.log(`  - ${issue.name}: ${issue.issues} issue(s)`);
      });
    }
    
  } catch (error) {
    log('\n❌ Fatal error during testing:', 'red');
    console.error(error);
  } finally {
    const pool = await poolPromise;
    await pool.close();
    log('\n🔌 Database connection closed', 'cyan');
  }
}

// Run tests
runAllTests()
  .then(() => {
    console.log('\n✅ Testing completed\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Testing failed:', error);
    process.exit(1);
  });
