/**
 * Simple script to seed 20 sport fields using EXISTING facilities
 * Usage: node scripts/seed-simple.js
 */

const { poolPromise } = require('../config/db');
const sql = require('mssql');

async function seedSimpleData() {
  console.log('\n🚀 Simple Sport Fields Seeding\n');
  
  try {
    const pool = await poolPromise;
    
    // Step 1: Check and create basic Area if not exists
    console.log('📋 Step 1: Checking Area...');
    let areaResult = await pool.request().query('SELECT TOP 1 * FROM Area');
    
    if (areaResult.recordset.length === 0) {
      console.log('   Creating Area "TP.HCM"...');
      await pool.request()
        .input('AreaName', sql.VarChar, 'TP.HCM')
        .query('INSERT INTO Area (AreaName) VALUES (@AreaName)');
      areaResult = await pool.request().query('SELECT TOP 1 * FROM Area');
    }
    
    const areaId = areaResult.recordset[0].AreaID;
    console.log(`   ✅ Using AreaID: ${areaId}\n`);
    
    // Step 2: Check and create basic Account (Owner) if not exists
    console.log('📋 Step 2: Checking Account...');
    let ownerResult = await pool.request().query('SELECT TOP 1 * FROM Account');
    
    if (ownerResult.recordset.length === 0) {
      console.log('   No accounts found! Please create an account first.');
      console.log('   You can register through the frontend or manually insert into Account table.');
      process.exit(1);
    }
    
    const ownerId = ownerResult.recordset[0].AccountID;
    console.log(`   ✅ Using OwnerID: ${ownerId} (${ownerResult.recordset[0].Username})\n`);
    
    // Step 3: Check Sport Types
    console.log('📋 Step 3: Checking Sport Types...');
    const sportTypes = await pool.request().query('SELECT * FROM SportType');
    
    if (sportTypes.recordset.length === 0) {
      console.log('   Creating basic sport types...');
      const types = ['Bóng Đá', 'Bóng Rổ', 'Cầu Lông', 'Tennis', 'Bóng Chuyền', 'Bơi Lội'];
      for (const type of types) {
        await pool.request()
          .input('SportName', sql.VarChar, type)
          .query('INSERT INTO SportType (SportName) VALUES (@SportName)');
      }
    }
    
    const allSportTypes = await pool.request().query('SELECT * FROM SportType');
    console.log(`   ✅ Found ${allSportTypes.recordset.length} sport types\n`);
    
    // Step 4: Check and create Facilities
    console.log('📋 Step 4: Checking Facilities...');
    let facilities = await pool.request().query('SELECT * FROM Facility');
    
    if (facilities.recordset.length === 0) {
      console.log('   Creating 6 facilities...');
      const facilityNames = [
        'Sân Bóng Thể Thao A',
        'Trung Tâm Thể Thao B',
        'Câu Lạc Bộ Cầu Lông C',
        'Sân Tennis D',
        'Trung Tâm Đa Năng E',
        'Bể Bơi F'
      ];
      
      for (const name of facilityNames) {
        await pool.request()
          .input('FacilityName', sql.VarChar, name)
          .input('AreaID', sql.Int, areaId)
          .input('OwnerID', sql.Int, ownerId)
          .query('INSERT INTO Facility (FacilityName, AreaID, OwnerID) VALUES (@FacilityName, @AreaID, @OwnerID)');
      }
      
      facilities = await pool.request().query('SELECT * FROM Facility');
    }
    
    console.log(`   ✅ Found ${facilities.recordset.length} facilities\n`);
    
    // Step 5: Insert 20 Sport Fields
    console.log('📋 Step 5: Inserting 20 Sport Fields...\n');
    
    const fields = [
      // Bóng Đá
      { name: 'Sân Bóng Đá Mini 1', type: '5v5', price: 300000, facilityIdx: 0, sportTypeIdx: 0 },
      { name: 'Sân Bóng Đá Mini 2', type: '5v5', price: 320000, facilityIdx: 0, sportTypeIdx: 0 },
      { name: 'Sân Bóng Đá 7 Người', type: '7v7', price: 500000, facilityIdx: 0, sportTypeIdx: 0 },
      { name: 'Sân Bóng Đá 11 Người', type: '11v11', price: 800000, facilityIdx: 0, sportTypeIdx: 0 },
      { name: 'Sân Bóng Đá Cỏ Nhân Tạo', type: '5v5', price: 350000, facilityIdx: 1, sportTypeIdx: 0 },
      
      // Bóng Rổ
      { name: 'Sân Bóng Rổ Trong Nhà 1', type: 'Indoor', price: 250000, facilityIdx: 1, sportTypeIdx: 1 },
      { name: 'Sân Bóng Rổ Ngoài Trời 1', type: 'Outdoor', price: 200000, facilityIdx: 1, sportTypeIdx: 1 },
      { name: 'Sân Bóng Rổ Pro Court', type: 'Indoor', price: 300000, facilityIdx: 2, sportTypeIdx: 1 },
      
      // Cầu Lông
      { name: 'Sân Cầu Lông A1', type: 'Single', price: 80000, facilityIdx: 2, sportTypeIdx: 2 },
      { name: 'Sân Cầu Lông A2', type: 'Single', price: 80000, facilityIdx: 2, sportTypeIdx: 2 },
      { name: 'Sân Cầu Lông B1', type: 'Double', price: 100000, facilityIdx: 2, sportTypeIdx: 2 },
      { name: 'Sân Cầu Lông B2', type: 'Double', price: 100000, facilityIdx: 2, sportTypeIdx: 2 },
      { name: 'Sân Cầu Lông VIP', type: 'Double', price: 150000, facilityIdx: 3, sportTypeIdx: 2 },
      
      // Tennis
      { name: 'Sân Tennis Đơn 1', type: 'Singles', price: 200000, facilityIdx: 3, sportTypeIdx: 3 },
      { name: 'Sân Tennis Đôi 1', type: 'Doubles', price: 250000, facilityIdx: 3, sportTypeIdx: 3 },
      { name: 'Sân Tennis Pro', type: 'Doubles', price: 300000, facilityIdx: 4, sportTypeIdx: 3 },
      
      // Bóng Chuyền
      { name: 'Sân Bóng Chuyền 1', type: 'Indoor', price: 200000, facilityIdx: 4, sportTypeIdx: 4 },
      { name: 'Sân Bóng Chuyền Bãi Biển', type: 'Beach', price: 250000, facilityIdx: 4, sportTypeIdx: 4 },
      
      // Bơi Lội
      { name: 'Bể Bơi Olympic 1', type: '50m', price: 150000, facilityIdx: 5, sportTypeIdx: 5 },
      { name: 'Bể Bơi Trẻ Em', type: '25m', price: 100000, facilityIdx: 5, sportTypeIdx: 5 },
    ];
    
    let successCount = 0;
    
    for (const field of fields) {
      try {
        const facilityId = facilities.recordset[field.facilityIdx]?.FacilityID;
        const sportTypeId = allSportTypes.recordset[field.sportTypeIdx]?.SportTypeID;
        
        if (!facilityId || !sportTypeId) {
          console.log(`   ❌ Skipping ${field.name} - Missing facility or sport type`);
          continue;
        }
        
        const result = await pool.request()
          .input('FieldName', sql.VarChar, field.name)
          .input('FieldType', sql.VarChar, field.type)
          .input('RentalPrice', sql.Decimal(10, 2), field.price)
          .input('Status', sql.VarChar, 'Available')
          .input('FacilityID', sql.Int, facilityId)
          .input('SportTypeID', sql.Int, sportTypeId)
          .query(`
            INSERT INTO SportField (FieldName, FieldType, RentalPrice, Status, FacilityID, SportTypeID)
            OUTPUT INSERTED.FieldID, INSERTED.FieldName, INSERTED.RentalPrice
            VALUES (@FieldName, @FieldType, @RentalPrice, @Status, @FacilityID, @SportTypeID)
          `);
        
        const inserted = result.recordset[0];
        console.log(`   ✅ [${inserted.FieldID}] ${inserted.FieldName} - ${inserted.RentalPrice.toLocaleString('vi-VN')}đ`);
        successCount++;
        
      } catch (error) {
        console.log(`   ❌ Failed: ${field.name} - ${error.message}`);
      }
    }
    
    console.log(`\n✅ Successfully inserted ${successCount}/20 sport fields!\n`);
    
    // Show all fields
    console.log('📋 ALL SPORT FIELDS:\n');
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
    
    console.log('\n✅ Seeding completed!\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    const pool = await poolPromise;
    await pool.close();
  }
}

seedSimpleData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
