/**
 * Feedback Model
 * Handles all database operations for feedback (reviews and ratings)
 */
const { poolPromise } = require('../config/db');
const sql = require('mssql');

class FeedbackModel {
  /**
   * Create new feedback
   */
  static async createFeedback(feedbackData) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    
    try {
      await transaction.begin();
      
      const { accountId, targetType, targetId, content, rating } = feedbackData;
      
      // Check if user already gave feedback for this target
      const existingFeedback = await transaction.request()
        .input('AccountID', sql.Int, accountId)
        .input('TargetType', sql.VarChar, targetType)
        .input('TargetID', sql.Int, targetId)
        .query(`
          SELECT FeedbackID 
          FROM Feedback 
          WHERE AccountID = @AccountID AND TargetType = @TargetType AND TargetID = @TargetID
        `);
      
      if (existingFeedback.recordset.length > 0) {
        await transaction.rollback();
        return { 
          success: false, 
          message: 'Bạn đã đánh giá cho đối tượng này rồi' 
        };
      }
      
      const result = await transaction.request()
        .input('AccountID', sql.Int, accountId)
        .input('TargetType', sql.VarChar, targetType)
        .input('TargetID', sql.Int, targetId)
  .input('Content', sql.NVarChar, content)
        .input('Rating', sql.Int, rating)
        .query(`
          INSERT INTO Feedback (AccountID, TargetType, TargetID, Content, Rating, CreatedDate)
          OUTPUT INSERTED.*
          VALUES (@AccountID, @TargetType, @TargetID, @Content, @Rating, GETDATE())
        `);
      
      await transaction.commit();
      return { success: true, data: result.recordset[0] };
    } catch (error) {
      await transaction.rollback();
      console.error('FeedbackModel.createFeedback error:', error);
      throw error;
    }
  }

  /**
   * Get feedback by ID
   */
  static async getFeedbackById(feedbackId) {
    try {
      const pool = await poolPromise;
      
      const result = await pool.request()
        .input('FeedbackID', sql.Int, feedbackId)
        .query(`
          SELECT f.*, acc.Username, acc.FullName, acc.AvatarUrl
          FROM Feedback f
          JOIN Account acc ON f.AccountID = acc.AccountID
          WHERE f.FeedbackID = @FeedbackID
        `);
      
      if (result.recordset.length === 0) {
        return null;
      }
      
      return { success: true, data: result.recordset[0] };
    } catch (error) {
      console.error('FeedbackModel.getFeedbackById error:', error);
      throw error;
    }
  }

  /**
   * Get feedback for a specific target (facility, field, or post)
   */
  static async getFeedbackByTarget(targetType, targetId, page = 1, limit = 10) {
    try {
      const pool = await poolPromise;
      const offset = (page - 1) * limit;
      
      const result = await pool.request()
        .input('TargetType', sql.VarChar, targetType)
        .input('TargetID', sql.Int, targetId)
        .input('Limit', sql.Int, limit)
        .input('Offset', sql.Int, offset)
        .query(`
          SELECT f.*, acc.Username, acc.FullName, acc.AvatarUrl
          FROM Feedback f
          JOIN Account acc ON f.AccountID = acc.AccountID
          WHERE f.TargetType = @TargetType AND f.TargetID = @TargetID
          ORDER BY f.CreatedDate DESC
          OFFSET @Offset ROWS
          FETCH NEXT @Limit ROWS ONLY
        `);
      
      // Get total count and average rating
      const statsResult = await pool.request()
        .input('TargetType', sql.VarChar, targetType)
        .input('TargetID', sql.Int, targetId)
        .query(`
          SELECT 
            COUNT(*) as TotalCount,
            AVG(CAST(Rating as FLOAT)) as AverageRating
          FROM Feedback 
          WHERE TargetType = @TargetType AND TargetID = @TargetID
        `);
      
      const stats = statsResult.recordset[0];
      
      return { 
        success: true, 
        data: result.recordset,
        pagination: {
          page,
          limit,
          total: stats.TotalCount
        },
        stats: {
          totalCount: stats.TotalCount,
          averageRating: Math.round(stats.AverageRating * 10) / 10 // Round to 1 decimal
        }
      };
    } catch (error) {
      console.error('FeedbackModel.getFeedbackByTarget error:', error);
      throw error;
    }
  }

  /**
   * Get feedback by user
   */
  static async getFeedbackByUser(accountId, page = 1, limit = 20) {
    try {
      const pool = await poolPromise;
      const offset = (page - 1) * limit;
      
      const result = await pool.request()
        .input('AccountID', sql.Int, accountId)
        .input('Limit', sql.Int, limit)
        .input('Offset', sql.Int, offset)
        .query(`
          SELECT f.*, 
                 CASE 
                   WHEN f.TargetType = 'Facility' THEN fac.FacilityName
                   WHEN f.TargetType = 'Field' THEN sf.FieldName
                   WHEN f.TargetType = 'Post' THEN 'Bài viết #' + CAST(f.TargetID as VARCHAR)
                 END as TargetName
          FROM Feedback f
          LEFT JOIN Facility fac ON f.TargetType = 'Facility' AND f.TargetID = fac.FacilityID
          LEFT JOIN SportField sf ON f.TargetType = 'Field' AND f.TargetID = sf.FieldID
          WHERE f.AccountID = @AccountID
          ORDER BY f.CreatedDate DESC
          OFFSET @Offset ROWS
          FETCH NEXT @Limit ROWS ONLY
        `);
      
      return { success: true, data: result.recordset };
    } catch (error) {
      console.error('FeedbackModel.getFeedbackByUser error:', error);
      throw error;
    }
  }

  /**
   * Update feedback
   */
  static async updateFeedback(feedbackId, feedbackData, userId) {
    try {
      const pool = await poolPromise;
      const { content, rating } = feedbackData;
      
      const result = await pool.request()
        .input('FeedbackID', sql.Int, feedbackId)
        .input('AccountID', sql.Int, userId)
  .input('Content', sql.NVarChar, content)
        .input('Rating', sql.Int, rating)
        .query(`
          UPDATE Feedback 
          SET Content = @Content, Rating = @Rating
          OUTPUT INSERTED.*
          WHERE FeedbackID = @FeedbackID AND AccountID = @AccountID
        `);
      
      if (result.recordset.length === 0) {
        return { success: false, message: 'Không thể cập nhật feedback này' };
      }
      
      return { success: true, data: result.recordset[0] };
    } catch (error) {
      console.error('FeedbackModel.updateFeedback error:', error);
      throw error;
    }
  }

  /**
   * Delete feedback
   */
  static async deleteFeedback(feedbackId, userId, isAdmin = false) {
    try {
      const pool = await poolPromise;
      
      let query = 'DELETE FROM Feedback WHERE FeedbackID = @FeedbackID';
      const request = pool.request().input('FeedbackID', sql.Int, feedbackId);
      
      if (!isAdmin) {
        query += ' AND AccountID = @AccountID';
        request.input('AccountID', sql.Int, userId);
      }
      
      const result = await request.query(query);
      
      if (result.rowsAffected[0] === 0) {
        return { success: false, message: 'Không thể xóa feedback này' };
      }
      
      return { success: true, message: 'Xóa feedback thành công' };
    } catch (error) {
      console.error('FeedbackModel.deleteFeedback error:', error);
      throw error;
    }
  }

  /**
   * Get rating statistics for a target
   */
  static async getRatingStatistics(targetType, targetId) {
    try {
      const pool = await poolPromise;
      
      const result = await pool.request()
        .input('TargetType', sql.VarChar, targetType)
        .input('TargetID', sql.Int, targetId)
        .query(`
          SELECT 
            Rating,
            COUNT(*) as Count
          FROM Feedback 
          WHERE TargetType = @TargetType AND TargetID = @TargetID
          GROUP BY Rating
          ORDER BY Rating DESC
        `);
      
      // Get overall statistics
      const overallResult = await pool.request()
        .input('TargetType', sql.VarChar, targetType)
        .input('TargetID', sql.Int, targetId)
        .query(`
          SELECT 
            COUNT(*) as TotalReviews,
            AVG(CAST(Rating as FLOAT)) as AverageRating,
            MAX(Rating) as MaxRating,
            MIN(Rating) as MinRating
          FROM Feedback 
          WHERE TargetType = @TargetType AND TargetID = @TargetID
        `);
      
      const overall = overallResult.recordset[0];
      
      return { 
        success: true, 
        data: {
          ratingDistribution: result.recordset,
          totalReviews: overall.TotalReviews,
          averageRating: Math.round(overall.AverageRating * 10) / 10,
          maxRating: overall.MaxRating,
          minRating: overall.MinRating
        }
      };
    } catch (error) {
      console.error('FeedbackModel.getRatingStatistics error:', error);
      throw error;
    }
  }

  /**
   * Get top rated facilities/fields
   */
  static async getTopRated(targetType, areaId = null, limit = 10) {
    try {
      const pool = await poolPromise;
      
      let query = `
        SELECT 
          f.TargetID,
          AVG(CAST(f.Rating as FLOAT)) as AverageRating,
          COUNT(*) as ReviewCount,
      `;
      
      let joinClause = '';
      let whereClause = `WHERE f.TargetType = @TargetType`;
      
      if (targetType === 'Facility') {
        query += `fac.FacilityName as Name, fac.AreaID`;
        joinClause = `JOIN Facility fac ON f.TargetID = fac.FacilityID`;
        if (areaId) {
          whereClause += ` AND fac.AreaID = @AreaID`;
        }
      } else if (targetType === 'Field') {
        query += `sf.FieldName as Name, fac.AreaID`;
        joinClause = `
          JOIN SportField sf ON f.TargetID = sf.FieldID
          JOIN Facility fac ON sf.FacilityID = fac.FacilityID
        `;
        if (areaId) {
          whereClause += ` AND fac.AreaID = @AreaID`;
        }
      }
      
      query += `
        FROM Feedback f
        ${joinClause}
        ${whereClause}
        GROUP BY f.TargetID, Name, fac.AreaID
        HAVING COUNT(*) >= 3  -- At least 3 reviews
        ORDER BY AverageRating DESC, ReviewCount DESC
        OFFSET 0 ROWS
        FETCH NEXT @Limit ROWS ONLY
      `;
      
      const request = pool.request()
        .input('TargetType', sql.VarChar, targetType)
        .input('Limit', sql.Int, limit);
      
      if (areaId) {
        request.input('AreaID', sql.Int, areaId);
      }
      
      const result = await request.query(query);
      
      return { success: true, data: result.recordset };
    } catch (error) {
      console.error('FeedbackModel.getTopRated error:', error);
      throw error;
    }
  }
}

module.exports = FeedbackModel;