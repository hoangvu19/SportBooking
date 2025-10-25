/**
 * Booking Data Access Layer
 * Provides advanced data access methods for booking operations
 */
const { poolPromise } = require('../../config/db');
const sql = require('mssql');
const Booking = require('../../models/Sport/Booking');

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
                 acc.Username, acc.FullName, acc.Email
          FROM Booking b
          JOIN SportField sf ON b.FieldID = sf.FieldID
          JOIN Facility f ON sf.FacilityID = f.FacilityID
          JOIN SportType st ON sf.SportTypeID = st.SportTypeID
          JOIN Area a ON f.AreaID = a.AreaID
          JOIN Account acc ON b.CustomerID = acc.AccountID
          ORDER BY b.CreatedDate DESC
          OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY
        `);
      
      return result.recordset.map(row => new Booking(row));
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
                 acc.Username, acc.FullName, acc.Email
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
      
      return new Booking(result.recordset[0]);
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
                 acc.Username, acc.FullName, acc.Email
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
      
      return result.recordset.map(row => new Booking(row));
    } catch (error) {
      console.error('BookingDAL.getByCustomerId error:', error);
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
        .input('Status', sql.VarChar, status)
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
          SELECT b.*, acc.Username, acc.FullName, acc.Email
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
                 acc.Username, acc.FullName, acc.Email,
                 owner.Username as OwnerUsername, owner.Email as OwnerEmail
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
}

module.exports = BookingDAL;