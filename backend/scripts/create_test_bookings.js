const { poolPromise } = require('../config/db');
const sql = require('mssql');

(async () => {
  try {
    const pool = await poolPromise;
    const ownerId = 84; // Change this to the owner you're logged in as
    
    // Get owner's fields
    const fields = await pool.request()
      .input('OwnerID', sql.Int, ownerId)
      .query(`
        SELECT TOP 5 sf.FieldID, sf.FieldName, sf.RentalPrice, f.FacilityName
        FROM SportField sf
        JOIN Facility f ON sf.FacilityID = f.FacilityID
        WHERE f.OwnerID = @OwnerID
      `);
    
    if (fields.recordset.length === 0) {
      console.log('❌ No fields found for owner 1');
      process.exit(1);
    }
    
    console.log('🏟️ Found fields:', fields.recordset);
    
    // Create bookings for December 2025 (using only available fields)
    const bookings = [
      // Week 1 - Early December
      { date: '2025-12-02', startHour: 8, endHour: 10, status: 'Confirmed', fieldIndex: 0 },
      { date: '2025-12-03', startHour: 14, endHour: 16, status: 'Confirmed', fieldIndex: 0 },
      { date: '2025-12-04', startHour: 18, endHour: 20, status: 'Completed', fieldIndex: 0 },
      
      // Week 2 - Current week
      { date: '2025-12-05', startHour: 9, endHour: 11, status: 'Confirmed', fieldIndex: 0 },
      { date: '2025-12-06', startHour: 15, endHour: 17, status: 'Confirmed', fieldIndex: 0 },
      { date: '2025-12-06', startHour: 19, endHour: 21, status: 'Pending', fieldIndex: 0 },
      
      // Future bookings
      { date: '2025-12-10', startHour: 10, endHour: 12, status: 'Confirmed', fieldIndex: 0 },
      { date: '2025-12-12', startHour: 16, endHour: 18, status: 'Confirmed', fieldIndex: 0 },
      { date: '2025-12-15', startHour: 8, endHour: 10, status: 'Pending', fieldIndex: 0 },
      { date: '2025-12-20', startHour: 14, endHour: 16, status: 'Confirmed', fieldIndex: 0 },
    ];
    
    console.log(`\n📝 Creating ${bookings.length} test bookings...`);
    
    let created = 0;
    for (const booking of bookings) {
      const field = fields.recordset[booking.fieldIndex];
      const startTime = `${booking.date}T${String(booking.startHour).padStart(2, '0')}:00:00`;
      const endTime = `${booking.date}T${String(booking.endHour).padStart(2, '0')}:00:00`;
      const hours = booking.endHour - booking.startHour;
      const totalAmount = hours * field.RentalPrice;
      
      try {
        await pool.request()
          .input('FieldID', sql.Int, field.FieldID)
          .input('CustomerID', sql.Int, 1) // Using owner as customer for testing
          .input('StartTime', sql.DateTime, startTime)
          .input('EndTime', sql.DateTime, endTime)
          .input('TotalAmount', sql.Decimal(18, 2), totalAmount)
          .input('Status', sql.NVarChar(50), booking.status)
          .input('Deposit', sql.Decimal(10, 2), 0)
          .query(`
            INSERT INTO Booking (FieldID, CustomerID, StartTime, EndTime, TotalAmount, Status, Deposit)
            VALUES (@FieldID, @CustomerID, @StartTime, @EndTime, @TotalAmount, @Status, @Deposit)
          `);
        
        created++;
        console.log(`✅ Created: ${booking.date} ${booking.startHour}:00-${booking.endHour}:00 | ${field.FieldName} | ${totalAmount.toLocaleString('vi-VN')} VND | ${booking.status}`);
      } catch (error) {
        console.log(`⚠️ Skipped (may already exist): ${booking.date} ${booking.startHour}:00-${booking.endHour}:00`);
      }
    }
    
    console.log(`\n🎉 Successfully created ${created} bookings!`);
    
    // Show summary
    const summary = await pool.request()
      .input('OwnerID', sql.Int, ownerId)
      .query(`
        DECLARE @StartOfMonth DATE = DATEADD(MONTH, DATEDIFF(MONTH, 0, GETDATE()), 0);
        DECLARE @EndOfMonth DATE = DATEADD(MONTH, 1, @StartOfMonth);
        
        SELECT 
          COUNT(*) as TotalBookings,
          COUNT(CASE WHEN b.Status IN ('Confirmed', 'Completed') THEN 1 END) as ConfirmedOrCompleted,
          SUM(CASE WHEN b.Status IN ('Confirmed', 'Completed') 
              THEN b.TotalAmount
              ELSE 0 END) as TotalRevenue
        FROM Booking b
        JOIN SportField sf ON b.FieldID = sf.FieldID
        JOIN Facility f ON sf.FacilityID = f.FacilityID
        WHERE f.OwnerID = @OwnerID
          AND b.StartTime >= @StartOfMonth
          AND b.StartTime < @EndOfMonth
      `);
    
    console.log('\n💰 DECEMBER 2025 SUMMARY:');
    console.log(`   Total Bookings: ${summary.recordset[0].TotalBookings}`);
    console.log(`   Confirmed/Completed: ${summary.recordset[0].ConfirmedOrCompleted}`);
    console.log(`   Total Revenue: ${(summary.recordset[0].TotalRevenue || 0).toLocaleString('vi-VN')} VND`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
})();
