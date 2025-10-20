/**
 * SportField Routes
 */
const express = require('express');
const router = express.Router();
const sportFieldController = require('../../controllers/Sport/sportFieldController');
const { authenticateToken, requireRole } = require('../../middleware/auth');

// Public routes
router.get('/', sportFieldController.getAllSportFields);
router.get('/search', sportFieldController.searchSportFields);
router.get('/:fieldId', sportFieldController.getSportFieldById);
router.get('/:fieldId/availability', sportFieldController.getFieldAvailability);
router.get('/facility/:facilityId', sportFieldController.getSportFieldsByFacility);

// Protected routes
router.use(authenticateToken);

// Facility owner routes
router.post('/facility/:facilityId', requireRole(['Court Owner', 'Admin']), sportFieldController.createSportField);
router.put('/:fieldId', requireRole(['Court Owner', 'Admin']), sportFieldController.updateSportField);
router.delete('/:fieldId', requireRole(['Court Owner', 'Admin']), sportFieldController.deleteSportField);
router.post('/:fieldId/images', requireRole(['Court Owner', 'Admin']), sportFieldController.addSportFieldImage);

module.exports = router;
