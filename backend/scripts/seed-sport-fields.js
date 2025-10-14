/**
 * Script to seed 20 sport fields for testing
 * Usage: node scripts/seed-sport-fields.js
 */

const { poolPromise } = require('../config/db');
const sql = require('mssql');

// Sample data for 20 sport fields
const sportFieldsData = [
  // Sân bóng đá (Soccer)
  { fieldName: 'Sân Bóng Đá Mini 1', fieldType: '5v5', rentalPrice: 300000, status: 'Available', facilityId: 1, sportTypeId: 1 },
  { fieldName: 'Sân Bóng Đá Mini 2', fieldType: '5v5', rentalPrice: 320000, status: 'Available', facilityId: 1, sportTypeId: 1 },
  { fieldName: 'Sân Bóng Đá 7 Người', fieldType: '7v7', rentalPrice: 500000, status: 'Available', facilityId: 1, sportTypeId: 1 },
  { fieldName: 'Sân Bóng Đá 11 Người', fieldType: '11v11', rentalPrice: 800000, status: 'Available', facilityId: 1, sportTypeId: 1 },
  { fieldName: 'Sân Bóng Đá Cỏ Nhân Tạo A', fieldType: '5v5', rentalPrice: 350000, status: 'Available', facilityId: 2, sportTypeId: 1 },
  
  // Sân bóng rổ (Basketball)
  { fieldName: 'Sân Bóng Rổ Trong Nhà 1', fieldType: 'Indoor', rentalPrice: 250000, status: 'Available', facilityId: 2, sportTypeId: 2 },
  { fieldName: 'Sân Bóng Rổ Ngoài Trời 1', fieldType: 'Outdoor', rentalPrice: 200000, status: 'Available', facilityId: 2, sportTypeId: 2 },
  { fieldName: 'Sân Bóng Rổ Pro Court', fieldType: 'Indoor', rentalPrice: 300000, status: 'Available', facilityId: 3, sportTypeId: 2 },
  
  // Sân cầu lông (Badminton)
  { fieldName: 'Sân Cầu Lông A1', fieldType: 'Single', rentalPrice: 80000, status: 'Available', facilityId: 3, sportTypeId: 3 },
  { fieldName: 'Sân Cầu Lông A2', fieldType: 'Single', rentalPrice: 80000, status: 'Available', facilityId: 3, sportTypeId: 3 },
  { fieldName: 'Sân Cầu Lông B1', fieldType: 'Double', rentalPrice: 100000, status: 'Available', facilityId: 3, sportTypeId: 3 },
  { fieldName: 'Sân Cầu Lông B2', fieldType: 'Double', rentalPrice: 100000, status: 'Available', facilityId: 3, sportTypeId: 3 },
  { fieldName: 'Sân Cầu Lông VIP', fieldType: 'Double', rentalPrice: 150000, status: 'Available', facilityId: 4, sportTypeId: 3 },
  
  // Sân tennis (Tennis)
  { fieldName: 'Sân Tennis Đơn 1', fieldType: 'Singles', rentalPrice: 200000, status: 'Available', facilityId: 4, sportTypeId: 4 },
  { fieldName: 'Sân Tennis Đôi 1', fieldType: 'Doubles', rentalPrice: 250000, status: 'Available', facilityId: 4, sportTypeId: 4 },
  { fieldName: 'Sân Tennis Pro', fieldType: 'Doubles', rentalPrice: 300000, status: 'Available', facilityId: 5, sportTypeId: 4 },
  
  // Sân bóng chuyền (Volleyball)
  { fieldName: 'Sân Bóng Chuyền 1', fieldType: 'Indoor', rentalPrice: 200000, status: 'Available', facilityId: 5, sportTypeId: 5 },
  { fieldName: 'Sân Bóng Chuyền Bãi Biển', fieldType: 'Beach', rentalPrice: 250000, status: 'Available', facilityId: 5, sportTypeId: 5 },
  
  // Sân bơi (Swimming)
  { fieldName: 'Bể Bơi Olympic 1', fieldType: '50m', rentalPrice: 150000, status: 'Available', facilityId: 6, sportTypeId: 6 },
  { fieldName: 'Bể Bơi Trẻ Em', fieldType: '25m', rentalPrice: 100000, status: 'Available', facilityId: 6, sportTypeId: 6 },
];

async function seedSportFields() {
  console.log('🚀 Starting to seed sport fields...\n');
  
  try {
    const pool = await poolPromise;
    
    // Check if we need to create facilities first
    console.log('📋 Checking existing facilities...');
    const facilitiesCheck = await pool.request().query('SELECT FacilityID, FacilityName FROM Facility');
    console.log(`Found ${facilitiesCheck.recordset.length} facilities`);
    
    if (facilitiesCheck.recordset.length > 0) {
      console.log('Facilities:');
      facilitiesCheck.recordset.forEach(f => {
        console.log(`  - [${f.FacilityID}] ${f.FacilityName}`);
      });
    }
    
    // Check sport types
    console.log('\n📋 Checking existing sport types...');
    const sportTypesCheck = await pool.request().query('SELECT SportTypeID, SportName FROM SportType');
    console.log(`Found ${sportTypesCheck.recordset.length} sport types`);
    
    if (sportTypesCheck.recordset.length > 0) {
      console.log('Sport Types:');
      sportTypesCheck.recordset.forEach(st => {
        console.log(`  - [${st.SportTypeID}] ${st.SportName}`);
      });
    }
    
    // Check existing sport fields
    console.log('\n📋 Checking existing sport fields...');
    const existingFields = await pool.request().query('SELECT COUNT(*) as count FROM SportField');
    const currentCount = existingFields.recordset[0].count;
    console.log(`Currently have ${currentCount} sport fields in database\n`);
    
    // Insert sport fields
    let successCount = 0;
    let errorCount = 0;
    
    console.log('🏟️  Inserting sport fields...\n');
    
    for (const field of sportFieldsData) {
      try {
        const result = await pool.request()
          .input('FieldName', sql.VarChar, field.fieldName)
          .input('FieldType', sql.VarChar, field.fieldType)
          .input('RentalPrice', sql.Decimal(10, 2), field.rentalPrice)
          .input('Status', sql.VarChar, field.status)
          .input('FacilityID', sql.Int, field.facilityId)
          .input('SportTypeID', sql.Int, field.sportTypeId)
          .query(`
            INSERT INTO SportField (FieldName, FieldType, RentalPrice, Status, FacilityID, SportTypeID)
            OUTPUT INSERTED.FieldID, INSERTED.FieldName, INSERTED.RentalPrice
            VALUES (@FieldName, @FieldType, @RentalPrice, @Status, @FacilityID, @SportTypeID)
          `);
        
        const inserted = result.recordset[0];
        console.log(`✅ [${inserted.FieldID}] ${inserted.FieldName} - ${inserted.RentalPrice.toLocaleString('vi-VN')}đ`);
        successCount++;
        
      } catch (error) {
        console.error(`❌ Failed to insert ${field.fieldName}:`, error.message);
        errorCount++;
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully inserted: ${successCount} fields`);
    console.log(`❌ Failed: ${errorCount} fields`);
    console.log(`📈 Total fields now: ${currentCount + successCount}`);
    console.log('='.repeat(60));
    
    // Show final list
    console.log('\n📋 All sport fields in database:');
    const allFields = await pool.request().query(`
      SELECT 
        sf.FieldID,
        sf.FieldName,
        sf.FieldType,
        sf.RentalPrice,
        sf.Status,
        f.FacilityName,
        st.SportName
      FROM SportField sf
      LEFT JOIN Facility f ON sf.FacilityID = f.FacilityID
      LEFT JOIN SportType st ON sf.SportTypeID = st.SportTypeID
      ORDER BY sf.FieldID
    `);
    
    console.log(`\nTotal: ${allFields.recordset.length} fields\n`);
    allFields.recordset.forEach((field, index) => {
      console.log(`${index + 1}. [ID: ${field.FieldID}] ${field.FieldName}`);
      console.log(`   Type: ${field.FieldType} | Price: ${field.RentalPrice.toLocaleString('vi-VN')}đ/hour`);
      console.log(`   Facility: ${field.FacilityName || 'N/A'} | Sport: ${field.SportName || 'N/A'}`);
      console.log(`   Status: ${field.Status}\n`);
    });
    
    console.log('✅ Seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Error seeding sport fields:', error);
    throw error;
  } finally {
    // Close connection
    const pool = await poolPromise;
    await pool.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the seeding
seedSportFields()
  .then(() => {
    console.log('\n✅ Script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
