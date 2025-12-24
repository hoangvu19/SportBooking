const SportFieldDAL = require('../../DAL/Sport/SportFieldDAL');
const FacilityDAL = require('../../DAL/Sport/facilityDAL');
const SportTypeDAL = require('../../DAL/Sport/SportTypeDAL');
const AreaDAL = require('../../DAL/Sport/AreaDAL');
const BookingDAL = require('../../DAL/Sport/bookingDAL');

class SportManagementController {
  /**
   * Get all facilities with their sport fields
   */
  static async getAllFacilities(req, res) {
    try {
      const { areaId, sportTypeId, searchTerm, ownerId } = req.query;
      
      const filters = {};
      if (areaId) filters.areaId = areaId;
      if (sportTypeId) filters.sportTypeId = sportTypeId;
      if (searchTerm) filters.searchTerm = searchTerm;
      if (ownerId) filters.ownerId = ownerId;

      const result = await FacilityDAL.getAllFacilities(filters);
      
      res.json({
        success: true,
        data: result.data || result.recordset || []
      });
    } catch (error) {
      console.error('Get all facilities error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy danh sách cơ sở',
        error: error.message
      });
    }
  }

  /**
   * Get all sport fields with facility info
   */
  static async getAllSportFields(req, res) {
    try {
      const filters = req.query;
      const result = await SportFieldDAL.getAllSportFields(filters);
      
      res.json({
        success: true,
        data: result.data || result.recordset || []
      });
    } catch (error) {
      console.error('Get all sport fields error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy danh sách sân',
        error: error.message
      });
    }
  }

  /**
   * Get facility by ID with all details
   */
  static async getFacilityById(req, res) {
    try {
      const { id } = req.params;
      const result = await FacilityDAL.getFacilityById(parseInt(id));
      
      if (!result.success || !result.data) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy cơ sở'
        });
      }

      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      console.error('Get facility by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy thông tin cơ sở',
        error: error.message
      });
    }
  }

  /**
   * Get sport field by ID
   */
  static async getSportFieldById(req, res) {
    try {
      const { id } = req.params;
      const result = await SportFieldDAL.getSportFieldById(parseInt(id));
      
      if (!result.success || !result.data) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy sân'
        });
      }

      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      console.error('Get sport field by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy thông tin sân',
        error: error.message
      });
    }
  }

  /**
   * Create new facility
   */
  static async createFacility(req, res) {
    try {
      const result = await FacilityDAL.createFacility(req.body);
      
      res.status(201).json({
        success: true,
        message: 'Tạo cơ sở thành công',
        data: result.data
      });
    } catch (error) {
      console.error('Create facility error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi tạo cơ sở',
        error: error.message
      });
    }
  }

  /**
   * Create new sport field
   */
  static async createSportField(req, res) {
    try {
      const result = await SportFieldDAL.createSportField(req.body);
      
      res.status(201).json({
        success: true,
        message: 'Tạo sân thành công',
        data: result.data
      });
    } catch (error) {
      console.error('Create sport field error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi tạo sân',
        error: error.message
      });
    }
  }

  /**
   * Update facility
   */
  static async updateFacility(req, res) {
    try {
      const { id } = req.params;
      const result = await FacilityDAL.updateFacility(parseInt(id), req.body);
      
      res.json({
        success: true,
        message: 'Cập nhật cơ sở thành công',
        data: result.data
      });
    } catch (error) {
      console.error('Update facility error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi cập nhật cơ sở',
        error: error.message
      });
    }
  }

  /**
   * Update sport field
   */
  static async updateSportField(req, res) {
    try {
      const { id } = req.params;
      const result = await SportFieldDAL.updateSportField(parseInt(id), req.body);
      
      res.json({
        success: true,
        message: 'Cập nhật sân thành công',
        data: result.data
      });
    } catch (error) {
      console.error('Update sport field error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi cập nhật sân',
        error: error.message
      });
    }
  }

  /**
   * Delete facility (soft delete if supported)
   */
  static async deleteFacility(req, res) {
    try {
      const { id } = req.params;
      const result = await FacilityDAL.deleteFacility(parseInt(id));
      
      res.json({
        success: true,
        message: 'Xóa cơ sở thành công'
      });
    } catch (error) {
      console.error('Delete facility error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi xóa cơ sở',
        error: error.message
      });
    }
  }

  /**
   * Delete sport field (soft delete if supported)
   */
  static async deleteSportField(req, res) {
    try {
      const { id } = req.params;
      const result = await SportFieldDAL.deleteSportField(parseInt(id));
      
      res.json({
        success: true,
        message: 'Xóa sân thành công'
      });
    } catch (error) {
      console.error('Delete sport field error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi xóa sân',
        error: error.message
      });
    }
  }

  /**
   * Get field availability/schedule for a date range
   */
  static async getFieldSchedule(req, res) {
    try {
      const { fieldId, startDate, endDate } = req.query;
      
      if (!fieldId || !startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Thiếu thông tin fieldId, startDate, hoặc endDate'
        });
      }

      const result = await BookingDAL.getBookingsByFieldAndDateRange(
        parseInt(fieldId),
        new Date(startDate),
        new Date(endDate)
      );
      
      res.json({
        success: true,
        data: result.data || result.recordset || []
      });
    } catch (error) {
      console.error('Get field schedule error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy lịch sân',
        error: error.message
      });
    }
  }

  /**
   * Get reference data (areas, sport types, owners)
   */
  static async getReferenceData(req, res) {
    try {
      const [areas, sportTypes] = await Promise.all([
        AreaDAL.getAllAreas(),
        SportTypeDAL.getAllSportTypes()
      ]);

      res.json({
        success: true,
        data: {
          areas: areas.data || areas.recordset || [],
          sportTypes: sportTypes.data || sportTypes.recordset || []
        }
      });
    } catch (error) {
      console.error('Get reference data error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy dữ liệu tham chiếu',
        error: error.message
      });
    }
  }

  /**
   * Create booking (admin can create booking for customers)
   */
  static async createBooking(req, res) {
    try {
      const bookingData = {
        FieldID: req.body.fieldId,
        CustomerID: req.body.customerId,
        StartTime: req.body.startTime,
        EndTime: req.body.endTime,
        Status: req.body.status || 'Confirmed',
        Deposit: req.body.deposit || 0
      };

      const result = await BookingDAL.create(bookingData);
      
      res.status(201).json({
        success: true,
        message: 'Tạo booking thành công',
        data: result.data
      });
    } catch (error) {
      console.error('Create booking error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi tạo booking',
        error: error.message
      });
    }
  }
}

module.exports = SportManagementController;
