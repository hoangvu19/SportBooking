const PostDAL = require('../DAL/PostDAL');

async function run() {
  try {
    // TODO: adjust these IDs to valid ones present in your DB
    const accountId = 1; // replace with a valid AccountID
    // find a visible post to share
    const { sql, poolPromise } = require('../config/db');
    const pool = await poolPromise;
    const postRes = await pool.request().query("SELECT TOP 1 PostID FROM Post WHERE Status = 'Visible'");
    const originalPostId = postRes.recordset.length ? postRes.recordset[0].PostID : null;
    const note = 'Test share from script';

    if (!originalPostId) {
      console.error('No visible post found in DB to share. Aborting.');
      return;
    }

    console.log('Creating share...', { accountId, originalPostId });
    const newShare = await PostDAL.createSharePost({ accountId, originalPostId, note });

    console.log('Created share post:', newShare.toFrontendFormat());
  } catch (err) {
    console.error('Error during createShare test:', err);
  }
}

run();
