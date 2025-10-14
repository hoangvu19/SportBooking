/**
 * SportType Model - thin wrapper delegating DB access to DAL
 */
const SportTypeDAL = require('../../DAL/Sport/SportTypeDAL');

class SportType {
  static async createSportType(sportData) {
    return SportTypeDAL.createSportType(sportData);
  }

  static async getAllSportTypes() {
    return SportTypeDAL.getAllSportTypes();
  }

  static async getSportTypeById(sportTypeId) {
    return SportTypeDAL.getSportTypeById(sportTypeId);
  }

  static async updateSportType(sportTypeId, sportData) {
    return SportTypeDAL.updateSportType(sportTypeId, sportData);
  }

  static async deleteSportType(sportTypeId) {
    return SportTypeDAL.deleteSportType(sportTypeId);
  }

  static async getSportTypeByName(sportName) {
    return SportTypeDAL.getSportTypeByName(sportName);
  }
}

module.exports = SportType;