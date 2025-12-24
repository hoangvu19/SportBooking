const { poolPromise, sql } = require('../../config/db');
const { getIo } = require('../../lib/realtimeEmitter');
const AccountDAL = require('../../DAL/Auth/accountDAL');
const fs = require('fs');

// Lấy danh sách thông báo của user
const getNotifications = async (req, res) => {
  try {
    const accountId = req.user.AccountID;
    const { limit = 20, offset = 0, onlyAdminSystem } = req.query;

    const pool = await poolPromise;

    // Build query with optional filter: only admin/system notifications
    let baseQuery = `
        SELECT
          n.NotificationID,
          n.Type,
          n.ContentID,
          n.Content,
          n.IsRead,
          n.CreatedDate,
          sender.AccountID as SenderAccountID,
          sender.FullName as SenderName,
          sender.AvatarUrl as SenderAvatar
        FROM Notification n
        LEFT JOIN Account sender ON n.SenderAccountID = sender.AccountID
        WHERE n.RecipientAccountID = @accountId
    `;

    // If onlyAdminSystem is truthy ('1' or 'true'), limit to admin/system messages
    const wantOnlyAdminSystem = (typeof onlyAdminSystem !== 'undefined') && (String(onlyAdminSystem) === '1' || String(onlyAdminSystem).toLowerCase() === 'true');
    if (wantOnlyAdminSystem) {
      baseQuery += ` AND (n.Type = 'admin_broadcast' OR n.Type = 'system') `;
    }

    baseQuery += ` ORDER BY n.CreatedDate DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY `;

    const result = await pool.request()
      .input('accountId', sql.Int, accountId)
      .input('limit', sql.Int, parseInt(limit))
      .input('offset', sql.Int, parseInt(offset))
      .query(baseQuery);

    res.json({ success: true, data: result.recordset });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ success: false, message: req.t('notification.fetch_error') });
  }
};

// Đếm số thông báo chưa đọc
const getUnreadCount = async (req, res) => {
  try {
    const accountId = req.user.AccountID;
    const { onlyAdminSystem } = req.query;
    const pool = await poolPromise;

    let countQuery = `SELECT COUNT(*) as UnreadCount FROM Notification WHERE RecipientAccountID = @accountId AND IsRead = 0`;
    const wantOnlyAdminSystem = (typeof onlyAdminSystem !== 'undefined') && (String(onlyAdminSystem) === '1' || String(onlyAdminSystem).toLowerCase() === 'true');
    if (wantOnlyAdminSystem) {
      countQuery += ` AND (Type = 'admin_broadcast' OR Type = 'system')`;
    }

    const result = await pool.request()
      .input('accountId', sql.Int, accountId)
      .query(countQuery);

    res.json({
      success: true,
      count: result.recordset[0].UnreadCount
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ success: false, message: req.t('notification.unread_count_error') });
  }
};

// Đánh dấu thông báo đã đọc
const markAsRead = async (req, res) => {
  try {
    const accountId = req.user.AccountID;
    const { notificationId } = req.params;

    const pool = await poolPromise;
    await pool.request()
      .input('notificationId', sql.Int, notificationId)
      .input('accountId', sql.Int, accountId)
      .query(`
        UPDATE Notification
        SET IsRead = 1
        WHERE NotificationID = @notificationId AND RecipientAccountID = @accountId
      `);

    // Emit realtime update
    const io = getIo();
    io.to(`user:${accountId}`).emit('notification_read', { notificationId });

    res.json({ success: true, message: req.t('notification.mark_read_success') });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ success: false, message: req.t('notification.mark_read_error') });
  }
};

// Đánh dấu tất cả đã đọc
const markAllAsRead = async (req, res) => {
  try {
    const accountId = req.user.AccountID;

    const pool = await poolPromise;
    await pool.request()
      .input('accountId', sql.Int, accountId)
      .query(`
        UPDATE Notification
        SET IsRead = 1
        WHERE RecipientAccountID = @accountId AND IsRead = 0
      `);

    // Emit realtime update
    const io = getIo();
    io.to(`user:${accountId}`).emit('notifications_all_read');

    res.json({ success: true, message: req.t('notification.mark_all_read_success') });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ success: false, message: req.t('notification.mark_all_read_error') });
  }
};

// Tạo thông báo mới (helper function)
const createNotification = async ({ recipientId, senderId, type, contentId, content }) => {
  try {
    // Không gửi thông báo cho chính mình
    if (recipientId === senderId) {
      console.log('⏭️ Skipping self-notification');
      return;
    }

    console.log('📬 Creating notification:', { recipientId, senderId, type, contentId });

    // Audit log for debugging notification creation (development only)
    try {
      const logsDir = require('path').resolve(__dirname, '..', '..', 'logs');
      if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
      const audit = { ts: new Date().toISOString(), recipientId, senderId, type, contentId, content };
      fs.appendFileSync(require('path').join(logsDir, 'notification-audit.jsonl'), JSON.stringify(audit) + '\n');
    } catch (auditErr) {
      console.debug('Could not write notification audit log', auditErr);
    }

    const pool = await poolPromise;
    // contentId must be numeric for SQL INT column; coerce or pass NULL for non-numeric/fallback ids
    const coercedContentId = (contentId === null || typeof contentId === 'undefined') ? null : (Number.isFinite(Number(contentId)) ? Number(contentId) : null);
    let notification;
    // validate sender exists; if not, use NULL (system notification)
    let actualSenderId = null;
    try {
      if (typeof senderId !== 'undefined' && senderId !== null) {
        const check = await pool.request().input('checkSenderId', sql.Int, senderId).query('SELECT AccountID FROM Account WHERE AccountID = @checkSenderId');
        if (check && check.recordset && check.recordset.length > 0) actualSenderId = senderId;
      }
    } catch (chkErr) {
      actualSenderId = null;
    }

    try {
      const result = await pool.request()
        .input('recipientId', sql.Int, recipientId)
        .input('senderId', sql.Int, actualSenderId)
        .input('type', sql.NVarChar, type)
        .input('contentId', sql.Int, coercedContentId)
        .input('content', sql.NVarChar, content)
        .query(`
          INSERT INTO Notification (RecipientAccountID, SenderAccountID, Type, ContentID, Content, IsRead, CreatedDate)
          OUTPUT INSERTED.*
          VALUES (@recipientId, @senderId, @type, @contentId, @content, 0, GETDATE())
        `);

      notification = result.recordset[0];
      console.log('✅ Notification created:', notification.NotificationID);
    } catch (dbErr) {
      try {
        const errLog = { ts: new Date().toISOString(), error: (dbErr && dbErr.message) ? dbErr.message : String(dbErr), stack: dbErr && dbErr.stack ? dbErr.stack : null, recipientId, senderId, type, coercedContentId, content };
        const logsDir = require('path').resolve(__dirname, '..', '..', 'logs');
        if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
        fs.appendFileSync(require('path').join(logsDir, 'notification-errors.jsonl'), JSON.stringify(errLog) + '\n');
      } catch (logErr) {
        console.debug('Could not write notification error log', logErr);
      }
      console.error('❌ Create notification DB error:', dbErr);
      throw dbErr;
    }

    // Lấy thông tin sender
    const senderInfo = await pool.request()
      .input('senderId', sql.Int, actualSenderId)
      .query('SELECT AccountID, FullName, AvatarUrl FROM Account WHERE AccountID = @senderId');

    const notificationData = {
      ...notification,
      Sender: senderInfo.recordset[0]
    };

    // Emit realtime notification
    const io = getIo();
    const room = `user:${recipientId}`;
    console.log('🔔 Emitting to room:', room, 'IO available:', !!io);
    
    if (io) {
      io.to(room).emit('new_notification', notificationData);
      console.log('✅ Notification emitted to room:', room);
    } else {
      console.error('❌ IO not available!');
    }

    return notification;
  } catch (error) {
    console.error('❌ Create notification error:', error);
    throw error;
  }
};

// Admin: get notifications sent by the admin (sent items)
const getSentNotifications = async (req, res) => {
  try {
    const accountId = req.user.AccountID; // admin account
    const { limit = 50, offset = 0 } = req.query;

    const pool = await poolPromise;
    // Group sent notifications by Type + Content so admin sees one entry per broadcast.
    // Only include admin/system-originated notifications (and other server-sent events)
    // — exclude user-generated social actions like likes/comments/follows.
    const result = await pool.request()
      .input('senderId', sql.Int, accountId)
      .input('limit', sql.Int, parseInt(limit))
      .input('offset', sql.Int, parseInt(offset))
      .query(`
        SELECT
          MIN(n.NotificationID) as ExampleNotificationID,
          n.Type,
          n.Content,
          COUNT(*) as RecipientCount,
          MAX(n.CreatedDate) as CreatedDate
        FROM Notification n
        WHERE (
          (
            n.SenderAccountID = @senderId
            AND (
              n.Type IN ('admin_broadcast','system','report_processed','payment_error','new_facility','moderation_action','booking_alert')
              OR n.Type LIKE 'admin_%' OR n.Type LIKE '%_admin%' OR n.Type LIKE '%system%'
            )
          )
          OR n.SenderAccountID IS NULL -- system-sent notifications
          OR n.Type IN ('admin_broadcast','system','report','report_update','report_processed','payment_error','new_facility','moderation_action','booking_alert')
          OR n.Type LIKE 'admin_%' OR n.Type LIKE '%_admin%' OR n.Type LIKE '%system%'
          OR n.Type LIKE '%booking%' OR n.Type LIKE '%complaint%' OR n.Type LIKE '%claim%'
        )
        GROUP BY n.Type, n.Content
        ORDER BY MAX(n.CreatedDate) DESC
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
      `);

    res.json({ success: true, data: result.recordset });
  } catch (error) {
    console.error('Get sent notifications error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy thông báo đã gửi' });
  }
};

// Admin: delete a group of sent notifications (all recipients for the same content+type)
const deleteSentNotificationGroup = async (req, res) => {
  try {
    const senderId = req.user.AccountID;
    const { type, content } = req.body || {};

    if (!content) {
      return res.status(400).json({ success: false, message: 'Content is required to delete group' });
    }

    const pool = await poolPromise;

    // Find affected notifications so we can emit deletes to recipients
    const affected = await pool.request()
      .input('senderId', sql.Int, senderId)
      .input('type', sql.NVarChar, type)
      .input('content', sql.NVarChar, content)
      .query(`SELECT NotificationID, RecipientAccountID FROM Notification WHERE SenderAccountID = @senderId AND Type = @type AND Content = @content`);

    // Delete all matching notifications
    await pool.request()
      .input('senderId', sql.Int, senderId)
      .input('type', sql.NVarChar, type)
      .input('content', sql.NVarChar, content)
      .query(`DELETE FROM Notification WHERE SenderAccountID = @senderId AND Type = @type AND Content = @content`);

    // Emit notification_deleted for each recipient so clients can update UI
    try {
      const io = getIo();
      if (io && affected && affected.recordset) {
        for (const r of affected.recordset) {
          if (r.RecipientAccountID) {
            io.to(`user:${r.RecipientAccountID}`).emit('notification_deleted', { notificationId: r.NotificationID });
          }
        }
      }
    } catch (emitErr) {
      console.error('Error emitting notification_deleted for group delete', emitErr);
    }

    res.json({ success: true, deleted: affected && affected.recordset ? affected.recordset.length : 0 });
  } catch (error) {
    console.error('Delete sent notification group error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi xóa nhóm thông báo' });
  }
};

// Admin: delete a sent notification (by id) — admin may remove any notification
const deleteSentNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const pool = await poolPromise;
    await pool.request()
      .input('notificationId', sql.Int, notificationId)
      .query(`
        DELETE FROM Notification
        WHERE NotificationID = @notificationId
      `);

    // Optionally emit to recipient to update UI
    // Attempt to read recipient and emit socket event
    try {
      const recipientResult = await pool.request()
        .input('notificationId', sql.Int, notificationId)
        .query('SELECT RecipientAccountID FROM Notification WHERE NotificationID = @notificationId');
      const recipient = recipientResult && recipientResult.recordset && recipientResult.recordset[0] && recipientResult.recordset[0].RecipientAccountID;
      if (recipient) {
        const io = getIo();
        if (io) io.to(`user:${recipient}`).emit('notification_deleted', { notificationId });
      }
    } catch (emitErr) {
      // ignore emit errors
    }

    res.json({ success: true, message: 'Đã xóa thông báo' });
  } catch (error) {
    console.error('Delete sent notification error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi xóa thông báo' });
  }
};

// Admin: broadcast notification to all active users
const broadcastNotification = async (req, res) => {
  try {
    const senderId = req.user && req.user.AccountID ? req.user.AccountID : null;
    const { type = 'admin_broadcast', contentId = null, content = '' } = req.body || {};

    if (!content || String(content).trim() === '') {
      return res.status(400).json({ success: false, message: 'Content is required for broadcast' });
    }

    // Get all active accounts
    const accounts = await AccountDAL.getAll();
    if (!Array.isArray(accounts) || accounts.length === 0) {
      return res.json({ success: true, message: 'No recipients found', sent: 0 });
    }

    const failed = [];
    let sent = 0;

    // Sequentially create notifications to avoid overwhelming DB/socket
    for (const acc of accounts) {
      try {
        await createNotification({ recipientId: acc.AccountID, senderId, type, contentId, content });
        sent++;
      } catch (err) {
        console.error('Broadcast: failed for recipient', acc && acc.AccountID, err);
        failed.push({ recipientId: acc && acc.AccountID, error: err && (err.message || err) });
      }
    }

    res.json({ success: true, message: 'Broadcast completed', sent, failedCount: failed.length, failed });
  } catch (error) {
    console.error('Broadcast notification error:', error);
    res.status(500).json({ success: false, message: 'Error broadcasting notifications' });
  }
};

// Xóa thông báo
const deleteNotification = async (req, res) => {
  try {
    const accountId = req.user.AccountID;
    const { notificationId } = req.params;

    const pool = await poolPromise;
    await pool.request()
      .input('notificationId', sql.Int, notificationId)
      .input('accountId', sql.Int, accountId)
      .query(`
        DELETE FROM Notification
        WHERE NotificationID = @notificationId AND RecipientAccountID = @accountId
      `);

    res.json({ success: true, message: 'Đã xóa thông báo' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi xóa thông báo' });
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  createNotification,
  broadcastNotification
  ,
  getSentNotifications,
  deleteSentNotification,
  deleteSentNotificationGroup
};
