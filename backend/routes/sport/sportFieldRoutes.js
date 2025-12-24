/**
 * SportField Routes
 */
const express = require('express');
const router = express.Router();
const sportFieldController = require('../../controllers/Sport/sportFieldController');
const { uploadFieldMedia } = require('../../middleware/uploadField');
const { authenticateToken, requireRole } = require('../../middleware/auth');

// Public routes
router.get('/', sportFieldController.getAllSportFields);
router.get('/search', sportFieldController.searchSportFields);
// More specific routes first to avoid being shadowed by param routes
router.get('/facility/:facilityId', sportFieldController.getSportFieldsByFacility);
router.get('/:fieldId/availability', sportFieldController.getFieldAvailability);
router.get('/:fieldId', sportFieldController.getSportFieldById);

// Protected routes
router.use(authenticateToken);

// Facility owner routes
router.post('/facility/:facilityId', requireRole(['Court Owner', 'Admin']), sportFieldController.createSportField);
router.put('/:fieldId', requireRole(['Court Owner', 'Admin']), sportFieldController.updateSportField);
router.delete('/:fieldId', requireRole(['Court Owner', 'Admin']), sportFieldController.deleteSportField);
router.post('/:fieldId/images', requireRole(['Court Owner', 'Admin']), uploadFieldMedia, sportFieldController.addSportFieldImage);
router.delete('/:fieldId/images/:imageId', requireRole(['Court Owner', 'Admin']), sportFieldController.deleteSportFieldImage);

module.exports = router;
