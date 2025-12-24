const ReportDAL = require('../../DAL/Report/reportDAL');
const ReportModel = require('../../models/Report/reportModel');
const fs = require('fs');
const path = require('path');
const { createNotification } = require('../Notification/notificationController');
const {
  sendSuccess,
  sendCreated,
  sendError,
  sendValidationError,
  sendUnauthorized,
  sendNotFound
} = require('../../utils/responseHelper');
const { getAccountId } = require('../../utils/requestUtils');
const { t, getLocaleFromReq } = require('../../i18n/translator');

class ReportController {
  /**
   * Create a new report (User action)
   */
  static async createReport(req, res) {
    try {
      const accountId = getAccountId(req);
      if (!accountId) {
        return sendUnauthorized(res);
      }
      const locale = getLocaleFromReq(req);

      const { contentType, contentId, reason, description } = req.body;
      console.log('📣 CreateReport request body:', { accountId, contentType, contentId, reason });

      // Validate input
      if (!contentType || !contentId || !reason) {
        return sendValidationError(res, t('common.invalid', locale));
      }

      const validContentTypes = ['post', 'story', 'comment', 'facility'];
      if (!validContentTypes.includes(contentType)) {
        return sendValidationError(res, t('common.invalid', locale));
      }

      // Try DB path (duplicate check + create) for supported content types (post/story/comment/facility).
      // For facility reports we now attempt to store in DB as well; if DB insert fails we'll fall back to file-backed reports.
      let report = null;
      try {
        const isDuplicate = await ReportDAL.checkDuplicateReport(accountId, contentType, contentId);
        if (isDuplicate) {
          return sendError(res, t('report.duplicate', locale), 400);
        }

        // Attempt to create report in DB for all content types (including 'facility').
        report = await ReportDAL.createReport({
          ReporterID: accountId,
          ReportedContentType: contentType,
          ReportedContentID: contentId,
          ReportReason: reason,
          ReportDescription: description || null
        });
      } catch (dbErr) {
        // If contentType is 'facility' we require DB persistence and do NOT fall back to logs.
        if (String(contentType).toLowerCase() === 'facility') {
          console.error('❌ DB error creating facility report; rejecting request (no fallback to logs):', dbErr && dbErr.message ? dbErr.message : dbErr);
          return sendError(res, t('report.createError', locale), 500, { error: dbErr });
        }

        // For non-facility content types, keep old behavior: write fallback to file so UX still works when DB is down
        try {
          console.error('⚠️ DB error during report create — using fallback file:', dbErr && dbErr.message ? dbErr.message : dbErr);
          const logsDir = path.resolve(__dirname, '..', '..', 'logs');
          if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

          const fallback = {
            ReportID: `fallback_${Date.now()}`,
            ReporterID: accountId,
            ReportedContentType: contentType,
            ReportedContentID: String(contentId),
            ReportReason: reason,
            ReportDescription: description || null,
            Status: 'pending',
            CreatedAt: new Date().toISOString(),
            UpdatedAt: new Date().toISOString()
          };

          const fallbackFile = path.join(logsDir, 'reports-fallback.jsonl');
          fs.appendFileSync(fallbackFile, JSON.stringify(fallback) + '\n');

          // Create an in-memory ReportModel instance to keep downstream code consistent
          report = new ReportModel(fallback);
        } catch (fallbackErr) {
          console.error('❌ Failed to write report fallback file:', fallbackErr);
          // If fallback also fails, rethrow original DB error to be handled by outer catch
          throw dbErr;
        }
      }

      // Send notification to all admins
      try {
        const UserDAL = require('../../DAL/Auth/userDAL');
        const admins = await UserDAL.getUsersByRole('admin');
        
        for (const admin of admins) {
          await createNotification({
            recipientId: admin.AccountID,
            senderId: accountId,
            type: 'report',
            contentId: report.ReportID,
            content: `Báo cáo mới về ${contentType}: ${reason}`
          });
        }

        // Emit realtime event for admins
        const realtimeEmitter = require('../../lib/realtimeEmitter');
        realtimeEmitter.emitEvent('report:created', null, {
          report: report.toFrontendFormat(),
          contentType,
          contentId
        });
      } catch (notifErr) {
        console.error('❌ Error sending report notifications:', notifErr);
      }

        return sendCreated(res, report.toFrontendFormat(), t('report.success', locale));
    } catch (error) {
      console.error('❌ Error creating report:', error);
      return sendError(res, t('report.createError', getLocaleFromReq(req)), 500, { error });
    }
  }

  /**
   * Get all reports (Admin only)
   */
  static async getAllReports(req, res) {
    try {
      // Debug: log auth info to diagnose 401 when user believes they are admin
      try {
        console.debug('[ReportController:getAllReports] headers:', {
          authorization: req && req.headers ? req.headers.authorization : undefined,
          xActiveRole: req && req.headers ? req.headers['x-active-role'] : undefined
        });
        console.debug('[ReportController:getAllReports] req.user:', req && req.user ? req.user : null);
      } catch (e) { /* ignore */ }

      const accountId = getAccountId(req);
      if (!accountId) {
        return sendUnauthorized(res);
      }
      const locale = getLocaleFromReq(req);


      const { status, contentType } = req.query;
      const filters = {};
      if (status) filters.status = status;
      if (contentType) filters.contentType = contentType;

      const reports = await ReportDAL.getAllReports(filters);

      // Fetch content details for each report (defensive per-item handling)
      const reportsWithContent = await Promise.all(
        reports.map(async (item) => {
          try {
            if (!item || !item.report || typeof item.report.toFrontendFormat !== 'function') {
              console.warn('[ReportController:getAllReports] Skipping malformed report item:', item);
              return null;
            }

            let content = null;
            try {
              content = await ReportDAL.getReportedContent(
                item.report.ReportedContentType,
                item.report.ReportedContentID
              );
            } catch (contentErr) {
              console.error('[ReportController:getAllReports] Error fetching reported content for report', item.report.ReportID, contentErr && contentErr.message ? contentErr.message : contentErr);
              content = null;
            }

            return {
              ...item.report.toFrontendFormat(),
              reporter: item.reporter || null,
              reviewer: item.reviewer || null,
              reportedContent: content
            };
          } catch (mapErr) {
            console.error('[ReportController:getAllReports] Error mapping report item:', mapErr);
            return null;
          }
        })
      );

      // Filter out any null/failed items
      const filtered = reportsWithContent.filter(r => r !== null);

      return sendSuccess(res, filtered);
    } catch (error) {
      console.error('❌ Error getting all reports:', error);
      return sendError(res, t('report.loadError', locale), 500, { error });
    }
  }

  /**
   * Get report by ID with full details (Admin only)
   */
  static async getReportById(req, res) {
    try {
      try {
        console.debug('[ReportController:getReportById] headers:', {
          authorization: req && req.headers ? req.headers.authorization : undefined,
          xActiveRole: req && req.headers ? req.headers['x-active-role'] : undefined
        });
        console.debug('[ReportController:getReportById] req.user:', req && req.user ? req.user : null);
      } catch (e) { /* ignore */ }

      const accountId = getAccountId(req);
      if (!accountId) {
        return sendUnauthorized(res);
      }
      const locale = getLocaleFromReq(req);


      const { reportId } = req.params;
      const reportData = await ReportDAL.getReportById(parseInt(reportId));

      if (!reportData) {
        return sendNotFound(res, t('report.notFound', locale));
      }

      // Get content details
      // Get content details (defensive)
      let content = null;
      try {
        content = await ReportDAL.getReportedContent(
          reportData.report.ReportedContentType,
          reportData.report.ReportedContentID
        );
      } catch (contentErr) {
        console.error('[ReportController:getReportById] Error fetching reported content for report', reportId, contentErr && contentErr.message ? contentErr.message : contentErr);
        content = null;
      }

      return sendSuccess(res, {
        ...reportData.report.toFrontendFormat(),
        reporter: reportData.reporter || null,
        reviewer: reportData.reviewer || null,
        reportedContent: content
      });
    } catch (error) {
      console.error('❌ Error getting report by ID:', error);
      return sendError(res, t('report.loadError', locale), 500, { error });
    }
  }

  /**
   * Update report status and take action (Admin only)
   */
  static async updateReport(req, res) {
    try {
      try {
        console.debug('[ReportController:updateReport] headers:', {
          authorization: req && req.headers ? req.headers.authorization : undefined,
          xActiveRole: req && req.headers ? req.headers['x-active-role'] : undefined
        });
        console.debug('[ReportController:updateReport] req.user:', req && req.user ? req.user : null);
      } catch (e) { /* ignore */ }

      const accountId = getAccountId(req);
      if (!accountId) {
        return sendUnauthorized(res);
      }
      const locale = getLocaleFromReq(req);

      // Check if user is admin. Prefer `req.user` (populated by auth middleware),
      // fall back to role-model DB check if needed.
      let isAdmin = !!(req.user && req.user.isAdmin);
      if (!isAdmin) {
        try {
          const AccountRoleModel = require('../../models/Auth/AccountRole');
          isAdmin = await AccountRoleModel.hasRoleByName(accountId, 'Admin');
        } catch (roleErr) {
          // ignore DB role check errors and keep isAdmin as false
        }
      }

      try {
        if (!isAdmin && process.env.ALLOW_HEADER_ADMIN_BYPASS === 'true') {
          const headerRole = (req.headers && (req.headers['x-active-role'] || req.headers['X-Active-Role'])) || null;
          if (String(headerRole).toLowerCase() === 'admin') {
            console.warn('[ReportController] ALLOW_HEADER_ADMIN_BYPASS in effect - granting admin for request based on header');
            isAdmin = true;
          }
        }
      } catch (bypassErr) { /* ignore */ }

      if (!isAdmin) {
        return sendUnauthorized(res, t('common.unauthorized', locale));
      }

      const { reportId } = req.params;
      const { status, adminNote, deleteContent } = req.body;

      // Validate status
      const validStatuses = ['pending', 'reviewed', 'resolved', 'dismissed'];
      if (status && !validStatuses.includes(status)) {
        return sendValidationError(res, t('common.invalid', locale));
      }

      // Get report. Support numeric DB IDs and fallback IDs (fallback_<ts>) saved to file when DB is down.
      let reportData = null;
      if (typeof reportId === 'string' && reportId.startsWith('fallback_')) {
        // Try to load and update fallback file entry
        try {
          const logsDir = path.resolve(__dirname, '..', '..', 'logs');
          const fallbackFile = path.join(logsDir, 'reports-fallback.jsonl');
          if (fs.existsSync(fallbackFile)) {
            const lines = fs.readFileSync(fallbackFile, 'utf8').split('\n').filter(Boolean);
            let found = null;
            const updatedLines = lines.map((ln) => {
              try {
                const obj = JSON.parse(ln);
                if (obj.ReportID === reportId) {
                  found = obj;
                  // apply status/adminNote/updatedAt
                  obj.Status = status || obj.Status || 'resolved';
                  if (adminNote !== undefined && adminNote !== null) obj.AdminNote = adminNote;
                  obj.UpdatedAt = new Date().toISOString();
                  // mark reviewedBy for trace
                  obj.ReviewedBy = accountId;
                  return JSON.stringify(obj);
                }
                return ln;
              } catch (e) {
                return ln;
              }
            });

            if (!found) {
              return sendNotFound(res, t('report.fallbackNotFound', locale));
            }

            // Write back updated lines
            try {
              fs.writeFileSync(fallbackFile, updatedLines.join('\n') + '\n', 'utf8');
            } catch (werr) {
              console.error('[ReportController:updateReport] Failed to write fallback file:', werr);
            }

            // Build a minimal reportData shape similar to DB path
            const ReportModel = require('../../models/Report/reportModel');
            const reportModelInstance = new ReportModel(found);
            reportData = {
              report: reportModelInstance,
              reporter: null,
              reviewer: { name: req.user && req.user.FullName ? req.user.FullName : null }
            };
            } else {
            return sendNotFound(res, t('report.fallbackFileMissing', locale));
          }
        } catch (fbErr) {
          console.error('[ReportController:updateReport] Error handling fallback report update:', fbErr);
          return sendError(res, t('report.updateError', locale), 500, { error: fbErr });
        }
      } else {
        reportData = await ReportDAL.getReportById(parseInt(reportId));
        if (!reportData) {
          return sendNotFound(res, t('report.notFound', locale));
        }
      }

      // Delete content if requested (support both DB-backed reports and fallback reports)
      if (deleteContent) {
        try {
          const contentType = reportData.report.ReportedContentType || reportData.report.reportedContentType || reportData.report.contentType || reportData.report.ReportedContentType;
          const contentId = reportData.report.ReportedContentID || reportData.report.reportedContentId || reportData.report.ReportedContentID || reportData.report.ReportedContentID;

          switch ((contentType || '').toLowerCase()) {
            case 'post':
              try {
                const PostDAL = require('../../DAL/Social/PostDAL');
                await PostDAL.deleteById(contentId);
              } catch (e) {
                console.warn('[ReportController:updateReport] PostDAL.deleteById failed (may be DB down):', e && e.message ? e.message : e);
              }
              break;
            case 'story':
              try {
                const StoryDAL = require('../../DAL/Social/StoryDAL');
                await StoryDAL.deleteById(contentId);
              } catch (e) {
                console.warn('[ReportController:updateReport] StoryDAL.deleteById failed:', e && e.message ? e.message : e);
              }
              break;
            case 'comment':
              try {
                const CommentDAL = require('../../DAL/Social/CommentDAL');
                await CommentDAL.deleteById(contentId);
              } catch (e) {
                console.warn('[ReportController:updateReport] CommentDAL.deleteById failed:', e && e.message ? e.message : e);
              }
              break;
          }

          console.log(`✅ Deleted ${contentType} ID: ${contentId}`);
        } catch (deleteErr) {
          console.error('❌ Error deleting content:', deleteErr);
          return sendError(res, t('report.updateError', locale), 500, { error: deleteErr });
        }
      }

      // Update report status for DB-backed reports. For fallback reports we've already written the file above.
      let updatedReport = null;
      if (typeof reportId === 'string' && reportId.startsWith('fallback_')) {
        // reportData.report is a ReportModel instance created from the fallback object
        updatedReport = reportData.report;
      } else {
        updatedReport = await ReportDAL.updateReportStatus(
          parseInt(reportId),
          status || 'resolved',
          accountId,
          adminNote
        );
      }

      // Notify reporter about the decision
      try {
        await createNotification({
          recipientId: reportData.report.ReporterID,
          senderId: accountId,
          type: 'report_update',
          contentId: reportData.report.ReportID,
          content: `Báo cáo của bạn đã được xử lý: ${deleteContent ? 'Nội dung đã bị xóa' : 'Nội dung được giữ lại'}`
        });
      } catch (notifErr) {
        console.error('❌ Error sending update notification:', notifErr);
      }

      return sendSuccess(res, updatedReport && typeof updatedReport.toFrontendFormat === 'function' ? updatedReport.toFrontendFormat() : (updatedReport || {}), t('report.processed', locale));
    } catch (error) {
      console.error('❌ Error updating report:', error);
      return sendError(res, t('report.updateError', getLocaleFromReq(req)), 500, { error });
    }
  }

  /**
   * Get report statistics (Admin only)
   */
  static async getReportStats(req, res) {
    try {
      try {
        console.debug('[ReportController:getReportStats] headers:', {
          authorization: req && req.headers ? req.headers.authorization : undefined,
          xActiveRole: req && req.headers ? req.headers['x-active-role'] : undefined
        });
        console.debug('[ReportController:getReportStats] req.user:', req && req.user ? req.user : null);
      } catch (e) { /* ignore */ }

      const accountId = getAccountId(req);
      if (!accountId) {
        return sendUnauthorized(res);
      }
      const locale = getLocaleFromReq(req);


      const stats = await ReportDAL.getReportStats();
      return sendSuccess(res, stats);
    } catch (error) {
      console.error('❌ Error getting report stats:', error);
      return sendError(res, t('report.statsError', locale), 500, { error });
    }
  }
}

module.exports = {
  createReport: ReportController.createReport,
  getAllReports: ReportController.getAllReports,
  getReportById: ReportController.getReportById,
  updateReport: ReportController.updateReport,
  getReportStats: ReportController.getReportStats
};
