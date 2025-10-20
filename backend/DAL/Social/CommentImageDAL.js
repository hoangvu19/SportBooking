const { poolPromise } = require('../../config/db');
const sql = require('mssql');

class CommentImageDAL {
  static async createCommentImage(commentImageData) {
    const pool = await poolPromise;
    try {
      const { commentId, imageUrl } = commentImageData;
      const colCheck = await pool.request().query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'CommentImage'`);
      const cols = (colCheck.recordset || []).map(r => (r.COLUMN_NAME || '').toLowerCase());
      const hasImageUrl = cols.includes('imageurl');
      const hasUploadedDate = cols.includes('uploadeddate');

      const req = pool.request().input('CommentID', sql.Int, commentId).input('ImageUrl', sql.VarChar, imageUrl);
      let result;
      if (hasImageUrl && hasUploadedDate) {
        result = await req.query(`INSERT INTO CommentImage (CommentID, ImageUrl, UploadedDate) OUTPUT INSERTED.* VALUES (@CommentID, @ImageUrl, GETDATE())`);
      } else if (hasImageUrl) {
        result = await req.query(`INSERT INTO CommentImage (CommentID, ImageUrl) OUTPUT INSERTED.* VALUES (@CommentID, @ImageUrl)`);
      } else {
        console.warn('CommentImageDAL.createCommentImage - CommentImage table missing ImageUrl column; skipping insert');
        return { success: false, data: null };
      }

      return { success: true, data: result.recordset[0] };
    } catch (error) {
      throw error;
    }
  }

  static async getImagesByCommentId(commentId) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('CommentID', sql.Int, commentId)
      .query('SELECT * FROM CommentImage WHERE CommentID = @CommentID ORDER BY UploadedDate ASC');

    return result.recordset;
  }

  static async deleteCommentImage(imageId) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('ImageID', sql.Int, imageId)
      .query('DELETE FROM CommentImage WHERE ImageID = @ImageID');

    return result.rowsAffected[0] > 0;
  }

  static async deleteImagesByCommentId(commentId) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('CommentID', sql.Int, commentId)
      .query('DELETE FROM CommentImage WHERE CommentID = @CommentID');

    return result.rowsAffected[0];
  }
}

module.exports = CommentImageDAL;
