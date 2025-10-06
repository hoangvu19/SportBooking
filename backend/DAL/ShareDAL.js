const { poolPromise } = require('../config/db');
const sql = require('mssql');

class ShareDAL {
  static async createShare(shareData) {
    const pool = await poolPromise;
    try {
      const { accountId, postId, note } = shareData;
      const result = await pool.request()
        .input('AccountID', sql.Int, accountId)
        .input('PostID', sql.Int, postId)
        .input('Note', sql.NVarChar, note || null)
        .query(`
          INSERT INTO Share (AccountID, PostID, Note, SharedDate)
          OUTPUT INSERTED.*
          VALUES (@AccountID, @PostID, @Note, GETDATE())
        `);

      return { success: true, data: result.recordset[0] };
    } catch (error) {
      throw error;
    }
  }

  static async getSharesByPostId(postId) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('PostID', sql.Int, postId)
      .query(`
        SELECT s.*, a.Username, a.FullName, a.Avatar
        FROM Share s
        INNER JOIN Account a ON s.AccountID = a.AccountID
        WHERE s.PostID = @PostID
        ORDER BY s.SharedDate DESC
      `);

    return result.recordset;
  }

  static async getSharesByAccountId(accountId) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('AccountID', sql.Int, accountId)
      .query(`
        SELECT s.*, p.Content, p.CreatedDate as PostCreatedDate, 
               pa.Username as PostAuthor, pa.FullName as PostAuthorName
        FROM Share s
        INNER JOIN Post p ON s.PostID = p.PostID
        INNER JOIN Account pa ON p.AccountID = pa.AccountID
        WHERE s.AccountID = @AccountID
        ORDER BY s.SharedDate DESC
      `);

    return result.recordset;
  }

  static async hasUserSharedPost(accountId, postId) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('AccountID', sql.Int, accountId)
      .input('PostID', sql.Int, postId)
      .query('SELECT ShareID FROM Share WHERE AccountID = @AccountID AND PostID = @PostID');

    return result.recordset.length > 0;
  }

  static async deleteShare(shareId) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('ShareID', sql.Int, shareId)
      .query('DELETE FROM Share WHERE ShareID = @ShareID');

    return result.rowsAffected[0] > 0;
  }

  static async deleteShareByAccountAndPost(accountId, postId) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('AccountID', sql.Int, accountId)
      .input('PostID', sql.Int, postId)
      .query('DELETE FROM Share WHERE AccountID = @AccountID AND PostID = @POSTID');

    return result.rowsAffected[0] > 0;
  }

  static async getShareCount(postId) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('PostID', sql.Int, postId)
      .query('SELECT COUNT(*) as ShareCount FROM Share WHERE PostID = @PostID');

    return result.recordset[0].ShareCount;
  }
}

module.exports = ShareDAL;
