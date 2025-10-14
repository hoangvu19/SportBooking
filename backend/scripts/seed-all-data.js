/**
 * Complete seed script: SportTypes + Facilities + SportFields
 * Usage: node scripts/seed-all-data.js
 */

const { poolPromise } = require('../config/db');
const sql = require('mssql');

// Sport Types data
const sportTypes = [
  { id: 1, name: 'Bóng Đá' },
  { id: 2, name: 'Bóng Rổ' },
  { id: 3, name: 'Cầu Lông' },
  { id: 4, name: 'Tennis' },
  { id: 5, name: 'Bóng Chuyền' },
  { id: 6, name: 'Bơi Lội' },
];

// Facilities data
const facilities = [
  { id: 1, name: 'Sân Bóng Thể Thao A', areaId: 1, ownerId: 1 },
  { id: 2, name: 'Trung Tâm Thể Thao B', areaId: 1, ownerId: 1 },
  { id: 3, name: 'Câu Lạc Bộ Cầu Lông C', areaId: 1, ownerId: 1 },
  { id: 4, name: 'Sân Tennis D', areaId: 1, ownerId: 1 },
  { id: 5, name: 'Trung Tâm Đa Năng E', areaId: 1, ownerId: 1 },
  { id: 6, name: 'Bể Bơi F', areaId: 1, ownerId: 1 },
];

// Sport Fields data (20 fields)
const sportFields = [
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

async function seedAllData() {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 COMPLETE DATABASE SEEDING');
  console.log('='.repeat(70));
  console.log(`Time: ${new Date().toLocaleString('vi-VN')}\n`);
  
  try {
    const pool = await poolPromise;
    
    // ========================
    // 1. SEED SPORT TYPES
    // ========================
    console.log('📝 Step 1: Seeding Sport Types...');
    let sportTypeCount = 0;
    
    for (const st of sportTypes) {
      try {
        // Check if exists
        const existing = await pool.request()
          .input('SportTypeID', sql.Int, st.id)
          .query('SELECT * FROM SportType WHERE SportTypeID = @SportTypeID');
        
        if (existing.recordset.length > 0) {
          console.log(`   ⏭️  [${st.id}] ${st.name} - Already exists`);
        } else {
          await pool.request()
            .input('SportTypeID', sql.Int, st.id)
            .input('SportName', sql.VarChar, st.name)
            .query(`
              SET IDENTITY_INSERT SportType ON;
              INSERT INTO SportType (SportTypeID, SportName)
              VALUES (@SportTypeID, @SportName);
              SET IDENTITY_INSERT SportType OFF;
            `);
          console.log(`   ✅ [${st.id}] ${st.name}`);
          sportTypeCount++;
        }
      } catch (error) {
        console.error(`   ❌ Failed to insert ${st.name}:`, error.message);
      }
    }
    
    console.log(`\n   Summary: ${sportTypeCount} sport types inserted\n`);
    
    // ========================
    // 2. SEED FACILITIES
    // ========================
    console.log('📝 Step 2: Seeding Facilities...');
    let facilityCount = 0;
    
    for (const f of facilities) {
      try {
        // Check if exists
        const existing = await pool.request()
          .input('FacilityID', sql.Int, f.id)
          .query('SELECT * FROM Facility WHERE FacilityID = @FacilityID');
        
        if (existing.recordset.length > 0) {
          console.log(`   ⏭️  [${f.id}] ${f.name} - Already exists`);
        } else {
          await pool.request()
            .input('FacilityID', sql.Int, f.id)
            .input('FacilityName', sql.VarChar, f.name)
            .input('AreaID', sql.Int, f.areaId)
            .input('OwnerID', sql.Int, f.ownerId)
            .query(`
              SET IDENTITY_INSERT Facility ON;
              INSERT INTO Facility (FacilityID, FacilityName, AreaID, OwnerID)
              VALUES (@FacilityID, @FacilityName, @AreaID, @OwnerID);
              SET IDENTITY_INSERT Facility OFF;
            `);
          console.log(`   ✅ [${f.id}] ${f.name}`);
          facilityCount++;
        }
      } catch (error) {
        console.error(`   ❌ Failed to insert ${f.name}:`, error.message);
      }
    }
    
    console.log(`\n   Summary: ${facilityCount} facilities inserted\n`);
    
    // ========================
    // 3. SEED SPORT FIELDS
    // ========================
    console.log('📝 Step 3: Seeding Sport Fields...');
    let fieldCount = 0;
    
    for (const field of sportFields) {
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
        console.log(`   ✅ [${inserted.FieldID}] ${inserted.FieldName} - ${inserted.RentalPrice.toLocaleString('vi-VN')}đ`);
        fieldCount++;
        
      } catch (error) {
        console.error(`   ❌ Failed to insert ${field.fieldName}:`, error.message);
      }
    }
    
    console.log(`\n   Summary: ${fieldCount} sport fields inserted\n`);
    
    // ========================
    // 4. FINAL REPORT
    // ========================
    console.log('='.repeat(70));
    console.log('📊 FINAL SUMMARY');
    console.log('='.repeat(70));
    
    // Count all data
    const sportTypeTotal = await pool.request().query('SELECT COUNT(*) as count FROM SportType');
    const facilityTotal = await pool.request().query('SELECT COUNT(*) as count FROM Facility');
    const fieldTotal = await pool.request().query('SELECT COUNT(*) as count FROM SportField');
    
    console.log(`✅ Sport Types: ${sportTypeTotal.recordset[0].count} total`);
    console.log(`✅ Facilities: ${facilityTotal.recordset[0].count} total`);
    console.log(`✅ Sport Fields: ${fieldTotal.recordset[0].count} total`);
    console.log('='.repeat(70));
    
    // Show all sport fields
    console.log('\n📋 ALL SPORT FIELDS IN DATABASE:\n');
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
      ORDER BY st.SportName, sf.FieldID
    `);
    
    let currentSport = null;
    allFields.recordset.forEach((field, index) => {
      if (currentSport !== field.SportName) {
        currentSport = field.SportName;
        console.log(`\n🏆 ${currentSport}:`);
      }
      console.log(`  ${index + 1}. [ID: ${field.FieldID}] ${field.FieldName}`);
      console.log(`     Type: ${field.FieldType} | Price: ${field.RentalPrice.toLocaleString('vi-VN')}đ/hour`);
      console.log(`     Facility: ${field.FacilityName} | Status: ${field.Status}`);
    });
    
    console.log('\n✅ Database seeding completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Error during seeding:', error);
    throw error;
  } finally {
    const pool = await poolPromise;
    await pool.close();
    console.log('\n🔌 Database connection closed\n');
  }
}

// Run the seeding
seedAllData()
  .then(() => {
    console.log('✅ Script finished successfully\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
