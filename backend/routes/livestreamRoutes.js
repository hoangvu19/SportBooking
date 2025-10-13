const express = require('express');
const router = express.Router();
const LivestreamController = require('../controllers/livestreamController');
const { authenticateToken } = require('../middleware/auth');

// Public list
router.get('/active', LivestreamController.listActive);
// Get by id
router.get('/:id', LivestreamController.getById);
// Auth required to create/end
router.post('/', authenticateToken, LivestreamController.createLivestream);
router.put('/:id/end', authenticateToken, LivestreamController.endLivestream);

module.exports = router;
