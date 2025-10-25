/**
 * Field Comment DAL
 * Database access layer for field comments (multiple comments per user allowed)
 */
const { poolPromise } = require('../../config/db');
const sql = require('mssql');

class FieldCommentDAL {
  /**
   * Create new comment
   */
  static async createComment(data) {
    const pool = await poolPromise;
    try {
      const { accountId, targetType, targetId, content } = data;
      
      const result = await pool.request()
        .input('AccountID', sql.Int, accountId)
        .input('TargetType', sql.VarChar, targetType)
        .input('TargetID', sql.Int, targetId)
        .input('Content', sql.NVarChar, content)
        .query(`
          INSERT INTO FieldComment (AccountID, TargetType, TargetID, Content, CreatedDate, UpdatedDate)
          OUTPUT INSERTED.*
          VALUES (@AccountID, @TargetType, @TargetID, @Content, GETDATE(), GETDATE())
        `);
      
      // Get user info
      const commentWithUser = await pool.request()
        .input('CommentID', sql.Int, result.recordset[0].CommentID)
        .query(`
          SELECT 
            fc.*,
            acc.Username,
            acc.FullName,
            acc.AvatarUrl
          FROM FieldComment fc
          JOIN Account acc ON fc.AccountID = acc.AccountID
          WHERE fc.CommentID = @CommentID
        `);
      
      return { success: true, data: commentWithUser.recordset[0] };
    } catch (error) {
      console.error('FieldCommentDAL.createComment error:', error);
      throw error;
    }
  }
  
  /**
   * Get comments for a target with pagination
   */
  static async getComments(targetType, targetId, page = 1, limit = 20) {
    const pool = await poolPromise;
    try {
      const offset = (page - 1) * limit;
      
      const result = await pool.request()
        .input('TargetType', sql.VarChar, targetType)
        .input('TargetID', sql.Int, targetId)
        .input('Limit', sql.Int, limit)
        .input('Offset', sql.Int, offset)
        .query(`
          SELECT 
            fc.*,
            acc.Username,
            acc.FullName,
            acc.AvatarUrl
          FROM FieldComment fc
          JOIN Account acc ON fc.AccountID = acc.AccountID
          WHERE fc.TargetType = @TargetType AND fc.TargetID = @TargetID
          ORDER BY fc.CreatedDate DESC
          OFFSET @Offset ROWS
          FETCH NEXT @Limit ROWS ONLY
        `);
      
      // Get total count
      const countResult = await pool.request()
        .input('TargetType', sql.VarChar, targetType)
        .input('TargetID', sql.Int, targetId)
        .query(`
          SELECT COUNT(*) as TotalCount
          FROM FieldComment
          WHERE TargetType = @TargetType AND TargetID = @TargetID
        `);
      
      const totalCount = countResult.recordset[0].TotalCount;
      
      return { 
        success: true, 
        data: result.recordset,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      console.error('FieldCommentDAL.getComments error:', error);
      throw error;
    }
  }
  
  /**
   * Update comment (only owner can update)
   */
  static async updateComment(commentId, content, accountId) {
    const pool = await poolPromise;
    try {
      const result = await pool.request()
        .input('CommentID', sql.Int, commentId)
        .input('Content', sql.NVarChar, content)
        .input('AccountID', sql.Int, accountId)
        .query(`
          UPDATE FieldComment
          SET Content = @Content, UpdatedDate = GETDATE()
          OUTPUT INSERTED.*
          WHERE CommentID = @CommentID AND AccountID = @AccountID
        `);
      
      if (result.recordset.length === 0) {
        return { success: false, message: 'Comment not found or you do not have permission to edit' };
      }
      
      return { success: true, data: result.recordset[0] };
    } catch (error) {
      console.error('FieldCommentDAL.updateComment error:', error);
      throw error;
    }
  }
  
  /**
   * Delete comment
   */
  static async deleteComment(commentId, accountId, isAdmin = false) {
    const pool = await poolPromise;
    try {
      let query = 'DELETE FROM FieldComment WHERE CommentID = @CommentID';
      const request = pool.request().input('CommentID', sql.Int, commentId);
      
      // If not admin, check ownership
      if (!isAdmin) {
        query += ' AND AccountID = @AccountID';
        request.input('AccountID', sql.Int, accountId);
      }
      
      const result = await request.query(query);
      
      if (result.rowsAffected[0] === 0) {
        return { success: false, message: 'Comment not found or you do not have permission to delete' };
      }
      
      return { success: true };
    } catch (error) {
      console.error('FieldCommentDAL.deleteComment error:', error);
      throw error;
    }
  }
  
  /**
   * Get user's own comments
   */
  static async getMyComments(accountId, page = 1, limit = 20) {
    const pool = await poolPromise;
    try {
      const offset = (page - 1) * limit;
      
      const result = await pool.request()
        .input('AccountID', sql.Int, accountId)
        .input('Limit', sql.Int, limit)
        .input('Offset', sql.Int, offset)
        .query(`
          SELECT 
            fc.*,
            CASE 
              WHEN fc.TargetType = 'Facility' THEN fac.FacilityName
              WHEN fc.TargetType = 'Field' THEN sf.FieldName
            END as TargetName
          FROM FieldComment fc
          LEFT JOIN Facility fac ON fc.TargetType = 'Facility' AND fc.TargetID = fac.FacilityID
          LEFT JOIN SportField sf ON fc.TargetType = 'Field' AND fc.TargetID = sf.FieldID
          WHERE fc.AccountID = @AccountID
          ORDER BY fc.CreatedDate DESC
          OFFSET @Offset ROWS
          FETCH NEXT @Limit ROWS ONLY
        `);
      
      // Get total count
      const countResult = await pool.request()
        .input('AccountID', sql.Int, accountId)
        .query(`
          SELECT COUNT(*) as TotalCount
          FROM FieldComment
          WHERE AccountID = @AccountID
        `);
      
      const totalCount = countResult.recordset[0].TotalCount;
      
      return { 
        success: true, 
        data: result.recordset,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      console.error('FieldCommentDAL.getMyComments error:', error);
      throw error;
    }
  }
}

module.exports = FieldCommentDAL;
