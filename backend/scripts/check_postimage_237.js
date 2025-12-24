const { poolPromise } = require('../config/db');

(async () => {
  try {
    const pool = await poolPromise;
    const res = await pool.request().input('PostID', '237').query('SELECT * FROM PostImage WHERE PostID = @PostID ORDER BY DisplayOrder ASC');
    console.log('PostImage rows for Post 237:', JSON.stringify(res.recordset || [], null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Error querying PostImage:', err);
    process.exit(1);
  }
})();
