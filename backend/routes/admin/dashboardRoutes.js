const express = require('express');
const router = express.Router();
const DashboardController = require('../../controllers/Admin/dashboardController');
const { authenticateToken, requireRole } = require('../../middleware/auth');

// All admin routes require authentication and admin/owner role
router.use(authenticateToken);
router.use(requireRole(['Admin', 'Court Owner']));

/**
 * GET /api/admin/dashboard/stats
 * Get all dashboard statistics
 */
router.get('/stats', DashboardController.getDashboardStats);

/**
 * GET /api/admin/dashboard/revenue-by-month
 * Get revenue by month for last 12 months
 */
router.get('/revenue-by-month', DashboardController.getRevenueByMonth);

/**
 * GET /api/admin/dashboard/sport-trends
 * Get sport type booking trends
 */
router.get('/sport-trends', DashboardController.getSportTrends);

/**
 * GET /api/admin/dashboard/occupancy-by-time
 * Get occupancy rate by time slots
 */
router.get('/occupancy-by-time', DashboardController.getOccupancyByTime);

/**
 * GET /api/admin/dashboard/user-growth
 * Get user growth by month (new users & total users)
 */
router.get('/user-growth', DashboardController.getUserGrowth);

/**
 * GET /api/admin/dashboard/activity-trends
 * Get post/comment activity by day (last 30 days)
 */
router.get('/activity-trends', DashboardController.getActivityTrends);

module.exports = router;
