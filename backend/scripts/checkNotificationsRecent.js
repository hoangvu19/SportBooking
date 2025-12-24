const { poolPromise } = require('../config/db');

(async () => {
  try {
    const pool = await poolPromise;
    const res = await pool.request().query("SELECT TOP 20 NotificationID, RecipientAccountID, SenderAccountID, Type, ContentID, Content, CreatedDate FROM Notification WHERE Content LIKE '%test report from script%' ORDER BY CreatedDate DESC");
    console.log('Matching notifications:');
    console.table(res.recordset);
    process.exit(0);
  } catch (err) {
    console.error('Error querying notifications:', err);
    process.exit(2);
  }
})();
