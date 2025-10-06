const { poolPromise } = require('../config/db');
const sql = require('mssql');

class AccountRoleDAL {
  static async assignRole(accountId, roleId) {
    const pool = await poolPromise;
    try {
      const existing = await pool.request()
        .input('AccountID', sql.Int, accountId)
        .input('RoleID', sql.Int, roleId)
        .query('SELECT * FROM AccountRole WHERE AccountID = @AccountID AND RoleID = @RoleID');

      if (existing.recordset.length > 0) {
        return { alreadyExists: true };
      }

      const result = await pool.request()
        .input('AccountID', sql.Int, accountId)
        .input('RoleID', sql.Int, roleId)
        .query(`
          INSERT INTO AccountRole (AccountID, RoleID, AssignedDate)
          OUTPUT INSERTED.*
          VALUES (@AccountID, @RoleID, GETDATE())
        `);

      return { inserted: result.recordset[0] };
    } catch (error) {
      throw error;
    }
  }

  static async removeRole(accountId, roleId) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('AccountID', sql.Int, accountId)
      .input('RoleID', sql.Int, roleId)
      .query('DELETE FROM AccountRole WHERE AccountID = @AccountID AND RoleID = @RoleID');

    return result.rowsAffected[0] > 0;
  }

  static async getAccountRoles(accountId) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('AccountID', sql.Int, accountId)
      .query(`
        SELECT ar.*, r.RoleName, r.Description
        FROM AccountRole ar
        INNER JOIN Role r ON ar.RoleID = r.RoleID
        WHERE ar.AccountID = @AccountID
        ORDER BY ar.AssignedDate DESC
      `);

    return result.recordset;
  }

  static async getAccountsByRole(roleId) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('RoleID', sql.Int, roleId)
      .query(`
        SELECT ar.*, a.Username, a.FullName, a.Email, a.Avatar
        FROM AccountRole ar
        INNER JOIN Account a ON ar.AccountID = a.AccountID
        WHERE ar.RoleID = @RoleID
        ORDER BY ar.AssignedDate DESC
      `);

    return result.recordset;
  }

  static async hasRole(accountId, roleId) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('AccountID', sql.Int, accountId)
      .input('RoleID', sql.Int, roleId)
      .query('SELECT AccountRoleID FROM AccountRole WHERE AccountID = @AccountID AND RoleID = @RoleID');

    return result.recordset.length > 0;
  }

  static async hasRoleByName(accountId, roleName) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('AccountID', sql.Int, accountId)
      .input('RoleName', sql.VarChar, roleName)
      .query(`
        SELECT ar.AccountRoleID
        FROM AccountRole ar
        INNER JOIN Role r ON ar.RoleID = r.RoleID
        WHERE ar.ACCOUNTID = @AccountID AND r.RoleName = @RoleName
      `);

    return result.recordset.length > 0;
  }

  static async removeAllRoles(accountId) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('AccountID', sql.Int, accountId)
      .query('DELETE FROM AccountRole WHERE AccountID = @AccountID');

    return result.rowsAffected[0];
  }

  static async getAllAssignments() {
    const pool = await poolPromise;
    const result = await pool.request()
      .query(`
        SELECT ar.*, a.Username, a.FullName, r.RoleName, r.Description
        FROM AccountRole ar
        INNER JOIN Account a ON ar.AccountID = a.AccountID
        INNER JOIN Role r ON ar.RoleID = r.RoleID
        ORDER BY ar.AssignedDate DESC
      `);

    return result.recordset;
  }

  static async getAssignmentById(accountRoleId) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('AccountRoleID', sql.Int, accountRoleId)
      .query(`
        SELECT ar.*, a.Username, a.FullName, r.RoleName, r.Description
        FROM AccountRole ar
        INNER JOIN Account a ON ar.AccountID = a.AccountID
        INNER JOIN Role r ON ar.RoleID = r.RoleID
        WHERE ar.AccountRoleID = @AccountRoleID
      `);

    return result.recordset[0] || null;
  }
}

module.exports = AccountRoleDAL;
