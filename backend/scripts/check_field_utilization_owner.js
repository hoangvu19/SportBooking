const { poolPromise } = require('../config/db');
const sql = require('mssql');

(async () => {
  try {
    const pool = await poolPromise;
    const ownerId = parseInt(process.argv[2] || '1', 10);
    const endDate = new Date('2025-12-06T00:00:00Z');
    const startDate = new Date('2025-11-06T00:00:00Z');

    console.log(`Checking Field Utilization for owner ${ownerId}`);

    const result = await pool.request()
      .input('OwnerID', sql.Int, ownerId)
      .input('StartDate', sql.Date, startDate)
      .input('EndDate', sql.Date, endDate)
      .query(`
        WITH FieldHours AS (
          SELECT 
            sf.FieldID,
            sf.FieldName,
            f.FacilityName,
            DATEDIFF(DAY, @StartDate, @EndDate) * 12 as TotalAvailableHours,
            ISNULL(SUM(DATEDIFF(HOUR, b.StartTime, b.EndTime)), 0) as BookedHours
          FROM SportField sf
          JOIN Facility f ON sf.FacilityID = f.FacilityID
          LEFT JOIN Booking b ON sf.FieldID = b.FieldID
            AND b.StartTime >= @StartDate
            AND b.StartTime < @EndDate
            AND b.Status IN ('Confirmed', 'Pending', 'Completed')
          WHERE f.OwnerID = @OwnerID
          GROUP BY sf.FieldID, sf.FieldName, f.FacilityName
        )
        SELECT 
          FieldID,
          FieldName,
          FacilityName,
          TotalAvailableHours,
          BookedHours,
          CASE WHEN TotalAvailableHours > 0 THEN CAST(BookedHours * 100.0 / TotalAvailableHours AS DECIMAL(5,2)) ELSE 0 END as UtilizationRate
        FROM FieldHours
        ORDER BY UtilizationRate DESC
      `);

    console.log('\n✅ Found', result.recordset.length, 'fields');
    console.table(result.recordset.map(r => ({ FieldID: r.FieldID, FieldName: r.FieldName, BookedHours: r.BookedHours, TotalAvailableHours: r.TotalAvailableHours, UtilizationRate: r.UtilizationRate })), ['FieldID','FieldName','BookedHours','TotalAvailableHours','UtilizationRate']);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();