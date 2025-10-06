/**
 * Area Controller
 * Handles area management operations (Da Nang, Ho Chi Minh City, Hanoi)
 */
const AreaModel = require('../models/Area');

/**
 * Get all areas
 */
async function getAllAreas(req, res) {
  try {
    const result = await AreaModel.getAllAreas();
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Lấy danh sách khu vực thành công',
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Không thể lấy danh sách khu vực'
      });
    }
  } catch (error) {
    console.error('Get all areas error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách khu vực',
      error: error.message
    });
  }
}

/**
 * Get area by ID
 */
async function getAreaById(req, res) {
  try {
    const { areaId } = req.params;
    
    const area = await AreaModel.getAreaById(parseInt(areaId));
    
    if (area) {
      res.json({
        success: true,
        message: 'Lấy thông tin khu vực thành công',
        data: area
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Không tìm thấy khu vực'
      });
    }
  } catch (error) {
    console.error('Get area by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy thông tin khu vực',
      error: error.message
    });
  }
}

/**
 * Create new area (Admin only)
 */
async function createArea(req, res) {
  try {
    const { areaName } = req.body;
    
    if (!areaName || areaName.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Tên khu vực không được để trống'
      });
    }
    
    const result = await AreaModel.createArea({
      areaName: areaName.trim()
    });
    
    if (result.success) {
      res.status(201).json({
        success: true,
        message: 'Tạo khu vực thành công',
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Không thể tạo khu vực'
      });
    }
  } catch (error) {
    console.error('Create area error:', error);
    
    // Handle duplicate area name
    if (error.message.includes('duplicate') || error.message.includes('UNIQUE')) {
      return res.status(400).json({
        success: false,
        message: 'Tên khu vực đã tồn tại'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi tạo khu vực',
      error: error.message
    });
  }
}

/**
 * Update area (Admin only)
 */
async function updateArea(req, res) {
  try {
    const { areaId } = req.params;
    const { areaName } = req.body;
    
    if (!areaName || areaName.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Tên khu vực không được để trống'
      });
    }
    
    const result = await AreaModel.updateArea(parseInt(areaId), {
      areaName: areaName.trim()
    });
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Cập nhật khu vực thành công',
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Không thể cập nhật khu vực'
      });
    }
  } catch (error) {
    console.error('Update area error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi cập nhật khu vực',
      error: error.message
    });
  }
}

/**
 * Delete area (Admin only)
 */
async function deleteArea(req, res) {
  try {
    const { areaId } = req.params;
    
    const result = await AreaModel.deleteArea(parseInt(areaId));
    
    if (result.success && result.rowsAffected > 0) {
      res.json({
        success: true,
        message: 'Xóa khu vực thành công'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Không tìm thấy khu vực để xóa'
      });
    }
  } catch (error) {
    console.error('Delete area error:', error);
    
    // Handle foreign key constraint
    if (error.message.includes('REFERENCE') || error.message.includes('foreign key')) {
      return res.status(400).json({
        success: false,
        message: 'Không thể xóa khu vực vì vẫn còn cơ sở thể thao trong khu vực này'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi xóa khu vực',
      error: error.message
    });
  }
}

module.exports = {
  getAllAreas,
  getAreaById,
  createArea,
  updateArea,
  deleteArea
};