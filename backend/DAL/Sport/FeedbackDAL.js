const { poolPromise } = require('../../config/db');
const sql = require('mssql');

class FeedbackDAL {
  static async createFeedback(feedbackData) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    try {
      await transaction.begin();
      const { accountId, targetType, targetId, content, rating } = feedbackData;

      const existingFeedback = await transaction.request()
        .input('AccountID', sql.Int, accountId)
        .input('TargetType', sql.VarChar, targetType)
        .input('TargetID', sql.Int, targetId)
        .query(`SELECT FeedbackID FROM Feedback WHERE AccountID = @AccountID AND TargetType = @TargetType AND TargetID = @TargetID`);

      if (existingFeedback.recordset.length > 0) {
        await transaction.rollback();
        return { success: false, message: 'Bạn đã đánh giá cho đối tượng này rồi' };
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
      try { await transaction.rollback(); } catch (e) { /* ignore */ }
      console.error('FeedbackDAL.createFeedback error:', error);
      throw error;
    }
  }

  static async getFeedbackById(feedbackId) {
    const pool = await poolPromise;
    try {
      const result = await pool.request()
        .input('FeedbackID', sql.Int, feedbackId)
        .query(`
          SELECT f.*, acc.Username, acc.FullName, acc.AvatarUrl
          FROM Feedback f
          JOIN Account acc ON f.AccountID = acc.AccountID
          WHERE f.FeedbackID = @FeedbackID
        `);

      if (result.recordset.length === 0) return null;
      return { success: true, data: result.recordset[0] };
    } catch (error) {
      console.error('FeedbackDAL.getFeedbackById error:', error);
      throw error;
    }
  }

  static async getFeedbackByTarget(targetType, targetId, page = 1, limit = 10) {
    const pool = await poolPromise;
    try {
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

      const statsResult = await pool.request()
        .input('TargetType', sql.VarChar, targetType)
        .input('TargetID', sql.Int, targetId)
        .query(`
          SELECT COUNT(*) as TotalCount, AVG(CAST(Rating as FLOAT)) as AverageRating
          FROM Feedback WHERE TargetType = @TargetType AND TargetID = @TargetID
        `);

      const stats = statsResult.recordset[0];

      return { success: true, data: result.recordset, pagination: { page, limit, total: stats.TotalCount }, stats: { totalCount: stats.TotalCount, averageRating: Math.round(stats.AverageRating * 10) / 10 } };
    } catch (error) {
      console.error('FeedbackDAL.getFeedbackByTarget error:', error);
      throw error;
    }
  }

  static async getFeedbackByUser(accountId, page = 1, limit = 20) {
    const pool = await poolPromise;
    try {
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
      console.error('FeedbackDAL.getFeedbackByUser error:', error);
      throw error;
    }
  }

  static async updateFeedback(feedbackId, feedbackData, userId) {
    const pool = await poolPromise;
    try {
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

      if (result.recordset.length === 0) return { success: false, message: 'Không thể cập nhật feedback này' };
      return { success: true, data: result.recordset[0] };
    } catch (error) {
      console.error('FeedbackDAL.updateFeedback error:', error);
      throw error;
    }
  }

  static async deleteFeedback(feedbackId, userId, isAdmin = false) {
    const pool = await poolPromise;
    try {
      let query = 'DELETE FROM Feedback WHERE FeedbackID = @FeedbackID';
      const request = pool.request().input('FeedbackID', sql.Int, feedbackId);
      if (!isAdmin) { query += ' AND AccountID = @AccountID'; request.input('AccountID', sql.Int, userId); }
      const result = await request.query(query);
      if (result.rowsAffected[0] === 0) return { success: false, message: 'Không thể xóa feedback này' };
      return { success: true, message: 'Xóa feedback thành công' };
    } catch (error) {
      console.error('FeedbackDAL.deleteFeedback error:', error);
      throw error;
    }
  }

  static async getRatingStatistics(targetType, targetId) {
    const pool = await poolPromise;
    try {
      const result = await pool.request()
        .input('TargetType', sql.VarChar, targetType)
        .input('TargetID', sql.Int, targetId)
        .query(`SELECT Rating, COUNT(*) as Count FROM Feedback WHERE TargetType = @TargetType AND TargetID = @TargetID GROUP BY Rating ORDER BY Rating DESC`);

      const overallResult = await pool.request()
        .input('TargetType', sql.VarChar, targetType)
        .input('TargetID', sql.Int, targetId)
        .query(`SELECT COUNT(*) as TotalReviews, AVG(CAST(Rating as FLOAT)) as AverageRating, MAX(Rating) as MaxRating, MIN(Rating) as MinRating FROM Feedback WHERE TargetType = @TargetType AND TargetID = @TargetID`);

      const overall = overallResult.recordset[0];
      return { success: true, data: { ratingDistribution: result.recordset, totalReviews: overall.TotalReviews, averageRating: Math.round(overall.AverageRating * 10) / 10, maxRating: overall.MaxRating, minRating: overall.MinRating } };
    } catch (error) {
      console.error('FeedbackDAL.getRatingStatistics error:', error);
      throw error;
    }
  }

  static async getTopRated(targetType, areaId = null, limit = 10) {
    const pool = await poolPromise;
    try {
      let query = `SELECT f.TargetID, AVG(CAST(f.Rating as FLOAT)) as AverageRating, COUNT(*) as ReviewCount, `;
      let joinClause = '';
      let whereClause = `WHERE f.TargetType = @TargetType`;
      if (targetType === 'Facility') { query += `fac.FacilityName as Name, fac.AreaID`; joinClause = `JOIN Facility fac ON f.TargetID = fac.FacilityID`; if (areaId) { whereClause += ' AND fac.AreaID = @AreaID'; } } else { query += `fac.FacilityName as Name, fac.AreaID`; }
      query += ` FROM Feedback f ${joinClause} ${whereClause} GROUP BY f.TargetID, Name, fac.AreaID HAVING COUNT(*) >= 3 ORDER BY AverageRating DESC, ReviewCount DESC OFFSET 0 ROWS FETCH NEXT @Limit ROWS ONLY`;

      const request = pool.request().input('TargetType', sql.VarChar, targetType).input('Limit', sql.Int, limit);
      if (areaId) request.input('AreaID', sql.Int, areaId);
      const result = await request.query(query);
      return { success: true, data: result.recordset };
    } catch (error) {
      console.error('FeedbackDAL.getTopRated error:', error);
      throw error;
    }
  }
}

module.exports = FeedbackDAL;
