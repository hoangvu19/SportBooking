// Run auto-cancel pending bookings manually
require('dotenv').config();
const BookingDAL = require('../DAL/Sport/bookingDAL');

// Usage:
//   node auto_cancel_pending_bookings.js         -> shows affected bookings (dry-run)
//   node auto_cancel_pending_bookings.js apply   -> perform update (apply changes)

(async () => {
  try {
    const doApply = process.argv[2] === 'apply';
    console.log(`Running autoCancelPendingBookings (apply=${doApply})...`);

    // First select affected rows
    const pool = await (require('../config/db').poolPromise);
    const selectSql = `
      SELECT BookingID, StartTime, Status
      FROM Booking
      WHERE StartTime <= GETDATE()
        AND (
          LOWER(RTRIM(LTRIM(Status))) = 'pending'
          OR Status LIKE '%Pending%'
          OR LOWER(Status) LIKE '%pending%'
          OR Status LIKE N'%Chờ%'
          OR Status LIKE N'%đang chờ%'
        )
      ORDER BY StartTime DESC
    `;

    const selectRes = await pool.request().query(selectSql);
    const rows = selectRes.recordset || [];

    console.log(`Found ${rows.length} pending booking(s) past start time.`);
    if (rows.length > 0) {
      console.table(rows.map(r => ({ BookingID: r.BookingID, StartTime: r.StartTime, Status: r.Status })));
    }

    if (!doApply) {
      console.log('Dry-run mode. To apply the changes, re-run with `apply` argument.');
      process.exit(0);
    }

    // Apply changes using DAL method
    const res = await BookingDAL.autoCancelPendingBookings();
    console.log('Update result:', res);
    process.exit(0);
  } catch (err) {
    console.error('Error running auto-cancel:', err);
    process.exit(1);
  }
})();
