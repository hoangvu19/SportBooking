/**
 * Booking Routes
 * Routes for court booking operations
 */
const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/Sport/bookingController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Protected routes (require authentication)
router.use(authenticateToken);

// Customer routes
router.post('/', bookingController.createBooking);
router.get('/my-bookings', bookingController.getMyBookings);
router.get('/:bookingId', bookingController.getBookingById);
router.put('/:bookingId/cancel', bookingController.cancelBooking);

// Facility owner routes
router.get('/facility/bookings', requireRole(['Court Owner', 'Admin']), bookingController.getFacilityBookings);
router.put('/:bookingId/confirm', requireRole(['Court Owner', 'Admin']), bookingController.confirmBooking);
router.get('/revenue/stats', requireRole(['Court Owner', 'Admin']), bookingController.getRevenueStats);

// Field availability (public within authenticated users)
router.get('/fields/:fieldId/availability', bookingController.getFieldAvailability);

module.exports = router;