const sql = require('mssql');
const { poolPromise } = require('../../config/db');
const Report = require('../../models/Report/reportModel');
const fs = require('fs');
const path = require('path');

class ReportDAL {
  /**
   * Create a new report
   */
  static async createReport(data) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('ReporterID', sql.Int, data.ReporterID)
        .input('ReportedContentType', sql.NVarChar, data.ReportedContentType)
        .input('ReportedContentID', sql.NVarChar, String(data.ReportedContentID))
        .input('ReportReason', sql.NVarChar, data.ReportReason)
        .input('ReportDescription', sql.NVarChar, data.ReportDescription || null)
        .query(`
          INSERT INTO Reports (ReporterID, ReportedContentType, ReportedContentID, ReportReason, ReportDescription)
          OUTPUT INSERTED.*
          VALUES (@ReporterID, @ReportedContentType, @ReportedContentID, @ReportReason, @ReportDescription)
        `);

      return result.recordset[0] ? new Report(result.recordset[0]) : null;
    } catch (err) {
      console.error('❌ Error creating report:', err);
      throw err;
    }
  }

  /**
   * Get all reports (admin only) with content details
   */
  static async getAllReports(filters = {}) {
    try {
      const pool = await poolPromise;
      let query = `
        SELECT 
          r.*,
          reporter.FullName as ReporterName,
          reporter.Username as ReporterUsername,
          reporter.AvatarUrl as ReporterAvatar,
          reviewer.FullName as ReviewerName,
          reviewer.Username as ReviewerUsername
        FROM Reports r
        LEFT JOIN Account reporter ON r.ReporterID = reporter.AccountID
        LEFT JOIN Account reviewer ON r.ReviewedBy = reviewer.AccountID
        WHERE 1=1
      `;

      const request = pool.request();

      if (filters.status) {
        query += ` AND r.Status = @Status`;
        request.input('Status', sql.NVarChar, filters.status);
      }

      if (filters.contentType) {
        query += ` AND r.ReportedContentType = @ContentType`;
        request.input('ContentType', sql.NVarChar, filters.contentType);
      }

      query += ` ORDER BY r.CreatedAt DESC`;

      const result = await request.query(query);
      const rows = result && result.recordset ? result.recordset : [];

      // Map DB-backed reports
      const mapped = rows.map(row => ({
        report: new Report(row),
        reporter: {
          name: row.ReporterName,
          username: row.ReporterUsername,
          avatar: row.ReporterAvatar
        },
        reviewer: row.ReviewerName ? {
          name: row.ReviewerName,
          username: row.ReviewerUsername
        } : null
      }));

      // Also include fallback reports written to logs/reports-fallback.jsonl (e.g., facility reports or DB-fallbacks)
      try {
        const logsDir = path.resolve(__dirname, '..', '..', 'logs');
        const fallbackFile = path.join(logsDir, 'reports-fallback.jsonl');
        if (fs.existsSync(fallbackFile)) {
          const lines = fs.readFileSync(fallbackFile, 'utf8').split('\n').filter(Boolean);
          const fallbackObjs = lines.map(l => {
            try { return JSON.parse(l); } catch (e) { return null; }
          }).filter(Boolean);

          // Apply same filters (status/contentType) to fallback objects
          const filteredFallback = fallbackObjs.filter(f => {
            if (!f) return false;
            if (filters.status && String(f.Status || '').toLowerCase() !== String(filters.status).toLowerCase()) return false;
            if (filters.contentType && String(f.ReportedContentType || '').toLowerCase() !== String(filters.contentType).toLowerCase()) return false;
            return true;
          });

          // Optionally try to enrich reporter info from Account table
          let reporterMap = {};
          try {
            const reporterIds = Array.from(new Set(filteredFallback.map(ff => ff.ReporterID).filter(Boolean)));
            if (reporterIds.length > 0) {
              const q = `SELECT AccountID, FullName, Username, AvatarUrl FROM Account WHERE AccountID IN (${reporterIds.map((_,i) => '@id' + i).join(',')})`;
              const req = pool.request();
              reporterIds.forEach((rid, i) => req.input('id' + i, sql.Int, rid));
              const rres = await req.query(q);
              if (rres && rres.recordset) {
                for (const rr of rres.recordset) reporterMap[rr.AccountID] = rr;
              }
            }
          } catch (enrichErr) {
            // Non-fatal; reporterMap stays empty
            console.debug('ReportDAL.getAllReports: could not enrich fallback reporters', enrichErr && enrichErr.message ? enrichErr.message : enrichErr);
          }

          for (const fb of filteredFallback) {
            const rowLike = {
              ReportID: fb.ReportID,
              ReporterID: fb.ReporterID,
              ReportedContentType: fb.ReportedContentType,
              ReportedContentID: fb.ReportedContentID,
              ReportReason: fb.ReportReason,
              ReportDescription: fb.ReportDescription,
              Status: fb.Status,
              AdminNote: fb.AdminNote || null,
              ReviewedBy: fb.ReviewedBy || null,
              ReviewedAt: fb.ReviewedAt || null,
              CreatedAt: fb.CreatedAt || fb.CreatedAt,
              UpdatedAt: fb.UpdatedAt || fb.UpdatedAt
            };

            mapped.push({
              report: new Report(rowLike),
              reporter: reporterMap[fb.ReporterID] ? {
                name: reporterMap[fb.ReporterID].FullName,
                username: reporterMap[fb.ReporterID].Username,
                avatar: reporterMap[fb.ReporterID].AvatarUrl
              } : null,
              reviewer: fb.ReviewedBy ? { name: String(fb.ReviewedBy) } : null
            });
          }
        }
      } catch (fallbackErr) {
        console.error('❌ Error reading fallback reports file:', fallbackErr && fallbackErr.message ? fallbackErr.message : fallbackErr);
      }

      return mapped;
    } catch (err) {
      console.error('❌ Error getting all reports:', err && err.message ? err.message : err);
      // If the reports table doesn't exist, return an empty list (development fallback)
      const msg = (err && err.originalError && err.originalError.info && err.originalError.info.message) || (err && err.message);
      if (typeof msg === 'string' && msg.includes("Invalid object name 'Reports'")) {
        console.warn("Reports table missing - returning empty list as fallback");
        return [];
      }
      throw err;
    }
  }

  /**
   * Get report by ID with full content details
   */
  static async getReportById(reportId) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('ReportID', sql.Int, reportId)
        .query(`
          SELECT 
            r.*,
            reporter.FullName as ReporterName,
            reporter.Username as ReporterUsername,
            reporter.AvatarUrl as ReporterAvatar,
            reviewer.FullName as ReviewerName,
            reviewer.Username as ReviewerUsername
          FROM Reports r
          LEFT JOIN Account reporter ON r.ReporterID = reporter.AccountID
          LEFT JOIN Account reviewer ON r.ReviewedBy = reviewer.AccountID
          WHERE r.ReportID = @ReportID
        `);

      if (result.recordset.length === 0) return null;

      const row = result.recordset[0];
      return {
        report: new Report(row),
        reporter: {
          name: row.ReporterName,
          username: row.ReporterUsername,
          avatar: row.ReporterAvatar
        },
        reviewer: row.ReviewerName ? {
          name: row.ReviewerName,
          username: row.ReviewerUsername
        } : null
      };
    } catch (err) {
      console.error('❌ Error getting report by ID:', err && err.message ? err.message : err);
      const msg = (err && err.originalError && err.originalError.info && err.originalError.info.message) || (err && err.message);
      if (typeof msg === 'string' && msg.includes("Invalid object name 'Reports'")) {
        console.warn('Reports table missing - getReportById returning null');
        return null;
      }
      throw err;
    }
  }

  /**
   * Get reported content details (post/story/comment)
   */
  static async getReportedContent(contentType, contentId) {
    try {
      const pool = await poolPromise;
      // For posts, prefer loading the full post via PostDAL so we include MediaAssets (Images/Data)
      if (String(contentType).toLowerCase() === 'post') {
        try {
          const PostDAL = require('../Social/PostDAL');
          const post = await PostDAL.getById(parseInt(contentId));
          // Return frontend-shaped post if available
          if (post && typeof post.toFrontendFormat === 'function') {
            return post.toFrontendFormat();
          }
          // else fall through to the legacy query below
        } catch (e) {
          // If PostDAL is unavailable or fails, log and continue to fallback query
          console.debug('ReportDAL.getReportedContent: PostDAL lookup failed, falling back to direct query', e && e.message ? e.message : e);
        }
      }

      let query = '';

      switch (String(contentType).toLowerCase()) {
        case 'post':
          // Select columns that exist in the DB and normalize CreatedDate -> CreatedAt for frontend
          query = `
            SELECT
              p.PostID,
              p.AccountID,
              p.Content,
              p.Status,
              p.IsShare,
              p.SharedFromPostID,
              p.SharedNote,
              p.BookingID,
              p.CreatedDate AS CreatedAt,
              a.FullName as AuthorName,
              a.Username as AuthorUsername,
              a.AvatarUrl as AuthorAvatar
            FROM Post p
            LEFT JOIN Account a ON p.AccountID = a.AccountID
            WHERE p.PostID = @ContentID
          `;
          break;

        case 'story':
          query = `
            SELECT
              s.StoryID,
              s.AccountID,
              s.Content,
              s.MediaUrl,
              s.MediaType,
              s.BackgroundColor,
              s.ExpiresAt,
              s.Status,
              s.ViewCount,
              s.CreatedDate AS CreatedAt,
              a.FullName as AuthorName,
              a.Username as AuthorUsername,
              a.AvatarUrl as AuthorAvatar
            FROM Story s
            LEFT JOIN Account a ON s.AccountID = a.AccountID
            WHERE s.StoryID = @ContentID
          `;
          break;

        case 'comment':
          query = `
            SELECT
              c.CommentID,
              c.PostID,
              c.AccountID,
              c.Content,
              c.ParentCommentID,
              c.CreatedDate AS CreatedAt,
              a.FullName as AuthorName,
              a.Username as AuthorUsername,
              a.AvatarUrl as AuthorAvatar
            FROM Comment c
            LEFT JOIN Account a ON c.AccountID = a.AccountID
            WHERE c.CommentID = @ContentID
          `;
          break;

        case 'facility':
          // Try to load facility details via FacilityDAL which returns enriched facility object
          try {
            const FacilityDAL = require('../Sport/facilityDAL');
            const fac = await FacilityDAL.getFacilityById(parseInt(contentId));
            if (fac && fac.success) return fac.data || null;
          } catch (e) {
            console.debug('ReportDAL.getReportedContent: FacilityDAL lookup failed', e && e.message ? e.message : e);
          }
          // Fallback: try a simple direct query below if FacilityDAL failed
          query = `
            SELECT f.FacilityID, f.FacilityName, f.AreaID, f.OwnerID, a.AreaName, acc.FullName as OwnerName
            FROM Facility f
            LEFT JOIN Area a ON f.AreaID = a.AreaID
            LEFT JOIN Account acc ON f.OwnerID = acc.AccountID
            WHERE f.FacilityID = @ContentID
          `;
          break;

        default:
          return null;
      }

      const result = await pool.request()
        .input('ContentID', sql.NVarChar, String(contentId))
        .query(query);

      return result.recordset[0] || null;
    } catch (err) {
      console.error('❌ Error getting reported content:', err && err.message ? err.message : err);
      const msg = (err && err.originalError && err.originalError.info && err.originalError.info.message) || (err && err.message);
      if (typeof msg === 'string' && msg.includes('Invalid object name')) {
        console.warn('Reported content table missing - returning null for content lookup');
        return null;
      }
      throw err;
    }
  }

  /**
   * Update report status (admin action)
   */
  static async updateReportStatus(reportId, status, adminId, adminNote = null) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('ReportID', sql.Int, reportId)
        .input('Status', sql.NVarChar, status)
        .input('AdminID', sql.Int, adminId)
        .input('AdminNote', sql.NVarChar, adminNote)
        .query(`
          UPDATE Reports
          SET 
            Status = @Status,
            ReviewedBy = @AdminID,
            ReviewedAt = GETDATE(),
            AdminNote = @AdminNote,
            UpdatedAt = GETDATE()
          OUTPUT INSERTED.*
          WHERE ReportID = @ReportID
        `);

      return result.recordset[0] ? new Report(result.recordset[0]) : null;
    } catch (err) {
      console.error('❌ Error updating report status:', err);
      throw err;
    }
  }

  /**
   * Check if user already reported this content
   */
  static async checkDuplicateReport(reporterId, contentType, contentId) {
    try {
      const pool = await poolPromise;
      const request = pool.request();
      request.input('ReporterID', sql.Int, reporterId);
      request.input('ContentType', sql.NVarChar, contentType);
      request.input('ContentID', sql.NVarChar, String(contentId));
      const result = await request.query(`
        SELECT COUNT(*) as Count
        FROM Reports
        WHERE ReporterID = @ReporterID
          AND ReportedContentType = @ContentType
          AND ReportedContentID = @ContentID
          AND Status IN ('pending', 'reviewed')
      `);

      return result.recordset[0].Count > 0;
    } catch (err) {
      console.error('❌ Error checking duplicate report:', err);
      throw err;
    }
  }

  /**
   * Get report count by status
   */
  static async getReportStats() {
    try {
      const pool = await poolPromise;
      const result = await pool.request().query(`
        SELECT 
          Status,
          COUNT(*) as Count
        FROM Reports
        GROUP BY Status
      `);

      return result.recordset;
    } catch (err) {
      console.error('❌ Error getting report stats:', err && err.message ? err.message : err);
      const msg = (err && err.originalError && err.originalError.info && err.originalError.info.message) || (err && err.message);
      // If Reports table missing or DB error, fall back to computing stats from fallback file
      try {
        const logsDir = path.resolve(__dirname, '..', '..', 'logs');
        const fallbackFile = path.join(logsDir, 'reports-fallback.jsonl');
        if (fs.existsSync(fallbackFile)) {
          const lines = fs.readFileSync(fallbackFile, 'utf8').split('\n').filter(Boolean);
          const fallbackObjs = lines.map(l => {
            try { return JSON.parse(l); } catch (e) { return null; }
          }).filter(Boolean);

          const counts = {};
          for (const f of fallbackObjs) {
            const st = (f.Status || 'pending');
            counts[st] = (counts[st] || 0) + 1;
          }

          const out = Object.keys(counts).map(k => ({ Status: k, Count: counts[k] }));
          return out;
        }
      } catch (fbErr) {
        console.error('❌ Error reading fallback reports for stats:', fbErr && fbErr.message ? fbErr.message : fbErr);
      }

      if (typeof msg === 'string' && msg.includes("Invalid object name 'Reports'")) {
        console.warn('Reports table missing - getReportStats returning empty array');
        return [];
      }
      throw err;
    }
  }
}

module.exports = ReportDAL;
