#!/usr/bin/env node
const { poolPromise } = require('../config/db');

(async function(){
  const postId = process.argv[2] ? parseInt(process.argv[2],10) : 141;
  try{
    const pool = await poolPromise;
    const res = await pool.request().input('PostID', postId).query(`SELECT TOP 100 CommentID, AccountID, Content, CreatedDate FROM Comment WHERE PostID = @PostID ORDER BY CreatedDate DESC`);
    console.log(`Comments for PostID=${postId}:`);
    if(!res.recordset || res.recordset.length===0){
      console.log('  (none)');
      process.exit(0);
    }
    for(const r of res.recordset){
      console.log(`  CommentID=${r.CommentID} AccountID=${r.AccountID} Created=${r.CreatedDate} Content="${(r.Content||'').slice(0,80)}"`);
    }
    process.exit(0);
  }catch(err){
    console.error('Error querying comments:', err && err.message?err.message:err);
    process.exit(2);
  }
})();
