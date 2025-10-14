const sql = require('mssql');
const { poolPromise } = require('../config/db');

async function checkDatabaseStructure() {
  try {
    const pool = await poolPromise;
    
    console.log('\n📋 1. Kiểm tra cột trong bảng SportField:');
    const sportFieldCols = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'SportField' 
      ORDER BY ORDINAL_POSITION
    `);
    sportFieldCols.recordset.forEach(r => {
      console.log(`  ✓ ${r.COLUMN_NAME} (${r.DATA_TYPE})`);
    });
    
    console.log('\n📋 2. Kiểm tra cột trong bảng Booking:');
    const bookingCols = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Booking' 
      ORDER BY ORDINAL_POSITION
    `);
    bookingCols.recordset.forEach(r => {
      console.log(`  ✓ ${r.COLUMN_NAME} (${r.DATA_TYPE})`);
    });
    
    console.log('\n📋 3. Lấy mẫu 1 sân với đầy đủ thông tin:');
    const sampleField = await pool.request().query(`
      SELECT TOP 1 
        sf.*, 
        f.FacilityName, 
        st.SportName, 
        a.AreaName,
        a.AreaID
      FROM SportField sf
      JOIN Facility f ON sf.FacilityID = f.FacilityID
      JOIN SportType st ON sf.SportTypeID = st.SportTypeID
      JOIN Area a ON f.AreaID = a.AreaID
      WHERE sf.FieldID = 99
    `);
    console.log('  Thông tin sân ID 99:');
    const field = sampleField.recordset[0];
    if (field) {
      console.log(`    - FieldID: ${field.FieldID}`);
      console.log(`    - FieldName: ${field.FieldName}`);
      console.log(`    - FieldType: ${field.FieldType}`);
      console.log(`    - FacilityName: ${field.FacilityName}`);
      console.log(`    - SportName: ${field.SportName}`);
      console.log(`    - AreaName: ${field.AreaName}`);
      console.log(`    - AreaID: ${field.AreaID}`);
      console.log(`    - RentalPrice: ${field.RentalPrice}`);
      console.log(`    - Status: ${field.Status}`);
    }
    
    console.log('\n📋 4. Kiểm tra booking của sân 99 ngày hôm nay:');
    const bookings = await pool.request().query(`
      SELECT 
        BookingID,
        FieldID,
        StartTime,
        EndTime,
        Status,
        DATEPART(HOUR, StartTime) as StartHour,
        DATEPART(MINUTE, StartTime) as StartMinute
      FROM Booking
      WHERE FieldID = 99 
        AND CAST(StartTime AS DATE) = CAST(GETDATE() AS DATE)
      ORDER BY StartTime
    `);
    if (bookings.recordset.length > 0) {
      console.log(`  ✓ Tìm thấy ${bookings.recordset.length} booking:`);
      bookings.recordset.forEach(b => {
        console.log(`    - BookingID ${b.BookingID}: ${b.StartHour}:${b.StartMinute.toString().padStart(2, '0')} - Status: ${b.Status}`);
      });
    } else {
      console.log('  ℹ️  Chưa có booking nào cho sân 99 hôm nay');
    }
    
    console.log('\n📋 5. Kiểm tra xem có cột "Area" hoặc "Zone" trong SportField không:');
    const hasAreaCol = sportFieldCols.recordset.find(c => 
      c.COLUMN_NAME.toLowerCase().includes('area') || 
      c.COLUMN_NAME.toLowerCase().includes('zone') ||
      c.COLUMN_NAME.toLowerCase().includes('khu')
    );
    if (hasAreaCol) {
      console.log(`  ✓ Có cột: ${hasAreaCol.COLUMN_NAME}`);
    } else {
      console.log('  ⚠️  KHÔNG có cột lưu thông tin khu vực trong bảng SportField');
      console.log('  ℹ️  Thông tin khu vực đang lưu ở bảng Facility -> Area');
    }
    
    console.log('\n📋 6. Tổng kết:');
    console.log('  ✓ Thông tin KHU VỰC: Có (qua Facility -> Area)');
    console.log('  ✓ Thông tin THỜI GIAN: Có (StartTime, EndTime trong Booking)');
    console.log('  ✓ Thông tin GIỜ SÂN: Có (tính từ StartTime, EndTime)');
    console.log('  ⚠️  Lưu ý: Không có cột riêng lưu "khu vực sân" trong SportField');
    console.log('  ℹ️  Frontend cần tự quản lý logic phân khu A1, A2, B1, B2...');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkDatabaseStructure();
