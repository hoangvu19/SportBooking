const express = require('express');
const router = express.Router();
const LivestreamController = require('../controllers/Livestream/livestreamController');
const { authenticateToken } = require('../middleware/auth');
const LivestreamCommentRoutes = require('./livestreamCommentRoutes');

// Public list
// active only
router.get('/active', LivestreamController.listActive);
// Get by id
router.get('/:id', LivestreamController.getById);
// Auth required to create/end
router.post('/', authenticateToken, LivestreamController.createLivestream);
router.put('/:id/end', authenticateToken, LivestreamController.endLivestream);

// Comments for a livestream
router.use('/:id/comments', LivestreamCommentRoutes);

module.exports = router;
