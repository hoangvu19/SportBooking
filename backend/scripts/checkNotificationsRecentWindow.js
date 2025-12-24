const { poolPromise } = require('../config/db');

(async () => {
  try {
    const pool = await poolPromise;
    const res = await pool.request().query("SELECT NotificationID, RecipientAccountID, SenderAccountID, Type, ContentID, Content, CreatedDate FROM Notification WHERE Type = 'report' AND CreatedDate >= DATEADD(minute, -10, GETDATE()) ORDER BY CreatedDate DESC");
    console.log('Recent (last 10min) report notifications:');
    console.table(res.recordset);
    process.exit(0);
  } catch (err) {
    console.error('Error querying notifications:', err);
    process.exit(2);
  }
})();
