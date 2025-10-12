/**
 * Enhanced Facility Controller
 * Handles facility management operations with new models integration
 */
const FacilityModel = require('../models/Facility');
const SportFieldModel = require('../models/SportField');
const FacilityDAL = require('../DAL/facilityDAL');

/**
 * Get all facilities with filtering
 */
async function getAllFacilities(req, res) {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const result = await FacilityModel.getAllFacilities(parseInt(page), parseInt(limit));
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Lấy danh sách cơ sở thể thao thành công',
        data: result.data,
        pagination: result.pagination
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Không thể lấy danh sách cơ sở thể thao'
      });
    }
  } catch (error) {
    console.error('Get all facilities error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách cơ sở thể thao',
      error: error.message
    });
  }
}

/**
 * Search facilities with advanced filters
 */
async function searchFacilities(req, res) {
  try {
    const { searchTerm, areaId, sportTypeId, minRating, priceRange, page = 1, limit = 20 } = req.query;
    
    const searchParams = {
      searchTerm,
      areaId: areaId ? parseInt(areaId) : null,
      sportTypeId: sportTypeId ? parseInt(sportTypeId) : null,
      minRating: minRating ? parseFloat(minRating) : null,
      priceRange: priceRange ? JSON.parse(priceRange) : null,
      page: parseInt(page),
      limit: parseInt(limit)
    };
    
    const result = await FacilityDAL.searchFacilities(searchParams);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Tìm kiếm cơ sở thể thao thành công',
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Không thể tìm kiếm cơ sở thể thao'
      });
    }
  } catch (error) {
    console.error('Search facilities error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi tìm kiếm cơ sở thể thao',
      error: error.message
    });
  }
}

/**
 * Get facility by ID
 */
async function getFacilityById(req, res) {
  try {
    const { facilityId } = req.params;
    
    const result = await FacilityModel.getFacilityById(parseInt(facilityId));
    
    if (result && result.success) {
      res.json({
        success: true,
        message: 'Lấy thông tin cơ sở thể thao thành công',
        data: result.data
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Không tìm thấy cơ sở thể thao'
      });
    }
  } catch (error) {
    console.error('Get facility by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy thông tin cơ sở thể thao',
      error: error.message
    });
  }
}

/**
 * Get facilities by area
 */
async function getFacilitiesByArea(req, res) {
  try {
    const { areaId } = req.params;
    const { sportTypeId, searchTerm } = req.query;
    
    const result = await FacilityModel.getFacilitiesByArea(
      parseInt(areaId),
      sportTypeId ? parseInt(sportTypeId) : null,
      searchTerm
    );
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Lấy danh sách cơ sở thể thao theo khu vực thành công',
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Không thể lấy danh sách cơ sở thể thao theo khu vực'
      });
    }
  } catch (error) {
    console.error('Get facilities by area error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách cơ sở thể thao theo khu vực',
      error: error.message
    });
  }
}

/**
 * Create facility (Court Owner only)
 */
async function createFacility(req, res) {
  try {
    const { facilityName, areaId } = req.body;
    const ownerId = req.user.AccountID;
    
    if (!facilityName || !areaId) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin bắt buộc: tên cơ sở, khu vực'
      });
    }
    
    const result = await FacilityModel.createFacility({
      facilityName: facilityName.trim(),
      areaId: parseInt(areaId),
      ownerId
    });
    
    if (result.success) {
      res.status(201).json({
        success: true,
        message: 'Tạo cơ sở thể thao thành công',
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Không thể tạo cơ sở thể thao'
      });
    }
  } catch (error) {
    console.error('Create facility error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi tạo cơ sở thể thao',
      error: error.message
    });
  }
}

/**
 * Update facility (Owner only)
 */
async function updateFacility(req, res) {
  try {
    const { facilityId } = req.params;
    const { facilityName, areaId } = req.body;
    const userId = req.user.AccountID;
    
    // Check ownership (TODO: implement ownership check)
    
    if (!facilityName || !areaId) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin bắt buộc: tên cơ sở, khu vực'
      });
    }
    
    const result = await FacilityModel.updateFacility(parseInt(facilityId), {
      facilityName: facilityName.trim(),
      areaId: parseInt(areaId)
    });
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Cập nhật cơ sở thể thao thành công',
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Không thể cập nhật cơ sở thể thao'
      });
    }
  } catch (error) {
    console.error('Update facility error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi cập nhật cơ sở thể thao',
      error: error.message
    });
  }
}

/**
 * Delete facility (Owner or Admin only)
 */
async function deleteFacility(req, res) {
  try {
    const { facilityId } = req.params;
    const userId = req.user.AccountID;
    const isAdmin = req.user.isAdmin;
    
    // Check ownership (TODO: implement ownership check)
    
    const result = await FacilityModel.deleteFacility(parseInt(facilityId));
    
    if (result.success && result.rowsAffected > 0) {
      res.json({
        success: true,
        message: 'Xóa cơ sở thể thao thành công'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Không tìm thấy cơ sở thể thao để xóa'
      });
    }
  } catch (error) {
    console.error('Delete facility error:', error);
    
    // Handle foreign key constraint
    if (error.message.includes('REFERENCE') || error.message.includes('foreign key')) {
      return res.status(400).json({
        success: false,
        message: 'Không thể xóa cơ sở vì vẫn còn sân hoặc booking liên quan'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi xóa cơ sở thể thao',
      error: error.message
    });
  }
}

/**
 * Get my facilities (Owner only)
 */
async function getMyFacilities(req, res) {
  try {
    const ownerId = req.user.AccountID;
    
    const result = await FacilityModel.getFacilitiesByOwner(ownerId);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Lấy danh sách cơ sở của bạn thành công',
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Không thể lấy danh sách cơ sở của bạn'
      });
    }
  } catch (error) {
    console.error('Get my facilities error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách cơ sở của bạn',
      error: error.message
    });
  }
}

/**
 * Get facility statistics (Owner only)
 */
async function getFacilityStatistics(req, res) {
  try {
    const { facilityId } = req.params;
    
    const result = await FacilityDAL.getFacilityStatistics(parseInt(facilityId));
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Lấy thống kê cơ sở thành công',
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Không thể lấy thống kê cơ sở'
      });
    }
  } catch (error) {
    console.error('Get facility statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy thống kê cơ sở',
      error: error.message
    });
  }
}

/**
 * Get popular facilities
 */
async function getPopularFacilities(req, res) {
  try {
    const { areaId, limit = 10 } = req.query;
    
    const result = await FacilityDAL.getPopularFacilities(
      areaId ? parseInt(areaId) : null,
      parseInt(limit)
    );
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Lấy danh sách cơ sở phổ biến thành công',
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Không thể lấy danh sách cơ sở phổ biến'
      });
    }
  } catch (error) {
    console.error('Get popular facilities error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách cơ sở phổ biến',
      error: error.message
    });
  }
}

/**
 * Add facility image (Owner only)
 */
async function addFacilityImage(req, res) {
  try {
    const { facilityId } = req.params;
    const { imageUrl } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu URL hình ảnh'
      });
    }
    
    const result = await FacilityModel.addFacilityImage(parseInt(facilityId), imageUrl);
    
    if (result.success) {
      res.status(201).json({
        success: true,
        message: 'Thêm hình ảnh cơ sở thành công',
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Không thể thêm hình ảnh cơ sở'
      });
    }
  } catch (error) {
    console.error('Add facility image error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi thêm hình ảnh cơ sở',
      error: error.message
    });
  }
}

module.exports = {
  getAllFacilities,
  searchFacilities,
  getFacilityById,
  getFacilitiesByArea,
  createFacility,
  updateFacility,
  deleteFacility,
  getMyFacilities,
  getFacilityStatistics,
  getPopularFacilities,
  addFacilityImage
};