const { poolPromise } = require('../config/db');

async function clearNotifications() {
  try {
    console.log('🗑️  Clearing all notifications...');
    const pool = await poolPromise;
    await pool.request().query('DELETE FROM Notification');
    console.log('✅ Successfully cleared all notifications');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing notifications:', error);
    process.exit(1);
  }
}

clearNotifications();
