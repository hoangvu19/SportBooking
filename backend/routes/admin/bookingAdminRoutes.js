const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../../middleware/auth');
const bookingAdminController = require('../../controllers/Admin/bookingAdminController');

// All admin booking routes require authentication and admin/owner role
router.use(authenticateToken);
router.use(requireRole(['Admin', 'Court Owner']));

// GET /api/admin/bookings/list
router.get('/list', bookingAdminController.getAdminBookingList);
// PUT /api/admin/bookings/:bookingId/status
router.put('/:bookingId/status', bookingAdminController.updateBookingStatus);

module.exports = router;
