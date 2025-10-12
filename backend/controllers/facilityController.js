/**
 * Facility Controller
 * Handles facility-related operations
 */
const sql = require('mssql');
const { poolPromise } = require('../config/db');

/**
 * Get all facilities
 */
async function getAllFacilities(req, res) {
  try {
    console.log('=== GET ALL FACILITIES ===');
    
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT 
        FacilityID,
        FacilityName,
        FacilityType,
        Location,
        Capacity,
        PricePerHour,
        Description,
        ImageURL,
        AvailableHours,
        Status
      FROM Facility
      WHERE Status = 'Available'
      ORDER BY FacilityName
    `);

    console.log(`✅ Found ${result.recordset.length} facilities`);
    
    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    console.error('❌ Get facilities error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách cơ sở'
    });
  }
}

/**
 * Get facility by ID
 */
async function getFacilityById(req, res) {
  try {
    const { facilityId } = req.params;
    console.log('=== GET FACILITY BY ID ===', facilityId);
    
    const pool = await poolPromise;
    const result = await pool.request()
      .input('FacilityID', sql.Int, facilityId)
      .query(`
        SELECT 
          FacilityID,
          FacilityName,
          FacilityType,
          Location,
          Capacity,
          PricePerHour,
          Description,
          ImageURL,
          AvailableHours,
          Status
        FROM Facility
        WHERE FacilityID = @FacilityID
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy cơ sở'
      });
    }
    
    res.json({
      success: true,
      data: result.recordset[0]
    });
  } catch (error) {
    console.error('❌ Get facility error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy thông tin cơ sở'
    });
  }
}

/**
 * Create new facility
 */
async function createFacility(req, res) {
  try {
    const {
      facilityName,
      facilityType,
      location,
      capacity,
      pricePerHour,
      description,
      imageURL,
      availableHours
    } = req.body;

    console.log('=== CREATE FACILITY ===');
    
    if (!facilityName || !facilityType || !location) {
      return res.status(400).json({
        success: false,
        message: 'Tên, loại và địa điểm cơ sở là bắt buộc'
      });
    }

    const pool = await poolPromise;
    const result = await pool.request()
      .input('FacilityName', sql.VarChar, facilityName)
      .input('FacilityType', sql.VarChar, facilityType)
      .input('Location', sql.VarChar, location)
      .input('Capacity', sql.Int, capacity || 0)
      .input('PricePerHour', sql.Decimal, pricePerHour || 0)
      .input('Description', sql.VarChar, description || '')
      .input('ImageURL', sql.VarChar, imageURL || '')
      .input('AvailableHours', sql.VarChar, availableHours || '8:00-22:00')
      .query(`
        INSERT INTO Facility (
          FacilityName, FacilityType, Location, Capacity, 
          PricePerHour, Description, ImageURL, AvailableHours, Status
        )
        OUTPUT INSERTED.*
        VALUES (
          @FacilityName, @FacilityType, @Location, @Capacity,
          @PricePerHour, @Description, @ImageURL, @AvailableHours, 'Available'
        )
      `);

    console.log('✅ Facility created successfully');
    
    res.status(201).json({
      success: true,
      message: 'Tạo cơ sở thành công',
      data: result.recordset[0]
    });
  } catch (error) {
    console.error('❌ Create facility error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi tạo cơ sở'
    });
  }
}

/**
 * Update facility
 */
async function updateFacility(req, res) {
  try {
    const { facilityId } = req.params;
    const updateData = req.body;

    console.log('=== UPDATE FACILITY ===', facilityId);
    
    const pool = await poolPromise;
    
    // Build dynamic update query
    const setClause = [];
    const request = pool.request().input('FacilityID', sql.Int, facilityId);
    
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        const sqlKey = key.charAt(0).toUpperCase() + key.slice(1);
        setClause.push(`${sqlKey} = @${key}`);
        request.input(key, updateData[key]);
      }
    });

    if (setClause.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Không có dữ liệu để cập nhật'
      });
    }

    const result = await request.query(`
      UPDATE Facility 
      SET ${setClause.join(', ')}
      OUTPUT INSERTED.*
      WHERE FacilityID = @FacilityID
    `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy cơ sở'
      });
    }

    console.log('✅ Facility updated successfully');
    
    res.json({
      success: true,
      message: 'Cập nhật cơ sở thành công',
      data: result.recordset[0]
    });
  } catch (error) {
    console.error('❌ Update facility error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi cập nhật cơ sở'
    });
  }
}

/**
 * Delete facility
 */
async function deleteFacility(req, res) {
  try {
    const { facilityId } = req.params;
    console.log('=== DELETE FACILITY ===', facilityId);
    
    const pool = await poolPromise;
    const result = await pool.request()
      .input('FacilityID', sql.Int, facilityId)
      .query(`
        UPDATE Facility 
        SET Status = 'Deleted'
        OUTPUT INSERTED.*
        WHERE FacilityID = @FacilityID
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy cơ sở'
      });
    }

    console.log('✅ Facility deleted successfully');
    
    res.json({
      success: true,
      message: 'Xóa cơ sở thành công'
    });
  } catch (error) {
    console.error('❌ Delete facility error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi xóa cơ sở'
    });
  }
}

/**
 * Get facility availability
 */
async function getFacilityAvailability(req, res) {
  try {
    const { facilityId } = req.params;
    const { date } = req.query;
    
    console.log('=== GET FACILITY AVAILABILITY ===', facilityId, date);
    
    const pool = await poolPromise;
    
    // Get facility info first
    const facilityResult = await pool.request()
      .input('FacilityID', sql.Int, facilityId)
      .query(`
        SELECT FacilityID, FacilityName, AvailableHours
        FROM Facility 
        WHERE FacilityID = @FacilityID AND Status = 'Available'
      `);

    if (facilityResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy cơ sở'
      });
    }

    // Get bookings for the specified date
    let bookingsResult = { recordset: [] };
    if (date) {
      bookingsResult = await pool.request()
        .input('FacilityID', sql.Int, facilityId)
        .input('Date', sql.Date, date)
        .query(`
          SELECT StartTime, EndTime, Status
          FROM Booking 
          WHERE FacilityID = @FacilityID 
            AND CAST(StartTime AS DATE) = @Date
            AND Status IN ('Confirmed', 'Pending')
          ORDER BY StartTime
        `);
    }

    res.json({
      success: true,
      data: {
        facility: facilityResult.recordset[0],
        bookings: bookingsResult.recordset,
        date: date || new Date().toISOString().split('T')[0]
      }
    });
  } catch (error) {
    console.error('❌ Get facility availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy lịch trống của cơ sở'
    });
  }
}

module.exports = {
  getAllFacilities,
  getFacilityById,
  createFacility,
  updateFacility,
  deleteFacility,
  getFacilityAvailability
};