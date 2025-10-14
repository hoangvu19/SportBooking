const { poolPromise } = require('../../config/db');
const sql = require('mssql');

class CommentImageDAL {
  static async createCommentImage(commentImageData) {
    const pool = await poolPromise;
    try {
      const { commentId, imageUrl } = commentImageData;
      const result = await pool.request()
        .input('CommentID', sql.Int, commentId)
        .input('ImageUrl', sql.VarChar, imageUrl)
        .query(`
          INSERT INTO CommentImage (CommentID, ImageUrl, UploadedDate)
          OUTPUT INSERTED.*
          VALUES (@CommentID, @ImageUrl, GETDATE())
        `);

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
