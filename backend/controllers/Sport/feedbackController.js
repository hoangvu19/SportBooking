const FeedbackDAL = require('../../DAL/Sport/FeedbackDAL');

async function createFeedback(req, res) {
  try {
    const { targetType, targetId, content } = req.body;
    const accountId = req.user && req.user.AccountID;

    if (!targetType || !targetId) {
      return res.status(400).json({ success: false, message: 'Missing targetType or targetId' });
    }

    const result = await FeedbackDAL.createFeedback({
      accountId,
      targetType,
      targetId: parseInt(targetId),
      content: content ? content.trim() : null
    });

    if (result.success) {
      // Emit realtime event so other clients can update comments live
      try {
        const emitter = require('../../lib/realtimeEmitter');
        emitter.emitEvent('comment:created', null, {
          targetType,
          targetId: parseInt(targetId),
          comment: result.data
        });
      } catch (e) { /* ignore realtime errors */ }

      return res.status(201).json({ success: true, data: result.data });
    }

    return res.status(400).json({ success: false, message: 'Unable to submit feedback' });
  } catch (error) {
    console.error('createFeedback error', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
}

async function getFeedbackByTarget(req, res) {
  try {
    const { targetType, targetId } = req.params;
    const page = parseInt(req.query.page || '1');
    const limit = parseInt(req.query.limit || '20');

    const result = await FeedbackDAL.getByTarget(targetType, parseInt(targetId), page, limit);
    if (result.success) {
      return res.json({ success: true, data: result.data, pagination: result.pagination });
    }
    return res.status(500).json({ success: false, message: 'Unable to fetch feedback' });
  } catch (error) {
    console.error('getFeedbackByTarget error', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
}

async function getMyFeedback(req, res) {
  try {
    const accountId = req.user && req.user.AccountID;
    const page = parseInt(req.query.page || '1');
    const limit = parseInt(req.query.limit || '20');

    const result = await FeedbackDAL.getMyFeedbacks(accountId, page, limit);
    if (result.success) return res.json({ success: true, data: result.data, pagination: result.pagination });
    return res.status(500).json({ success: false, message: 'Unable to fetch your feedbacks' });
  } catch (error) {
    console.error('getMyFeedback error', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
}

async function updateFeedback(req, res) {
  try {
    const { feedbackId } = req.params;
    const { content } = req.body;
    const accountId = req.user && req.user.AccountID;

    if (!content) {
      return res.status(400).json({ success: false, message: 'Nothing to update' });
    }

    const result = await FeedbackDAL.updateFeedback(parseInt(feedbackId), accountId, content ? content.trim() : null);
    if (result.success) return res.json({ success: true, data: result.data });
    return res.status(400).json({ success: false, message: result.message || 'Unable to update feedback' });
  } catch (error) {
    console.error('updateFeedback error', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
}

async function deleteFeedback(req, res) {
  try {
    const { feedbackId } = req.params;
    const accountId = req.user && req.user.AccountID;
    const isAdmin = req.user && req.user.isAdmin;

    const result = await FeedbackDAL.deleteFeedback(parseInt(feedbackId), accountId, !!isAdmin);
    if (result.success) return res.json({ success: true });
    return res.status(400).json({ success: false, message: result.message || 'Unable to delete feedback' });
  } catch (error) {
    console.error('deleteFeedback error', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
}

async function getRatingStatistics(req, res) {
  // Keep existing rating endpoints in /api/ratings; expose legacy stats route if needed
  return res.status(410).json({ success: false, message: 'Use /api/ratings/stats for rating statistics' });
}

async function getTopRated(req, res) {
  return res.status(410).json({ success: false, message: 'Deprecated' });
}

async function getFeedbackById(req, res) {
  return res.status(410).json({ success: false, message: 'Deprecated' });
}

module.exports = {
  createFeedback,
  getFeedbackByTarget,
  getMyFeedback,
  updateFeedback,
  deleteFeedback,
  getRatingStatistics,
  getTopRated,
  getFeedbackById
};
