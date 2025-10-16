/**
 * Enhanced Facility Routes
 * Routes for facility management with new models integration
 */
const express = require('express');
const router = express.Router();
const facilityController = require('../controllers/Sport/facilityControllerNew');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Public routes
router.get('/', facilityController.getAllFacilities);
router.get('/search', facilityController.searchFacilities);
router.get('/popular', facilityController.getPopularFacilities);
router.get('/area/:areaId', facilityController.getFacilitiesByArea);
router.get('/:facilityId', facilityController.getFacilityById);

// Protected routes (require authentication)
router.use(authenticateToken);

// Court owner routes
router.get('/my/facilities', requireRole(['Court Owner', 'Admin']), facilityController.getMyFacilities);
router.post('/', requireRole(['Court Owner', 'Admin']), facilityController.createFacility);
router.put('/:facilityId', requireRole(['Court Owner', 'Admin']), facilityController.updateFacility);
router.delete('/:facilityId', requireRole(['Court Owner', 'Admin']), facilityController.deleteFacility);
router.get('/:facilityId/statistics', requireRole(['Court Owner', 'Admin']), facilityController.getFacilityStatistics);
router.post('/:facilityId/images', requireRole(['Court Owner', 'Admin']), facilityController.addFacilityImage);

module.exports = router;