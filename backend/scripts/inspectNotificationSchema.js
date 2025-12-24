const { poolPromise } = require('../config/db');

(async () => {
  try {
    const pool = await poolPromise;
    const res = await pool.request().query("SELECT COLUMN_NAME, IS_NULLABLE, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Notification'");
    console.log('Notification table schema:');
    console.table(res.recordset);
    process.exit(0);
  } catch (err) {
    console.error('Error inspecting schema:', err);
    process.exit(2);
  }
})();
