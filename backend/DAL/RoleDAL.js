const { poolPromise } = require('../config/db');
const sql = require('mssql');

class RoleDAL {
  static async createRole(roleData) {
    const pool = await poolPromise;
    try {
      const { roleName, description } = roleData;
      const result = await pool.request()
        .input('RoleName', sql.VarChar, roleName)
        .input('Description', sql.NVarChar, description || null)
        .query(`
          INSERT INTO Role (RoleName, Description, CreatedDate)
          OUTPUT INSERTED.*
          VALUES (@RoleName, @Description, GETDATE())
        `);

      return { success: true, data: result.recordset[0] };
    } catch (error) {
      throw error;
    }
  }

  static async getAllRoles() {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT * FROM Role ORDER BY RoleName');
    return result.recordset;
  }

  static async getRoleById(roleId) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('RoleID', sql.Int, roleId)
      .query('SELECT * FROM Role WHERE RoleID = @RoleID');

    return result.recordset[0] || null;
  }

  static async getRoleByName(roleName) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('RoleName', sql.VarChar, roleName)
      .query('SELECT * FROM Role WHERE RoleName = @RoleName');

    return result.recordset[0] || null;
  }

  static async updateRole(roleId, updateData) {
    const pool = await poolPromise;
    const { roleName, description } = updateData;
    const result = await pool.request()
      .input('RoleID', sql.Int, roleId)
      .input('RoleName', sql.VarChar, roleName)
      .input('Description', sql.NVarChar, description)
      .query(`
        UPDATE Role 
        SET RoleName = @RoleName, 
            Description = @Description,
            UpdatedDate = GETDATE()
        OUTPUT INSERTED.*
        WHERE RoleID = @RoleID
      `);

    return result.recordset[0] || null;
  }

  static async deleteRole(roleId) {
    const pool = await poolPromise;
    const assignmentCheck = await pool.request()
      .input('RoleID', sql.Int, roleId)
      .query('SELECT COUNT(*) as Count FROM AccountRole WHERE RoleID = @RoleID');

    if (assignmentCheck.recordset[0].Count > 0) {
      throw new Error('Cannot delete role that is assigned to accounts');
    }

    const result = await pool.request()
      .input('RoleID', sql.Int, roleId)
      .query('DELETE FROM Role WHERE RoleID = @RoleID');

    return result.rowsAffected[0] > 0;
  }

  static async roleExists(roleName) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('RoleName', sql.VarChar, roleName)
      .query('SELECT RoleID FROM Role WHERE RoleName = @RoleName');

    return result.recordset.length > 0;
  }

  static async getRolesWithUserCount() {
    const pool = await poolPromise;
    const result = await pool.request()
      .query(`
        SELECT r.*, ISNULL(ar.UserCount, 0) as UserCount
        FROM Role r
        LEFT JOIN (
          SELECT RoleID, COUNT(*) as UserCount
          FROM AccountRole
          GROUP BY RoleID
        ) ar ON r.RoleID = ar.RoleID
        ORDER BY r.RoleName
      `);

    return result.recordset;
  }
}

module.exports = RoleDAL;
