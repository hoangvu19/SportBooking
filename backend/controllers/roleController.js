/**
 * Role Controller - Xử lý các thao tác với roles và permissions
 */
const RoleModel = require('../models/Role');
const AccountRoleModel = require('../models/AccountRole');

class RoleController {
  /**
   * Tạo role mới (Admin only)
   */
  static async createRole(req, res) {
    try {
      const { roleName, description } = req.body;

      if (!roleName) {
        return res.status(400).json({
          success: false,
          message: 'RoleName là bắt buộc'
        });
      }

      // Kiểm tra role đã tồn tại chưa
      const exists = await RoleModel.roleExists(roleName);
      if (exists) {
        return res.status(400).json({
          success: false,
          message: 'Role đã tồn tại'
        });
      }

      const result = await RoleModel.createRole({ roleName, description });
      res.status(201).json(result);
    } catch (error) {
      console.error('Lỗi tạo role:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi tạo role'
      });
    }
  }

  /**
   * Lấy tất cả roles
   */
  static async getAllRoles(req, res) {
    try {
      const roles = await RoleModel.getAllRoles();
      
      res.json({
        success: true,
        data: roles
      });
    } catch (error) {
      console.error('Lỗi lấy roles:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lấy danh sách roles'
      });
    }
  }

  /**
   * Lấy roles với số lượng user
   */
  static async getRolesWithUserCount(req, res) {
    try {
      const roles = await RoleModel.getRolesWithUserCount();
      
      res.json({
        success: true,
        data: roles
      });
    } catch (error) {
      console.error('Lỗi lấy roles with count:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lấy roles với user count'
      });
    }
  }

  /**
   * Lấy role theo ID
   */
  static async getRoleById(req, res) {
    try {
      const { roleId } = req.params;
      const role = await RoleModel.getRoleById(roleId);
      
      if (!role) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy role'
        });
      }
      
      res.json({
        success: true,
        data: role
      });
    } catch (error) {
      console.error('Lỗi lấy role:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lấy role'
      });
    }
  }

  /**
   * Cập nhật role (Admin only)
   */
  static async updateRole(req, res) {
    try {
      const { roleId } = req.params;
      const { roleName, description } = req.body;

      if (!roleName) {
        return res.status(400).json({
          success: false,
          message: 'RoleName là bắt buộc'
        });
      }

      const updatedRole = await RoleModel.updateRole(roleId, {
        roleName,
        description
      });

      if (!updatedRole) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy role để cập nhật'
        });
      }

      res.json({
        success: true,
        data: updatedRole
      });
    } catch (error) {
      console.error('Lỗi cập nhật role:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi cập nhật role'
      });
    }
  }

  /**
   * Xóa role (Admin only)
   */
  static async deleteRole(req, res) {
    try {
      const { roleId } = req.params;
      
      const success = await RoleModel.deleteRole(roleId);
      
      if (success) {
        res.json({
          success: true,
          message: 'Đã xóa role thành công'
        });
      } else {
        res.status(404).json({
          success: false,
          message: 'Không tìm thấy role để xóa'
        });
      }
    } catch (error) {
      console.error('Lỗi xóa role:', error);
      if (error.message.includes('Cannot delete role')) {
        res.status(400).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Lỗi server khi xóa role'
        });
      }
    }
  }

  /**
   * Gán role cho user (Admin only)
   */
  static async assignRole(req, res) {
    try {
      const { accountId, roleId } = req.body;

      if (!accountId || !roleId) {
        return res.status(400).json({
          success: false,
          message: 'AccountID và RoleID là bắt buộc'
        });
      }

      const result = await AccountRoleModel.assignRole(accountId, roleId);
      
      if (result.success) {
        res.status(201).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Lỗi gán role:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi gán role'
      });
    }
  }

  /**
   * Gỡ role khỏi user (Admin only)
   */
  static async removeRole(req, res) {
    try {
      const { accountId, roleId } = req.body;

      if (!accountId || !roleId) {
        return res.status(400).json({
          success: false,
          message: 'AccountID và RoleID là bắt buộc'
        });
      }

      const success = await AccountRoleModel.removeRole(accountId, roleId);
      
      if (success) {
        res.json({
          success: true,
          message: 'Đã gỡ role thành công'
        });
      } else {
        res.status(404).json({
          success: false,
          message: 'Không tìm thấy role assignment để gỡ'
        });
      }
    } catch (error) {
      console.error('Lỗi gỡ role:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi gỡ role'
      });
    }
  }

  /**
   * Lấy roles của một user
   */
  static async getUserRoles(req, res) {
    try {
      const { accountId } = req.params;
      const roles = await AccountRoleModel.getAccountRoles(accountId);
      
      res.json({
        success: true,
        data: roles
      });
    } catch (error) {
      console.error('Lỗi lấy user roles:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lấy roles của user'
      });
    }
  }

  /**
   * Lấy users có role cụ thể
   */
  static async getUsersByRole(req, res) {
    try {
      const { roleId } = req.params;
      const users = await AccountRoleModel.getAccountsByRole(roleId);
      
      res.json({
        success: true,
        data: users
      });
    } catch (error) {
      console.error('Lỗi lấy users by role:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lấy users theo role'
      });
    }
  }
}

module.exports = RoleController;