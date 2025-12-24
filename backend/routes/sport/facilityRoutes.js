const express = require('express');
const router = express.Router();
const {
  getAllFacilities,
  getFacilityById,
  createFacility,
  updateFacility,
  deleteFacility,
  searchFacilities,
  getMyFacilities,
  addFacilityImage,
  // getFacilityAvailability is not implemented in controller; provide placeholder here
} = require('../../controllers/Sport/facilityController');
const { authenticateToken, requireRole } = require('../../middleware/auth');
const { uploadFacilityMedia } = require('../../middleware/uploadFacility');

// If facility-level availability logic isn't implemented yet, return a 501 placeholder
async function getFacilityAvailability(req, res) {
  // Optionally: aggregate availability across sportFields in the facility
  res.status(501).json({ success: false, message: 'Facility-level availability not implemented' });
}

// Get all facilities
// Search facilities (by query params: sportTypeId, areaId, searchTerm, etc.)
router.get('/search', searchFacilities);
router.get('/', getAllFacilities);

// Get single facility
// Get facility availability
router.get('/:facilityId/availability', getFacilityAvailability);

// Get facilities belonging to the authenticated owner
router.get('/mine', authenticateToken, requireRole(['Court Owner', 'Admin']), getMyFacilities);

// Get single facility
router.get('/:facilityId', getFacilityById);

// Create new facility (owner/admin only)
router.post('/', authenticateToken, requireRole(['Court Owner', 'Admin']), createFacility);

// Upload images for an existing facility (owner/admin only)
router.post('/:facilityId/images', authenticateToken, requireRole(['Court Owner', 'Admin']), uploadFacilityMedia, addFacilityImage);

// Delete an image attached to a facility
const { deleteFacilityImage } = require('../../controllers/Sport/facilityController');
router.delete('/:facilityId/images/:imageId', authenticateToken, requireRole(['Court Owner', 'Admin']), deleteFacilityImage);

// Update facility (owner/admin only)
router.put('/:facilityId', authenticateToken, requireRole(['Court Owner', 'Admin']), updateFacility);

// Delete facility (owner/admin only)
router.delete('/:facilityId', authenticateToken, requireRole(['Court Owner', 'Admin']), deleteFacility);


module.exports = router;
