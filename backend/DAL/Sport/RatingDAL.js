/**
 * Rating DAL
 * Database access layer for ratings (1 rating per user per target)
 */
const { poolPromise } = require('../../config/db');
const sql = require('mssql');

class RatingDAL {
  /**
   * Set or update user's rating
   * If rating exists, update it. Otherwise, create new.
   */
  static async setRating(data) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    
    try {
      await transaction.begin();
      const { accountId, targetType, targetId, rating } = data;
      
      // Check if rating exists
      const existing = await transaction.request()
        .input('AccountID', sql.Int, accountId)
        .input('TargetType', sql.VarChar, targetType)
        .input('TargetID', sql.Int, targetId)
        .query(`
          SELECT RatingID, Rating 
          FROM Rating 
          WHERE AccountID = @AccountID 
            AND TargetType = @TargetType 
            AND TargetID = @TargetID
        `);
      
      let result;
      let isUpdate = false;
      
      if (existing.recordset.length > 0) {
        // Update existing rating
        isUpdate = true;
        result = await transaction.request()
          .input('RatingID', sql.Int, existing.recordset[0].RatingID)
          .input('Rating', sql.Int, rating)
          .query(`
            UPDATE Rating 
            SET Rating = @Rating, UpdatedDate = GETDATE()
            OUTPUT INSERTED.*
            WHERE RatingID = @RatingID
          `);
      } else {
        // Create new rating
        result = await transaction.request()
          .input('AccountID', sql.Int, accountId)
          .input('TargetType', sql.VarChar, targetType)
          .input('TargetID', sql.Int, targetId)
          .input('Rating', sql.Int, rating)
          .query(`
            INSERT INTO Rating (AccountID, TargetType, TargetID, Rating, CreatedDate, UpdatedDate)
            OUTPUT INSERTED.*
            VALUES (@AccountID, @TargetType, @TargetID, @Rating, GETDATE(), GETDATE())
          `);
      }
      
      await transaction.commit();
      return { 
        success: true, 
        data: result.recordset[0],
        isUpdate 
      };
    } catch (error) {
      try { await transaction.rollback(); } catch (e) { /* ignore */ }
      console.error('RatingDAL.setRating error:', error);
      throw error;
    }
  }
  
  /**
   * Get user's rating for a target
   */
  static async getUserRating(accountId, targetType, targetId) {
    const pool = await poolPromise;
    try {
      const result = await pool.request()
        .input('AccountID', sql.Int, accountId)
        .input('TargetType', sql.VarChar, targetType)
        .input('TargetID', sql.Int, targetId)
        .query(`
          SELECT * FROM Rating
          WHERE AccountID = @AccountID 
            AND TargetType = @TargetType 
            AND TargetID = @TargetID
        `);
      
      return { 
        success: true, 
        data: result.recordset.length > 0 ? result.recordset[0] : null 
      };
    } catch (error) {
      console.error('RatingDAL.getUserRating error:', error);
      throw error;
    }
  }
  
  /**
   * Get rating statistics for a target
   */
  static async getRatingStats(targetType, targetId) {
    const pool = await poolPromise;
    try {
      // Get overall stats
      const statsResult = await pool.request()
        .input('TargetType', sql.VarChar, targetType)
        .input('TargetID', sql.Int, targetId)
        .query(`
          SELECT 
            COUNT(*) as totalCount,
            AVG(CAST(Rating as FLOAT)) as averageRating,
            MAX(Rating) as maxRating,
            MIN(Rating) as minRating
          FROM Rating
          WHERE TargetType = @TargetType AND TargetID = @TargetID
        `);
      
      // Get distribution (count for each star)
      const distResult = await pool.request()
        .input('TargetType', sql.VarChar, targetType)
        .input('TargetID', sql.Int, targetId)
        .query(`
          SELECT 
            Rating as star,
            COUNT(*) as count
          FROM Rating
          WHERE TargetType = @TargetType AND TargetID = @TargetID
          GROUP BY Rating
          ORDER BY Rating DESC
        `);
      
      const stats = statsResult.recordset[0];
      
      return { 
        success: true, 
        data: {
          totalCount: stats.totalCount || 0,
          averageRating: stats.averageRating ? Math.round(stats.averageRating * 10) / 10 : 0,
          maxRating: stats.maxRating || 0,
          minRating: stats.minRating || 0,
          distribution: distResult.recordset
        }
      };
    } catch (error) {
      console.error('RatingDAL.getRatingStats error:', error);
      throw error;
    }
  }
  
  /**
   * Delete user's rating
   */
  static async deleteRating(accountId, targetType, targetId) {
    const pool = await poolPromise;
    try {
      const result = await pool.request()
        .input('AccountID', sql.Int, accountId)
        .input('TargetType', sql.VarChar, targetType)
        .input('TargetID', sql.Int, targetId)
        .query(`
          DELETE FROM Rating
          WHERE AccountID = @AccountID 
            AND TargetType = @TargetType 
            AND TargetID = @TargetID
        `);
      
      if (result.rowsAffected[0] === 0) {
        return { success: false, message: 'Không tìm thấy đánh giá để xóa' };
      }
      
      return { success: true };
    } catch (error) {
      console.error('RatingDAL.deleteRating error:', error);
      throw error;
    }
  }
}

module.exports = RatingDAL;
