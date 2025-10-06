const { poolPromise, sql } = require('./config/db');

(async () => {
  try {
    const pool = await poolPromise;
    
    // Test 1: Check table structure
    const columnsResult = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'Story'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('\n📋 Story Table Columns:');
    console.table(columnsResult.recordset);
    
    // Test 2: Try to insert a story
    console.log('\n🧪 Testing story insertion...');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    const result = await pool.request()
      .input('AccountID', sql.Int, 1)
      .input('Content', sql.NVarChar, 'Test story')
      .input('MediaUrl', sql.NVarChar, null)
      .input('MediaType', sql.VarChar, 'text')
      .input('BackgroundColor', sql.VarChar, '#4f46e5')
      .input('ExpiresAt', sql.DateTime, expiresAt)
      .query(`
        INSERT INTO Story (AccountID, Content, MediaUrl, MediaType, BackgroundColor, CreatedDate, ExpiresAt, Status, ViewCount)
        OUTPUT INSERTED.*
        VALUES (@AccountID, @Content, @MediaUrl, @MediaType, @BackgroundColor, GETDATE(), @ExpiresAt, 'Active', 0)
      `);
    
    console.log('\n✅ Story inserted successfully:');
    console.log(result.recordset[0]);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nDetails:', error);
  } finally {
    process.exit(0);
  }
})();
