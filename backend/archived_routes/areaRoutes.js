/**
 * Area Routes
 * Routes for area management (Da Nang, Ho Chi Minh City, Hanoi)
 */
const express = require('express');
const router = express.Router();
const areaController = require('../controllers/Sport/areaController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Public routes
router.get('/', areaController.getAllAreas);
router.get('/:areaId', areaController.getAreaById);

// Admin only routes
router.post('/', authenticateToken, requireRole(['Admin']), areaController.createArea);
router.put('/:areaId', authenticateToken, requireRole(['Admin']), areaController.updateArea);
router.delete('/:areaId', authenticateToken, requireRole(['Admin']), areaController.deleteArea);

module.exports = router;