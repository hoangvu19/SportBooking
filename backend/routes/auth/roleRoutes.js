/**
 * Role Routes - API endpoints for roles and permissions
 */
const express = require('express');
const router = express.Router();
const RoleController = require('../../controllers/Auth/roleController');
const { authenticateToken, requireAdmin } = require('../../middleware/auth');
const { validate, schemas } = require('../../middleware/validation');

// GET /api/roles - Get all roles
router.get('/', RoleController.getAllRoles);

// GET /api/roles/with-count - Get roles with user count (admin only)
router.get('/with-count', authenticateToken, requireAdmin, RoleController.getRolesWithUserCount);

// GET /api/roles/:roleId - Get role by ID
router.get('/:roleId', authenticateToken, RoleController.getRoleById);

// POST /api/roles - Create role (admin only)
router.post('/', authenticateToken, requireAdmin, validate(schemas.createRole), RoleController.createRole);

// PUT /api/roles/:roleId - Update role
router.put('/:roleId', authenticateToken, requireAdmin, RoleController.updateRole);

// DELETE /api/roles/:roleId - Delete role
router.delete('/:roleId', authenticateToken, requireAdmin, RoleController.deleteRole);

// POST /api/roles/assign - Assign role to user (admin only)
router.post('/assign', authenticateToken, requireAdmin, RoleController.assignRole);

// POST /api/roles/remove - Remove role from user (admin only)
router.post('/remove', authenticateToken, requireAdmin, RoleController.removeRole);

// GET /api/roles/user/:accountId - Get roles of a user
router.get('/user/:accountId', authenticateToken, RoleController.getUserRoles);

// GET /api/roles/:roleId/users - Get users with a role (admin only)
router.get('/:roleId/users', authenticateToken, requireAdmin, RoleController.getUsersByRole);

module.exports = router;
