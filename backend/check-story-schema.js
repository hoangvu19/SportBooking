const { poolPromise } = require('./config/db');

(async () => {
  try {
    const pool = await poolPromise;
    
    // Check computed columns
    const result = await pool.request().query(`
      SELECT 
        c.name AS ColumnName,
        t.name AS DataType,
        c.is_computed AS IsComputed,
        cc.definition AS ComputedDefinition
      FROM sys.columns c
      JOIN sys.types t ON c.user_type_id = t.user_type_id
      LEFT JOIN sys.computed_columns cc ON cc.object_id = c.object_id AND cc.column_id = c.column_id
      WHERE c.object_id = OBJECT_ID('Story')
      ORDER BY c.column_id
    `);
    
    console.log('\n📋 Story Table Column Details:');
    console.table(result.recordset);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
})();
