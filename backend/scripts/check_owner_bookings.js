const { poolPromise } = require('../config/db');
const sql = require('mssql');

(async () => {
  try {
    const pool = await poolPromise;
    const ownerId = 84;
    
    // Check current month bookings
    const result = await pool.request()
      .input('OwnerID', sql.Int, ownerId)
      .query(`
        DECLARE @StartOfMonth DATE = DATEADD(MONTH, DATEDIFF(MONTH, 0, GETDATE()), 0);
        DECLARE @EndOfMonth DATE = DATEADD(MONTH, 1, @StartOfMonth);
        
        SELECT 
          b.BookingID,
          b.StartTime,
          b.EndTime,
          b.Status,
          b.TotalAmount,
          sf.FieldName,
          sf.RentalPrice,
          f.FacilityName,
          DATEDIFF(HOUR, b.StartTime, b.EndTime) as DurationHours,
          CASE 
            WHEN b.TotalAmount IS NOT NULL THEN b.TotalAmount
            ELSE DATEDIFF(HOUR, b.StartTime, b.EndTime) * sf.RentalPrice
          END as CalculatedRevenue
        FROM Booking b
        JOIN SportField sf ON b.FieldID = sf.FieldID
        JOIN Facility f ON sf.FacilityID = f.FacilityID
        WHERE f.OwnerID = @OwnerID
          AND b.StartTime >= @StartOfMonth
          AND b.StartTime < @EndOfMonth
        ORDER BY b.StartTime DESC
      `);
    
    console.log('\n📅 CURRENT MONTH BOOKINGS (December 2025):');
    console.log('Total records:', result.recordset.length);
    console.log('\n', JSON.stringify(result.recordset, null, 2));
    
    // Check summary
    const summary = await pool.request()
      .input('OwnerID', sql.Int, ownerId)
      .query(`
        DECLARE @StartOfMonth DATE = DATEADD(MONTH, DATEDIFF(MONTH, 0, GETDATE()), 0);
        DECLARE @EndOfMonth DATE = DATEADD(MONTH, 1, @StartOfMonth);
        
        SELECT 
          COUNT(*) as TotalBookings,
          COUNT(CASE WHEN b.Status IN ('Confirmed', 'Completed') THEN 1 END) as ConfirmedOrCompleted,
          SUM(b.TotalAmount) as SumTotalAmount,
          SUM(CASE WHEN b.Status IN ('Confirmed', 'Completed') 
              THEN ISNULL(b.TotalAmount, DATEDIFF(HOUR, b.StartTime, b.EndTime) * sf.RentalPrice)
              ELSE 0 END) as CalculatedRevenue
        FROM Booking b
        JOIN SportField sf ON b.FieldID = sf.FieldID
        JOIN Facility f ON sf.FacilityID = f.FacilityID
        WHERE f.OwnerID = @OwnerID
          AND b.StartTime >= @StartOfMonth
          AND b.StartTime < @EndOfMonth
      `);
    
    console.log('\n💰 REVENUE SUMMARY:');
    console.log(JSON.stringify(summary.recordset[0], null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
})();
