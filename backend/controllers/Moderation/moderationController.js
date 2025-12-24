const { getAccountId } = require('../../utils/requestUtils');
const { sendSuccess, sendError, sendUnauthorized } = require('../../utils/responseHelper');
const { createNotification } = require('../Notification/notificationController');

// Admin-only: send a warning notification to a user
const warnUser = async (req, res) => {
  try {
    const adminId = getAccountId(req);
    if (!adminId) return sendUnauthorized(res);

    // Determine admin rights (prefer req.user populated by auth middleware)
    let isAdmin = !!(req.user && req.user.isAdmin);
    if (!isAdmin) {
      try {
        const AccountRoleModel = require('../../models/Auth/AccountRole');
        isAdmin = await AccountRoleModel.hasRoleByName(adminId, 'Admin');
      } catch (e) {
        isAdmin = false;
      }
    }

    if (!isAdmin) {
      try {
        if (process.env.ALLOW_HEADER_ADMIN_BYPASS === 'true') {
          const headerRole = (req.headers && (req.headers['x-active-role'] || req.headers['X-Active-Role'])) || null;
          if (String(headerRole || '').toLowerCase() === 'admin') isAdmin = true;
        }
      } catch (e) { /* ignore */ }
    }

    if (!isAdmin) return sendUnauthorized(res);

    const { userId, note } = req.body || {};
    if (!userId) return sendError(res, 'Missing userId', 400);

    const content = note || 'You have received a warning from moderators';

    await createNotification({ recipientId: userId, senderId: adminId, type: 'warning', contentId: null, content });

    return sendSuccess(res, { success: true, message: 'Warning sent' });
  } catch (error) {
    console.error('Warn user error:', error);
    return sendError(res, 'Failed to send warning', 500, { error });
  }
};

module.exports = { warnUser };
