const SportFieldModel = require('../../models/Sport/sportField');
async function getSportFieldById(req, res) {
  try {
    const { fieldId } = req.params;
    
    const result = await SportFieldModel.getSportFieldById(parseInt(fieldId));
    
    if (result && result.success) {
      const field = result.data;
      const mappedData = {
        SanID: field.FieldID,
        TenSan: field.FieldName,
        LoaiSan: field.FieldType,
        GiaThue: field.RentalPrice,
        TrangThai: field.Status,
        MonTheThao: field.SportName,
        KhuVuc: field.AreaName,
        KhuVucSan: field.FieldArea || null, 
        TenCoSo: field.FacilityName,
        CoSoID: field.FacilityID,
        HinhAnh: field.Image,
        ChuSoHuu: field.OwnerAccountID ? {
          AccountID: field.OwnerAccountID,
          HoTen: field.OwnerName,
          Avatar: field.OwnerAvatar
        } : null
      };
      
      Object.keys(field).forEach(key => {
        if (!(key in mappedData)) {
          mappedData[key] = field[key];
        }
      });
      
      res.json({
        success: true,
        message: 'Lấy thông tin sân thành công',
        data: mappedData
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Không tìm thấy sân'
      });
    }
  } catch (error) {
    console.error('Get sport field by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy thông tin sân',
      error: error.message
    });
  }
}

async function getSportFieldsByFacility(req, res) {
  try {
    const { facilityId } = req.params;
    
    const result = await SportFieldModel.getSportFieldsByFacility(parseInt(facilityId));
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Lấy danh sách sân theo cơ sở thành công',
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Không thể lấy danh sách sân theo cơ sở'
      });
    }
  } catch (error) {
    console.error('Get sport fields by facility error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách sân theo cơ sở',
      error: error.message
    });
  }
}

/**
 * Search sport fields by type and area
 */
async function searchSportFields(req, res) {
  try {
    const { sportTypeId, areaId, searchTerm } = req.query;
    
    if (!sportTypeId || !areaId) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin môn thể thao hoặc khu vực'
      });
    }
    
    const result = await SportFieldModel.getSportFieldsByTypeAndArea(
      parseInt(sportTypeId),
      parseInt(areaId),
      searchTerm
    );
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Tìm kiếm sân thành công',
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Không thể tìm kiếm sân'
      });
    }
  } catch (error) {
    console.error('Search sport fields error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi tìm kiếm sân',
      error: error.message
    });
  }
}

async function createSportField(req, res) {
  try {
    const { facilityId } = req.params;
    const { fieldName, fieldType, rentalPrice, status, sportTypeId } = req.body;
    
    if (!fieldName || !fieldType || !rentalPrice || !sportTypeId) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin bắt buộc: tên sân, loại sân, giá thuê, môn thể thao'
      });
    }
    
    const result = await SportFieldModel.createSportField({
      fieldName: fieldName.trim(),
      fieldType: fieldType.trim(),
      rentalPrice: parseFloat(rentalPrice),
      status: status || 'Available',
      facilityId: parseInt(facilityId),
      sportTypeId: parseInt(sportTypeId)
    });
    
    if (result.success) {
      res.status(201).json({
        success: true,
        message: 'Tạo sân thành công',
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Không thể tạo sân'
      });
    }
  } catch (error) {
    console.error('Create sport field error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi tạo sân',
      error: error.message
    });
  }
}


async function updateSportField(req, res) {
  try {
    const { fieldId } = req.params;
    const { fieldName, fieldType, rentalPrice, status, sportTypeId } = req.body;
    
    if (!fieldName || !fieldType || !rentalPrice || !sportTypeId) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin bắt buộc'
      });
    }
    
    const result = await SportFieldModel.updateSportField(parseInt(fieldId), {
      fieldName: fieldName.trim(),
      fieldType: fieldType.trim(),
      rentalPrice: parseFloat(rentalPrice),
      status: status || 'Available',
      sportTypeId: parseInt(sportTypeId)
    });
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Cập nhật sân thành công',
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Không thể cập nhật sân'
      });
    }
  } catch (error) {
    console.error('Update sport field error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi cập nhật sân',
      error: error.message
    });
  }
}


async function deleteSportField(req, res) {
  try {
    const { fieldId } = req.params;
    
    const result = await SportFieldModel.deleteSportField(parseInt(fieldId));
    
    if (result.success && result.rowsAffected > 0) {
      res.json({
        success: true,
        message: 'Xóa sân thành công'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Không tìm thấy sân để xóa'
      });
    }
  } catch (error) {
    console.error('Delete sport field error:', error);
    
    if (error.message.includes('REFERENCE') || error.message.includes('foreign key')) {
      return res.status(400).json({
        success: false,
        message: 'Không thể xóa sân vì vẫn còn booking liên quan'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi xóa sân',
      error: error.message
    });
  }
}


async function getFieldAvailability(req, res) {
  try {
    const { fieldId } = req.params;
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin ngày'
      });
    }
    
    const result = await SportFieldModel.getFieldAvailability(parseInt(fieldId), date);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Lấy lịch trống của sân thành công',
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Không thể lấy lịch trống của sân'
      });
    }
  } catch (error) {
    console.error('Get field availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy lịch trống của sân',
      error: error.message
    });
  }
}


async function getAllSportFields(req, res) {
  try {
    const filters = {
      sportTypeId: req.query.sportTypeId,
      areaId: req.query.areaId,
      searchTerm: req.query.searchTerm,
      status: req.query.status
    };

    const result = await SportFieldModel.getAllSportFields(filters);
    if (result.success) {
      const mappedData = result.data.map(field => {
        console.log('\n=== MAPPING FIELD ===');
        console.log('field.FieldArea:', field.FieldArea);
        console.log('field.FieldArea type:', typeof field.FieldArea);
        const mapped = {
          SanID: field.FieldID,
          TenSan: field.FieldName,
          LoaiSan: field.FieldType,
          GiaThue: field.RentalPrice,
          TrangThai: field.Status,
          MonTheThao: field.SportName,
          KhuVuc: field.AreaName,
          KhuVucSan: field.FieldArea || null, 
          TenCoSo: field.FacilityName,
          CoSoID: field.FacilityID,
          ChuSoHuu: field.OwnerAccountID ? {
            AccountID: field.OwnerAccountID,
            HoTen: field.OwnerName,
            Avatar: field.OwnerAvatar
          } : null
        };
        
        console.log('mapped.KhuVucSan after creation:', mapped.KhuVucSan);
        console.log('mapped.KhuVucSan type:', typeof mapped.KhuVucSan);
        Object.keys(field).forEach(key => {
          if (!(key in mapped)) {
            mapped[key] = field[key];
          }
        });
        
        console.log('mapped.KhuVucSan after forEach:', mapped.KhuVucSan);
        console.log('mapped.KhuVucSan type after forEach:', typeof mapped.KhuVucSan);
        console.log('=== END MAPPING ===\n');
        
        return mapped;
      });
      
      res.json({ success: true, message: 'Lấy danh sách sân thành công', data: mappedData });
    } else {
      res.status(500).json({ success: false, message: 'Không thể lấy danh sách sân' });
    }
  } catch (error) {
    console.error('Get all sport fields error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy danh sách sân', error: error.message });
  }
}


async function addSportFieldImage(req, res) {
  try {
    const { fieldId } = req.params;
    const { imageUrl } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu URL hình ảnh'
      });
    }
    
    const result = await SportFieldModel.addSportFieldImage(parseInt(fieldId), imageUrl);
    
    if (result.success) {
      res.status(201).json({
        success: true,
        message: 'Thêm hình ảnh sân thành công',
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Không thể thêm hình ảnh sân'
      });
    }
  } catch (error) {
    console.error('Add sport field image error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi thêm hình ảnh sân',
      error: error.message
    });
  }
}
module.exports = {
  getSportFieldById,
  getSportFieldsByFacility,
  searchSportFields,
  getAllSportFields,
  createSportField,
  updateSportField,
  deleteSportField,
  getFieldAvailability,
  addSportFieldImage
};