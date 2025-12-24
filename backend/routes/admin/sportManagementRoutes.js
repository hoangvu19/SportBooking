const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../../middleware/auth');
const sportManagementController = require('../../controllers/Admin/sportManagementController');

// All sport management routes require authentication and admin role
router.use(authenticateToken);
router.use(requireRole(['Admin']));

// Facilities routes
router.get('/facilities', sportManagementController.getAllFacilities);
router.get('/facilities/:id', sportManagementController.getFacilityById);
router.post('/facilities', sportManagementController.createFacility);
router.put('/facilities/:id', sportManagementController.updateFacility);
router.delete('/facilities/:id', sportManagementController.deleteFacility);

// Sport fields routes
router.get('/fields', sportManagementController.getAllSportFields);
router.get('/fields/:id', sportManagementController.getSportFieldById);
router.post('/fields', sportManagementController.createSportField);
router.put('/fields/:id', sportManagementController.updateSportField);
router.delete('/fields/:id', sportManagementController.deleteSportField);

// Schedule and availability
router.get('/fields/schedule', sportManagementController.getFieldSchedule);

// Reference data (areas, sport types, etc.)
router.get('/reference-data', sportManagementController.getReferenceData);

// Create booking (admin creates for customer)
router.post('/bookings', sportManagementController.createBooking);

module.exports = router;
