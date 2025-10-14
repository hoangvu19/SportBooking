const sql = require('mssql');
const { poolPromise } = require('../config/db');

async function checkBookingColumns() {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Booking' 
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('📋 Booking table columns:');
    result.recordset.forEach(r => {
      console.log(`  - ${r.COLUMN_NAME} (${r.DATA_TYPE})`);
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkBookingColumns();
