/**
 * Area Model
 * Handles all database operations for areas (Da Nang, Ho Chi Minh City, Hanoi)
 */
// Thin wrapper model delegating DB work to DAL
const AreaDAL = require('../../DAL/Sport/AreaDAL');

class AreaModel {
  static async createArea(areaData) {
    return AreaDAL.createArea(areaData);
  }

  static async getAllAreas() {
    return AreaDAL.getAllAreas();
  }

  static async getAreaById(areaId) {
    return AreaDAL.getAreaById(areaId);
  }

  static async updateArea(areaId, areaData) {
    return AreaDAL.updateArea(areaId, areaData);
  }

  static async deleteArea(areaId) {
    return AreaDAL.deleteArea(areaId);
  }
}

module.exports = AreaModel;