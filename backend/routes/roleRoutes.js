/**
 * Role Routes - API endpoints cho quản lý roles và permissions
 */
const express = require('express');
const router = express.Router();
const RoleController = require('../controllers/Auth/roleController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

// GET /api/roles - Lấy tất cả roles (public cho dropdown/select)
router.get('/', RoleController.getAllRoles);

// GET /api/roles/with-count - Lấy roles với số lượng user (admin only)
router.get('/with-count', authenticateToken, requireAdmin, RoleController.getRolesWithUserCount);

// GET /api/roles/:roleId - Lấy role theo ID
router.get('/:roleId', authenticateToken, RoleController.getRoleById);

// POST /api/roles - Tạo role mới (admin only)
router.post('/', authenticateToken, requireAdmin, validate(schemas.createRole), RoleController.createRole);

// PUT /api/roles/:roleId - Cập nhật role (admin only)
router.put('/:roleId', authenticateToken, requireAdmin, RoleController.updateRole);

// DELETE /api/roles/:roleId - Xóa role (admin only)
router.delete('/:roleId', authenticateToken, requireAdmin, RoleController.deleteRole);

// POST /api/roles/assign - Gán role cho user (admin only)
router.post('/assign', authenticateToken, requireAdmin, RoleController.assignRole);

// POST /api/roles/remove - Gỡ role khỏi user (admin only)
router.post('/remove', authenticateToken, requireAdmin, RoleController.removeRole);

// GET /api/roles/user/:accountId - Lấy roles của một user
router.get('/user/:accountId', authenticateToken, RoleController.getUserRoles);

// GET /api/roles/:roleId/users - Lấy users có role cụ thể (admin only)
router.get('/:roleId/users', authenticateToken, requireAdmin, RoleController.getUsersByRole);

module.exports = router;