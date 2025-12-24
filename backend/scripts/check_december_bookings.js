const { poolPromise } = require('../config/db');
const sql = require('mssql');

(async () => {
  try {
    const pool = await poolPromise;
    
    const result = await pool.request()
      .query(`
        SELECT TOP 10 
          b.BookingID, 
          b.StartTime, 
          b.Status, 
          sf.FieldName, 
          f.FacilityName, 
          f.OwnerID,
          DATEDIFF(HOUR, b.StartTime, b.EndTime) as Hours
        FROM Booking b
        JOIN SportField sf ON b.FieldID = sf.FieldID
        JOIN Facility f ON sf.FacilityID = f.FacilityID
        WHERE b.StartTime >= '2025-12-01'
        ORDER BY b.BookingID DESC
      `);
    
    console.log('Recent December 2025 bookings:');
    console.log(JSON.stringify(result.recordset, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
