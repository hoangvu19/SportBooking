const FacilityModel = require('../../models/Sport/Facility');
const SportFieldModel = require('../../models/Sport/sportField');
const FacilityDAL = require('../../DAL/Sport/facilityDAL');
const { emitToRealtime } = require('../../lib/realtimeEmitter');

/**
 * Get all facilities with filtering
 */
async function getAllFacilities(req, res) {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const result = await FacilityModel.getAllFacilities(parseInt(page), parseInt(limit));

    if (result.success) {
      try {
        // Attach media assets (images) for the returned facilities in batch to avoid N+1 queries
        const facilityIds = (result.data || []).map(f => f.facilityId || f.FacilityID || f.SanID || f.id).filter(Boolean).map(String);
        if (facilityIds.length > 0) {
          const MediaAssetDAL = require('../../DAL/Social/MediaAssetDAL');
          const media = await MediaAssetDAL.getByTargets('Facility', facilityIds);
          const mediaByFacility = {};
          (media || []).forEach(m => {
            const tid = m.TargetID || m.TargetId || m.targetId;
            if (!tid) return;
            if (!mediaByFacility[tid]) mediaByFacility[tid] = [];
            mediaByFacility[tid].push(m);
          });
          // Attach images array to each facility row
          result.data = (result.data || []).map(f => ({ 
            ...f, 
            images: mediaByFacility[String(f.facilityId || f.FacilityID || f.SanID || f.id)] || [],
            // Add backward compatibility fields for frontend
            FacilityID: f.facilityId || f.FacilityID,
            FacilityName: f.facilityName || f.FacilityName,
            AreaName: f.areaName || f.AreaName
          }));
        }
      } catch (attachErr) {
        // Non-fatal: log and continue returning facilities without images
        console.warn('Failed to attach media assets to facilities list', attachErr && attachErr.message ? attachErr.message : attachErr);
      }
      res.json({
        success: true,
        message: req.t('sport.facility_list_success'),
        data: result.data,
        pagination: result.pagination
      });
    } else {
      res.status(500).json({
        success: false,
        message: req.t('sport.facility_list_error')
      });
    }
  } catch (error) {
    console.error('Get all facilities error:', error);
    res.status(500).json({
      success: false,
      message: req.t('sport.facility_server_error'),
      error: error.message
    });
  }
}


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
      try {
        // Attach media assets for returned search results (batch)
        const facilityIds = (result.data || []).map(f => f.FacilityID || f.SanID || f.id).filter(Boolean).map(String);
        if (facilityIds.length > 0) {
          const MediaAssetDAL = require('../../DAL/Social/MediaAssetDAL');
          const media = await MediaAssetDAL.getByTargets('Facility', facilityIds);
          const mediaByFacility = {};
          (media || []).forEach(m => {
            const tid = m.TargetID || m.TargetId || m.TargetId;
            if (!tid) return;
            if (!mediaByFacility[tid]) mediaByFacility[tid] = [];
            mediaByFacility[tid].push(m);
          });
          result.data = (result.data || []).map(f => ({ ...f, images: mediaByFacility[String(f.FacilityID || f.SanID || f.id)] || [] }));
        }
      } catch (attachErr) {
        console.warn('Failed to attach media assets to facility search results', attachErr && attachErr.message ? attachErr.message : attachErr);
      }
      res.json({
        success: true,
        message: req.t('sport.facility_search_success'),
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: req.t('sport.facility_search_error')
      });
    }
  } catch (error) {
    console.error('Search facilities error:', error);
    res.status(500).json({
      success: false,
      message: req.t('sport.facility_server_error'),
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
        try {
          // Attach media assets (images) for this facility so frontend can render DB images
          const fid = result.data && (result.data.FacilityID || result.data.SanID || result.data.id);
          if (fid) {
            const MediaAssetDAL = require('../../DAL/Social/MediaAssetDAL');
            const media = await MediaAssetDAL.getByTarget('Facility', String(fid));
            result.data.images = Array.isArray(media) ? media : (media ? [media] : []);
          }
          // If facility includes sportFields, attach media for each sport field (batch)
          if (result.data && Array.isArray(result.data.sportFields) && result.data.sportFields.length > 0) {
            try {
              const sfIds = result.data.sportFields.map(sf => sf.FieldID || sf.SanID || sf.id).filter(Boolean).map(String);
              if (sfIds.length > 0) {
                const MediaAssetDAL2 = require('../../DAL/Social/MediaAssetDAL');
                const sfMedia = await MediaAssetDAL2.getByTargets('SportField', sfIds);
                const mediaBySf = {};
                (sfMedia || []).forEach(m => {
                  const tid = m.TargetID || m.TargetId || m.TargetId;
                  if (!tid) return;
                  if (!mediaBySf[tid]) mediaBySf[tid] = [];
                  mediaBySf[tid].push(m);
                });
                result.data.sportFields = result.data.sportFields.map(sf => ({ ...sf, images: mediaBySf[String(sf.FieldID || sf.SanID || sf.id)] || [] }));
              }
            } catch (e) {
              console.warn('Failed to attach media to sportFields in facility detail', e && e.message ? e.message : e);
            }
          }
        } catch (attachErr) {
          console.warn('Failed to attach media assets to facility detail', attachErr && attachErr.message ? attachErr.message : attachErr);
        }
        res.json({
          success: true,
          message: req.t('sport.facility_list_success'),
          data: result.data
        });
    } else {
      res.status(404).json({
        success: false,
        message: req.t('sport.facility_not_found')
      });
    }
  } catch (error) {
    console.error('Get facility by ID error:', error);
    res.status(500).json({
      success: false,
      message: req.t('sport.facility_detail_error'),
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
      // Emit realtime event for facility creation
      try {
        emitToRealtime('facility:created', {
          facilityId: result.data.FacilityID || result.data.facilityId || result.data.id,
          facilityName: facilityName.trim(),
          ownerId,
          areaId: parseInt(areaId),
          timestamp: new Date().toISOString()
        });
      } catch (emitErr) {
        console.warn('Failed to emit facility:created event', emitErr);
      }
      // Also notify all admins about the new facility so it appears in Sent Notifications
      try {
        const UserDAL = require('../../DAL/Auth/userDAL');
        const admins = await UserDAL.getUsersByRole('admin');
        const { createNotification } = require('../Notification/notificationController');
        for (const admin of admins) {
          try {
            await createNotification({
              recipientId: admin.AccountID,
              senderId: ownerId,
              type: 'new_facility',
              contentId: result.data.FacilityID || result.data.facilityId || result.data.id,
              content: `Cơ sở mới được tạo: ${facilityName.trim()}`
            });
          } catch (nerr) {
            console.warn('Failed to create admin notification for new facility', admin && admin.AccountID, nerr && nerr.message ? nerr.message : nerr);
          }
        }
      } catch (notifErr) {
        console.error('Error sending new_facility notifications to admins', notifErr);
      }
      
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
    const isAdmin = req.user.isAdmin;

    // Check ownership: only owner or admin can update
    const facilityRes = await FacilityModel.getFacilityById(parseInt(facilityId));
    if (!facilityRes || !facilityRes.success || !facilityRes.data) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cơ sở để cập nhật' });
    }
    const facility = facilityRes.data;
    const ownerId = facility.OwnerID || facility.OwnerId || facility.ownerId || facility.Owner || null;
    if (!isAdmin && parseInt(ownerId) !== parseInt(userId)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền cập nhật cơ sở này' });
    }
    
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
      // Emit realtime event for facility update
      try {
        emitToRealtime('facility:updated', {
          facilityId: parseInt(facilityId),
          facilityName: facilityName.trim(),
          areaId: parseInt(areaId),
          timestamp: new Date().toISOString()
        });
      } catch (emitErr) {
        console.warn('Failed to emit facility:updated event', emitErr);
      }
      
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
    // Check ownership: only owner or admin can delete
    const facilityRes = await FacilityModel.getFacilityById(parseInt(facilityId));
    if (!facilityRes || !facilityRes.success || !facilityRes.data) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cơ sở để xóa' });
    }
    const facility = facilityRes.data;
    const ownerId = facility.OwnerID || facility.OwnerId || facility.ownerId || facility.Owner || null;
    if (!isAdmin && parseInt(ownerId) !== parseInt(userId)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa cơ sở này' });
    }

    const result = await FacilityModel.deleteFacility(parseInt(facilityId));
    
    if (result.success && result.rowsAffected > 0) {
      // Emit realtime event for facility deletion
      try {
        emitToRealtime('facility:deleted', {
          facilityId: parseInt(facilityId),
          timestamp: new Date().toISOString()
        });
      } catch (emitErr) {
        console.warn('Failed to emit facility:deleted event', emitErr);
      }
      
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
    console.debug(`[facilityController.getMyFacilities] ownerId=${ownerId}`);
    const result = await FacilityModel.getFacilitiesByOwner(ownerId);
    console.debug('[facilityController.getMyFacilities] result=', result && (result.data ? `count=${(result.data||[]).length}` : JSON.stringify(result)));

    // Even if no facilities exist for the owner, return success with empty array
    if (result && result.success) {
      return res.json({ success: true, message: 'Lấy danh sách cơ sở của bạn thành công', data: result.data || [] });
    }

    // If DAL returned an unexpected shape, return empty list but log warning
    console.warn('[facilityController.getMyFacilities] unexpected DAL response', result);
    return res.json({ success: true, message: 'Lấy danh sách cơ sở của bạn thành công', data: [] });
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
    // Support two modes:
    // 1) JSON body with imageUrl (existing behavior)
    // 2) Multipart upload with files available in req.files (handled by multer)
    const accountId = req.user && req.user.AccountID ? req.user.AccountID : null;

    // If files were uploaded (multer), store them via MediaAssetDAL.createFromFiles
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      // Verify ownership: only facility owner or admin can add images
      const facilityRes = await FacilityModel.getFacilityById(parseInt(facilityId));
      if (!facilityRes || !facilityRes.success || !facilityRes.data) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy cơ sở' });
      }
      const facility = facilityRes.data;
      const ownerId = facility.OwnerID || facility.OwnerId || facility.ownerId || facility.Owner || null;
      const isAdmin = req.user && req.user.isAdmin;
      if (!isAdmin && String(ownerId) !== String(accountId)) {
        return res.status(403).json({ success: false, message: 'Bạn không có quyền thêm hình ảnh cho cơ sở này' });
      }

      const MediaAssetDAL = require('../../DAL/Social/MediaAssetDAL');
      const created = await MediaAssetDAL.createFromFiles(req.files, { targetType: 'Facility', targetId: parseInt(facilityId), accountId });
      return res.status(201).json({ success: true, message: 'Thêm hình ảnh cơ sở thành công', data: created });
    }

    // Fallback: JSON body with imageUrl
    const { imageUrl } = req.body;
    if (!imageUrl) {
      return res.status(400).json({ success: false, message: 'Thiếu URL hình ảnh hoặc file upload' });
    }

    const result = await FacilityModel.addFacilityImage(parseInt(facilityId), imageUrl, accountId);

    if (result.success) {
      res.status(201).json({ success: true, message: 'Thêm hình ảnh cơ sở thành công', data: result.data });
    } else {
      res.status(500).json({ success: false, message: 'Không thể thêm hình ảnh cơ sở' });
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

/**
 * Delete a facility image (Owner only)
 */
async function deleteFacilityImage(req, res) {
  try {
    const { facilityId, imageId } = req.params;
    const accountId = req.user && req.user.AccountID ? req.user.AccountID : null;

    // Validate facility exists and ownership
    const facilityRes = await FacilityModel.getFacilityById(parseInt(facilityId));
    if (!facilityRes || !facilityRes.success || !facilityRes.data) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cơ sở' });
    }
    const facility = facilityRes.data;
    const ownerId = facility.OwnerID || facility.OwnerId || facility.ownerId || facility.Owner || null;
    const isAdmin = req.user && req.user.isAdmin;
    if (!isAdmin && String(ownerId) !== String(accountId)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa hình ảnh của cơ sở này' });
    }

    // Delete image by id (uses MediaAssetDAL under the hood)
    const result = await FacilityDAL.deleteFacilityImage(parseInt(imageId));
    if (result && result.success) {
      return res.json({ success: true, message: 'Xóa hình ảnh thành công' });
    }

    return res.status(404).json({ success: false, message: 'Không tìm thấy hình ảnh để xóa' });
  } catch (error) {
    console.error('Delete facility image error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi xóa hình ảnh', error: error.message });
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
  addFacilityImage,
  deleteFacilityImage
};