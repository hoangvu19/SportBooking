const express = require('express');
const router = express.Router();
const {
  getAllFacilities,
  getFacilityById,
  createFacility,
  updateFacility,
  deleteFacility,
  getFacilityAvailability
} = require('../controllers/Sport/facilityController');
const { authenticateToken } = require('../middleware/auth');

// Get all facilities
router.get('/', getAllFacilities);

// Get single facility
router.get('/:facilityId', getFacilityById);

// Get facility availability
router.get('/:facilityId/availability', getFacilityAvailability);

// Create new facility (admin only)
router.post('/', authenticateToken, createFacility);

// Update facility (admin only)  
router.put('/:facilityId', authenticateToken, updateFacility);

// Delete facility (admin only)
router.delete('/:facilityId', authenticateToken, deleteFacility);

module.exports = router;