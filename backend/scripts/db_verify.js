const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { poolPromise } = require('../config/db');

async function run() {
  // Safety: force exit after 20s to avoid hanging terminals
  const killTimer = setTimeout(() => {
    console.error('Timed out waiting for DB operations. Exiting.');
    process.exit(2);
  }, 20000);

  try {
    console.log('cwd:', process.cwd());
    console.log('Loading .env from:', path.resolve(__dirname, '..', '.env'));
    console.log('DB env:', {
      DB_SERVER: process.env.DB_SERVER,
      DB_DATABASE: process.env.DB_DATABASE,
      DB_USER: process.env.DB_USER
    });

    const pool = await poolPromise;

    console.log('Connected to DB, running verification queries...');
    console.log('Pool config summary:', {
      connected: pool.connected,
      config: pool.config && {
        server: pool.config.server,
        database: pool.config.database,
        user: pool.config.user
      }
    });

    const commentsResult = await pool.request()
      .query(`SELECT TOP 20 * FROM FieldComment ORDER BY CreatedDate DESC`);

    const ratingsResult = await pool.request()
      .query(`SELECT TOP 20 * FROM Rating ORDER BY CreatedDate DESC`);

    clearTimeout(killTimer);

    console.log('=== FieldComment (recent) ===');
    console.log(JSON.stringify(commentsResult.recordset, null, 2));

    console.log('=== Rating (recent) ===');
    console.log(JSON.stringify(ratingsResult.recordset, null, 2));

    process.exit(0);
  } catch (err) {
    clearTimeout(killTimer);
    console.error('DB verification error:', err);
    process.exit(1);
  }
}

run();
