const { poolPromise } = require('../../config/db');
const sql = require('mssql');

class PostImageDAL {
  static async createPostImage(postImageData) {
    const pool = await poolPromise;
    try {
      const { postId, imageUrl } = postImageData;
      // check table columns
      const colCheck = await pool.request().query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PostImage'`);
      const cols = (colCheck.recordset || []).map(r => (r.COLUMN_NAME || '').toLowerCase());
      const hasImageUrl = cols.includes('imageurl');
      const hasUploadedDate = cols.includes('uploadeddate');

      const req = pool.request().input('PostID', sql.Int, postId).input('ImageUrl', sql.VarChar, imageUrl);
      let result;
      if (hasImageUrl && hasUploadedDate) {
        result = await req.query(`INSERT INTO PostImage (PostID, ImageUrl, UploadedDate) OUTPUT INSERTED.* VALUES (@PostID, @ImageUrl, GETDATE())`);
      } else if (hasImageUrl) {
        result = await req.query(`INSERT INTO PostImage (PostID, ImageUrl) OUTPUT INSERTED.* VALUES (@PostID, @ImageUrl)`);
      } else {
        // no suitable columns
        console.warn('PostImageDAL.createPostImage - PostImage table missing ImageUrl column; skipping insert');
        return { success: false, data: null };
      }

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
