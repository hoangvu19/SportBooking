const { poolPromise } = require('../../config/db');
const sql = require('mssql');

class PostImageDAL {
  static async createPostImage(postImageData) {
    const pool = await poolPromise;
    try {
      const { postId, imageUrl } = postImageData;
      const result = await pool.request()
        .input('PostID', sql.Int, postId)
        .input('ImageUrl', sql.VarChar, imageUrl)
        .query(`
          INSERT INTO PostImage (PostID, ImageUrl, UploadedDate)
          OUTPUT INSERTED.*
          VALUES (@PostID, @ImageUrl, GETDATE())
        `);

      return { success: true, data: result.recordset[0] };
    } catch (error) {
      throw error;
    }
  }

  static async getImagesByPostId(postId) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('PostID', sql.Int, postId)
      .query('SELECT * FROM PostImage WHERE PostID = @PostID ORDER BY UploadedDate ASC');

    return result.recordset;
  }

  static async deletePostImage(imageId) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('ImageID', sql.Int, imageId)
      .query('DELETE FROM PostImage WHERE ImageID = @ImageID');

    return result.rowsAffected[0] > 0;
  }

  static async deleteImagesByPostId(postId) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('PostID', sql.Int, postId)
      .query('DELETE FROM PostImage WHERE POSTID = @PostID');

    return result.rowsAffected[0];
  }
}

module.exports = PostImageDAL;
