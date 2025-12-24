/**
 * SportType Controller
 * Handles sport type management operations
 */
const SportTypeModel = require('../../models/Sport/SportType');

/**
 * Get all sport types
 */
async function getAllSportTypes(req, res) {
  try {
    const result = await SportTypeModel.getAllSportTypes();
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Lấy danh sách môn thể thao thành công',
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Không thể lấy danh sách môn thể thao'
      });
    }
  } catch (error) {
    console.error('Get all sport types error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách môn thể thao',
      error: error.message
    });
  }
}

/**
 * Get sport type by ID
 */
async function getSportTypeById(req, res) {
  try {
    const { sportTypeId } = req.params;
    
    const sportType = await SportTypeModel.getSportTypeById(parseInt(sportTypeId));
    
    if (sportType) {
      res.json({
        success: true,
        message: 'Lấy thông tin môn thể thao thành công',
        data: sportType
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Không tìm thấy môn thể thao'
      });
    }
  } catch (error) {
    console.error('Get sport type by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy thông tin môn thể thao',
      error: error.message
    });
  }
}

/**
 * Create new sport type (Admin only)
 */
async function createSportType(req, res) {
  try {
    const { sportName } = req.body;
    
    if (!sportName || sportName.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Tên môn thể thao không được để trống'
      });
    }
    
    // Check if sport type already exists
    const existingSportType = await SportTypeModel.getSportTypeByName(sportName.trim());
    if (existingSportType) {
      return res.status(400).json({
        success: false,
        message: 'Môn thể thao này đã tồn tại'
      });
    }
    
    const result = await SportTypeModel.createSportType({
      sportName: sportName.trim()
    });
    
    if (result.success) {
      res.status(201).json({
        success: true,
        message: 'Tạo môn thể thao thành công',
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Không thể tạo môn thể thao'
      });
    }
  } catch (error) {
    console.error('Create sport type error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi tạo môn thể thao',
      error: error.message
    });
  }
}

/**
 * Update sport type (Admin only)
 */
async function updateSportType(req, res) {
  try {
    const { sportTypeId } = req.params;
    const { sportName } = req.body;
    
    if (!sportName || sportName.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Tên môn thể thao không được để trống'
      });
    }
    
    const result = await SportTypeModel.updateSportType(parseInt(sportTypeId), {
      sportName: sportName.trim()
    });
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Cập nhật môn thể thao thành công',
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Không thể cập nhật môn thể thao'
      });
    }
  } catch (error) {
    console.error('Update sport type error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi cập nhật môn thể thao',
      error: error.message
    });
  }
}

/**
 * Delete sport type (Admin only)
 */
async function deleteSportType(req, res) {
  try {
    const { sportTypeId } = req.params;
    
    const result = await SportTypeModel.deleteSportType(parseInt(sportTypeId));
    
    if (result.success && result.rowsAffected > 0) {
      res.json({
        success: true,
        message: 'Xóa môn thể thao thành công'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Không tìm thấy môn thể thao để xóa'
      });
    }
  } catch (error) {
    console.error('Delete sport type error:', error);
    
    // Handle foreign key constraint
    if (error.message.includes('REFERENCE') || error.message.includes('foreign key')) {
      return res.status(400).json({
        success: false,
        message: 'Không thể xóa môn thể thao vì vẫn còn sân thuộc môn này'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi xóa môn thể thao',
      error: error.message
    });
  }
}

module.exports = {
  getAllSportTypes,
  getSportTypeById,
  createSportType,
  updateSportType,
  deleteSportType
};