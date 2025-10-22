const express = require('express');
const router = express.Router();
const debugController = require('../../controllers/debugController');

// GET /api/debug/resolve-shared/:postId
router.get('/resolve-shared/:postId', debugController.resolveShared);

module.exports = router;
