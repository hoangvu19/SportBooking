const { poolPromise } = require('../../config/db');
const sql = require('mssql');

class SportFieldDAL {
  static async createSportField(fieldData) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    try {
      await transaction.begin();
      const { fieldName, fieldType, rentalPrice, status, facilityId, sportTypeId } = fieldData;
        const result = await transaction.request()
          .input('FieldName', sql.NVarChar, fieldName)
          .input('FieldType', sql.NVarChar, fieldType)
        .input('RentalPrice', sql.Decimal(10, 2), rentalPrice)
          .input('Status', sql.NVarChar, status || 'Available')
        .input('FacilityID', sql.Int, facilityId)
        .input('SportTypeID', sql.Int, sportTypeId)
        .query(`
          INSERT INTO SportField (FieldName, FieldType, RentalPrice, Status, FacilityID, SportTypeID)
          OUTPUT INSERTED.*
          VALUES (@FieldName, @FieldType, @RentalPrice, @Status, @FacilityID, @SportTypeID)
        `);

      await transaction.commit();
      return { success: true, data: result.recordset[0] };
    } catch (error) {
      try { await transaction.rollback(); } catch (e) { /* ignore */ }
      console.error('SportFieldDAL.createSportField error:', error);
      throw error;
    }
  }

  static async getAllSportFields(filters = {}) {
    const pool = await poolPromise;
    try {
      // Try to filter out soft-deleted rows if the column exists; if not, fall back to legacy query
      const baseSelect = `
        SELECT 
          sf.*, 
          f.FacilityName, 
          f.OwnerID,
          st.SportName, 
          a.AreaName,
          acc.AccountID as OwnerAccountID,
          acc.FullName as OwnerName,
          acc.AvatarUrl as OwnerAvatar,
          (SELECT TOP 1 COALESCE(URL, Data) FROM MediaAsset WHERE TargetType = 'SportField' AND TargetID = sf.FieldID ORDER BY UploadedDate DESC) as ImageUrl,
          (SELECT TOP 1 COALESCE(URL, Data) FROM MediaAsset WHERE TargetType = 'Facility' AND TargetID = f.FacilityID ORDER BY UploadedDate DESC) as FacilityImageUrl
        FROM SportField sf
        JOIN Facility f ON sf.FacilityID = f.FacilityID
        JOIN SportType st ON sf.SportTypeID = st.SportTypeID
        JOIN Area a ON f.AreaID = a.AreaID
        LEFT JOIN Account acc ON f.OwnerID = acc.AccountID
      `;
      let query = `${baseSelect} WHERE (sf.IsDeleted = 0 OR sf.IsDeleted IS NULL)`;

      const request = pool.request();

      if (filters.sportTypeId) {
        query += ' AND sf.SportTypeID = @SportTypeID';
        request.input('SportTypeID', sql.Int, parseInt(filters.sportTypeId));
      }

      if (filters.areaId) {
        query += ' AND a.AreaID = @AreaID';
        request.input('AreaID', sql.Int, parseInt(filters.areaId));
      }

      if (filters.status) {
        query += ' AND sf.Status = @Status';
          request.input('Status', sql.NVarChar, filters.status);
      }

      if (filters.searchTerm) {
        query += ' AND (sf.FieldName LIKE @SearchTerm OR f.FacilityName LIKE @SearchTerm)';
          request.input('SearchTerm', sql.NVarChar, `%${filters.searchTerm}%`);
      }

      query += ' ORDER BY f.FacilityName, sf.FieldName';

      let result;
      try {
        result = await request.query(query);
      } catch (err) {
        // If IsDeleted column doesn't exist, retry without the filter
        if (err && /is invalid column name 'IsDeleted'|Invalid column name 'IsDeleted'/i.test(err.message)) {
          query = `${baseSelect} WHERE 1=1`;
          result = await request.query(query);
        } else {
          throw err;
        }
      }
      return { success: true, data: result.recordset };
    } catch (error) {
      console.error('SportFieldDAL.getAllSportFields error:', error);
      throw error;
    }
  }

  static async getSportFieldById(fieldId) {
    const pool = await poolPromise;
    try {
      const baseQ = `
          SELECT 
            sf.*, 
            f.FacilityName, 
            f.OwnerID,
            st.SportName, 
            a.AreaName,
            acc.AccountID as OwnerAccountID,
            acc.FullName as OwnerName,
            acc.AvatarUrl as OwnerAvatar
          FROM SportField sf
          JOIN Facility f ON sf.FacilityID = f.FacilityID
          JOIN SportType st ON sf.SportTypeID = st.SportTypeID
          JOIN Area a ON f.AreaID = a.AreaID
          LEFT JOIN Account acc ON f.OwnerID = acc.AccountID
      `;
      let fieldResult;
      try {
        fieldResult = await pool.request().input('FieldID', sql.Int, fieldId).query(`${baseQ} WHERE sf.FieldID = @FieldID AND (sf.IsDeleted = 0 OR sf.IsDeleted IS NULL)`);
      } catch (err) {
        if (err && /is invalid column name 'IsDeleted'|Invalid column name 'IsDeleted'/i.test(err.message)) {
          fieldResult = await pool.request().input('FieldID', sql.Int, fieldId).query(`${baseQ} WHERE sf.FieldID = @FieldID`);
        } else throw err;
      }

      if (fieldResult.recordset.length === 0) return null;
      const field = fieldResult.recordset[0];

      const MediaAssetDAL = require('../Social/MediaAssetDAL');
      const imagesRows = await MediaAssetDAL.getByTarget('SportField', fieldId);
      const imagesResult = { recordset: imagesRows.map(r => ({ ImageUrl: r.URL, UploadedDate: r.UploadedDate, ImageID: r.MediaID })) };

      const bookingsResult = await pool.request()
        .input('FieldID', sql.Int, fieldId)
        .query(`
          SELECT StartTime, EndTime, Status
          FROM Booking
          WHERE FieldID = @FieldID 
            AND CAST(StartTime AS DATE) = CAST(GETDATE() AS DATE)
            AND Status IN ('Confirmed', 'Pending')
          ORDER BY StartTime
        `);

      field.images = imagesResult.recordset;
      field.todayBookings = bookingsResult.recordset;

      return { success: true, data: field };
    } catch (error) {
      console.error('SportFieldDAL.getSportFieldById error:', error);
      throw error;
    }
  }

  static async getSportFieldsByFacility(facilityId) {
    const pool = await poolPromise;
    try {
      const req = pool.request().input('FacilityID', sql.Int, facilityId);
      let result;
      try {
        result = await req.query(`SELECT sf.*, st.SportName FROM SportField sf JOIN SportType st ON sf.SportTypeID = st.SportTypeID WHERE sf.FacilityID = @FacilityID AND (sf.IsDeleted = 0 OR sf.IsDeleted IS NULL) ORDER BY sf.FieldName`);
      } catch (err) {
        if (err && /is invalid column name 'IsDeleted'|Invalid column name 'IsDeleted'/i.test(err.message)) {
          result = await req.query(`SELECT sf.*, st.SportName FROM SportField sf JOIN SportType st ON sf.SportTypeID = st.SportTypeID WHERE sf.FacilityID = @FacilityID ORDER BY sf.FieldName`);
        } else throw err;
      }

      // Attach media images for the returned fields (batch fetch to avoid N+1)
      const rows = result.recordset || [];
      if (rows.length > 0) {
        try {
          const MediaAssetDAL = require('../Social/MediaAssetDAL');
          const ids = rows.map(r => r.FieldID).filter(id => id != null);
          if (ids.length > 0) {
            const mediaRows = await MediaAssetDAL.getByTargets('SportField', ids);
            // group media by TargetID
            const byTarget = {};
            (mediaRows || []).forEach(m => {
              const tid = m.TargetID != null ? (isNaN(m.TargetID) ? m.TargetID : parseInt(m.TargetID)) : null;
              if (tid == null) return;
              if (!byTarget[tid]) byTarget[tid] = [];
              // Prefer URL, fall back to stored Data (base64 data URI), then other path fields
              const img = m.URL || m.Data || m.ImageUrl || m.Path || null;
              byTarget[tid].push({ ImageUrl: img, MediaID: m.MediaID || m.Id });
            });
            // attach images array to each row
            rows.forEach(r => {
              const id = r.FieldID;
              r.images = byTarget[id] || [];
            });
          }
        } catch (mediaErr) {
          console.error('Error fetching media for sport fields:', mediaErr);
          // non-fatal; continue without images
        }
      }

      return { success: true, data: rows };
    } catch (error) {
      console.error('SportFieldDAL.getSportFieldsByFacility error:', error);
      throw error;
    }
  }

  static async getSportFieldsByTypeAndArea(sportTypeId, areaId, searchTerm = null) {
    const pool = await poolPromise;
    try {
      const baseSelect = `
        SELECT sf.*, f.FacilityName, st.SportName, a.AreaName
        FROM SportField sf
        JOIN Facility f ON sf.FacilityID = f.FacilityID
        JOIN SportType st ON sf.SportTypeID = st.SportTypeID
        JOIN Area a ON f.AreaID = a.AreaID
      `;
      let query = `${baseSelect} WHERE sf.SportTypeID = @SportTypeID AND f.AreaID = @AreaID AND (sf.IsDeleted = 0 OR sf.IsDeleted IS NULL)`;

      const request = pool.request()
        .input('SportTypeID', sql.Int, sportTypeId)
        .input('AreaID', sql.Int, areaId);

      if (searchTerm) {
        query += ' AND (sf.FieldName LIKE @SearchTerm OR f.FacilityName LIKE @SearchTerm)';
          request.input('SearchTerm', sql.NVarChar, `%${searchTerm}%`);
      }

      query += ` ORDER BY f.FacilityName, sf.FieldName`;

      let result;
      try {
        result = await request.query(query);
      } catch (err) {
        if (err && /is invalid column name 'IsDeleted'|Invalid column name 'IsDeleted'/i.test(err.message)) {
          query = `${baseSelect} WHERE sf.SportTypeID = @SportTypeID AND f.AreaID = @AreaID`;
          result = await request.query(query);
        } else throw err;
      }

      return { success: true, data: result.recordset };
    } catch (error) {
      console.error('SportFieldDAL.getSportFieldsByTypeAndArea error:', error);
      throw error;
    }
  }

  static async updateSportField(fieldId, fieldData) {
    const pool = await poolPromise;
    try {
      const { fieldName, fieldType, rentalPrice, status, sportTypeId } = fieldData;
      const result = await pool.request()
        .input('FieldID', sql.Int, fieldId)
          .input('FieldName', sql.NVarChar, fieldName)
          .input('FieldType', sql.NVarChar, fieldType)
        .input('RentalPrice', sql.Decimal(10, 2), rentalPrice)
          .input('Status', sql.NVarChar, status)
        .input('SportTypeID', sql.Int, sportTypeId)
        .query(`
          UPDATE SportField 
          SET FieldName = @FieldName, 
              FieldType = @FieldType, 
              RentalPrice = @RentalPrice, 
              Status = @Status, 
              SportTypeID = @SportTypeID
          OUTPUT INSERTED.*
          WHERE FieldID = @FieldID
        `);

      return { success: true, data: result.recordset[0] };
    } catch (error) {
      console.error('SportFieldDAL.updateSportField error:', error);
      throw error;
    }
  }

  static async deleteSportField(fieldId) {
    const pool = await poolPromise;
    try {
      try {
        const result = await pool.request().input('FieldID', sql.Int, fieldId).query("UPDATE SportField SET IsDeleted = 1 WHERE FieldID = @FieldID");
        return { success: true, rowsAffected: result.rowsAffected[0] };
      } catch (err) {
        // If IsDeleted column doesn't exist, fall back to hard delete
        if (err && /is invalid column name 'IsDeleted'|Invalid column name 'IsDeleted'/i.test(err.message)) {
          const res = await pool.request().input('FieldID', sql.Int, fieldId).query('DELETE FROM SportField WHERE FieldID = @FieldID');
          return { success: true, rowsAffected: res.rowsAffected[0] };
        }
        throw err;
      }
    } catch (error) {
      console.error('SportFieldDAL.deleteSportField error:', error);
      throw error;
    }
  }

  static async addSportFieldImage(fieldId, imageUrl, accountId = null) {
    const created = await require('../Social/MediaAssetDAL').createMedia({ targetType: 'SportField', targetId: fieldId, url: imageUrl, mediaType: 'Image', accountId });
    return { success: true, data: created };
  }

  static async deleteSportFieldImage(imageId) {
    const deleted = await require('../Social/MediaAssetDAL').deleteById(imageId);
    return { success: true, rowsAffected: deleted ? 1 : 0 };
  }

  static async getFieldAvailability(fieldId, date) {
    const pool = await poolPromise;
    try {
      const result = await pool.request()
        .input('FieldID', sql.Int, fieldId)
        .input('Date', sql.Date, date)
        .query(`
          SELECT StartTime, EndTime, Status
          FROM Booking
          WHERE FieldID = @FieldID 
            AND CAST(StartTime AS DATE) = @Date
            AND Status IN ('Confirmed', 'Pending')
          ORDER BY StartTime
        `);

      return { success: true, data: result.recordset };
    } catch (error) {
      console.error('SportFieldDAL.getFieldAvailability error:', error);
      throw error;
    }
  }

  /**
   * Get all sport fields with optional booking statistics
   * Used by: AI recommendation system - trending analysis & field recommendations
   * @param {Object} options - Query options
   * @param {Number} options.limit - Maximum number of fields to return (default: 50)
   * @param {Boolean} options.includeBookingStats - Include booking statistics (default: false)
   * @returns {Array} Array of field objects with optional booking stats
   */
  static async getAllFields({ limit = 50, includeBookingStats = false } = {}) {
    const pool = await poolPromise;
    try {
      let query = `
        SELECT TOP (@Limit)
          sf.FieldID,
          sf.FieldName,
          sf.FieldType,
          sf.RentalPrice,
          sf.Status,
          sf.FacilityID,
          sf.SportTypeID,
          f.FacilityName,
          f.AreaID,
          st.SportName,
          a.AreaName
      `;

      if (includeBookingStats) {
        query += `,
          ISNULL((SELECT COUNT(*) FROM Booking WHERE FieldID = sf.FieldID AND Status IN ('Confirmed', 'Completed')), 0) as TotalBookings,
          ISNULL((SELECT COUNT(*) FROM Booking WHERE FieldID = sf.FieldID AND Status IN ('Confirmed', 'Completed') AND StartTime >= DATEADD(day, -7, GETDATE())), 0) as RecentBookings,
          ISNULL((SELECT AVG(CAST(Rating AS FLOAT)) FROM Rating WHERE FieldID = sf.FieldID), 0) as AverageRating
        `;
      }

      query += `
        FROM SportField sf
        JOIN Facility f ON sf.FacilityID = f.FacilityID
        JOIN SportType st ON sf.SportTypeID = st.SportTypeID
        JOIN Area a ON f.AreaID = a.AreaID
        WHERE sf.Status = 'Available'
        ORDER BY sf.FieldID DESC
      `;

      const result = await pool.request()
        .input('Limit', sql.Int, limit)
        .query(query);

      return result.recordset.map(field => ({
        fieldId: field.FieldID,
        fieldName: field.FieldName,
        fieldType: field.FieldType,
        rentalPrice: parseFloat(field.RentalPrice || 0),
        status: field.Status,
        facilityId: field.FacilityID,
        facilityName: field.FacilityName,
        sportTypeId: field.SportTypeID,
        sportName: field.SportName,
        areaId: field.AreaID,
        areaName: field.AreaName,
        ...(includeBookingStats && {
          totalBookings: field.TotalBookings || 0,
          recentBookings: field.RecentBookings || 0,
          averageRating: parseFloat(field.AverageRating || 0)
        })
      }));
    } catch (error) {
      console.error('SportFieldDAL.getAllFields error:', error);
      throw error;
    }
  }

  /**
   * Get available sport fields with filters
   * Used by: AI recommendation system - personalized field recommendations
   * @param {Object} filters - Filter criteria
   * @param {Number} filters.sportType - SportTypeID to filter by (optional)
   * @param {Object} filters.priceRange - Price range { min, max } (optional)
   * @param {Object} filters.timeSlot - Time slot { date, startTime, endTime } (optional)
   * @param {Number} filters.limit - Maximum number of fields (default: 50)
   * @returns {Array} Array of available field objects
   */
  static async getAvailableFields({ sportType, priceRange, timeSlot, limit = 50 } = {}) {
    const pool = await poolPromise;
    try {
      // Temporarily relax WHERE conditions to get ANY fields for AI recommendations
      let whereConditions = ["1=1"]; // Always true - gets all fields
      const request = pool.request();

      // Filter by sport type
      if (sportType) {
        whereConditions.push('sf.SportTypeID = @SportTypeID');
        request.input('SportTypeID', sql.Int, sportType);
      }

      // Filter by price range
      if (priceRange) {
        if (priceRange.min !== undefined) {
          whereConditions.push('sf.RentalPrice >= @MinPrice');
          request.input('MinPrice', sql.Decimal(10, 2), priceRange.min);
        }
        if (priceRange.max !== undefined) {
          whereConditions.push('sf.RentalPrice <= @MaxPrice');
          request.input('MaxPrice', sql.Decimal(10, 2), priceRange.max);
        }
      }

      // Build base query
      let query = `
        SELECT TOP (@Limit)
          sf.FieldID,
          sf.FieldName,
          sf.FieldType,
          sf.RentalPrice,
          sf.Status,
          sf.FacilityID,
          sf.SportTypeID,
          f.FacilityName,
          f.AreaID,
          st.SportName,
          a.AreaName,
          ISNULL((SELECT AVG(CAST(Rating AS FLOAT)) FROM Rating WHERE FieldID = sf.FieldID), 0) as AverageRating
      `;

      // Check availability for specific time slot
      if (timeSlot && timeSlot.date && timeSlot.startTime && timeSlot.endTime) {
        query += `,
          CASE 
            WHEN EXISTS (
              SELECT 1 FROM Booking 
              WHERE FieldID = sf.FieldID 
                AND CAST(StartTime AS DATE) = @Date
                AND Status IN ('Confirmed', 'Pending')
                AND (
                  (@StartTime BETWEEN StartTime AND EndTime) OR
                  (@EndTime BETWEEN StartTime AND EndTime) OR
                  (StartTime BETWEEN @StartTime AND @EndTime)
                )
            ) THEN 0
            ELSE 1
          END as IsAvailable
        `;
        request.input('Date', sql.Date, timeSlot.date);
        request.input('StartTime', sql.DateTime, timeSlot.startTime);
        request.input('EndTime', sql.DateTime, timeSlot.endTime);
      }

      query += `
        FROM SportField sf
        JOIN Facility f ON sf.FacilityID = f.FacilityID
        JOIN SportType st ON sf.SportTypeID = st.SportTypeID
        JOIN Area a ON f.AreaID = a.AreaID
        WHERE ${whereConditions.join(' AND ')}
      `;

      // If time slot specified, filter only available fields
      if (timeSlot && timeSlot.date) {
        query += `
        ORDER BY 
          CASE 
            WHEN EXISTS (
              SELECT 1 FROM Booking 
              WHERE FieldID = sf.FieldID 
                AND CAST(StartTime AS DATE) = @Date
                AND Status IN ('Confirmed', 'Pending')
            ) THEN 1
            ELSE 0
          END,
          sf.FieldID DESC
        `;
      } else {
        query += ' ORDER BY sf.FieldID DESC';
      }

      request.input('Limit', sql.Int, limit);
      const result = await request.query(query);

      return result.recordset.map(field => ({
        fieldId: field.FieldID,
        fieldName: field.FieldName,
        fieldType: field.FieldType,
        rentalPrice: parseFloat(field.RentalPrice || 0),
        status: field.Status,
        facilityId: field.FacilityID,
        facilityName: field.FacilityName,
        sportTypeId: field.SportTypeID,
        sportName: field.SportName,
        areaId: field.AreaID,
        areaName: field.AreaName,
        averageRating: parseFloat(field.AverageRating || 0),
        ...(timeSlot && timeSlot.date && { isAvailable: field.IsAvailable === 1 })
      }));
    } catch (error) {
      console.error('SportFieldDAL.getAvailableFields error:', error);
      throw error;
    }
  }
}

module.exports = SportFieldDAL;
