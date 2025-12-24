const { poolPromise } = require('../../config/db');
const sql = require('mssql');

class FeedbackDAL {
  static async createFeedback(data) {
    const pool = await poolPromise;
    try {
      const { accountId, targetType, targetId, content, rating } = data;

      const result = await pool.request()
        .input('AccountID', sql.Int, accountId)
        .input('TargetType', sql.NVarChar, targetType)
        .input('TargetID', sql.Int, targetId)
        .input('Content', sql.NVarChar, content)
        .query(`
          INSERT INTO Feedback (AccountID, TargetType, TargetID, Content, CreatedDate)
          OUTPUT INSERTED.*
          VALUES (@AccountID, @TargetType, @TargetID, @Content, GETDATE())
        `);

      const feedbackId = result.recordset[0].FeedbackID;

      // Attach user info
      const withUser = await pool.request()
        .input('FeedbackID', sql.Int, feedbackId)
        .query(`
          SELECT f.FeedbackID, f.AccountID, f.TargetType, f.TargetID, f.Content, f.CreatedDate,
                 acc.Username, acc.FullName, acc.AvatarUrl
          FROM Feedback f
          JOIN Account acc ON f.AccountID = acc.AccountID
          WHERE f.FeedbackID = @FeedbackID
        `);

      return { success: true, data: withUser.recordset[0] };
    } catch (error) {
      console.error('FeedbackDAL.createFeedback error:', error);
      throw error;
    }
  }

  static async getByTarget(targetType, targetId, page = 1, limit = 20) {
    const pool = await poolPromise;
    try {
      const offset = (page - 1) * limit;

      const result = await pool.request()
        .input('TargetType', sql.NVarChar, targetType)
        .input('TargetID', sql.Int, targetId)
        .input('Limit', sql.Int, limit)
        .input('Offset', sql.Int, offset)
        .query(`
          SELECT f.FeedbackID, f.AccountID, f.TargetType, f.TargetID, f.Content, f.CreatedDate,
                 acc.Username, acc.FullName, acc.AvatarUrl
          FROM Feedback f
          JOIN Account acc ON f.AccountID = acc.AccountID
          WHERE f.TargetType = @TargetType AND f.TargetID = @TargetID
          ORDER BY f.CreatedDate DESC
          OFFSET @Offset ROWS
          FETCH NEXT @Limit ROWS ONLY
        `);

      const countRes = await pool.request()
        .input('TargetType', sql.NVarChar, targetType)
        .input('TargetID', sql.Int, targetId)
        .query(`
          SELECT COUNT(*) as TotalCount FROM Feedback WHERE TargetType = @TargetType AND TargetID = @TargetID
        `);

      const total = countRes.recordset[0].TotalCount;

      return {
        success: true,
        data: result.recordset,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('FeedbackDAL.getByTarget error:', error);
      throw error;
    }
  }

  static async updateFeedback(feedbackId, accountId, content, rating) {
    const pool = await poolPromise;
    try {
      const result = await pool.request()
        .input('FeedbackID', sql.Int, feedbackId)
        .input('AccountID', sql.Int, accountId)
        .input('Content', sql.NVarChar, content)
        .query(`
          UPDATE Feedback
          SET Content = @Content
          OUTPUT INSERTED.*
          WHERE FeedbackID = @FeedbackID AND AccountID = @AccountID
        `);

      if (result.recordset.length === 0) {
        return { success: false, message: 'Feedback not found or no permission' };
      }

      return { success: true, data: result.recordset[0] };
    } catch (error) {
      console.error('FeedbackDAL.updateFeedback error:', error);
      throw error;
    }
  }

  static async deleteFeedback(feedbackId, accountId, isAdmin = false) {
    const pool = await poolPromise;
    try {
      let query = 'DELETE FROM Feedback WHERE FeedbackID = @FeedbackID';
      const request = pool.request().input('FeedbackID', sql.Int, feedbackId);

      if (!isAdmin) {
        query += ' AND AccountID = @AccountID';
        request.input('AccountID', sql.Int, accountId);
      }

      const result = await request.query(query);

      if (result.rowsAffected[0] === 0) {
        return { success: false, message: 'Feedback not found or no permission' };
      }

      return { success: true };
    } catch (error) {
      console.error('FeedbackDAL.deleteFeedback error:', error);
      throw error;
    }
  }

  static async getMyFeedbacks(accountId, page = 1, limit = 20) {
    const pool = await poolPromise;
    try {
      const offset = (page - 1) * limit;
      const result = await pool.request()
        .input('AccountID', sql.Int, accountId)
        .input('Limit', sql.Int, limit)
        .input('Offset', sql.Int, offset)
        .query(`
          SELECT f.FeedbackID, f.AccountID, f.TargetType, f.TargetID, f.Content, f.CreatedDate,
            CASE WHEN f.TargetType = 'Facility' THEN fac.FacilityName
                 WHEN f.TargetType = 'Field' THEN sf.FieldName END as TargetName
          FROM Feedback f
          LEFT JOIN Facility fac ON f.TargetType = 'Facility' AND f.TargetID = fac.FacilityID
          LEFT JOIN SportField sf ON f.TargetType = 'Field' AND f.TargetID = sf.FieldID
          WHERE f.AccountID = @AccountID
          ORDER BY f.CreatedDate DESC
          OFFSET @Offset ROWS
          FETCH NEXT @Limit ROWS ONLY
        `);

      const countRes = await pool.request()
        .input('AccountID', sql.Int, accountId)
        .query(`
          SELECT COUNT(*) as TotalCount FROM Feedback WHERE AccountID = @AccountID
        `);

      const total = countRes.recordset[0].TotalCount;

      return {
        success: true,
        data: result.recordset,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('FeedbackDAL.getMyFeedbacks error:', error);
      throw error;
    }
  }
}

module.exports = FeedbackDAL;
