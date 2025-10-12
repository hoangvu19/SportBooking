/**
 * SportType Routes
 * Routes for sport type management
 */
const express = require('express');
const router = express.Router();
const sportTypeController = require('../controllers/sportTypeController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Public routes
router.get('/', sportTypeController.getAllSportTypes);
router.get('/:sportTypeId', sportTypeController.getSportTypeById);

// Admin only routes
router.post('/', authenticateToken, requireRole(['Admin']), sportTypeController.createSportType);
router.put('/:sportTypeId', authenticateToken, requireRole(['Admin']), sportTypeController.updateSportType);
router.delete('/:sportTypeId', authenticateToken, requireRole(['Admin']), sportTypeController.deleteSportType);

module.exports = router;