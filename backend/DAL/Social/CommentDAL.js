/**
 * Comment Data Access Layer (DAL)
 * Handles all database operations for Comment entity
 */
const { sql, poolPromise } = require("../../config/db");
const Comment = require("../../models/Social/Comment");

class CommentDAL {
  /**
   * Create new comment
   */
  static async create(commentData) {
    let transaction;
    try {
      console.log('📝 Creating comment:', {
        PostID: commentData.PostID,
        AccountID: commentData.AccountID,
        ContentLength: commentData.Content?.length
      });
      
      const pool = await poolPromise;
      transaction = new sql.Transaction(pool);
      
      await transaction.begin();
      console.log('✅ Transaction started');
      
      const req = transaction.request()
        .input("PostID", sql.Int, commentData.PostID)
        .input("AccountID", sql.Int, commentData.AccountID)
        .input("Content", sql.VarChar, commentData.Content);

      if (commentData.ParentCommentID) {
        req.input("ParentCommentID", sql.Int, commentData.ParentCommentID);
      }

      const insertSql = commentData.ParentCommentID
        ? `INSERT INTO Comment (PostID, AccountID, Content, ParentCommentID, CreatedDate) OUTPUT INSERTED.* VALUES (@PostID, @AccountID, @Content, @ParentCommentID, GETDATE())`
        : `INSERT INTO Comment (PostID, AccountID, Content, CreatedDate) OUTPUT INSERTED.* VALUES (@PostID, @AccountID, @Content, GETDATE())`;

      const result = await req.query(insertSql);
      
      console.log('✅ Comment inserted:', result.recordset[0].CommentID);
      
      await transaction.commit();
      console.log('✅ Transaction committed');
      
      // Get comment with user info
      const comment = await CommentDAL.getById(result.recordset[0].CommentID);
      console.log('✅ Comment created successfully');
      return comment;
    } catch (error) {
      console.error('❌ CommentDAL.create error:', error);
      if (transaction) {
        try {
          await transaction.rollback();
          console.log('⚠️  Transaction rolled back');
        } catch (rollbackError) {
          console.error('❌ Rollback error:', rollbackError);
        }
      }
      throw error;
    }
  }

  /**
   * Create comment and images atomically.
   * files: array of multer file objects
   * Converts images to base64 and stores in database (NO file system storage)
   */
  static async createWithImages(commentData, files = []) {
    let transaction;
    const fs = require('fs');
    const sharp = require('sharp');

    try {
      const pool = await poolPromise;
      transaction = new sql.Transaction(pool);
      await transaction.begin();

      // insert comment
      const req = transaction.request()
        .input('PostID', sql.Int, commentData.PostID)
        .input('AccountID', sql.Int, commentData.AccountID)
        .input('Content', sql.NVarChar, commentData.Content || null);

      if (commentData.ParentCommentID) req.input('ParentCommentID', sql.Int, commentData.ParentCommentID);

      const insertSql = commentData.ParentCommentID
        ? `INSERT INTO Comment (PostID, AccountID, Content, ParentCommentID, CreatedDate) OUTPUT INSERTED.* VALUES (@PostID, @AccountID, @Content, @ParentCommentID, GETDATE())`
        : `INSERT INTO Comment (PostID, AccountID, Content, CreatedDate) OUTPUT INSERTED.* VALUES (@PostID, @AccountID, @Content, GETDATE())`;

      const result = await req.query(insertSql);
      const commentId = result.recordset[0].CommentID;

      // process files sequentially - convert to base64
      for (const f of files || []) {
        // basic mime validation
        if (!f.mimetype || !f.mimetype.startsWith('image/')) {
          throw new Error('Invalid file type');
        }

        // resize and convert to buffer with sharp (max width/height 1200)
        const buffer = await sharp(f.path)
          .resize({ width: 1200, height: 1200, fit: 'inside' })
          .jpeg({ quality: 80 })
          .toBuffer();

        // Convert to base64 data URI
        const base64Image = `data:image/jpeg;base64,${buffer.toString('base64')}`;

        // remove temp file if exists
        try { fs.unlinkSync(f.path); } catch (e) { /* ignore */ }

        // Store base64 in ImageUrl column (VARCHAR(MAX) can hold base64)
        try {
          await transaction.request()
            .input('CommentID', sql.Int, commentId)
            .input('ImageUrl', sql.VarChar(sql.MAX), base64Image)
            .query(`INSERT INTO CommentImage (CommentID, ImageUrl, UploadedDate) VALUES (@CommentID, @ImageUrl, GETDATE())`);
        } catch (imgInsErr) {
          console.warn('CommentDAL.createWithImages - image insert failed:', imgInsErr.message);
        }
      }

      await transaction.commit();

      // return full comment object (DB authoritative)
      const comment = await CommentDAL.getById(commentId);
      return comment;
    } catch (error) {
      console.error('CommentDAL.createWithImages error:', error);
      if (transaction) {
        try { await transaction.rollback(); } catch (e) { console.error('Rollback failed', e); }
      }

      throw error;
    }
  }

  /**
   * Add images for a comment
   */
  static async addImages(commentId, imageUrls = []) {
    if (!imageUrls || imageUrls.length === 0) return [];
    try {
      const pool = await poolPromise;
      const inserted = [];
      for (const url of imageUrls) {
        const result = await pool.request()
          .input('CommentID', sql.Int, commentId)
          .input('ImageUrl', sql.VarChar, url)
          .query(`INSERT INTO CommentImage (CommentID, ImageUrl, UploadedDate) OUTPUT INSERTED.* VALUES (@CommentID, @ImageUrl, GETDATE())`);
        inserted.push(result.recordset[0].ImageUrl);
      }
      return inserted;
    } catch (error) {
      console.error('CommentDAL.addImages error:', error);
      throw error;
    }
  }

  /**
   * Get comment by ID with user info
   */
  static async getById(commentId) {
    try {
      const pool = await poolPromise;
      
      const result = await pool.request()
        .input("CommentID", sql.Int, commentId)
        .query(`
          SELECT c.*, a.Username, a.FullName, a.AvatarUrl
          FROM Comment c
          JOIN Account a ON c.AccountID = a.AccountID
          WHERE c.CommentID = @CommentID AND a.Status = 'Active'
        `);
      
      if (result.recordset.length === 0) {
        return null;
      }
      
      const comment = new Comment(result.recordset[0]);
      
      // Get comment images from ImageUrl column (contains both base64 and file URLs)
      const imagesResult = await pool.request()
        .input("CommentID", sql.Int, commentId)
        .query(`
          SELECT ImageUrl
          FROM CommentImage
          WHERE CommentID = @CommentID
          ORDER BY UploadedDate
        `);
      
      comment.Images = imagesResult.recordset.map(img => img.ImageUrl).filter(Boolean);

      return comment;
    } catch (error) {
      console.error('CommentDAL.getById error:', error);
      throw error;
    }
  }

  /**
   * Get comments by post ID
   */
  static async getByPostId(postId, page = 1, limit = 20) {
    try {
      const pool = await poolPromise;
      const offset = (page - 1) * limit;
      
      const request = pool.request()
        .input("PostID", sql.Int, postId)
        .input("Offset", sql.Int, offset)
        .input("Limit", sql.Int, limit);

      const queryText = `
          SELECT c.*, a.Username, a.FullName, a.AvatarUrl
          FROM Comment c
          JOIN Account a ON c.AccountID = a.AccountID
          WHERE c.PostID = @PostID AND a.Status = 'Active'
          ORDER BY c.CreatedDate ASC
          OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY
        `;

      console.log('🔎 CommentDAL.getByPostId query:', { postId, offset, limit });
      // keep the query execution separate so in case of errors we can log queryText
      const result = await request.query(queryText);
      
      const comments = [];
      
      for (const row of result.recordset) {
        const comment = new Comment(row);
        
        // Get images for each comment from ImageUrl column (contains both base64 and file URLs)
        const imagesResult = await pool.request()
          .input("CommentID", sql.Int, comment.CommentID)
          .query(`
            SELECT ImageUrl
            FROM CommentImage
            WHERE CommentID = @CommentID
            ORDER BY UploadedDate
          `);
        
        comment.Images = imagesResult.recordset.map(img => img.ImageUrl).filter(Boolean);
        comments.push(comment);
      }
      
      return comments;
    } catch (error) {
      console.error('CommentDAL.getByPostId error:', error);
      throw error;
    }
  }

  /**
   * Update comment
   */
  static async update(commentId, content) {
    try {
      const pool = await poolPromise;
      
      await pool.request()
        .input("CommentID", sql.Int, commentId)
        .input("Content", sql.VarChar, content)
        .query(`
          UPDATE Comment 
          SET Content = @Content
          WHERE CommentID = @CommentID
        `);
      
      return await CommentDAL.getById(commentId);
    } catch (error) {
      console.error('CommentDAL.update error:', error);
      throw error;
    }
  }

  /**
   * Delete comment (hard delete since no Status column)
   */
  static async delete(commentId) {
    try {
      const pool = await poolPromise;
      
      // First delete comment images
      await pool.request()
        .input("CommentID", sql.Int, commentId)
        .query(`
          DELETE FROM CommentImage
          WHERE CommentID = @CommentID
        `);
      
      // Then delete comment
      await pool.request()
        .input("CommentID", sql.Int, commentId)
        .query(`
          DELETE FROM Comment
          WHERE CommentID = @CommentID
        `);
      
      return true;
    } catch (error) {
      console.error('CommentDAL.delete error:', error);
      throw error;
    }
  }

  /**
   * Get comment count for a post
   */
  static async getCountByPostId(postId) {
    try {
      const pool = await poolPromise;
      
      const result = await pool.request()
        .input("PostID", sql.Int, postId)
        .query(`
          SELECT COUNT(*) as count
          FROM Comment c
          JOIN Account a ON c.AccountID = a.AccountID
          WHERE c.PostID = @PostID AND a.Status = 'Active'
        `);
      
      return result.recordset[0].count;
    } catch (error) {
      console.error('CommentDAL.getCountByPostId error:', error);
      throw error;
    }
  }

  /**
   * Check if user owns comment
   */
  static async isOwner(commentId, accountId) {
    try {
      const pool = await poolPromise;
      
      const result = await pool.request()
        .input("CommentID", sql.Int, commentId)
        .input("AccountID", sql.Int, accountId)
        .query(`
          SELECT COUNT(*) as count
          FROM Comment
          WHERE CommentID = @CommentID AND AccountID = @AccountID
        `);
      
      return result.recordset[0].count > 0;
    } catch (error) {
      console.error('CommentDAL.isOwner error:', error);
      throw error;
    }
  }
}

module.exports = CommentDAL;