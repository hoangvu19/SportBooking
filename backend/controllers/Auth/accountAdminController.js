const AccountDAL = require('../../DAL/Auth/accountDAL');
const AccountRoleDAL = require('../../DAL/Auth/AccountRoleDAL');
const RoleDAL = require('../../DAL/Auth/RoleDAL');
const AreaDAL = require('../../DAL/Auth/AreaDAL');
const { sendSuccess, sendError, sendValidationError, sendNotFound } = require('../../utils/responseHelper');

// GET /admin/areas - List all areas for address selection
const listAreas = async (req, res) => {
  try {
    const areas = await AreaDAL.getAllAreas();
    return sendSuccess(res, areas, 'Danh sách khu vực');
  } catch (error) {
    return sendError(res, 'Lỗi server khi lấy danh sách khu vực', 500, { error });
  }
};

// GET /admin/accounts/list - List all accounts
const listAccounts = async (req, res) => {
  try {
    const accounts = await AccountDAL.getAll();
    return sendSuccess(res, accounts.map(acc => acc.toFrontendFormat()), 'Danh sách tài khoản');
  } catch (error) {
    return sendError(res, 'Lỗi server khi lấy danh sách tài khoản', 500, { error });
  }
};

// PUT /admin/accounts/:id - Update account info
const updateAccount = async (req, res) => {
  try {
    const accountId = req.params.id;
    const updatePayload = req.body;
    
    console.log('=== UPDATE ACCOUNT DEBUG ===');
    console.log('Account ID:', accountId);
    console.log('Update Payload:', JSON.stringify(updatePayload, null, 2));
    
    // Update basic account info
    const updated = await AccountDAL.update(accountId, updatePayload);
    console.log('Updated basic info successfully');
    
    // Update roles if provided
    if (updatePayload.roles && Array.isArray(updatePayload.roles)) {
      // Get current roles
      const currentRoles = await AccountRoleDAL.getAccountRoles(accountId);
      const currentRoleNames = currentRoles.map(r => r.RoleName);
      
      // Get all roles from database
      const allRoles = await RoleDAL.getAllRoles();
      const newRoleNames = updatePayload.roles.filter(r => r); // Filter out empty strings
      
      // Find roles to add and remove
      const rolesToAdd = newRoleNames.filter(name => !currentRoleNames.includes(name));
      const rolesToRemove = currentRoleNames.filter(name => !newRoleNames.includes(name));
      
      // Add new roles
      for (const roleName of rolesToAdd) {
        const role = allRoles.find(r => r.RoleName === roleName);
        if (role) {
          await AccountRoleDAL.assignRole(accountId, role.RoleID);
        }
      }
      
      // Remove old roles
      for (const roleName of rolesToRemove) {
        const role = allRoles.find(r => r.RoleName === roleName);
        if (role) {
          await AccountRoleDAL.removeRole(accountId, role.RoleID);
        }
      }
    }
    
    // Fetch updated account with roles
    const finalAccount = await AccountDAL.getById(accountId);
    return sendSuccess(res, finalAccount.toFrontendFormat(), 'Cập nhật tài khoản thành công');
  } catch (error) {
    console.error('Error updating account:', error);
    return sendError(res, 'Lỗi server khi cập nhật tài khoản', 500, { error });
  }
};

// DELETE /admin/accounts/:id - Soft delete account
const deleteAccount = async (req, res) => {
  try {
    const accountId = req.params.id;
    await AccountDAL.delete(accountId);
    return sendSuccess(res, null, 'Xóa tài khoản thành công');
  } catch (error) {
    return sendError(res, 'Lỗi server khi xóa tài khoản', 500, { error });
  }
};

module.exports = { listAccounts, updateAccount, deleteAccount, listAreas };