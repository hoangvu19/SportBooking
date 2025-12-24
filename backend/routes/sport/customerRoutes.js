/**
 * Customer Management Routes
 * Routes for owner to manage their customers
 */
const express = require('express');
const router = express.Router();
const CustomerController = require('../../controllers/Sport/customerController');
const { authenticateToken } = require('../../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

/**
 * @route GET /api/customers
 * @desc Get all customers who have booked at owner's facilities
 * @access Private (Owner)
 */
router.get('/', CustomerController.getCustomers);

/**
 * @route GET /api/customers/:customerId/bookings
 * @desc Get booking history of a specific customer
 * @access Private (Owner)
 */
router.get('/:customerId/bookings', CustomerController.getCustomerBookings);

/**
 * @route GET /api/customers/:customerId/stats
 * @desc Get statistics of a specific customer
 * @access Private (Owner)
 */
router.get('/:customerId/stats', CustomerController.getCustomerStats);

module.exports = router;
