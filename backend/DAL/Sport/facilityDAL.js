const { poolPromise } = require('../../config/db');
const sql = require('mssql');

class FacilityDAL {
  static async createFacility(facilityData) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();

      const { facilityName, areaId, ownerId } = facilityData;

        const result = await transaction.request()
          .input('FacilityName', sql.NVarChar, facilityName)
        .input('AreaID', sql.Int, areaId)
        .input('OwnerID', sql.Int, ownerId)
        .query(`
          -- Do not reference CreatedAt explicitly (schema may not include it)
          INSERT INTO Facility (FacilityName, AreaID, OwnerID)
          OUTPUT INSERTED.*
          VALUES (@FacilityName, @AreaID, @OwnerID)
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

    // Use unified MediaAsset for images
    const MediaAssetDAL = require('../Social/MediaAssetDAL');
    const imagesRows = await MediaAssetDAL.getByTarget('Facility', facilityId);
    const imagesResult = { recordset: imagesRows.map(r => ({ ImageUrl: r.URL, UploadedDate: r.UploadedDate, ImageID: r.MediaID })) };
    // Load sport fields; if DB doesn't have IsDeleted column, fall back to query without the filter
    let fieldsResult;
    try {
      fieldsResult = await pool.request()
        .input('FacilityID', sql.Int, facilityId)
        .query(`
          SELECT sf.*, st.SportName
          FROM SportField sf
          JOIN SportType st ON sf.SportTypeID = st.SportTypeID
          WHERE sf.FacilityID = @FacilityID AND (sf.IsDeleted = 0 OR sf.IsDeleted IS NULL)
          ORDER BY sf.FieldName
        `);
    } catch (err) {
      if (err && /is invalid column name 'IsDeleted'|Invalid column name 'IsDeleted'/i.test(err.message)) {
        fieldsResult = await pool.request()
          .input('FacilityID', sql.Int, facilityId)
          .query(`
            SELECT sf.*, st.SportName
            FROM SportField sf
            JOIN SportType st ON sf.SportTypeID = st.SportTypeID
            WHERE sf.FacilityID = @FacilityID
            ORDER BY sf.FieldName
          `);
      } else throw err;
    }

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
      if (searchTerm) request.input('SearchTerm', sql.NVarChar, `%${searchTerm}%`);

    const result = await request.query(query);
    return { success: true, data: result.recordset };
  }

  static async getAllFacilities(page = 1, limit = 20) {
    const pool = await poolPromise;
    const offset = (page - 1) * limit;
    const query = `
      SELECT f.FacilityID, f.FacilityName, f.AreaID, f.OwnerID, a.AreaName, acc.Username as OwnerUsername
      FROM Facility f
      JOIN Area a ON f.AreaID = a.AreaID
      JOIN Account acc ON f.OwnerID = acc.AccountID
      ORDER BY f.FacilityID DESC
      OFFSET @Offset ROWS
      FETCH NEXT @Limit ROWS ONLY
    `;

    // Run the main paginated query and the count query separately with granular logging
    const request = pool.request().input('Limit', sql.Int, limit).input('Offset', sql.Int, offset);

    let result;
    try {
      result = await request.query(query);
    } catch (err) {
      console.error('FacilityDAL.getAllFacilities - Failed main query');
      console.error('SQL:', query);
      console.error('Inputs: Limit=', limit, 'Offset=', offset);
      console.error('Error:', err && err.message ? err.message : err);

      // If the database schema is missing columns (CreatedAt), try a safer fallback
      if (err && err.message && err.message.includes('CreatedAt')) {
        try {
          console.warn('FacilityDAL.getAllFacilities - Falling back to simplified query due to missing CreatedAt');
          const fallbackQuery = `
            SELECT FacilityID, FacilityName, AreaID, OwnerID
            FROM Facility
            ORDER BY FacilityID DESC
            OFFSET @Offset ROWS
            FETCH NEXT @Limit ROWS ONLY
          `;

          const fallbackReq = pool.request().input('Limit', sql.Int, limit).input('Offset', sql.Int, offset);
          result = await fallbackReq.query(fallbackQuery);
        } catch (fallbackErr) {
          console.error('FacilityDAL.getAllFacilities - Fallback query failed:', fallbackErr && fallbackErr.message ? fallbackErr.message : fallbackErr);
          throw err; // throw original
        }
      } else {
        throw err;
      }
    }

    let totalCount = 0;
    try {
      const countResult = await pool.request().query('SELECT COUNT(*) as TotalCount FROM Facility');
      totalCount = countResult.recordset[0].TotalCount;
    } catch (err) {
      console.error('FacilityDAL.getAllFacilities - Failed count query');
      console.error("SQL: SELECT COUNT(*) as TotalCount FROM Facility");
      console.error('Error:', err && err.message ? err.message : err);
      throw err;
    }

    return {
      success: true,
      data: result.recordset,
      pagination: {
        page,
        limit,
        total: totalCount
      }
    };
  }

  static async getFacilitiesByOwner(ownerId) {
    const pool = await poolPromise;
    // First fetch facilities for the owner
    const facilitiesResult = await pool.request()
      .input('OwnerID', sql.Int, ownerId)
      .query(`
        SELECT f.*, a.AreaName
        FROM Facility f
        JOIN Area a ON f.AreaID = a.AreaID
        WHERE f.OwnerID = @OwnerID
        ORDER BY f.FacilityName
      `);

    const facilities = facilitiesResult.recordset || [];

    // If no facilities, return early
    if (!facilities || facilities.length === 0) return { success: true, data: [] };

    // Fetch sport fields for all facilities in one query to avoid N+1 requests
    const facilityIds = facilities.map(f => f.FacilityID).filter(Boolean);
    let fields = [];
    try {
      const idsList = facilityIds.join(',');
      const fieldsQueryWith = `
        SELECT sf.*, st.SportName
        FROM SportField sf
        JOIN SportType st ON sf.SportTypeID = st.SportTypeID
        WHERE sf.FacilityID IN (${idsList}) AND (sf.IsDeleted = 0 OR sf.IsDeleted IS NULL)
        ORDER BY sf.FieldName
      `;
      const fieldsQueryWithout = `
        SELECT sf.*, st.SportName
        FROM SportField sf
        JOIN SportType st ON sf.SportTypeID = st.SportTypeID
        WHERE sf.FacilityID IN (${idsList})
        ORDER BY sf.FieldName
      `;
      try {
        const fieldsResult = await pool.request().query(fieldsQueryWith);
        fields = fieldsResult.recordset || [];
      } catch (err) {
        if (err && /is invalid column name 'IsDeleted'|Invalid column name 'IsDeleted'/i.test(err.message)) {
          const fieldsResult = await pool.request().query(fieldsQueryWithout);
          fields = fieldsResult.recordset || [];
        } else {
          console.error('FacilityDAL.getFacilitiesByOwner - failed to load sport fields:', err && err.message ? err.message : err);
          fields = [];
        }
      }
    } catch (err) {
      // If the fields query fails, log and continue with empty arrays so we don't break owner listing
      console.error('FacilityDAL.getFacilitiesByOwner - failed to load sport fields:', err && err.message ? err.message : err);
      fields = [];
    }

    // Fetch media assets (images) for all facilities to attach thumbnails/counts
    let media = [];
    try {
      const MediaAssetDAL = require('../Social/MediaAssetDAL');
      // MediaAssetDAL.getByTargets expects array of target IDs
      media = await MediaAssetDAL.getByTargets('Facility', facilityIds.map(String));
    } catch (err) {
      console.error('FacilityDAL.getFacilitiesByOwner - failed to load media assets:', err && err.message ? err.message : err);
      media = [];
    }

    // Map media by facility id
    const mediaByFacility = {};
    (media || []).forEach(m => {
      const tid = m.TargetID || m.TargetId || m.TargetId;
      if (!tid) return;
      if (!mediaByFacility[tid]) mediaByFacility[tid] = [];
      mediaByFacility[tid].push(m);
    });

    // Map fields by facility id
    const fieldsByFacility = {};
    fields.forEach(ff => {
      const fid = ff.FacilityID;
      if (!fieldsByFacility[fid]) fieldsByFacility[fid] = [];
      fieldsByFacility[fid].push(ff);
    });

    // Attach sportFields and images array to each facility object
    const enriched = facilities.map(f => ({
      ...f,
      sportFields: fieldsByFacility[f.FacilityID] || [],
      images: mediaByFacility[String(f.FacilityID)] || []
    }));

    return { success: true, data: enriched };
  }

  static async updateFacility(facilityId, facilityData) {
    const pool = await poolPromise;
    const { facilityName, areaId } = facilityData;

    const result = await pool.request()
      .input('FacilityID', sql.Int, facilityId)
      .input('FacilityName', sql.NVarChar, facilityName)
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

  static async addFacilityImage(facilityId, imageUrl, accountId = null) {
    const created = await require('../Social/MediaAssetDAL').createMedia({ targetType: 'Facility', targetId: facilityId, url: imageUrl, mediaType: 'Image', accountId });
    return { success: true, data: created };
  }

  static async deleteFacilityImage(imageId) {
    const deleted = await require('../Social/MediaAssetDAL').deleteById(imageId);
    return { success: true, rowsAffected: deleted ? 1 : 0 };
  }

  // Advanced search with aggregation and filters
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
        SELECT f.FacilityID, f.FacilityName, f.AreaID, f.OwnerID,
               a.AreaName,
               acc.Username as OwnerUsername, acc.FullName as OwnerFullName,
               AVG(CAST(r.Rating as FLOAT)) as AverageRating,
               COUNT(fb.FeedbackID) as ReviewCount
  FROM Facility f
  JOIN Area a ON f.AreaID = a.AreaID
  JOIN Account acc ON f.OwnerID = acc.AccountID
  LEFT JOIN Feedback fb ON fb.TargetType = 'Facility' AND fb.TargetID = f.FacilityID
  LEFT JOIN Rating r ON r.TargetType = 'Facility' AND r.TargetID = f.FacilityID
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
          request.input('SearchTerm', sql.NVarChar, `%${searchTerm}%`);
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
        GROUP BY f.FacilityID, f.FacilityName, f.AreaID, f.OwnerID,
                 a.AreaName, acc.Username, acc.FullName
      `;

      // Rating filter
      if (minRating) {
        query += ` HAVING AVG(CAST(r.Rating as FLOAT)) >= @MinRating`;
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

  static async getFacilityStatistics(facilityId) {
    try {
      const pool = await poolPromise;
      
      // Try statistics including IsDeleted filter; fallback if column does not exist
      let result;
      try {
        result = await pool.request()
          .input('FacilityID', sql.Int, facilityId)
          .query(`
            SELECT 
              (SELECT COUNT(*) FROM SportField WHERE FacilityID = @FacilityID AND (IsDeleted = 0 OR IsDeleted IS NULL)) as TotalFields,
              (SELECT COUNT(*) FROM Booking b 
               JOIN SportField sf ON b.FieldID = sf.FieldID 
               WHERE sf.FacilityID = @FacilityID AND b.Status = 'Confirmed') as TotalBookings,
              (SELECT COUNT(*) FROM Feedback WHERE TargetType = 'Facility' AND TargetID = @FacilityID) as TotalReviews,
              (SELECT AVG(CAST(Rating as FLOAT)) FROM Rating WHERE TargetType = 'Facility' AND TargetID = @FacilityID) as AverageRating,
              (SELECT SUM(sf.RentalPrice * DATEDIFF(HOUR, b.StartTime, b.EndTime))
               FROM Booking b 
               JOIN SportField sf ON b.FieldID = sf.FieldID 
               WHERE sf.FacilityID = @FacilityID AND b.Status = 'Confirmed'
               AND MONTH(b.StartTime) = MONTH(GETDATE())
               AND YEAR(b.StartTime) = YEAR(GETDATE())) as MonthlyRevenue
          `);
      } catch (err) {
        if (err && /is invalid column name 'IsDeleted'|Invalid column name 'IsDeleted'/i.test(err.message)) {
          result = await pool.request()
            .input('FacilityID', sql.Int, facilityId)
            .query(`
              SELECT 
                (SELECT COUNT(*) FROM SportField WHERE FacilityID = @FacilityID) as TotalFields,
                (SELECT COUNT(*) FROM Booking b 
                 JOIN SportField sf ON b.FieldID = sf.FieldID 
                 WHERE sf.FacilityID = @FacilityID AND b.Status = 'Confirmed') as TotalBookings,
                (SELECT COUNT(*) FROM Feedback WHERE TargetType = 'Facility' AND TargetID = @FacilityID) as TotalReviews,
                (SELECT AVG(CAST(Rating as FLOAT)) FROM Rating WHERE TargetType = 'Facility' AND TargetID = @FacilityID) as AverageRating,
                (SELECT SUM(sf.RentalPrice * DATEDIFF(HOUR, b.StartTime, b.EndTime))
                 FROM Booking b 
                 JOIN SportField sf ON b.FieldID = sf.FieldID 
                 WHERE sf.FacilityID = @FacilityID AND b.Status = 'Confirmed'
                 AND MONTH(b.StartTime) = MONTH(GETDATE())
                 AND YEAR(b.StartTime) = YEAR(GETDATE())) as MonthlyRevenue
            `);
        } else throw err;
      }
      
      return { success: true, data: result.recordset[0] };
    } catch (error) {
      console.error('FacilityDAL.getFacilityStatistics error:', error);
      throw error;
    }
  }

  static async getNearbyFacilities(areaId, excludeFacilityId = null, limit = 5) {
    try {
      const pool = await poolPromise;
      
      let query = `
   SELECT TOP (@Limit) f.FacilityID, f.FacilityName, f.AreaID, f.OwnerID,
     a.AreaName,
     AVG(CAST(r.Rating as FLOAT)) as AverageRating,
     COUNT(fb.FeedbackID) as ReviewCount
   FROM Facility f
   JOIN Area a ON f.AreaID = a.AreaID
   LEFT JOIN Feedback fb ON fb.TargetType = 'Facility' AND fb.TargetID = f.FacilityID
   LEFT JOIN Rating r ON r.TargetType = 'Facility' AND r.TargetID = f.FacilityID
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
        GROUP BY f.FacilityID, f.FacilityName, f.AreaID, f.OwnerID, a.AreaName
        ORDER BY AverageRating DESC, ReviewCount DESC
      `;
      
      const result = await request.query(query);
      
      return { success: true, data: result.recordset };
    } catch (error) {
      console.error('FacilityDAL.getNearbyFacilities error:', error);
      throw error;
    }
  }

  static async getPopularFacilities(areaId = null, limit = 10) {
    try {
      const pool = await poolPromise;
      
      let query = `
   SELECT TOP (@Limit) f.FacilityID, f.FacilityName, f.AreaID, f.OwnerID,
     a.AreaName,
     COUNT(b.BookingID) as BookingCount,
     AVG(CAST(r.Rating as FLOAT)) as AverageRating
   FROM Facility f
   JOIN Area a ON f.AreaID = a.AreaID
   JOIN SportField sf ON f.FacilityID = sf.FacilityID
   LEFT JOIN Booking b ON sf.FieldID = b.FieldID AND b.Status = 'Confirmed'
   LEFT JOIN Feedback fb ON fb.TargetType = 'Facility' AND fb.TargetID = f.FacilityID
   LEFT JOIN Rating r ON r.TargetType = 'Facility' AND r.TargetID = f.FacilityID
      `;
      
      const request = pool.request().input('Limit', sql.Int, limit);
      
      if (areaId) {
        query += ` WHERE f.AreaID = @AreaID`;
        request.input('AreaID', sql.Int, areaId);
      }
      
      query += `
        GROUP BY f.FacilityID, f.FacilityName, f.AreaID, f.OwnerID, a.AreaName
        ORDER BY BookingCount DESC, AverageRating DESC
      `;
      
      const result = await request.query(query);
      
      return { success: true, data: result.recordset };
    } catch (error) {
      console.error('FacilityDAL.getPopularFacilities error:', error);
      throw error;
    }
  }

  static async bulkUpdateFacilityStatus(facilityIds, status) {
    try {
      const pool = await poolPromise;
      
      const facilityIdList = facilityIds.map(id => `'${id}'`).join(',');
      
      const result = await pool.request()
        .input('Status', sql.NVarChar(50), status)
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

  /**
   * Get all facilities with optional pagination and booking statistics
   * Used by: Controllers & AI recommendation system
   * @param {Number} page - Page number (1-based)
   * @param {Number} limit - Items per page
   * @param {Object} options - Additional options
   * @param {Boolean} options.includeBookingStats - Include booking statistics
   * @returns {Object} { success, data, pagination } or Array for backward compatibility
   */
  static async getAllFacilities(page = 1, limit = 20, { includeBookingStats = false } = {}) {
    const pool = await poolPromise;
    try {
      // Support both old signature (page, limit) and new signature (options object)
      let actualLimit = limit;
      let actualPage = page;
      let includeStats = includeBookingStats;
      
      // If first param is an object, use new signature and allow filters
      let filters = {};
      if (typeof page === 'object' && page !== null) {
        filters = page.filters || page || {};
        actualLimit = page.limit || 20;
        actualPage = 1; // No pagination in new signature
        includeStats = page.includeBookingStats || false;
      }
      
      const offset = (actualPage - 1) * actualLimit;
      
      let query = `
        SELECT 
          f.FacilityID,
          f.FacilityName,
          f.AreaID,
          f.OwnerID,
          a.AreaName,
          acc.Username as OwnerUsername,
          acc.FullName as OwnerFullName,
          (SELECT TOP 1 sf.SportTypeID FROM SportField sf WHERE sf.FacilityID = f.FacilityID) as SportTypeID,
          (SELECT TOP 1 st.SportName FROM SportField sf JOIN SportType st ON sf.SportTypeID = st.SportTypeID WHERE sf.FacilityID = f.FacilityID) as SportName,
            (SELECT TOP 1 COALESCE(ma.URL, ma.Data) FROM MediaAsset ma WHERE ma.TargetType = 'Facility' AND ma.TargetID = f.FacilityID ORDER BY ma.UploadedDate DESC) as FacilityImageUrl
      `;

      if (includeStats) {
        query += `,
          ISNULL((
            SELECT COUNT(*) 
            FROM Booking b 
            JOIN SportField sf ON b.FieldID = sf.FieldID 
            WHERE sf.FacilityID = f.FacilityID 
              AND b.Status IN ('Confirmed', 'Completed')
          ), 0) as TotalBookings,
          ISNULL((
            SELECT COUNT(*) 
            FROM Booking b 
            JOIN SportField sf ON b.FieldID = sf.FieldID 
            WHERE sf.FacilityID = f.FacilityID 
              AND b.Status IN ('Confirmed', 'Completed')
              AND b.StartTime >= DATEADD(day, -7, GETDATE())
          ), 0) as RecentBookings,
          ISNULL((
            SELECT AVG(CAST(Rating AS FLOAT)) 
            FROM Rating 
            WHERE TargetType = 'Facility' 
              AND TargetID = f.FacilityID
          ), 0) as AverageRating
        `;
      }

      query += `
        FROM Facility f
        JOIN Area a ON f.AreaID = a.AreaID
        LEFT JOIN Account acc ON f.OwnerID = acc.AccountID
      `;

      // Apply filters from filters object when provided
      const whereClauses = [];
      if (filters.areaId) {
        whereClauses.push('f.AreaID = @AreaID');
      }
      if (filters.sportTypeId) {
        // ensure facility has at least one field of this sport type
        whereClauses.push("EXISTS(SELECT 1 FROM SportField sf WHERE sf.FacilityID = f.FacilityID AND sf.SportTypeID = @SportTypeID)");
      }
      if (filters.searchTerm) {
        whereClauses.push('(f.FacilityName LIKE @SearchTerm)');
      }
      if (filters.ownerId) {
        whereClauses.push('f.OwnerID = @OwnerID');
      }

      if (whereClauses.length > 0) {
        query += '\n WHERE ' + whereClauses.join(' AND ');
      }

      query += `\n        ORDER BY f.FacilityID DESC\n        OFFSET @Offset ROWS\n        FETCH NEXT @Limit ROWS ONLY\n      `;

      const result = await pool.request()
        .input('Offset', sql.Int, offset)
        .input('Limit', sql.Int, actualLimit)
        .query(query);

      // Get total count for pagination
      const countResult = await pool.request().query('SELECT COUNT(*) as total FROM Facility');
      const total = countResult.recordset[0].total;

      const facilities = result.recordset.map(facility => ({
        FacilityID: facility.FacilityID,
        FacilityName: facility.FacilityName,
        AreaID: facility.AreaID,
        AreaName: facility.AreaName,
        OwnerID: facility.OwnerID,
        OwnerUsername: facility.OwnerUsername || null,
        OwnerFullName: facility.OwnerFullName || null,
        SportTypeID: facility.SportTypeID || null,
        SportName: facility.SportName || '',
        FacilityImageUrl: facility.FacilityImageUrl || null,
        // provide images array for backward-compatible frontend usage
        images: facility.FacilityImageUrl ? [{ ImageUrl: facility.FacilityImageUrl }] : [],
        ...(includeStats && {
          TotalBookings: facility.TotalBookings || 0,
          RecentBookings: facility.RecentBookings || 0,
          AverageRating: parseFloat(facility.AverageRating || 0)
        })
      }));

      // Return with pagination info for controller use
      return {
        success: true,
        data: facilities,
        pagination: {
          page: actualPage,
          limit: actualLimit,
          total,
          totalPages: Math.ceil(total / actualLimit)
        }
      };
    } catch (error) {
      console.error('FacilityDAL.getAllFacilities error:', error);
      throw error;
    }
  }
}

module.exports = FacilityDAL;
