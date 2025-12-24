  /**
   * Admin Dashboard Controller
   * Provides aggregated statistics for admin dashboard
   */

  const { poolPromise } = require('../../config/db');
  const sql = require('mssql');

  class DashboardController {
    /**
     * Get user growth by month (new users & total users)
     * GET /api/admin/dashboard/user-growth
     */
    static async getUserGrowth(req, res) {
      try {
        const pool = await poolPromise;
        const newUsersResult = await pool.request().query(`
          SELECT YEAR(CreatedAt) as Year, MONTH(CreatedAt) as Month, COUNT(*) as NewUsers
          FROM dbo.Account
          WHERE CreatedAt >= DATEADD(month, -12, GETDATE())
          GROUP BY YEAR(CreatedAt), MONTH(CreatedAt)
          ORDER BY Year, Month
        `);
        const totalUsersResult = await pool.request().query(`
          SELECT YEAR(CreatedAt) as Year, MONTH(CreatedAt) as Month, COUNT(*) as TotalUsers
          FROM dbo.Account
          GROUP BY YEAR(CreatedAt), MONTH(CreatedAt)
          ORDER BY Year, Month
        `);
        res.json({
          success: true,
          data: {
            newUsers: newUsersResult.recordset,
            totalUsers: totalUsersResult.recordset
          }
        });
      } catch (error) {
        console.error('User growth error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch user growth', error: error.message });
      }
    }
    static async getActivityTrends(req, res) {
      try {
        const pool = await poolPromise;
        const postsResult = await pool.request().query(`
          SELECT CAST(CreatedDate AS DATE) as Date, COUNT(*) as Posts
          FROM Post
          WHERE CreatedDate >= DATEADD(day, -30, GETDATE())
          GROUP BY CAST(CreatedDate AS DATE)
          ORDER BY Date
        `);
        const commentsResult = await pool.request().query(`
          SELECT CAST(CreatedDate AS DATE) as Date, COUNT(*) as Comments
          FROM Comment
          WHERE CreatedDate >= DATEADD(day, -30, GETDATE())
          GROUP BY CAST(CreatedDate AS DATE)
          ORDER BY Date
        `);
        res.json({
          success: true,
          data: {
            posts: postsResult.recordset,
            comments: commentsResult.recordset
          }
        });
      } catch (error) {
        console.error('Activity trends error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch activity trends', error: error.message });
      }
    }
  /**
   * Get all dashboard statistics in one request
   * GET /api/admin/dashboard/stats
   */
  static async getDashboardStats(req, res) {
    try {
      const pool = await poolPromise;

      // Helper function to safely execute query with fallback
      const safeQuery = async (query, fallback = { recordset: [{ Total: 0 }] }) => {
        try {
          return await pool.request().query(query);
        } catch (error) {
          console.warn('Query failed, using fallback:', error.message);
          return fallback;
        }
      };

      // Execute all queries in parallel
      const [
        usersResult,
        facilitiesResult,
        bookingsResult,
        postsResult,
        commentsResult,
        reactionsResult,
        sharesResult,
        moderationResult,
        activeUsersResult,
        revenueResult,
        courtsResult
      ] = await Promise.all([
        // Total users (no Status column in Account)
        safeQuery(`SELECT COUNT(*) as Total FROM Account`),

        // Total facilities (no Status column in Facility)
        safeQuery(`SELECT COUNT(*) as Total FROM Facility`),

        // Total bookings and pending count
        safeQuery(`
          SELECT 
            COUNT(*) as Total,
            SUM(CASE WHEN Status = 'Pending' THEN 1 ELSE 0 END) as Pending,
            SUM(CASE WHEN Status = 'Confirmed' THEN 1 ELSE 0 END) as Confirmed,
            SUM(CASE WHEN Status = 'Completed' THEN 1 ELSE 0 END) as Completed,
            SUM(CASE WHEN Status = 'Cancelled' THEN 1 ELSE 0 END) as Cancelled
          FROM Booking
        `, { recordset: [{ Total: 0, Pending: 0, Confirmed: 0, Completed: 0, Cancelled: 0 }] }),

        // Total posts
        safeQuery(`
          SELECT COUNT(*) as Total 
          FROM Post 
          WHERE Status = 'Visible'
        `),

        // Total comments
        safeQuery(`
          SELECT COUNT(*) as Total 
          FROM Comment 
          WHERE Status != 'Deleted'
        `),

        // Total reactions
        safeQuery(`SELECT COUNT(*) as Total FROM Reaction`),

        // Total shares
        safeQuery(`SELECT COUNT(*) as Total FROM Share`),

        // Flagged content (may not exist)
        safeQuery(`
          SELECT COUNT(*) as Total 
          FROM ContentModerationLog 
          WHERE NeedsReview = 1 OR IsClean = 0
        `),

        // Active users (posted, commented, or booked in last 30 days)
        safeQuery(`
          SELECT COUNT(DISTINCT AccountID) as Total 
          FROM (
            SELECT AccountID FROM Post 
            WHERE CreatedDate >= DATEADD(day, -30, GETDATE())
            UNION
            SELECT AccountID FROM Comment 
            WHERE CreatedDate >= DATEADD(day, -30, GETDATE())
            UNION
            SELECT CustomerID as AccountID FROM Booking 
            WHERE StartTime >= DATEADD(day, -30, GETDATE())
          ) AS ActiveUsers
        `),

        // Total revenue from confirmed/completed bookings
        safeQuery(`
          SELECT 
            ISNULL(SUM(TotalAmount), 0) as TotalRevenue,
            ISNULL(SUM(CASE WHEN Status = 'Completed' THEN TotalAmount ELSE 0 END), 0) as CompletedRevenue
          FROM Booking 
          WHERE Status IN ('Confirmed', 'Completed')
        `, { recordset: [{ TotalRevenue: 0, CompletedRevenue: 0 }] })
        ,
        // Top courts (fields) by bookings in last 30 days with average rating
        safeQuery(`
          SELECT TOP 5
            sf.FieldID,
            sf.FieldName as Name,
            f.FacilityName as Facility,
            COUNT(*) as BookingsCount,
            ISNULL((SELECT AVG(CAST(Rating as FLOAT)) FROM Rating WHERE TargetType = 'Field' AND TargetID = sf.FieldID), 0) as AvgRating
          FROM Booking b
          JOIN SportField sf ON b.FieldID = sf.FieldID
          LEFT JOIN Facility f ON sf.FacilityID = f.FacilityID
          WHERE b.StartTime >= DATEADD(day, -30, GETDATE())
          GROUP BY sf.FieldID, sf.FieldName, f.FacilityName
          ORDER BY BookingsCount DESC
        `, { recordset: [] })
      ]);

      // Calculate growth rate (bookings last 30 days vs previous 30 days)
      const growthResult = await safeQuery(`
        SELECT 
          (SELECT COUNT(*) FROM Booking WHERE StartTime >= DATEADD(day, -30, GETDATE())) as Recent,
          (SELECT COUNT(*) FROM Booking WHERE StartTime >= DATEADD(day, -60, GETDATE()) AND StartTime < DATEADD(day, -30, GETDATE())) as Previous
      `, { recordset: [{ Recent: 0, Previous: 0 }] });

      const recent = growthResult.recordset[0].Recent || 0;
      const previous = growthResult.recordset[0].Previous || 0;
      const growthRate = previous > 0 ? ((recent - previous) / previous * 100).toFixed(1) : 0;

      // Compile statistics
      const stats = {
        users: {
          total: usersResult.recordset[0].Total || 0,
          active: activeUsersResult.recordset[0].Total || 0
        },
        facilities: {
          total: facilitiesResult.recordset[0].Total || 0
        },
        bookings: {
          total: bookingsResult.recordset[0].Total || 0,
          pending: bookingsResult.recordset[0].Pending || 0,
          confirmed: bookingsResult.recordset[0].Confirmed || 0,
          completed: bookingsResult.recordset[0].Completed || 0,
          cancelled: bookingsResult.recordset[0].Cancelled || 0
        },
        revenue: {
          total: parseFloat(revenueResult.recordset[0].TotalRevenue) || 0,
          completed: parseFloat(revenueResult.recordset[0].CompletedRevenue) || 0
        },
        social: {
          posts: postsResult.recordset[0].Total || 0,
          comments: commentsResult.recordset[0].Total || 0,
          reactions: reactionsResult.recordset[0].Total || 0,
          shares: sharesResult.recordset[0].Total || 0
        },
        moderation: {
          flagged: moderationResult.recordset[0].Total || 0
        },
        growth: {
          rate: parseFloat(growthRate),
          recent: recent,
          previous: previous
        }
        ,
        courts: (courtsResult && courtsResult.recordset ? courtsResult.recordset.map(c => ({
          name: c.Name || (c.Facility ? `${c.Facility}` : 'Unknown'),
          bookings: c.BookingsCount || 0,
          rating: c.AvgRating ? Math.round(c.AvgRating * 10) / 10 : 0
        })) : [])
      };

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      console.error('Dashboard stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch dashboard statistics',
        error: error.message
      });
    }
  }

  /**
   * Get revenue trend by month (last 12 months)
   * GET /api/admin/dashboard/revenue-by-month
   */
  static async getRevenueByMonth(req, res) {
    try {
      const pool = await poolPromise;

      const result = await pool.request().query(`
        SELECT 
          YEAR(StartTime) as Year,
          MONTH(StartTime) as Month,
          COUNT(*) as BookingsCount,
          SUM(TotalAmount) as Revenue
        FROM Booking
        WHERE StartTime >= DATEADD(month, -12, GETDATE())
          AND Status IN ('Confirmed', 'Completed')
        GROUP BY YEAR(StartTime), MONTH(StartTime)
        ORDER BY Year, Month
      `);

      res.json({
        success: true,
        data: result.recordset
      });

    } catch (error) {
      console.error('Revenue by month error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch monthly revenue',
        error: error.message
      });
    }
  }

  /**
   * Get sport type trends by month
   * GET /api/admin/dashboard/sport-trends
   */
  static async getSportTrends(req, res) {
    try {
      const pool = await poolPromise;

      const result = await pool.request().query(`
        SELECT 
          st.SportName,
          YEAR(b.StartTime) as Year,
          MONTH(b.StartTime) as Month,
          COUNT(*) as BookingsCount
        FROM Booking b
        JOIN SportField sf ON b.FieldID = sf.FieldID
        JOIN SportType st ON sf.SportTypeID = st.SportTypeID
        WHERE b.StartTime >= DATEADD(month, -6, GETDATE())
        GROUP BY st.SportName, YEAR(b.StartTime), MONTH(b.StartTime)
        ORDER BY Year, Month, BookingsCount DESC
      `);

      res.json({
        success: true,
        data: result.recordset
      });

    } catch (error) {
      console.error('Sport trends error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch sport trends',
        error: error.message
      });
    }
  }
  static async getOccupancyByTime(req, res) {
    try {
      const pool = await poolPromise;

      const result = await pool.request().query(`
        SELECT 
          DATEPART(HOUR, StartTime) as Hour,
          COUNT(*) as TotalBookings,
          COUNT(CASE WHEN Status IN ('Confirmed', 'Completed') THEN 1 END) as ConfirmedBookings,
          CAST(COUNT(CASE WHEN Status IN ('Confirmed', 'Completed') THEN 1 END) * 100.0 / COUNT(*) as DECIMAL(5,2)) as OccupancyRate
        FROM Booking
        WHERE StartTime >= DATEADD(day, -30, GETDATE())
        GROUP BY DATEPART(HOUR, StartTime)
        ORDER BY Hour
      `);

      res.json({
        success: true,
        data: result.recordset
      });

    } catch (error) {
      console.error('Occupancy by time error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch occupancy data',
        error: error.message
      });
    }
  }
}

module.exports = DashboardController;
