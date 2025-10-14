/**
 * Facility Model (thin wrapper)
 * Delegates DB operations to backend/DAL/FacilityDAL.js
 */
const FacilityDAL = require('../../DAL/Sport/facilityDAL');

class FacilityModel {
  static async createFacility(facilityData) {
    return FacilityDAL.createFacility(facilityData);
  }

  static async getFacilityById(facilityId) {
    return FacilityDAL.getFacilityById(facilityId);
  }

  static async getFacilitiesByArea(areaId, sportTypeId = null, searchTerm = null) {
    return FacilityDAL.getFacilitiesByArea(areaId, sportTypeId, searchTerm);
  }

  static async getAllFacilities(page = 1, limit = 20) {
    return FacilityDAL.getAllFacilities(page, limit);
  }

  static async getFacilitiesByOwner(ownerId) {
    return FacilityDAL.getFacilitiesByOwner(ownerId);
  }

  static async updateFacility(facilityId, facilityData) {
    return FacilityDAL.updateFacility(facilityId, facilityData);
  }

  static async deleteFacility(facilityId) {
    return FacilityDAL.deleteFacility(facilityId);
  }

  static async addFacilityImage(facilityId, imageUrl) {
    return FacilityDAL.addFacilityImage(facilityId, imageUrl);
  }

  static async deleteFacilityImage(imageId) {
    return FacilityDAL.deleteFacilityImage(imageId);
  }
}

module.exports = FacilityModel;