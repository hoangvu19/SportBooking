const express = require('express');
const router = express.Router();
const { listAccounts, updateAccount, deleteAccount, listAreas } = require('../../controllers/Auth/accountAdminController');
const { authenticateToken } = require('../../middleware/auth');
// GET /admin/accounts/areas - List all areas for address selection
router.get('/areas', authenticateToken, listAreas);

// GET /admin/accounts/list - List all accounts
router.get('/list', authenticateToken, listAccounts);

// PUT /admin/accounts/:id - Update account info
router.put('/:id', authenticateToken, updateAccount);

// DELETE /admin/accounts/:id - Soft delete account
router.delete('/:id', authenticateToken, deleteAccount);

module.exports = router;
