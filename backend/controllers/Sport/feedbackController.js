// Feedback Controller (Legacy - deprecated)
// Use ratingController and fieldCommentController instead
// Kept for backward compatibility

async function createFeedback(req, res) {
  res.status(410).json({
    success: false,
    message: 'API deprecated. Use /api/ratings and /api/field-comments'
  });
}

async function getFeedbackByTarget(req, res) {
  res.status(410).json({
    success: false,
    message: 'API deprecated. Use /api/ratings/stats and /api/field-comments'
  });
}

async function getMyFeedback(req, res) {
  res.status(410).json({
    success: false,
    message: 'API deprecated. Use /api/ratings and /api/field-comments'
  });
}

async function updateFeedback(req, res) {
  res.status(410).json({
    success: false,
    message: 'API deprecated. Use /api/ratings and /api/field-comments'
  });
}

async function deleteFeedback(req, res) {
  res.status(410).json({
    success: false,
    message: 'API deprecated. Use /api/ratings and /api/field-comments'
  });
}

async function getRatingStatistics(req, res) {
  res.status(410).json({
    success: false,
    message: 'API deprecated. Use /api/ratings/stats'
  });
}

async function getTopRated(req, res) {
  res.status(410).json({
    success: false,
    message: 'API deprecated'
  });
}

async function getFeedbackById(req, res) {
  res.status(410).json({
    success: false,
    message: 'API deprecated'
  });
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
