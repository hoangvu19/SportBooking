const { poolPromise } = require('../config/db');
const sql = require('mssql');

class SportTypeDAL {
  static async createSportType(sportData) {
    const pool = await poolPromise;
    const { sportName } = sportData;
    const result = await pool.request()
      .input('SportName', sql.VarChar, sportName)
      .query(`
        INSERT INTO SportType (SportName)
        OUTPUT INSERTED.*
        VALUES (@SportName)
      `);

    return { success: true, data: result.recordset[0] };
  }

  static async getAllSportTypes() {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT * FROM SportType ORDER BY SportName');
    return { success: true, data: result.recordset };
  }

  static async getSportTypeById(sportTypeId) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('SportTypeID', sql.Int, sportTypeId)
      .query('SELECT * FROM SportType WHERE SportTypeID = @SportTypeID');

    return result.recordset[0] || null;
  }

  static async updateSportType(sportTypeId, sportData) {
    const pool = await poolPromise;
    const { sportName } = sportData;
    const result = await pool.request()
      .input('SportTypeID', sql.Int, sportTypeId)
      .input('SportName', sql.VarChar, sportName)
      .query(`
        UPDATE SportType 
        SET SportName = @SportName
        OUTPUT INSERTED.*
        WHERE SportTypeID = @SportTypeID
      `);

    return { success: true, data: result.recordset[0] };
  }

  static async deleteSportType(sportTypeId) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('SportTypeID', sql.Int, sportTypeId)
      .query('DELETE FROM SportType WHERE SportTypeID = @SportTypeID');

    return { success: true, rowsAffected: result.rowsAffected[0] };
  }

  static async getSportTypeByName(sportName) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('SportName', sql.VarChar, sportName)
      .query('SELECT * FROM SportType WHERE SportName = @SportName');

    return result.recordset[0] || null;
  }
}

module.exports = SportTypeDAL;
