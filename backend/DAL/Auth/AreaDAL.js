const { poolPromise } = require("../../config/db");
const sql = require("mssql");

class AreaDAL {
  static async getAllAreas() {
    const pool = await poolPromise;
    const result = await pool.request()
      .query("SELECT AreaID, AreaName FROM Area ORDER BY AreaName ASC");
    return result.recordset;
  }
}

module.exports = AreaDAL;
