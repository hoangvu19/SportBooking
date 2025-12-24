const { poolPromise } = require('../config/db');
const sql = require('mssql');

(async () => {
  try {
    const pool = await poolPromise;
    const fieldId = 82;
    const startDate = new Date('2025-11-06T00:00:00Z');
    const endDate = new Date('2025-12-06T00:00:00Z');
    const targetHours = Math.floor(360 * 0.65); // 234 hours

    // Get current booked hours for field
    const cur = await pool.request()
      .input('FieldID', sql.Int, fieldId)
      .input('StartDate', sql.Date, startDate)
      .input('EndDate', sql.Date, endDate)
      .query(`SELECT ISNULL(SUM(DATEDIFF(HOUR, StartTime, EndTime)),0) as BookedHours FROM Booking WHERE FieldID = @FieldID AND StartTime >= @StartDate AND StartTime < @EndDate AND Status IN ('Confirmed','Pending','Completed')`);

    const current = cur.recordset[0].BookedHours || 0;
    console.log('Current booked hours for field', fieldId, current);

    if (current <= targetHours) {
      console.log('Already at or below target');
      process.exit(0);
    }

    const hoursToRemove = current - targetHours;
    const slotsToCancel = Math.ceil(hoursToRemove / 2);
    console.log(`Need to cancel ~${hoursToRemove} hours => ${slotsToCancel} slots`);

    // Select booking IDs to cancel (Confirmed first)
    const idsRes = await pool.request()
      .input('FieldID', sql.Int, fieldId)
      .input('StartDate', sql.Date, startDate)
      .input('EndDate', sql.Date, endDate)
      .input('Limit', sql.Int, slotsToCancel)
      .query(`SELECT TOP (@Limit) BookingID FROM Booking WHERE FieldID = @FieldID AND StartTime >= @StartDate AND StartTime < @EndDate AND Status = 'Confirmed' ORDER BY BookingID DESC`);

    const ids = idsRes.recordset.map(r => r.BookingID);
    console.log('Will cancel bookings:', ids.length);

    if (ids.length === 0) {
      console.log('No confirmed bookings available to cancel');
      process.exit(0);
    }

    // Update statuses
    // Update statuses one-by-one to avoid duplicate param names
    for (const id of ids) {
      await pool.request()
        .input('id', sql.Int, id)
        .query(`UPDATE Booking SET Status = 'Cancelled' WHERE BookingID = @id`);
    }

    console.log('Cancelled', ids.length, 'bookings for field', fieldId);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();