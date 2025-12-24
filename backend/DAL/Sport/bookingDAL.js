/**
 * Booking Data Access Layer
 * Provides advanced data access methods for booking operations
 */
const { poolPromise } = require('../../config/db');
const sql = require('mssql');


class BookingDAL {
  /**
   * Get all bookings with pagination
   */
  static async getAll(page = 1, limit = 20) {
    try {
      const pool = await poolPromise;
      const offset = (page - 1) * limit;
      
      const result = await pool.request()
        .input('Offset', sql.Int, offset)
        .input('Limit', sql.Int, limit)
        .query(`
     SELECT b.*, 
       sf.FieldName, sf.FieldType, sf.RentalPrice,
       f.FacilityName,
       st.SportName,
       a.AreaName,
       acc.Username, acc.FullName, acc.Email, acc.PhoneNumber
          FROM Booking b
          JOIN SportField sf ON b.FieldID = sf.FieldID
          JOIN Facility f ON sf.FacilityID = f.FacilityID
          JOIN SportType st ON sf.SportTypeID = st.SportTypeID
          JOIN Area a ON f.AreaID = a.AreaID
          JOIN Account acc ON b.CustomerID = acc.AccountID
          ORDER BY b.StartTime DESC
          OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY
        `);
      
  // Return raw DB rows; model layer will instantiate Booking objects to avoid circular dependency
  return result.recordset;
    } catch (error) {
      console.error('BookingDAL.getAll error:', error);
      throw error;
    }
  }

  /**
   * Get booking by ID
   */
  static async getById(bookingId) {
    try {
      const pool = await poolPromise;
      
      const result = await pool.request()
        .input('BookingID', sql.Int, bookingId)
        .query(`
     SELECT b.*, 
       sf.FieldName, sf.FieldType, sf.RentalPrice,
       f.FacilityName,
       st.SportName,
       a.AreaName,
       acc.Username, acc.FullName, acc.Email, acc.PhoneNumber
          FROM Booking b
          JOIN SportField sf ON b.FieldID = sf.FieldID
          JOIN Facility f ON sf.FacilityID = f.FacilityID
          JOIN SportType st ON sf.SportTypeID = st.SportTypeID
          JOIN Area a ON f.AreaID = a.AreaID
          JOIN Account acc ON b.CustomerID = acc.AccountID
          WHERE b.BookingID = @BookingID
        `);
      
      if (result.recordset.length === 0) {
        return null;
      }

      // Return raw row object; model will wrap into Booking class
      return result.recordset[0];
    } catch (error) {
      console.error('BookingDAL.getById error:', error);
      throw error;
    }
  }

  /**
   * Get bookings by customer
   */
  static async getByCustomerId(customerId, page = 1, limit = 20) {
    try {
      const pool = await poolPromise;
      const offset = (page - 1) * limit;
      
      const result = await pool.request()
        .input('CustomerID', sql.Int, customerId)
        .input('Offset', sql.Int, offset)
        .input('Limit', sql.Int, limit)
        .query(`
     SELECT b.*, 
       sf.FieldName, sf.FieldType, sf.RentalPrice,
       f.FacilityName,
       st.SportName,
       a.AreaName,
       acc.Username, acc.FullName, acc.Email, acc.PhoneNumber
          FROM Booking b
          JOIN SportField sf ON b.FieldID = sf.FieldID
          JOIN Facility f ON sf.FacilityID = f.FacilityID
          JOIN SportType st ON sf.SportTypeID = st.SportTypeID
          JOIN Area a ON f.AreaID = a.AreaID
          JOIN Account acc ON b.CustomerID = acc.AccountID
          WHERE b.CustomerID = @CustomerID
          ORDER BY b.StartTime DESC
          OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY
        `);
      
  return result.recordset;
    } catch (error) {
      console.error('BookingDAL.getByCustomerId error:', error);
      throw error;
    }
  }

  /**
   * Get bookings by facility owner
   */
  static async getByFacilityOwner(ownerId, status = null, page = 1, limit = 100) {
    try {
      const pool = await poolPromise;
      const offset = (page - 1) * limit;
      // Use window functions to include total counts and aggregates so
      // the caller can present pagination and summary without an extra query.
      let query = `
SELECT b.*, 
  sf.FieldName, sf.FieldType, sf.RentalPrice,
  f.FacilityName, f.OwnerID,
  st.SportName,
  a.AreaName,
  acc.Username, acc.FullName, acc.Email, acc.PhoneNumber,
  COUNT(*) OVER() as TotalCount,
  SUM(CASE WHEN LOWER(RTRIM(LTRIM(b.Status))) = 'pending' THEN 1 ELSE 0 END) OVER() as PendingCount,
  SUM(CASE WHEN LOWER(RTRIM(LTRIM(b.Status))) = 'confirmed' THEN 1 ELSE 0 END) OVER() as ConfirmedCount,
  SUM(CASE WHEN LOWER(RTRIM(LTRIM(b.Status))) = 'cancelled' THEN 1 ELSE 0 END) OVER() as CancelledCount,
  SUM(CASE WHEN LOWER(RTRIM(LTRIM(b.Status))) = 'confirmed' THEN ISNULL(b.TotalAmount,0) ELSE 0 END) OVER() as TotalRevenue
   FROM Booking b
   JOIN SportField sf ON b.FieldID = sf.FieldID
   JOIN Facility f ON sf.FacilityID = f.FacilityID
   JOIN SportType st ON sf.SportTypeID = st.SportTypeID
   JOIN Area a ON f.AreaID = a.AreaID
   JOIN Account acc ON b.CustomerID = acc.AccountID
   WHERE f.OwnerID = @OwnerID
`;

      if (status) {
        query += ` AND b.Status = @Status`;
      }

      query += `
ORDER BY b.StartTime DESC
OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY
`;

      const request = pool.request()
        .input('OwnerID', sql.Int, ownerId)
        .input('Offset', sql.Int, offset)
        .input('Limit', sql.Int, limit);

      if (status) {
        request.input('Status', sql.NVarChar(50), status);
      }

      const result = await request.query(query);
      return result.recordset;
    } catch (error) {
      console.error('BookingDAL.getByFacilityOwner error:', error);
      throw error;
    }
  }

  /**
   * Create new booking
   */
  static async create(bookingData) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    
    try {
      await transaction.begin();
      
      console.log('💾 Creating booking with data:', bookingData);
      
      // Check for conflicts
      const conflictCheck = await transaction.request()
        .input('FieldID', sql.Int, bookingData.FieldID)
        .input('StartTime', sql.DateTime, new Date(bookingData.StartTime))
        .input('EndTime', sql.DateTime, new Date(bookingData.EndTime))
        .query(`
          SELECT COUNT(*) as ConflictCount
          FROM Booking
          WHERE FieldID = @FieldID 
            AND Status IN ('Confirmed', 'Pending')
            AND (
              (@StartTime >= StartTime AND @StartTime < EndTime) OR
              (@EndTime > StartTime AND @EndTime <= EndTime) OR
              (@StartTime <= StartTime AND @EndTime >= EndTime)
            )
        `);
      
      console.log('🔍 Conflict check result:', conflictCheck.recordset[0]);
      
      if (conflictCheck.recordset[0].ConflictCount > 0) {
        // Let the catch handler perform rollback to avoid double-rollback errors
        throw new Error('Khung giờ này đã được đặt. Vui lòng chọn khung giờ khác.');
      }
      
      console.log('✅ No conflicts, inserting booking...');
      
      const result = await transaction.request()
        .input('FieldID', sql.Int, bookingData.FieldID)
        .input('CustomerID', sql.Int, bookingData.CustomerID)
        .input('StartTime', sql.DateTime, new Date(bookingData.StartTime))
        .input('EndTime', sql.DateTime, new Date(bookingData.EndTime))
  .input('Status', sql.NVarChar(50), bookingData.Status || 'Pending')
        .input('Deposit', sql.Decimal(10, 2), bookingData.Deposit || 0)
        .query(`
          INSERT INTO Booking (FieldID, CustomerID, StartTime, EndTime, Status, Deposit)
          OUTPUT INSERTED.BookingID
          VALUES (@FieldID, @CustomerID, @StartTime, @EndTime, @Status, @Deposit)
        `);
      
      console.log('✅ Booking inserted, BookingID:', result.recordset[0].BookingID);
      
      await transaction.commit();
      
      const newBookingId = result.recordset[0].BookingID;
      const booking = await BookingDAL.getById(newBookingId);
      
      return {
        success: true,
        message: 'Booking created successfully',
        data: booking
      };
    } catch (error) {
      console.error('❌ BookingDAL.create error:', error.message);
      if (transaction && !transaction.aborted) {
        try {
          await transaction.rollback();
        } catch (rollbackError) {
          console.error('❌ Rollback error:', rollbackError.message);
        }
      }
      throw error;
    }
  }

  /**
   * Update booking status
   */
  static async updateStatus(bookingId, status) {
    try {
      const pool = await poolPromise;
      
      await pool.request()
        .input('BookingID', sql.Int, bookingId)
        .input('Status', sql.NVarChar(50), status)
        .query(`
          UPDATE Booking
          SET Status = @Status
          WHERE BookingID = @BookingID
        `);
      
      return await BookingDAL.getById(bookingId);
    } catch (error) {
      console.error('BookingDAL.updateStatus error:', error);
      throw error;
    }
  }

  /**
   * Cancel booking
   */
  static async cancel(bookingId) {
    return await BookingDAL.updateStatus(bookingId, 'Cancelled');
  }

  /**
   * Confirm booking
   */
  static async confirm(bookingId) {
    return await BookingDAL.updateStatus(bookingId, 'Confirmed');
  }

  /**
   * Complete booking
   */
  static async complete(bookingId) {
    return await BookingDAL.updateStatus(bookingId, 'Completed');
  }

  /**
   * Get booking analytics for facility owner
   */
  static async getBookingAnalytics(ownerId, period = 'month') {
    try {
      const pool = await poolPromise;
      
      let dateFilter = '';
      switch(period) {
        case 'week':
          dateFilter = 'DATEPART(week, b.StartTime) = DATEPART(week, GETDATE()) AND YEAR(b.StartTime) = YEAR(GETDATE())';
          break;
        case 'month':
          dateFilter = 'MONTH(b.StartTime) = MONTH(GETDATE()) AND YEAR(b.StartTime) = YEAR(GETDATE())';
          break;
        case 'year':
          dateFilter = 'YEAR(b.StartTime) = YEAR(GETDATE())';
          break;
        default:
          dateFilter = 'MONTH(b.StartTime) = MONTH(GETDATE()) AND YEAR(b.StartTime) = YEAR(GETDATE())';
      }
      
      const result = await pool.request()
        .input('OwnerID', sql.Int, ownerId)
        .query(`
          SELECT 
            COUNT(b.BookingID) as TotalBookings,
            COUNT(CASE WHEN b.Status = 'Confirmed' THEN 1 END) as ConfirmedBookings,
            COUNT(CASE WHEN b.Status = 'Pending' THEN 1 END) as PendingBookings,
            COUNT(CASE WHEN b.Status = 'Cancelled' THEN 1 END) as CancelledBookings,
            SUM(CASE WHEN b.Status = 'Confirmed' THEN sf.RentalPrice * DATEDIFF(HOUR, b.StartTime, b.EndTime) ELSE 0 END) as TotalRevenue,
            AVG(CASE WHEN b.Status = 'Confirmed' THEN sf.RentalPrice * DATEDIFF(HOUR, b.StartTime, b.EndTime) END) as AverageBookingValue,
            f.FacilityName,
            sf.FieldName
          FROM Booking b
          JOIN SportField sf ON b.FieldID = sf.FieldID
          JOIN Facility f ON sf.FacilityID = f.FacilityID
          WHERE f.OwnerID = @OwnerID AND ${dateFilter}
          GROUP BY f.FacilityID, f.FacilityName, sf.FieldID, sf.FieldName
          ORDER BY TotalRevenue DESC
        `);
      
      return { success: true, data: result.recordset };
    } catch (error) {
      console.error('BookingDAL.getBookingAnalytics error:', error);
      throw error;
    }
  }

  /**
   * Get peak hours analysis
   */
  static async getPeakHoursAnalysis(facilityId, startDate, endDate) {
    try {
      const pool = await poolPromise;
      
      const result = await pool.request()
        .input('FacilityID', sql.Int, facilityId)
        .input('StartDate', sql.Date, startDate)
        .input('EndDate', sql.Date, endDate)
        .query(`
          SELECT 
            DATEPART(HOUR, b.StartTime) as BookingHour,
            COUNT(*) as BookingCount,
            AVG(sf.RentalPrice * DATEDIFF(HOUR, b.StartTime, b.EndTime)) as AverageRevenue
          FROM Booking b
          JOIN SportField sf ON b.FieldID = sf.FieldID
          WHERE sf.FacilityID = @FacilityID 
            AND CAST(b.StartTime AS DATE) BETWEEN @StartDate AND @EndDate
            AND b.Status = 'Confirmed'
          GROUP BY DATEPART(HOUR, b.StartTime)
          ORDER BY BookingCount DESC
        `);
      
      return { success: true, data: result.recordset };
    } catch (error) {
      console.error('BookingDAL.getPeakHoursAnalysis error:', error);
      throw error;
    }
  }

  /**
   * Get customer booking patterns
   */
  static async getCustomerBookingPatterns(customerId) {
    try {
      const pool = await poolPromise;
      
      const result = await pool.request()
        .input('CustomerID', sql.Int, customerId)
        .query(`
          SELECT 
            COUNT(*) as TotalBookings,
            COUNT(CASE WHEN b.Status = 'Confirmed' THEN 1 END) as CompletedBookings,
            COUNT(CASE WHEN b.Status = 'Cancelled' THEN 1 END) as CancelledBookings,
            AVG(DATEDIFF(HOUR, b.StartTime, b.EndTime)) as AverageBookingDuration,
            st.SportName,
            COUNT(CASE WHEN st.SportTypeID = sf.SportTypeID THEN 1 END) as SportBookingCount
          FROM Booking b
          JOIN SportField sf ON b.FieldID = sf.FieldID
          JOIN SportType st ON sf.SportTypeID = st.SportTypeID
          WHERE b.CustomerID = @CustomerID
          GROUP BY st.SportTypeID, st.SportName
          ORDER BY SportBookingCount DESC
        `);
      
      return { success: true, data: result.recordset };
    } catch (error) {
      console.error('BookingDAL.getCustomerBookingPatterns error:', error);
      throw error;
    }
  }

  /**
   * Get booking conflicts for a time period
   */
  static async getBookingConflicts(fieldId, startDate, endDate) {
    try {
      const pool = await poolPromise;
      
      const result = await pool.request()
        .input('FieldID', sql.Int, fieldId)
        .input('StartDate', sql.DateTime, startDate)
        .input('EndDate', sql.DateTime, endDate)
        .query(`
          SELECT b.*, acc.Username, acc.FullName, acc.Email, acc.PhoneNumber
          FROM Booking b
          JOIN Account acc ON b.CustomerID = acc.AccountID
          WHERE b.FieldID = @FieldID 
            AND b.Status IN ('Confirmed', 'Pending')
            AND (
              (@StartDate >= b.StartTime AND @StartDate < b.EndTime) OR
              (@EndDate > b.StartTime AND @EndDate <= b.EndTime) OR
              (@StartDate <= b.StartTime AND @EndDate >= b.EndTime)
            )
          ORDER BY b.StartTime
        `);
      
      return { success: true, data: result.recordset };
    } catch (error) {
      console.error('BookingDAL.getBookingConflicts error:', error);
      throw error;
    }
  }

  /**
   * Get upcoming bookings with notifications
   */
  static async getUpcomingBookingsWithNotifications(hours = 24) {
    try {
      const pool = await poolPromise;
      
      const result = await pool.request()
        .input('Hours', sql.Int, hours)
        .query(`
     SELECT b.*, 
       sf.FieldName, 
       f.FacilityName,
       acc.Username, acc.FullName, acc.Email, acc.PhoneNumber,
       owner.Username as OwnerUsername, owner.Email as OwnerEmail, owner.PhoneNumber as OwnerPhoneNumber
          FROM Booking b
          JOIN SportField sf ON b.FieldID = sf.FieldID
          JOIN Facility f ON sf.FacilityID = f.FacilityID
          JOIN Account acc ON b.CustomerID = acc.AccountID
          JOIN Account owner ON f.OwnerID = owner.AccountID
          WHERE b.Status = 'Confirmed'
            AND b.StartTime BETWEEN GETDATE() AND DATEADD(HOUR, @Hours, GETDATE())
          ORDER BY b.StartTime
        `);
      
      return { success: true, data: result.recordset };
    } catch (error) {
      console.error('BookingDAL.getUpcomingBookingsWithNotifications error:', error);
      throw error;
    }
  }

  /**
   * Get monthly revenue trend
   */
  static async getMonthlyRevenueTrend(ownerId, months = 12) {
    try {
      const pool = await poolPromise;
      
      const result = await pool.request()
        .input('OwnerID', sql.Int, ownerId)
        .input('Months', sql.Int, months)
        .query(`
          SELECT 
            YEAR(b.StartTime) as BookingYear,
            MONTH(b.StartTime) as BookingMonth,
            COUNT(b.BookingID) as TotalBookings,
            SUM(CASE WHEN b.Status = 'Confirmed' THEN sf.RentalPrice * DATEDIFF(HOUR, b.StartTime, b.EndTime) ELSE 0 END) as MonthlyRevenue
          FROM Booking b
          JOIN SportField sf ON b.FieldID = sf.FieldID
          JOIN Facility f ON sf.FacilityID = f.FacilityID
          WHERE f.OwnerID = @OwnerID
            AND b.StartTime >= DATEADD(MONTH, -@Months, GETDATE())
          GROUP BY YEAR(b.StartTime), MONTH(b.StartTime)
          ORDER BY BookingYear DESC, BookingMonth DESC
        `);
      
      return { success: true, data: result.recordset };
    } catch (error) {
      console.error('BookingDAL.getMonthlyRevenueTrend error:', error);
      throw error;
    }
  }

  /**
   * Get field utilization rate
   */
  static async getFieldUtilizationRate(facilityId, startDate, endDate) {
    try {
      const pool = await poolPromise;
      
      const result = await pool.request()
        .input('FacilityID', sql.Int, facilityId)
        .input('StartDate', sql.Date, startDate)
        .input('EndDate', sql.Date, endDate)
        .query(`
          SELECT 
            sf.FieldID,
            sf.FieldName,
            sf.FieldType,
            st.SportName,
            COUNT(b.BookingID) as TotalBookings,
            SUM(DATEDIFF(HOUR, b.StartTime, b.EndTime)) as TotalBookedHours,
            DATEDIFF(DAY, @StartDate, @EndDate) * 12 as TotalAvailableHours, -- Assuming 12 hours per day
            CAST(SUM(DATEDIFF(HOUR, b.StartTime, b.EndTime)) as FLOAT) / 
            (DATEDIFF(DAY, @StartDate, @EndDate) * 12) * 100 as UtilizationRate
          FROM SportField sf
          JOIN SportType st ON sf.SportTypeID = st.SportTypeID
          LEFT JOIN Booking b ON sf.FieldID = b.FieldID 
            AND CAST(b.StartTime AS DATE) BETWEEN @StartDate AND @EndDate
            AND b.Status = 'Confirmed'
          WHERE sf.FacilityID = @FacilityID
          GROUP BY sf.FieldID, sf.FieldName, sf.FieldType, st.SportName
          ORDER BY UtilizationRate DESC
        `);
      
      return { success: true, data: result.recordset };
    } catch (error) {
      console.error('BookingDAL.getFieldUtilizationRate error:', error);
      throw error;
    }
  }

  /**
   * Get customer loyalty metrics
   */
  static async getCustomerLoyaltyMetrics(ownerId) {
    try {
      const pool = await poolPromise;
      
      const result = await pool.request()
        .input('OwnerID', sql.Int, ownerId)
        .query(`
          SELECT 
            acc.AccountID,
            acc.Username,
            acc.FullName,
            COUNT(b.BookingID) as TotalBookings,
            SUM(sf.RentalPrice * DATEDIFF(HOUR, b.StartTime, b.EndTime)) as TotalSpent,
            MIN(b.StartTime) as FirstBooking,
            MAX(b.StartTime) as LastBooking,
            DATEDIFF(DAY, MIN(b.StartTime), MAX(b.StartTime)) as CustomerLifetimeDays,
            COUNT(DISTINCT sf.FacilityID) as FacilitiesUsed
          FROM Account acc
          JOIN Booking b ON acc.AccountID = b.CustomerID
          JOIN SportField sf ON b.FieldID = sf.FieldID
          JOIN Facility f ON sf.FacilityID = f.FacilityID
          WHERE f.OwnerID = @OwnerID AND b.Status = 'Confirmed'
          GROUP BY acc.AccountID, acc.Username, acc.FullName
          HAVING COUNT(b.BookingID) > 1
          ORDER BY TotalSpent DESC, TotalBookings DESC
        `);
      
      return { success: true, data: result.recordset };
    } catch (error) {
      console.error('BookingDAL.getCustomerLoyaltyMetrics error:', error);
      throw error;
    }
  }

  /**
   * Get field availability for a given day
   * Delegates the availability query that was previously in the Booking model
   */
  static async getFieldAvailability(fieldId, date) {
    try {
      const pool = await poolPromise;
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const result = await pool.request()
        .input('FieldID', sql.Int, fieldId)
        .input('StartDate', sql.DateTime, startOfDay)
        .input('EndDate', sql.DateTime, endOfDay)
        .query(`
          SELECT BookingID, FieldID, StartTime, EndTime, Status
          FROM Booking
          WHERE FieldID = @FieldID
            AND Status IN ('Confirmed', 'Pending')
            AND StartTime >= @StartDate
            AND StartTime <= @EndDate
          ORDER BY StartTime
        `);

      return { success: true, data: result.recordset };
    } catch (error) {
      console.error('BookingDAL.getFieldAvailability error:', error);
      return { success: false, message: 'Could not fetch availability', error: error.message };
    }
  }

  /**
   * Get all customers who have booked at owner's facilities
   * @param {number} ownerId - Facility owner ID
   * @param {Object} filters - { search, page, limit }
   * @returns {Promise<Object>} List of customers with booking stats
   */
  static async getCustomersByOwner(ownerId, filters = {}) {
    try {
      const pool = await poolPromise;
      const { search = '', page = 1, limit = 20 } = filters;
      const offset = (page - 1) * limit;

      let query = `
        SELECT 
          acc.AccountID,
          acc.Username,
          acc.FullName,
          acc.Email,
          acc.PhoneNumber,
          acc.AvatarUrl,
          acc.Gender,
          acc.Address,
          acc.CreatedAt,
          COUNT(b.BookingID) as TotalBookings,
          SUM(CASE WHEN b.Status = 'Confirmed' THEN 1 ELSE 0 END) as CompletedBookings,
          SUM(CASE WHEN b.Status = 'Cancelled' THEN 1 ELSE 0 END) as CancelledBookings,
          SUM(CASE WHEN b.Status = 'Confirmed' THEN ISNULL(b.TotalAmount, 0) ELSE 0 END) as TotalSpent,
          MAX(b.StartTime) as LastBookingDate,
          MIN(b.StartTime) as FirstBookingDate
        FROM Account acc
        INNER JOIN Booking b ON acc.AccountID = b.CustomerID
        INNER JOIN SportField sf ON b.FieldID = sf.FieldID
        INNER JOIN Facility f ON sf.FacilityID = f.FacilityID
        WHERE f.OwnerID = @OwnerID
      `;

      if (search) {
        query += ` AND (acc.FullName LIKE @Search OR acc.Email LIKE @Search OR acc.Username LIKE @Search OR acc.PhoneNumber LIKE @Search)`;
      }

      query += `
        GROUP BY acc.AccountID, acc.Username, acc.FullName, acc.Email, acc.PhoneNumber, 
                 acc.AvatarUrl, acc.Gender, acc.Address, acc.CreatedAt
        ORDER BY TotalSpent DESC, TotalBookings DESC
        OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY
      `;

      const request = pool.request()
        .input('OwnerID', sql.Int, ownerId)
        .input('Offset', sql.Int, offset)
        .input('Limit', sql.Int, limit);

      if (search) {
        request.input('Search', sql.NVarChar, `%${search}%`);
      }

      const result = await request.query(query);

      // Get total count
      let countQuery = `
        SELECT COUNT(DISTINCT acc.AccountID) as Total
        FROM Account acc
        INNER JOIN Booking b ON acc.AccountID = b.CustomerID
        INNER JOIN SportField sf ON b.FieldID = sf.FieldID
        INNER JOIN Facility f ON sf.FacilityID = f.FacilityID
        WHERE f.OwnerID = @OwnerID
      `;

      if (search) {
        countQuery += ` AND (acc.FullName LIKE @Search OR acc.Email LIKE @Search OR acc.Username LIKE @Search OR acc.PhoneNumber LIKE @Search)`;
      }

      const countRequest = pool.request().input('OwnerID', sql.Int, ownerId);
      if (search) {
        countRequest.input('Search', sql.NVarChar, `%${search}%`);
      }

      const countResult = await countRequest.query(countQuery);

      return {
        success: true,
        data: result.recordset,
        pagination: {
          page,
          limit,
          total: countResult.recordset[0].Total,
          totalPages: Math.ceil(countResult.recordset[0].Total / limit)
        }
      };
    } catch (error) {
      console.error('BookingDAL.getCustomersByOwner error:', error);
      throw error;
    }
  }

  /**
   * Get customer booking history with a specific owner's facilities
   * @param {number} ownerId - Facility owner ID
   * @param {number} customerId - Customer ID
   * @param {Object} filters - { status, startDate, endDate, page, limit }
   * @returns {Promise<Object>} Customer's booking history
   */
  static async getCustomerBookingHistory(ownerId, customerId, filters = {}) {
    try {
      const pool = await poolPromise;
      const { status, startDate, endDate, page = 1, limit = 20 } = filters;
      const offset = (page - 1) * limit;

      let query = `
        SELECT 
          b.*,
          sf.FieldName,
          sf.FieldType,
          sf.RentalPrice,
          f.FacilityName,
          f.FacilityID,
          st.SportName,
          a.AreaName
        FROM Booking b
        INNER JOIN SportField sf ON b.FieldID = sf.FieldID
        INNER JOIN Facility f ON sf.FacilityID = f.FacilityID
        INNER JOIN SportType st ON sf.SportTypeID = st.SportTypeID
        INNER JOIN Area a ON f.AreaID = a.AreaID
        WHERE f.OwnerID = @OwnerID AND b.CustomerID = @CustomerID
      `;

      const request = pool.request()
        .input('OwnerID', sql.Int, ownerId)
        .input('CustomerID', sql.Int, customerId)
        .input('Offset', sql.Int, offset)
        .input('Limit', sql.Int, limit);

      if (status) {
        query += ` AND b.Status = @Status`;
        request.input('Status', sql.NVarChar(50), status);
      }

      if (startDate) {
        query += ` AND b.StartTime >= @StartDate`;
        request.input('StartDate', sql.DateTime, new Date(startDate));
      }

      if (endDate) {
        query += ` AND b.StartTime <= @EndDate`;
        request.input('EndDate', sql.DateTime, new Date(endDate));
      }

      query += `
        ORDER BY b.StartTime DESC
        OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY
      `;

      const result = await request.query(query);

      // Get total count
      let countQuery = `
        SELECT COUNT(*) as Total
        FROM Booking b
        INNER JOIN SportField sf ON b.FieldID = sf.FieldID
        INNER JOIN Facility f ON sf.FacilityID = f.FacilityID
        WHERE f.OwnerID = @OwnerID AND b.CustomerID = @CustomerID
      `;

      const countRequest = pool.request()
        .input('OwnerID', sql.Int, ownerId)
        .input('CustomerID', sql.Int, customerId);

      if (status) {
        countQuery += ` AND b.Status = @Status`;
        countRequest.input('Status', sql.NVarChar(50), status);
      }

      if (startDate) {
        countQuery += ` AND b.StartTime >= @StartDate`;
        countRequest.input('StartDate', sql.DateTime, new Date(startDate));
      }

      if (endDate) {
        countQuery += ` AND b.StartTime <= @EndDate`;
        countRequest.input('EndDate', sql.DateTime, new Date(endDate));
      }

      const countResult = await countRequest.query(countQuery);

      return {
        success: true,
        data: result.recordset,
        pagination: {
          page,
          limit,
          total: countResult.recordset[0].Total,
          totalPages: Math.ceil(countResult.recordset[0].Total / limit)
        }
      };
    } catch (error) {
      console.error('BookingDAL.getCustomerBookingHistory error:', error);
      throw error;
    }
  }

  /**
   * Get customer spending statistics
   * @param {number} ownerId - Facility owner ID
   * @param {number} customerId - Customer ID
   * @param {Object} filters - { startDate, endDate }
   * @returns {Promise<Object>} Customer spending statistics
   */
  static async getCustomerStats(ownerId, customerId, filters = {}) {
    try {
      const pool = await poolPromise;
      const { startDate, endDate } = filters;

      let query = `
        SELECT 
          COUNT(b.BookingID) as TotalBookings,
          SUM(CASE WHEN b.Status = 'Confirmed' THEN 1 ELSE 0 END) as CompletedBookings,
          SUM(CASE WHEN b.Status = 'Pending' THEN 1 ELSE 0 END) as PendingBookings,
          SUM(CASE WHEN b.Status = 'Cancelled' THEN 1 ELSE 0 END) as CancelledBookings,
          SUM(CASE WHEN b.Status = 'Confirmed' THEN ISNULL(b.TotalAmount, 0) ELSE 0 END) as TotalSpent,
          AVG(CASE WHEN b.Status = 'Confirmed' THEN ISNULL(b.TotalAmount, 0) ELSE NULL END) as AvgSpending,
          MAX(b.StartTime) as LastBookingDate,
          MIN(b.StartTime) as FirstBookingDate
        FROM Booking b
        INNER JOIN SportField sf ON b.FieldID = sf.FieldID
        INNER JOIN Facility f ON sf.FacilityID = f.FacilityID
        WHERE f.OwnerID = @OwnerID AND b.CustomerID = @CustomerID
      `;

      const request = pool.request()
        .input('OwnerID', sql.Int, ownerId)
        .input('CustomerID', sql.Int, customerId);

      if (startDate) {
        query += ` AND b.StartTime >= @StartDate`;
        request.input('StartDate', sql.DateTime, new Date(startDate));
      }

      if (endDate) {
        query += ` AND b.StartTime <= @EndDate`;
        request.input('EndDate', sql.DateTime, new Date(endDate));
      }

      const result = await request.query(query);

      // Get monthly spending trend (last 6 months)
      const trendQuery = `
        SELECT 
          FORMAT(b.StartTime, 'yyyy-MM') as Month,
          COUNT(b.BookingID) as BookingCount,
          SUM(CASE WHEN b.Status = 'Confirmed' THEN ISNULL(b.TotalAmount, 0) ELSE 0 END) as MonthlySpent
        FROM Booking b
        INNER JOIN SportField sf ON b.FieldID = sf.FieldID
        INNER JOIN Facility f ON sf.FacilityID = f.FacilityID
        WHERE f.OwnerID = @OwnerID 
          AND b.CustomerID = @CustomerID
          AND b.StartTime >= DATEADD(MONTH, -6, GETDATE())
        GROUP BY FORMAT(b.StartTime, 'yyyy-MM')
        ORDER BY Month DESC
      `;

      const trendResult = await pool.request()
        .input('OwnerID', sql.Int, ownerId)
        .input('CustomerID', sql.Int, customerId)
        .query(trendQuery);

      return {
        success: true,
        data: {
          summary: result.recordset[0],
          monthlyTrend: trendResult.recordset
        }
      };
    } catch (error) {
      console.error('BookingDAL.getCustomerStats error:', error);
      throw error;
    }
  }

  /**
   * Get user's booking history (for AI recommendations)
   * @param {number} accountId - Customer account ID
   * @returns {Array} Booking history with sport and facility info
   */
  static async getUserBookingHistory(accountId) {
    try {
      const pool = await poolPromise;
      
      const result = await pool.request()
        .input('CustomerID', sql.Int, accountId)
        .query(`
          SELECT b.BookingID,
                 b.StartTime,
                 b.EndTime,
                 b.Status,
                 b.TotalAmount,
                 sf.FieldID,
                 sf.SportTypeID,
                 sf.FacilityID,
                 st.SportName,
                 f.FacilityName
          FROM Booking b
          JOIN SportField sf ON b.FieldID = sf.FieldID
          LEFT JOIN SportType st ON sf.SportTypeID = st.SportTypeID
          LEFT JOIN Facility f ON sf.FacilityID = f.FacilityID
          WHERE b.CustomerID = @CustomerID
          ORDER BY b.StartTime DESC
        `);
      
      return result.recordset.map(row => ({
        BookingID: row.BookingID,
        StartTime: row.StartTime,
        EndTime: row.EndTime,
        Status: row.Status,
        TotalAmount: row.TotalAmount,
        FieldID: row.FieldID,
        SportTypeID: row.SportTypeID,
        FacilityID: row.FacilityID,
        SportName: row.SportName,
        FacilityName: row.FacilityName
      }));
    } catch (error) {
      console.error('BookingDAL.getUserBookingHistory error:', error);
      throw error;
    }
  }

  /**
   * Auto-cancel bookings which are still 'Pending' on or before their StartTime date.
   * This method will set Status = 'Cancelled' for bookings where
   * CAST(StartTime AS DATE) <= CAST(GETDATE() AS DATE) AND Status = 'Pending'.
   * Returns number of rows updated.
   */
  static async autoCancelPendingBookings() {
    try {
      const pool = await poolPromise;
      // First, find bookings that match (time-based check: StartTime <= GETDATE())
      // and status looks like pending (covering English/Vietnamese variants).
      const selectSql = `
        SELECT BookingID, StartTime, Status
        FROM Booking
        WHERE StartTime <= GETDATE()
          AND (
            LOWER(RTRIM(LTRIM(Status))) = 'pending'
            OR Status LIKE '%Pending%'
            OR LOWER(Status) LIKE '%pending%'
            OR Status LIKE N'%Chờ%'
            OR Status LIKE N'%đang chờ%'
          )
        ORDER BY StartTime DESC
      `;

      const selectRes = await pool.request().query(selectSql);
      const rows = selectRes.recordset || [];

      if (!rows.length) {
        return { success: true, updated: 0, ids: [] };
      }

      const ids = rows.map(r => r.BookingID);

      // Perform update using the same predicate to be safe
      const updateSql = `
        UPDATE Booking
        SET Status = 'Cancelled'
        WHERE StartTime <= GETDATE()
          AND (
            LOWER(RTRIM(LTRIM(Status))) = 'pending'
            OR Status LIKE '%Pending%'
            OR LOWER(Status) LIKE '%pending%'
            OR Status LIKE N'%Chờ%'
            OR Status LIKE N'%đang chờ%'
          )
      `;

      const updateRes = await pool.request().query(updateSql);
      const updatedCount = Array.isArray(updateRes.rowsAffected) ? updateRes.rowsAffected.reduce((a,b)=>a+(b||0),0) : (updateRes.rowsAffected || 0);

      return { success: true, updated: updatedCount, ids };
    } catch (error) {
      console.error('BookingDAL.autoCancelPendingBookings error:', error);
      return { success: false, error: error.message };
    }
  }
  static async createTransaction(transData) {
    try {
      const pool = await poolPromise;
      
      console.log('💰 Saving transaction:', transData);

      const result = await pool.request()
        .input('BookingID', sql.Int, transData.bookingId) // Khớp với cột BookingID
        .input('Amount', sql.Decimal(10, 2), transData.amount) // Khớp với DECIMAL(10,2)
        .input('PaymentMethod', sql.NVarChar(50), transData.paymentMethod || 'VNPAY')
        .input('TransactionRef', sql.NVarChar(100), transData.transactionRef)
        .input('Status', sql.NVarChar(50), transData.status || 'Pending')
        .input('Description', sql.NVarChar(255), transData.description)
        .query(`
          INSERT INTO Transactions 
          (BookingID, amount, payment_method, transaction_ref, status, description, created_at)
          VALUES 
          (@BookingID, @Amount, @PaymentMethod, @TransactionRef, @Status, @Description, GETDATE())
        `);

      return { success: true, message: 'Transaction saved successfully' };
    } catch (error) {
      console.error('❌ BookingDAL.createTransaction error:', error);
      // Không ném lỗi (throw) để tránh làm chết luồng chính nếu chỉ lỗi log transaction
      return { success: false, error: error.message };
    }
  }

  /**
   * (MỚI - Tùy chọn) Lấy thông tin giao dịch theo BookingID
   * Dùng để xem lịch sử thanh toán của đơn hàng
   */
  static async getTransactionByBookingId(bookingId) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('BookingID', sql.Int, bookingId)
        .query(`
          SELECT * FROM Transactions WHERE BookingID = @BookingID
        `);
      return result.recordset[0] || null;
    } catch (error) {
      console.error('BookingDAL.getTransactionByBookingId error:', error);
      return null;
    }
  }
  static async createTransaction(transData) {
    try {
      const pool = await poolPromise;
      
      console.log('💰 Saving transaction:', transData);

      const result = await pool.request()
        .input('BookingID', sql.Int, transData.bookingId) // Khớp với cột BookingID
        .input('Amount', sql.Decimal(10, 2), transData.amount) // Khớp với DECIMAL(10,2)
        .input('PaymentMethod', sql.NVarChar(50), transData.paymentMethod || 'VNPAY')
        .input('TransactionRef', sql.NVarChar(100), transData.transactionRef)
        .input('Status', sql.NVarChar(50), transData.status || 'Pending')
        .input('Description', sql.NVarChar(255), transData.description)
        .query(`
          INSERT INTO Transactions 
          (BookingID, amount, payment_method, transaction_ref, status, description, created_at)
          VALUES 
          (@BookingID, @Amount, @PaymentMethod, @TransactionRef, @Status, @Description, GETDATE())
        `);

      return { success: true, message: 'Transaction saved successfully' };
    } catch (error) {
      console.error('❌ BookingDAL.createTransaction error:', error);
      // Không ném lỗi (throw) để tránh làm chết luồng chính nếu chỉ lỗi log transaction
      return { success: false, error: error.message };
    }
  }

  /**
   * (MỚI - Tùy chọn) Lấy thông tin giao dịch theo BookingID
   * Dùng để xem lịch sử thanh toán của đơn hàng
   */
  static async getTransactionByBookingId(bookingId) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('BookingID', sql.Int, bookingId)
        .query(`
          SELECT * FROM Transactions WHERE BookingID = @BookingID
        `);
      return result.recordset[0] || null;
    } catch (error) {
      console.error('BookingDAL.getTransactionByBookingId error:', error);
      return null;
    }
  }

}

module.exports = BookingDAL;