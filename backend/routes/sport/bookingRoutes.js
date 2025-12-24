const express = require('express');
const router = express.Router();
const bookingController = require('../../controllers/Sport/bookingController');
const ownerDashboardController = require('../../controllers/Sport/ownerDashboardController');
const { authenticateToken, requireRole } = require('../../middleware/auth');

// Protected routes (require authentication)
router.use(authenticateToken);

// Customer routes
router.post('/', bookingController.createBooking);
router.get('/my-bookings', bookingController.getMyBookings);
// Field availability (public within authenticated users)
router.get('/fields/:fieldId/availability', bookingController.getFieldAvailability);

// Facility owner routes - place fixed owner routes before the generic bookingId param
router.get('/facility/bookings', requireRole(['Court Owner', 'Admin']), bookingController.getFacilityBookings);
router.get('/revenue/stats', requireRole(['Court Owner', 'Admin']), bookingController.getRevenueStats);

// Owner dashboard statistics routes
router.get('/dashboard/summary', requireRole(['Court Owner', 'Admin']), ownerDashboardController.getDashboardSummary);
router.get('/dashboard/monthly-revenue', requireRole(['Court Owner', 'Admin']), ownerDashboardController.getMonthlyRevenue);
router.get('/dashboard/revenue-by-field', requireRole(['Court Owner', 'Admin']), ownerDashboardController.getRevenueByField);
router.get('/dashboard/booking-trends', requireRole(['Court Owner', 'Admin']), ownerDashboardController.getBookingTrendsByDay);
router.get('/dashboard/peak-hours', requireRole(['Court Owner', 'Admin']), ownerDashboardController.getPeakHours);
router.get('/dashboard/field-utilization', requireRole(['Court Owner', 'Admin']), ownerDashboardController.getFieldUtilization);
router.get('/dashboard/booking-status', requireRole(['Court Owner', 'Admin']), ownerDashboardController.getBookingStatusDistribution);
router.get('/dashboard/top-customers', requireRole(['Court Owner', 'Admin']), ownerDashboardController.getTopCustomers);

router.put('/:bookingId/confirm', requireRole(['Court Owner', 'Admin']), bookingController.confirmBooking);

// Booking-specific routes (param routes last so 'facility' or 'fields' won't be mistaken for an id)
router.get('/:bookingId', bookingController.getBookingById);
router.put('/:bookingId/cancel', bookingController.cancelBooking);

module.exports = router;
