/**
 * AccountRole Model - Handles account role assignments
 */
const AccountRoleDAL = require('../../DAL/Auth/AccountRoleDAL');

class AccountRoleModel {
  static async assignRole(accountId, roleId) {
    const res = await AccountRoleDAL.assignRole(accountId, roleId);
    if (res.alreadyExists) return { success: false, message: 'Role already assigned to this account' };
    return { success: true, data: res.inserted };
  }

  static async removeRole(accountId, roleId) {
    return AccountRoleDAL.removeRole(accountId, roleId);
  }

  static async getAccountRoles(accountId) {
    return AccountRoleDAL.getAccountRoles(accountId);
  }

  static async getAccountsByRole(roleId) {
    return AccountRoleDAL.getAccountsByRole(roleId);
  }

  static async hasRole(accountId, roleId) {
    return AccountRoleDAL.hasRole(accountId, roleId);
  }

  static async hasRoleByName(accountId, roleName) {
    return AccountRoleDAL.hasRoleByName(accountId, roleName);
  }

  static async removeAllRoles(accountId) {
    return AccountRoleDAL.removeAllRoles(accountId);
  }

  static async getAllAssignments() {
    return AccountRoleDAL.getAllAssignments();
  }

  static async getAssignmentById(accountRoleId) {
    return AccountRoleDAL.getAssignmentById(accountRoleId);
  }
}

module.exports = AccountRoleModel;