// Thin wrapper model delegating DB work to DAL
const SportFieldDAL = require('../../DAL/Sport/SportFieldDAL');

class SportFieldModel {
  static async createSportField(fieldData) { return SportFieldDAL.createSportField(fieldData); }
  static async getAllSportFields(filters = {}) { return SportFieldDAL.getAllSportFields(filters); }
  static async getSportFieldById(fieldId) { return SportFieldDAL.getSportFieldById(fieldId); }
  static async getSportFieldsByFacility(facilityId) { return SportFieldDAL.getSportFieldsByFacility(facilityId); }
  static async getSportFieldsByTypeAndArea(sportTypeId, areaId, searchTerm = null) { return SportFieldDAL.getSportFieldsByTypeAndArea(sportTypeId, areaId, searchTerm); }
  static async updateSportField(fieldId, fieldData) { return SportFieldDAL.updateSportField(fieldId, fieldData); }
  static async deleteSportField(fieldId) { return SportFieldDAL.deleteSportField(fieldId); }
  static async getFieldAvailability(fieldId, date) { return SportFieldDAL.getFieldAvailability(fieldId, date); }
}

module.exports = SportFieldModel;