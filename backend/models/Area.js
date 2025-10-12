/**
 * Area Model
 * Handles all database operations for areas (Da Nang, Ho Chi Minh City, Hanoi)
 */
const { poolPromise } = require('../config/db');
const sql = require('mssql');

class AreaModel {
  /**
   * Create a new area
   */
  static async createArea(areaData) {
    try {
      const pool = await poolPromise;
      const { areaName } = areaData;
      
      const result = await pool.request()
        .input('AreaName', sql.VarChar, areaName)
        .query(`
          INSERT INTO Area (AreaName)
          OUTPUT INSERTED.*
          VALUES (@AreaName)
        `);
      
      return { success: true, data: result.recordset[0] };
    } catch (error) {
      console.error('AreaModel.createArea error:', error);
      throw error;
    }
  }

  /**
   * Get all areas
   */
  static async getAllAreas() {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .query('SELECT * FROM Area ORDER BY AreaName');
      
      return { success: true, data: result.recordset };
    } catch (error) {
      console.error('AreaModel.getAllAreas error:', error);
      throw error;
    }
  }

  /**
   * Get area by ID
   */
  static async getAreaById(areaId) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('AreaID', sql.Int, areaId)
        .query('SELECT * FROM Area WHERE AreaID = @AreaID');
      
      return result.recordset[0] || null;
    } catch (error) {
      console.error('AreaModel.getAreaById error:', error);
      throw error;
    }
  }

  /**
   * Update area
   */
  static async updateArea(areaId, areaData) {
    try {
      const pool = await poolPromise;
      const { areaName } = areaData;
      
      const result = await pool.request()
        .input('AreaID', sql.Int, areaId)
        .input('AreaName', sql.VarChar, areaName)
        .query(`
          UPDATE Area 
          SET AreaName = @AreaName
          OUTPUT INSERTED.*
          WHERE AreaID = @AreaID
        `);
      
      return { success: true, data: result.recordset[0] };
    } catch (error) {
      console.error('AreaModel.updateArea error:', error);
      throw error;
    }
  }

  /**
   * Delete area
   */
  static async deleteArea(areaId) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('AreaID', sql.Int, areaId)
        .query('DELETE FROM Area WHERE AreaID = @AreaID');
      
      return { success: true, rowsAffected: result.rowsAffected[0] };
    } catch (error) {
      console.error('AreaModel.deleteArea error:', error);
      throw error;
    }
  }
}

module.exports = AreaModel;