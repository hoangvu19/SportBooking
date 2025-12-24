const express = require('express');
const router = express.Router();
const ReportController = require('../../controllers/Report/reportController');
const { authenticateToken } = require('../../middleware/auth');

// Create a new report (User)
router.post('/', authenticateToken, ReportController.createReport);

// Get all reports (Admin only)
router.get('/', authenticateToken, ReportController.getAllReports);

// Get report statistics (Admin only)
router.get('/stats', authenticateToken, ReportController.getReportStats);

// Get report by ID (Admin only)
router.get('/:reportId', authenticateToken, ReportController.getReportById);

// Update report status and take action (Admin only)
router.patch('/:reportId', authenticateToken, ReportController.updateReport);

module.exports = router;
