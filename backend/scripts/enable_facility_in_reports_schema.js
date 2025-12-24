const { poolPromise } = require('../config/db');

async function main() {
  const pool = await poolPromise;
  try {
    console.log('Checking existing CHECK constraint on Reports.ReportedContentType...');
    const q = `
      SELECT cc.name AS ConstraintName
      FROM sys.check_constraints cc
      JOIN sys.columns col ON cc.parent_object_id = col.object_id
      WHERE cc.parent_object_id = OBJECT_ID('dbo.Reports')
        AND col.name = 'ReportedContentType'
    `;
    const res = await pool.request().query(q);
    if (res && res.recordset && res.recordset.length > 0) {
      for (const row of res.recordset) {
        const name = row.ConstraintName;
        console.log('Found constraint:', name, ' - dropping it');
        await pool.request().query(`ALTER TABLE dbo.Reports DROP CONSTRAINT [${name}]`);
      }
    } else {
      console.log('No existing named CHECK constraint found for ReportedContentType');
    }

    // Add new check constraint allowing facility
    const newName = 'CK_Reports_ReportedContentType_AllowedValues';
    const addQ = `ALTER TABLE dbo.Reports ADD CONSTRAINT ${newName} CHECK (ReportedContentType IN ('post','story','comment','facility'))`;
    await pool.request().query(addQ);
    console.log('Added new constraint allowing facility');
  } catch (err) {
    console.error('Failed to update Reports constraint:', err && err.message ? err.message : err);
    process.exit(2);
  }
  console.log('Done');
}

main().catch(err => { console.error(err); process.exit(2); });
