/**
 * Role Model - Handles user roles
 */
const RoleDAL = require('../DAL/RoleDAL');

class RoleModel {
  static async createRole(roleData) {
    return RoleDAL.createRole(roleData);
  }

  static async getAllRoles() {
    return RoleDAL.getAllRoles();
  }

  static async getRoleById(roleId) {
    return RoleDAL.getRoleById(roleId);
  }

  static async getRoleByName(roleName) {
    return RoleDAL.getRoleByName(roleName);
  }

  static async updateRole(roleId, updateData) {
    return RoleDAL.updateRole(roleId, updateData);
  }

  static async deleteRole(roleId) {
    return RoleDAL.deleteRole(roleId);
  }

  static async roleExists(roleName) {
    return RoleDAL.roleExists(roleName);
  }

  static async getRolesWithUserCount() {
    return RoleDAL.getRolesWithUserCount();
  }
}

module.exports = RoleModel;