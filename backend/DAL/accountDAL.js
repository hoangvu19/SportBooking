/**
 * Account Data Access Layer (DAL)
 * Handles all database operations for Account entity
 */
const { poolPromise } = require("../config/db");
const sql = require('mssql');
const Account = require("../models/Account");

class AccountDAL {
  /**
   * Get all accounts
   */
  static async getAll() {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .query("SELECT * FROM Account WHERE Status != 'Deleted' ORDER BY CreatedAt DESC");
      
      return result.recordset.map(row => new Account(row));
    } catch (error) {
      console.error('AccountDAL.getAll error:', error);
      throw error;
    }
  }

  /**
   * Get account by ID
   */
  static async getById(id) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input("AccountID", sql.Int, id)
        .query("SELECT * FROM Account WHERE AccountID = @AccountID AND Status != 'Deleted'");
      
      if (result.recordset.length === 0) {
        return null;
      }
      
      return new Account(result.recordset[0]);
    } catch (error) {
      console.error('AccountDAL.getById error:', error);
      throw error;
    }
  }

  /**
   * Get account by username
   */
  static async getByUsername(username) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input("Username", sql.VarChar, username)
        .query("SELECT * FROM Account WHERE Username = @Username AND Status != 'Deleted'");
      
      if (result.recordset.length === 0) {
        return null;
      }
      
      return new Account(result.recordset[0]);
    } catch (error) {
      console.error('AccountDAL.getByUsername error:', error);
      throw error;
    }
  }

  /**
   * Get account by email
   */
  static async getByEmail(email) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input("Email", sql.VarChar, email)
        .query("SELECT * FROM Account WHERE Email = @Email AND Status != 'Deleted'");
      
      if (result.recordset.length === 0) {
        return null;
      }
      
      return new Account(result.recordset[0]);
    } catch (error) {
      console.error('AccountDAL.getByEmail error:', error);
      throw error;
    }
  }


  /**
   * Get account by identifier (username, email, or phone)
   */
  static async getByIdentifier(identifier) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input("Identifier", sql.VarChar, identifier)
        .query(`
          SELECT * FROM Account 
          WHERE (Username = @Identifier OR Email = @Identifier) 
          AND Status != 'Deleted'
        `);
      
      if (result.recordset.length === 0) {
        return null;
      }
      
      return new Account(result.recordset[0]);
    } catch (error) {
      console.error('AccountDAL.getByIdentifier error:', error);
      throw error;
    }
  }

  /**
   * Create new account
   */
  static async create(accountData) {
    try {
      const pool = await poolPromise;
      const transaction = new sql.Transaction(pool);
      
      await transaction.begin();
      
  // Use independent Bio column if provided; keep Address separate
  const req = transaction.request()
    .input("Username", sql.VarChar, accountData.Username)
    .input("PasswordHash", sql.VarChar, accountData.PasswordHash)
    .input("FullName", sql.VarChar, accountData.FullName)
    .input("Email", sql.VarChar, accountData.Email)
    .input("Gender", sql.VarChar, accountData.Gender || null)
    .input("Address", sql.VarChar, accountData.Address || null)
    .input("Bio", sql.NVarChar(sql.MAX), accountData.Bio || null)
    .input("Status", sql.VarChar, accountData.Status || "Active")
    .input("AvatarUrl", sql.NVarChar(sql.MAX), accountData.AvatarUrl || null);

  const result = await req.query(`
      INSERT INTO Account (Username, PasswordHash, FullName, Email, Gender, Address, Bio, Status, AvatarUrl, CreatedAt, UpdatedAt)
      OUTPUT INSERTED.*
      VALUES (@Username, @PasswordHash, @FullName, @Email, @Gender, @Address, @Bio, @Status, @AvatarUrl, GETDATE(), GETDATE())
    `);
      
      await transaction.commit();
      
      return new Account(result.recordset[0]);
    } catch (error) {
      if (transaction) {
        await transaction.rollback();
      }
      console.error('AccountDAL.create error:', error);
      throw error;
    }
  }

  /**
   * Update account
   */
  static async update(id, accountData) {
    try {
      const pool = await poolPromise;
      const transaction = new sql.Transaction(pool);
      
      await transaction.begin();
      
      // Build dynamic query based on provided fields
      const fields = [];
      const request = transaction.request().input("AccountID", sql.Int, id);
      
      if (accountData.FullName !== undefined) {
        fields.push("FullName = @FullName");
  request.input("FullName", sql.NVarChar, accountData.FullName);
      }
      
      if (accountData.Email !== undefined) {
        fields.push("Email = @Email");
        request.input("Email", sql.VarChar, accountData.Email);
      }
      
      // If client provided Bio explicitly, update Bio column
      if (accountData.Bio !== undefined) {
        fields.push("Bio = @Bio");
        request.input("Bio", sql.NVarChar(sql.MAX), accountData.Bio);
      }
      
      if (accountData.Gender !== undefined) {
        fields.push("Gender = @Gender");
        request.input("Gender", sql.VarChar, accountData.Gender);
      }
      
      if (accountData.Address !== undefined) {
        fields.push("Address = @Address");
        request.input("Address", sql.VarChar, accountData.Address);
      }
      
      if (accountData.Status !== undefined) {
        fields.push("Status = @Status");
        request.input("Status", sql.VarChar, accountData.Status);
      }
      
      if (accountData.AvatarUrl !== undefined) {
        fields.push("AvatarUrl = @AvatarUrl");
        // Accept long base64/data URLs
        request.input("AvatarUrl", sql.NVarChar(sql.MAX), accountData.AvatarUrl);
      }
      
      if (fields.length === 0) {
        await transaction.rollback();
        throw new Error('No fields to update');
      }
      
      fields.push("UpdatedAt = GETDATE()");
      
      await request.query(`
        UPDATE Account SET ${fields.join(', ')}
        WHERE AccountID = @AccountID
      `);
      
      await transaction.commit();
      
      // Return updated account
      return await AccountDAL.getById(id);
    } catch (error) {
      if (transaction) {
        await transaction.rollback();
      }
      console.error('AccountDAL.update error:', error);
      throw error;
    }
  }

  /**
   * Set password
   */
  static async setPassword(id, passwordHash) {
    try {
      const pool = await poolPromise;
      await pool.request()
        .input("AccountID", sql.Int, id)
        .input("PasswordHash", sql.VarChar, passwordHash)
        .query("UPDATE Account SET PasswordHash = @PasswordHash, UpdatedAt = GETDATE() WHERE AccountID = @AccountID");
      
      return true;
    } catch (error) {
      console.error('AccountDAL.setPassword error:', error);
      throw error;
    }
  }

  /**
   * Delete account (soft delete)
   */
  static async delete(id) {
    try {
      const pool = await poolPromise;
      await pool.request()
        .input("AccountID", sql.Int, id)
        .query("UPDATE Account SET Status = 'Deleted', UpdatedAt = GETDATE() WHERE AccountID = @AccountID");
      
      return true;
    } catch (error) {
      console.error('AccountDAL.delete error:', error);
      throw error;
    }
  }

  /**
   * Search accounts
   */
  static async search(searchTerm, page = 1, limit = 20) {
    try {
      const pool = await poolPromise;
      const offset = (page - 1) * limit;
      
      const result = await pool.request()
        .input("SearchTerm", sql.VarChar, `%${searchTerm}%`)
        .input("Offset", sql.Int, offset)
        .input("Limit", sql.Int, limit)
        .query(`
          SELECT * FROM Account 
          WHERE (FullName LIKE @SearchTerm OR Username LIKE @SearchTerm OR Email LIKE @SearchTerm) 
          AND Status = 'Active'
          ORDER BY FullName, Username
          OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY
        `);
      
      return result.recordset.map(row => new Account(row));
    } catch (error) {
      console.error('AccountDAL.search error:', error);
      throw error;
    }
  }

  /**
   * Check if username exists
   */
  static async usernameExists(username, excludeId = null) {
    try {
      const pool = await poolPromise;
      const request = pool.request()
        .input("Username", sql.VarChar, username);
      
      let query = "SELECT COUNT(*) as count FROM Account WHERE Username = @Username AND Status != 'Deleted'";
      
      if (excludeId) {
        request.input("ExcludeID", sql.Int, excludeId);
        query += " AND AccountID != @ExcludeID";
      }
      
      const result = await request.query(query);
      return result.recordset[0].count > 0;
    } catch (error) {
      console.error('AccountDAL.usernameExists error:', error);
      throw error;
    }
  }

  /**
   * Check if email exists
   */
  static async emailExists(email, excludeId = null) {
    try {
      const pool = await poolPromise;
      const request = pool.request()
        .input("Email", sql.VarChar, email);
      
      let query = "SELECT COUNT(*) as count FROM Account WHERE Email = @Email AND Status != 'Deleted'";
      
      if (excludeId) {
        request.input("ExcludeID", sql.Int, excludeId);
        query += " AND AccountID != @ExcludeID";
      }
      
      const result = await request.query(query);
      return result.recordset[0].count > 0;
    } catch (error) {
      console.error('AccountDAL.emailExists error:', error);
      throw error;
    }
  }
}

module.exports = AccountDAL;