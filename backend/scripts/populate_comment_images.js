#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const mappingPath = path.join(__dirname, 'sample_mapping.json');
if (!fs.existsSync(mappingPath)) {
  console.error('Mapping file not found:', mappingPath);
  process.exit(1);
}

const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));

const statements = [];
for (const [commentId, files] of Object.entries(mapping)) {
  for (const fname of files) {
    const url = `/uploads/comments/${fname}`;
    statements.push(`IF NOT EXISTS (SELECT 1 FROM CommentImage WHERE CommentID = ${commentId} AND ImageUrl = '${url.replace("'","''")}')\nINSERT INTO CommentImage (CommentID, ImageUrl, UploadedDate) VALUES (${commentId}, '${url.replace("'","''")}', GETDATE());`);
  }
}

const sql = ['SET NOCOUNT ON;', 'BEGIN TRANSACTION;', ...statements, 'COMMIT TRANSACTION;'].join('\n\n');

if (!process.env.EXECUTE_SQL || process.env.EXECUTE_SQL === 'false') {
  console.log('\n--- Generated SQL (dry-run) ---\n');
  console.log(sql);
  process.exit(0);
}

// EXECUTE_SQL=true -> attempt to run using existing db config
console.log('EXECUTE_SQL=true detected — attempting to run SQL using backend config...');
try {
  const { poolPromise } = require('../config/db');
  (async () => {
    let tx;
    try {
      const pool = await poolPromise;
      tx = pool.transaction();
      await tx.begin();
      for (const s of statements) {
        await tx.request().query(s);
      }
      await tx.commit();
      console.log('SQL executed successfully');
      process.exit(0);
    } catch (err) {
      console.error('SQL execution failed:', err.message || err);
      try { if (tx) await tx.rollback(); } catch (e) { /* ignore */ }
      process.exit(2);
    }
  })();
} catch (err) {
  console.error('Failed to load DB config or connect:', err.message || err);
  process.exit(1);
}
