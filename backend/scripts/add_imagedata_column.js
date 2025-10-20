const {poolPromise} = require('../config/db');

(async()=>{
  try{
    const pool = await poolPromise;
    
    console.log('📝 Adding ImageData column to CommentImage table...');
    
    // Add ImageData column (NVARCHAR(MAX) for base64 strings)
    await pool.request().query(`
      ALTER TABLE CommentImage
      ADD ImageData NVARCHAR(MAX) NULL
    `);
    
    console.log('✅ ImageData column added successfully');
    
    // Verify column was added
    const verify = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME='CommentImage' 
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('\n✅ Updated CommentImage schema:');
    verify.recordset.forEach(col => {
      console.log(`  - ${col.COLUMN_NAME}: ${col.DATA_TYPE}${col.CHARACTER_MAXIMUM_LENGTH ? '(' + col.CHARACTER_MAXIMUM_LENGTH + ')' : ''}`);
    });
    
    console.log('\n💡 Now restart backend to apply code changes!');
    process.exit(0);
  } catch(e){
    if (e.message && e.message.includes('already an object named')) {
      console.log('⚠️  ImageData column already exists!');
      process.exit(0);
    }
    console.error('❌ Error:', e);
    process.exit(1);
  }
})();
