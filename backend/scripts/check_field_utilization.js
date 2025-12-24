const { poolPromise } = require('../config/db');
const sql = require('mssql');

(async () => {
  try {
    const pool = await poolPromise;
    const ownerId = 84;
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);
    
    console.log(`📊 Checking Field Utilization for owner ${ownerId}`);
    console.log(`Date range: ${startDate.toISOString().slice(0, 10)} to ${endDate.toISOString().slice(0, 10)}`);
    
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
            -- Total available hours in period (assuming 12 hours/day operation)
            DATEDIFF(DAY, @StartDate, @EndDate) * 12 as TotalAvailableHours,
            -- Total booked hours (all statuses except Cancelled)
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
          CASE 
            WHEN TotalAvailableHours > 0 
            THEN CAST(BookedHours * 100.0 / TotalAvailableHours AS DECIMAL(5,2))
            ELSE 0 
          END as UtilizationRate
        FROM FieldHours
        ORDER BY UtilizationRate DESC
      `);
    
    console.log(`\n✅ Found ${result.recordset.length} fields`);
    console.log('\nField Utilization Data:');
    result.recordset.forEach(field => {
      console.log(`\n📍 ${field.FieldName} (${field.FacilityName})`);
      console.log(`   Available Hours: ${field.TotalAvailableHours}`);
      console.log(`   Booked Hours: ${field.BookedHours}`);
      console.log(`   Utilization Rate: ${field.UtilizationRate}%`);
    });
    
    if (result.recordset.length === 0) {
      console.log('\n⚠️ No fields found for this owner!');
      
      // Check if owner has fields
      const fieldsCheck = await pool.request()
        .input('OwnerID', sql.Int, ownerId)
        .query(`
          SELECT sf.FieldID, sf.FieldName, f.FacilityName
          FROM SportField sf
          JOIN Facility f ON sf.FacilityID = f.FacilityID
          WHERE f.OwnerID = @OwnerID
        `);
      
      console.log(`\n🏟️ Owner has ${fieldsCheck.recordset.length} fields in total`);
      if (fieldsCheck.recordset.length > 0) {
        console.log('Fields:', fieldsCheck.recordset.map(f => f.FieldName).join(', '));
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
})();
