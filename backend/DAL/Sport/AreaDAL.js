const { poolPromise } = require('../../config/db');
const sql = require('mssql');

class AreaDAL {
  static async createArea(areaData) {
    const pool = await poolPromise;
    try {
      const { areaName } = areaData;
      const result = await pool.request()
        .input('AreaName', sql.VarChar, areaName)
        .query(`INSERT INTO Area (AreaName) OUTPUT INSERTED.* VALUES (@AreaName)`);
      return { success: true, data: result.recordset[0] };
    } catch (error) {
      console.error('AreaDAL.createArea error:', error);
      throw error;
    }
  }

  static async getAllAreas() {
    const pool = await poolPromise;
    try {
      const result = await pool.request().query('SELECT * FROM Area ORDER BY AreaName');
      return { success: true, data: result.recordset };
    } catch (error) {
      console.error('AreaDAL.getAllAreas error:', error);
      throw error;
    }
  }

  static async getAreaById(areaId) {
    const pool = await poolPromise;
    try {
      const result = await pool.request().input('AreaID', sql.Int, areaId).query('SELECT * FROM Area WHERE AreaID = @AreaID');
      return result.recordset[0] || null;
    } catch (error) {
      console.error('AreaDAL.getAreaById error:', error);
      throw error;
    }
  }

  static async updateArea(areaId, areaData) {
    const pool = await poolPromise;
    try {
      const { areaName } = areaData;
      const result = await pool.request()
        .input('AreaID', sql.Int, areaId)
        .input('AreaName', sql.VarChar, areaName)
        .query(`UPDATE Area SET AreaName = @AreaName OUTPUT INSERTED.* WHERE AreaID = @AreaID`);
      return { success: true, data: result.recordset[0] };
    } catch (error) {
      console.error('AreaDAL.updateArea error:', error);
      throw error;
    }
  }

  static async deleteArea(areaId) {
    const pool = await poolPromise;
    try {
      const result = await pool.request().input('AreaID', sql.Int, areaId).query('DELETE FROM Area WHERE AreaID = @AreaID');
      return { success: true, rowsAffected: result.rowsAffected[0] };
    } catch (error) {
      console.error('AreaDAL.deleteArea error:', error);
      throw error;
    }
  }
}

module.exports = AreaDAL;
