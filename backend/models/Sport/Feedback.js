/**
 * Feedback Model
 * Handles all database operations for feedback (reviews and ratings)
 */
// Thin wrapper model delegating DB work to DAL
const FeedbackDAL = require('../../DAL/Sport/FeedbackDAL');

class FeedbackModel {
  static async createFeedback(feedbackData) { return FeedbackDAL.createFeedback(feedbackData); }
  static async getFeedbackById(feedbackId) { return FeedbackDAL.getFeedbackById(feedbackId); }
  static async getFeedbackByTarget(targetType, targetId, page = 1, limit = 10) { return FeedbackDAL.getFeedbackByTarget(targetType, targetId, page, limit); }
  static async getFeedbackByUser(accountId, page = 1, limit = 20) { return FeedbackDAL.getFeedbackByUser(accountId, page, limit); }
  static async updateFeedback(feedbackId, feedbackData, userId) { return FeedbackDAL.updateFeedback(feedbackId, feedbackData, userId); }
  static async deleteFeedback(feedbackId, userId, isAdmin = false) { return FeedbackDAL.deleteFeedback(feedbackId, userId, isAdmin); }
  static async getRatingStatistics(targetType, targetId) { return FeedbackDAL.getRatingStatistics(targetType, targetId); }
  static async getTopRated(targetType, areaId = null, limit = 10) { return FeedbackDAL.getTopRated(targetType, areaId, limit); }
}

module.exports = FeedbackModel;