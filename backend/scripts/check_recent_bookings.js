const { poolPromise } = require('../config/db');
const sql = require('mssql');

(async () => {
  try {
    const pool = await poolPromise;
    const ownerId = 84;
    
    // Check all bookings with dates
    const result = await pool.request()
      .input('OwnerID', sql.Int, ownerId)
      .query(`
        SELECT TOP 20
          b.BookingID,
          b.StartTime,
          b.EndTime,
          b.Status,
          b.TotalAmount,
          sf.FieldName,
          sf.RentalPrice,
          f.FacilityName,
          YEAR(b.StartTime) as Year,
          MONTH(b.StartTime) as Month,
          DATEDIFF(HOUR, b.StartTime, b.EndTime) as Hours
        FROM Booking b
        JOIN SportField sf ON b.FieldID = sf.FieldID
        JOIN Facility f ON sf.FacilityID = f.FacilityID
        WHERE f.OwnerID = @OwnerID
        ORDER BY b.StartTime DESC
      `);
    
    console.log('\n📅 LATEST 20 BOOKINGS FOR OWNER 84:');
    console.log('Total found:', result.recordset.length);
    
    if (result.recordset.length > 0) {
      console.log('\nFirst booking:', result.recordset[0]);
      console.log('\nLast booking:', result.recordset[result.recordset.length - 1]);
      
      // Group by month
      const byMonth = {};
      result.recordset.forEach(r => {
        const key = `${r.Year}-${String(r.Month).padStart(2, '0')}`;
        if (!byMonth[key]) byMonth[key] = 0;
        byMonth[key]++;
      });
      
      console.log('\n📊 Bookings by month:');
      console.log(byMonth);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
})();
