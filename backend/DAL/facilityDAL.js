const { poolPromise } = require('../config/db');
const sql = require('mssql');

class FacilityDAL {
  static async createFacility(facilityData) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();

      const { facilityName, areaId, ownerId } = facilityData;

      const result = await transaction.request()
        .input('FacilityName', sql.VarChar, facilityName)
        .input('AreaID', sql.Int, areaId)
        .input('OwnerID', sql.Int, ownerId)
        .query(`
          INSERT INTO Facility (FacilityName, AreaID, OwnerID, CreatedAt)
          OUTPUT INSERTED.*
          VALUES (@FacilityName, @AreaID, @OwnerID, GETDATE())
        `);

      await transaction.commit();
      return { success: true, data: result.recordset[0] };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async getFacilityById(facilityId) {
    const pool = await poolPromise;

    const facilityResult = await pool.request()
      .input('FacilityID', sql.Int, facilityId)
      .query(`
        SELECT f.*, a.AreaName, acc.Username as OwnerUsername, acc.FullName as OwnerFullName
        FROM Facility f
        JOIN Area a ON f.AreaID = a.AreaID
        JOIN Account acc ON f.OwnerID = acc.AccountID
        WHERE f.FacilityID = @FacilityID
      `);

    if (facilityResult.recordset.length === 0) return { success: false, data: null };

    const facility = facilityResult.recordset[0];

    const imagesResult = await pool.request()
      .input('FacilityID', sql.Int, facilityId)
      .query(`
        SELECT ImageUrl, UploadedDate
        FROM FacilityImage
        WHERE FacilityID = @FacilityID
        ORDER BY UploadedDate
      `);

    const fieldsResult = await pool.request()
      .input('FacilityID', sql.Int, facilityId)
      .query(`
        SELECT sf.*, st.SportName
        FROM SportField sf
        JOIN SportType st ON sf.SportTypeID = st.SportTypeID
        WHERE sf.FacilityID = @FacilityID
        ORDER BY sf.FieldName
      `);

    facility.images = imagesResult.recordset;
    facility.sportFields = fieldsResult.recordset;

    return { success: true, data: facility };
  }

  static async getFacilitiesByArea(areaId, sportTypeId = null, searchTerm = null) {
    const pool = await poolPromise;
    let query = `
      SELECT DISTINCT f.*, a.AreaName
      FROM Facility f
      JOIN Area a ON f.AreaID = a.AreaID
    `;

    const whereConditions = ['f.AreaID = @AreaID'];

    if (sportTypeId) {
      query += ` JOIN SportField sf ON f.FacilityID = sf.FacilityID`;
      whereConditions.push('sf.SportTypeID = @SportTypeID');
    }

    if (searchTerm) whereConditions.push('f.FacilityName LIKE @SearchTerm');

    query += ` WHERE ${whereConditions.join(' AND ')} ORDER BY f.FacilityName`;

    const request = pool.request().input('AreaID', sql.Int, areaId);
    if (sportTypeId) request.input('SportTypeID', sql.Int, sportTypeId);
    if (searchTerm) request.input('SearchTerm', sql.VarChar, `%${searchTerm}%`);

    const result = await request.query(query);
    return { success: true, data: result.recordset };
  }

  static async getAllFacilities(page = 1, limit = 20) {
    const pool = await poolPromise;
    const offset = (page - 1) * limit;

    const result = await pool.request()
      .input('Limit', sql.Int, limit)
      .input('Offset', sql.Int, offset)
      .query(`
        SELECT f.*, a.AreaName, acc.Username as OwnerUsername
        FROM Facility f
        JOIN Area a ON f.AreaID = a.AreaID
        JOIN Account acc ON f.OwnerID = acc.AccountID
        ORDER BY f.CreatedAt DESC
        OFFSET @Offset ROWS
        FETCH NEXT @Limit ROWS ONLY
      `);

    const countResult = await pool.request().query('SELECT COUNT(*) as TotalCount FROM Facility');

    return {
      success: true,
      data: result.recordset,
      pagination: {
        page,
        limit,
        total: countResult.recordset[0].TotalCount
      }
    };
  }

  static async getFacilitiesByOwner(ownerId) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('OwnerID', sql.Int, ownerId)
      .query(`
        SELECT f.*, a.AreaName
        FROM Facility f
        JOIN Area a ON f.AreaID = a.AreaID
        WHERE f.OwnerID = @OwnerID
        ORDER BY f.FacilityName
      `);

    return { success: true, data: result.recordset };
  }

  static async updateFacility(facilityId, facilityData) {
    const pool = await poolPromise;
    const { facilityName, areaId } = facilityData;

    const result = await pool.request()
      .input('FacilityID', sql.Int, facilityId)
      .input('FacilityName', sql.VarChar, facilityName)
      .input('AreaID', sql.Int, areaId)
      .query(`
        UPDATE Facility 
        SET FacilityName = @FacilityName, AreaID = @AreaID
        OUTPUT INSERTED.*
        WHERE FacilityID = @FacilityID
      `);

    return { success: true, data: result.recordset[0] };
  }

  static async deleteFacility(facilityId) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('FacilityID', sql.Int, facilityId)
      .query('DELETE FROM Facility WHERE FacilityID = @FacilityID');

    return { success: true, rowsAffected: result.rowsAffected[0] };
  }

  static async addFacilityImage(facilityId, imageUrl) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('FacilityID', sql.Int, facilityId)
      .input('ImageUrl', sql.VarChar, imageUrl)
      .query(`
        INSERT INTO FacilityImage (FacilityID, ImageUrl, UploadedDate)
        OUTPUT INSERTED.*
        VALUES (@FacilityID, @ImageUrl, GETDATE())
      `);

    return { success: true, data: result.recordset[0] };
  }

  static async deleteFacilityImage(imageId) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('ImageID', sql.Int, imageId)
      .query('DELETE FROM FacilityImage WHERE ImageID = @ImageID');

    return { success: true, rowsAffected: result.rowsAffected[0] };
  }
}

module.exports = FacilityDAL;
/**
 * Facility Data Access Layer
 * Provides data access methods for facility operations
 */
const { poolPromise } = require('../config/db');
const sql = require('mssql');

class FacilityDAL {
  /**
   * Search facilities with advanced filters
   */
  static async searchFacilities(searchParams) {
    try {
      const pool = await poolPromise;
      const { 
        searchTerm, 
        areaId, 
        sportTypeId, 
        minRating,
        priceRange,
        page = 1, 
        limit = 20 
      } = searchParams;
      
      const offset = (page - 1) * limit;
      
      let query = `
        SELECT DISTINCT f.*, a.AreaName,
               acc.Username as OwnerUsername, acc.FullName as OwnerFullName,
               AVG(CAST(fb.Rating as FLOAT)) as AverageRating,
               COUNT(fb.FeedbackID) as ReviewCount
        FROM Facility f
        JOIN Area a ON f.AreaID = a.AreaID
        JOIN Account acc ON f.OwnerID = acc.AccountID
        LEFT JOIN Feedback fb ON fb.TargetType = 'Facility' AND fb.TargetID = f.FacilityID
      `;
      
      let whereConditions = [];
      const request = pool.request();
      
      // Area filter
      if (areaId) {
        whereConditions.push('f.AreaID = @AreaID');
        request.input('AreaID', sql.Int, areaId);
      }
      
      // Sport type filter
      if (sportTypeId) {
        query += ` JOIN SportField sf ON f.FacilityID = sf.FacilityID`;
        whereConditions.push('sf.SportTypeID = @SportTypeID');
        request.input('SportTypeID', sql.Int, sportTypeId);
      }
      
      // Search term
      if (searchTerm) {
        whereConditions.push('f.FacilityName LIKE @SearchTerm');
        request.input('SearchTerm', sql.VarChar, `%${searchTerm}%`);
      }
      
      // Price range filter (based on sport fields)
      if (priceRange && priceRange.min !== undefined) {
        query += ` JOIN SportField sf2 ON f.FacilityID = sf2.FacilityID`;
        whereConditions.push('sf2.RentalPrice >= @MinPrice');
        request.input('MinPrice', sql.Decimal(10, 2), priceRange.min);
      }
      
      if (priceRange && priceRange.max !== undefined) {
        if (!query.includes('sf2')) {
          query += ` JOIN SportField sf2 ON f.FacilityID = sf2.FacilityID`;
        }
        whereConditions.push('sf2.RentalPrice <= @MaxPrice');
        request.input('MaxPrice', sql.Decimal(10, 2), priceRange.max);
      }
      
      if (whereConditions.length > 0) {
        query += ` WHERE ${whereConditions.join(' AND ')}`;
      }
      
      query += `
        GROUP BY f.FacilityID, f.FacilityName, f.AreaID, f.OwnerID, f.CreatedAt, 
                 a.AreaName, acc.Username, acc.FullName
      `;
      
      // Rating filter
      if (minRating) {
        query += ` HAVING AVG(CAST(fb.Rating as FLOAT)) >= @MinRating`;
        request.input('MinRating', sql.Float, minRating);
      }
      
      query += `
        ORDER BY AverageRating DESC, ReviewCount DESC, f.FacilityName
        OFFSET @Offset ROWS
        FETCH NEXT @Limit ROWS ONLY
      `;
      
      request.input('Limit', sql.Int, limit);
      request.input('Offset', sql.Int, offset);
      
      const result = await request.query(query);
      
      return { success: true, data: result.recordset };
    } catch (error) {
      console.error('FacilityDAL.searchFacilities error:', error);
      throw error;
    }
  }

  /**
   * Get facility statistics
   */
  static async getFacilityStatistics(facilityId) {
    try {
      const pool = await poolPromise;
      
      const result = await pool.request()
        .input('FacilityID', sql.Int, facilityId)
        .query(`
          SELECT 
            (SELECT COUNT(*) FROM SportField WHERE FacilityID = @FacilityID) as TotalFields,
            (SELECT COUNT(*) FROM Booking b 
             JOIN SportField sf ON b.FieldID = sf.FieldID 
             WHERE sf.FacilityID = @FacilityID AND b.Status = 'Confirmed') as TotalBookings,
            (SELECT COUNT(*) FROM Feedback WHERE TargetType = 'Facility' AND TargetID = @FacilityID) as TotalReviews,
            (SELECT AVG(CAST(Rating as FLOAT)) FROM Feedback WHERE TargetType = 'Facility' AND TargetID = @FacilityID) as AverageRating,
            (SELECT SUM(sf.RentalPrice * DATEDIFF(HOUR, b.StartTime, b.EndTime))
             FROM Booking b 
             JOIN SportField sf ON b.FieldID = sf.FieldID 
             WHERE sf.FacilityID = @FacilityID AND b.Status = 'Confirmed'
             AND MONTH(b.StartTime) = MONTH(GETDATE())
             AND YEAR(b.StartTime) = YEAR(GETDATE())) as MonthlyRevenue
        `);
      
      return { success: true, data: result.recordset[0] };
    } catch (error) {
      console.error('FacilityDAL.getFacilityStatistics error:', error);
      throw error;
    }
  }

  /**
   * Get nearby facilities
   */
  static async getNearbyFacilities(areaId, excludeFacilityId = null, limit = 5) {
    try {
      const pool = await poolPromise;
      
      let query = `
        SELECT TOP (@Limit) f.*, a.AreaName,
               AVG(CAST(fb.Rating as FLOAT)) as AverageRating,
               COUNT(fb.FeedbackID) as ReviewCount
        FROM Facility f
        JOIN Area a ON f.AreaID = a.AreaID
        LEFT JOIN Feedback fb ON fb.TargetType = 'Facility' AND fb.TargetID = f.FacilityID
        WHERE f.AreaID = @AreaID
      `;
      
      const request = pool.request()
        .input('AreaID', sql.Int, areaId)
        .input('Limit', sql.Int, limit);
      
      if (excludeFacilityId) {
        query += ` AND f.FacilityID != @ExcludeFacilityID`;
        request.input('ExcludeFacilityID', sql.Int, excludeFacilityId);
      }
      
      query += `
        GROUP BY f.FacilityID, f.FacilityName, f.AreaID, f.OwnerID, f.CreatedAt, a.AreaName
        ORDER BY AverageRating DESC, ReviewCount DESC
      `;
      
      const result = await request.query(query);
      
      return { success: true, data: result.recordset };
    } catch (error) {
      console.error('FacilityDAL.getNearbyFacilities error:', error);
      throw error;
    }
  }

  /**
   * Get popular facilities (most bookings)
   */
  static async getPopularFacilities(areaId = null, limit = 10) {
    try {
      const pool = await poolPromise;
      
      let query = `
        SELECT TOP (@Limit) f.*, a.AreaName,
               COUNT(b.BookingID) as BookingCount,
               AVG(CAST(fb.Rating as FLOAT)) as AverageRating
        FROM Facility f
        JOIN Area a ON f.AreaID = a.AreaID
        JOIN SportField sf ON f.FacilityID = sf.FacilityID
        LEFT JOIN Booking b ON sf.FieldID = b.FieldID AND b.Status = 'Confirmed'
        LEFT JOIN Feedback fb ON fb.TargetType = 'Facility' AND fb.TargetID = f.FacilityID
      `;
      
      const request = pool.request().input('Limit', sql.Int, limit);
      
      if (areaId) {
        query += ` WHERE f.AreaID = @AreaID`;
        request.input('AreaID', sql.Int, areaId);
      }
      
      query += `
        GROUP BY f.FacilityID, f.FacilityName, f.AreaID, f.OwnerID, f.CreatedAt, a.AreaName
        ORDER BY BookingCount DESC, AverageRating DESC
      `;
      
      const result = await request.query(query);
      
      return { success: true, data: result.recordset };
    } catch (error) {
      console.error('FacilityDAL.getPopularFacilities error:', error);
      throw error;
    }
  }

  /**
   * Bulk update facility status
   */
  static async bulkUpdateFacilityStatus(facilityIds, status) {
    try {
      const pool = await poolPromise;
      
      const facilityIdList = facilityIds.map(id => `'${id}'`).join(',');
      
      const result = await pool.request()
        .input('Status', sql.VarChar, status)
        .query(`
          UPDATE Facility 
          SET Status = @Status
          WHERE FacilityID IN (${facilityIdList})
        `);
      
      return { success: true, rowsAffected: result.rowsAffected[0] };
    } catch (error) {
      console.error('FacilityDAL.bulkUpdateFacilityStatus error:', error);
      throw error;
    }
  }
}

module.exports = FacilityDAL;