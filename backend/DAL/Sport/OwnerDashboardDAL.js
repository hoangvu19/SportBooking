const { poolPromise } = require('../../config/db');
const sql = require('mssql');

class OwnerDashboardDAL {
  /**
   * Get monthly revenue statistics for owner's facilities
   */
  static async getMonthlyRevenue(ownerId, months = 12) {
    const pool = await poolPromise;
    
    console.log(`📊 Getting monthly revenue for owner ${ownerId}, last ${months} months`);
    
    const result = await pool.request()
      .input('OwnerID', sql.Int, ownerId)
      .input('Months', sql.Int, months)
      .query(`
        -- Generate all months in range
        WITH MonthRange AS (
          SELECT 
            DATEADD(MONTH, -n.Number, DATEADD(DAY, 1-DAY(GETDATE()), GETDATE())) as MonthStart
          FROM (
            SELECT TOP (@Months) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1 as Number
            FROM sys.all_columns
          ) n
        ),
        MonthlyData AS (
          SELECT 
            YEAR(b.StartTime) as Year,
            MONTH(b.StartTime) as Month,
            ISNULL(SUM(CASE WHEN b.Status IN ('Confirmed', 'Completed') 
                THEN ISNULL(b.TotalAmount, DATEDIFF(HOUR, b.StartTime, b.EndTime) * sf.RentalPrice)
                ELSE 0 END), 0) as Revenue,
            COUNT(DISTINCT b.BookingID) as TotalBookings,
            COUNT(DISTINCT CASE WHEN b.Status IN ('Confirmed', 'Completed') THEN b.BookingID END) as ConfirmedBookings
          FROM Booking b
          JOIN SportField sf ON b.FieldID = sf.FieldID
          JOIN Facility f ON sf.FacilityID = f.FacilityID
          WHERE f.OwnerID = @OwnerID
            AND b.StartTime >= DATEADD(MONTH, -@Months, GETDATE())
          GROUP BY YEAR(b.StartTime), MONTH(b.StartTime)
        )
        SELECT 
          YEAR(mr.MonthStart) as Year,
          MONTH(mr.MonthStart) as Month,
          ISNULL(md.Revenue, 0) as Revenue,
          ISNULL(md.TotalBookings, 0) as TotalBookings,
          ISNULL(md.ConfirmedBookings, 0) as ConfirmedBookings
        FROM MonthRange mr
        LEFT JOIN MonthlyData md ON YEAR(mr.MonthStart) = md.Year AND MONTH(mr.MonthStart) = md.Month
        ORDER BY Year ASC, Month ASC
      `);

    console.log(`✅ Monthly revenue data: ${result.recordset.length} months returned`);
    console.log('Sample data:', result.recordset.slice(0, 3));
    
    return result.recordset;
  }

  /**
   * Get revenue by facility/field
   */
  static async getRevenueByField(ownerId, startDate, endDate) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('OwnerID', sql.Int, ownerId)
      .input('StartDate', sql.Date, startDate)
      .input('EndDate', sql.Date, endDate)
      .query(`
        SELECT 
          f.FacilityID,
          f.FacilityName,
          sf.FieldID,
          sf.FieldName,
          sf.FieldType,
          st.SportName,
          COUNT(DISTINCT b.BookingID) as TotalBookings,
          SUM(CASE WHEN b.Status IN ('Confirmed', 'Completed') 
              THEN ISNULL(b.TotalAmount, DATEDIFF(HOUR, b.StartTime, b.EndTime) * sf.RentalPrice)
              ELSE 0 END) as Revenue,
          SUM(CASE WHEN b.Status = 'Confirmed' THEN 1 ELSE 0 END) as ConfirmedBookings,
          SUM(CASE WHEN b.Status = 'Cancelled' THEN 1 ELSE 0 END) as CancelledBookings,
          AVG(DATEDIFF(HOUR, b.StartTime, b.EndTime)) as AvgBookingDuration
        FROM Facility f
        JOIN SportField sf ON f.FacilityID = sf.FacilityID
        JOIN SportType st ON sf.SportTypeID = st.SportTypeID
        LEFT JOIN Booking b ON sf.FieldID = b.FieldID 
          AND b.StartTime >= @StartDate 
          AND b.EndTime <= @EndDate
        WHERE f.OwnerID = @OwnerID
        GROUP BY f.FacilityID, f.FacilityName, sf.FieldID, sf.FieldName, sf.FieldType, st.SportName
        ORDER BY Revenue DESC
      `);

    return result.recordset;
  }

  /**
   * Get booking trends by day of week
   */
  static async getBookingTrendsByDay(ownerId, startDate, endDate) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('OwnerID', sql.Int, ownerId)
      .input('StartDate', sql.Date, startDate)
      .input('EndDate', sql.Date, endDate)
      .query(`
        SELECT 
          DATEPART(WEEKDAY, b.StartTime) as DayOfWeek,
          DATENAME(WEEKDAY, b.StartTime) as DayName,
          COUNT(*) as TotalBookings,
          SUM(CASE WHEN b.Status IN ('Confirmed', 'Completed') 
              THEN ISNULL(b.TotalAmount, DATEDIFF(HOUR, b.StartTime, b.EndTime) * sf.RentalPrice)
              ELSE 0 END) as Revenue,
          AVG(CASE WHEN b.Status IN ('Confirmed', 'Completed') 
              THEN ISNULL(b.TotalAmount, DATEDIFF(HOUR, b.StartTime, b.EndTime) * sf.RentalPrice)
              ELSE 0 END) as AvgBookingValue
        FROM Booking b
        JOIN SportField sf ON b.FieldID = sf.FieldID
        JOIN Facility f ON sf.FacilityID = f.FacilityID
        WHERE f.OwnerID = @OwnerID
          AND b.StartTime >= @StartDate
          AND b.EndTime <= @EndDate
        GROUP BY DATEPART(WEEKDAY, b.StartTime), DATENAME(WEEKDAY, b.StartTime)
        ORDER BY DayOfWeek
      `);

    return result.recordset;
  }

  /**
   * Get peak hours analysis
   */
  static async getPeakHours(ownerId, startDate, endDate) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('OwnerID', sql.Int, ownerId)
      .input('StartDate', sql.Date, startDate)
      .input('EndDate', sql.Date, endDate)
      .query(`
        SELECT 
          DATEPART(HOUR, b.StartTime) as Hour,
          COUNT(*) as TotalBookings,
          SUM(CASE WHEN b.Status IN ('Confirmed', 'Completed') 
              THEN ISNULL(b.TotalAmount, DATEDIFF(HOUR, b.StartTime, b.EndTime) * sf.RentalPrice)
              ELSE 0 END) as Revenue,
          AVG(CASE WHEN b.Status IN ('Confirmed', 'Completed') 
              THEN ISNULL(b.TotalAmount, DATEDIFF(HOUR, b.StartTime, b.EndTime) * sf.RentalPrice)
              ELSE 0 END) as AvgBookingValue
        FROM Booking b
        JOIN SportField sf ON b.FieldID = sf.FieldID
        JOIN Facility f ON sf.FacilityID = f.FacilityID
        WHERE f.OwnerID = @OwnerID
          AND b.StartTime >= @StartDate
          AND b.EndTime <= @EndDate
        GROUP BY DATEPART(HOUR, b.StartTime)
        ORDER BY Hour
      `);

    return result.recordset;
  }

  /**
   * Get field utilization rate
   */
  static async getFieldUtilization(ownerId, startDate, endDate) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('OwnerID', sql.Int, ownerId)
      .input('StartDate', sql.Date, startDate)
      .input('EndDate', sql.Date, endDate)
      .query(`
        WITH FieldHours AS (
          SELECT 
            sf.FieldID,
            sf.FieldName,
            f.FacilityName,
            -- Total available hours in period (assuming 12 hours/day operation)
            DATEDIFF(DAY, @StartDate, @EndDate) * 12 as TotalAvailableHours,
            -- Total booked hours (all statuses except Cancelled)
            ISNULL(SUM(DATEDIFF(HOUR, b.StartTime, b.EndTime)), 0) as BookedHours
          FROM SportField sf
          JOIN Facility f ON sf.FacilityID = f.FacilityID
          LEFT JOIN Booking b ON sf.FieldID = b.FieldID
            AND b.StartTime >= @StartDate
            AND b.StartTime < @EndDate
            AND b.Status IN ('Confirmed', 'Pending', 'Completed')
          WHERE f.OwnerID = @OwnerID
          GROUP BY sf.FieldID, sf.FieldName, f.FacilityName
        )
        SELECT 
          FieldID,
          FieldName,
          FacilityName,
          TotalAvailableHours,
          BookedHours,
          CASE 
            WHEN TotalAvailableHours > 0 
            THEN CAST(BookedHours * 100.0 / TotalAvailableHours AS DECIMAL(5,2))
            ELSE 0 
          END as UtilizationRate
        FROM FieldHours
        ORDER BY UtilizationRate DESC
      `);

    return result.recordset;
  }

  /**
   * Get booking status distribution
   */
  static async getBookingStatusDistribution(ownerId, startDate, endDate) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('OwnerID', sql.Int, ownerId)
      .input('StartDate', sql.Date, startDate)
      .input('EndDate', sql.Date, endDate)
      .query(`
        SELECT 
          b.Status,
          COUNT(*) as Count,
          SUM(CASE WHEN b.Status IN ('Confirmed', 'Completed') 
              THEN ISNULL(b.TotalAmount, DATEDIFF(HOUR, b.StartTime, b.EndTime) * sf.RentalPrice)
              ELSE 0 END) as TotalAmount
        FROM Booking b
        JOIN SportField sf ON b.FieldID = sf.FieldID
        JOIN Facility f ON sf.FacilityID = f.FacilityID
        WHERE f.OwnerID = @OwnerID
          AND b.StartTime >= @StartDate
          AND b.EndTime <= @EndDate
        GROUP BY b.Status
        ORDER BY Count DESC
      `);

    return result.recordset;
  }

  /**
   * Get comprehensive dashboard summary
   */
  static async getDashboardSummary(ownerId) {
    const pool = await poolPromise;
    
    console.log(`📊 Getting dashboard summary for owner ${ownerId}`);
    
    // First, let's check if owner has any bookings at all
    const debugResult = await pool.request()
      .input('OwnerID', sql.Int, ownerId)
      .query(`
        SELECT 
          COUNT(*) as TotalBookings,
          COUNT(CASE WHEN b.Status = 'Confirmed' THEN 1 END) as ConfirmedBookings,
          COUNT(CASE WHEN b.Status = 'Completed' THEN 1 END) as CompletedBookings,
          SUM(CASE WHEN b.Status IN ('Confirmed', 'Completed') 
              THEN ISNULL(b.TotalAmount, DATEDIFF(HOUR, b.StartTime, b.EndTime) * sf.RentalPrice)
              ELSE 0 END) as TotalRevenue
        FROM Booking b
        JOIN SportField sf ON b.FieldID = sf.FieldID
        JOIN Facility f ON sf.FacilityID = f.FacilityID
        WHERE f.OwnerID = @OwnerID
      `);
    
    console.log('🔍 Owner booking stats:', debugResult.recordset[0]);
    
    // Get current month stats
    const result = await pool.request()
      .input('OwnerID', sql.Int, ownerId)
      .query(`
        DECLARE @StartOfMonth DATE = DATEADD(MONTH, DATEDIFF(MONTH, 0, GETDATE()), 0);
        DECLARE @EndOfMonth DATE = DATEADD(MONTH, 1, @StartOfMonth);
        DECLARE @StartOfLastMonth DATE = DATEADD(MONTH, -1, @StartOfMonth);
        DECLARE @EndOfLastMonth DATE = @StartOfMonth;

        SELECT 
          -- Current month
          (SELECT COUNT(*) FROM Booking b
           JOIN SportField sf ON b.FieldID = sf.FieldID
           JOIN Facility f ON sf.FacilityID = f.FacilityID
           WHERE f.OwnerID = @OwnerID
             AND b.StartTime >= @StartOfMonth
             AND b.StartTime < @EndOfMonth) as CurrentMonthBookings,
          
          (SELECT ISNULL(SUM(CASE WHEN b.Status IN ('Confirmed', 'Completed') 
                THEN ISNULL(b.TotalAmount, DATEDIFF(HOUR, b.StartTime, b.EndTime) * sf.RentalPrice)
                ELSE 0 END), 0)
           FROM Booking b
           JOIN SportField sf ON b.FieldID = sf.FieldID
           JOIN Facility f ON sf.FacilityID = f.FacilityID
           WHERE f.OwnerID = @OwnerID
             AND b.StartTime >= @StartOfMonth
             AND b.StartTime < @EndOfMonth) as CurrentMonthRevenue,
          
          -- Last month
          (SELECT COUNT(*) FROM Booking b
           JOIN SportField sf ON b.FieldID = sf.FieldID
           JOIN Facility f ON sf.FacilityID = f.FacilityID
           WHERE f.OwnerID = @OwnerID
             AND b.StartTime >= @StartOfLastMonth
             AND b.StartTime < @EndOfLastMonth) as LastMonthBookings,
          
          (SELECT ISNULL(SUM(CASE WHEN b.Status IN ('Confirmed', 'Completed') 
                THEN ISNULL(b.TotalAmount, DATEDIFF(HOUR, b.StartTime, b.EndTime) * sf.RentalPrice)
                ELSE 0 END), 0)
           FROM Booking b
           JOIN SportField sf ON b.FieldID = sf.FieldID
           JOIN Facility f ON sf.FacilityID = f.FacilityID
           WHERE f.OwnerID = @OwnerID
             AND b.StartTime >= @StartOfLastMonth
             AND b.StartTime < @EndOfLastMonth) as LastMonthRevenue,
          
          -- Total facilities and fields
          (SELECT COUNT(*) FROM Facility WHERE OwnerID = @OwnerID) as TotalFacilities,
          (SELECT COUNT(*) FROM SportField sf
           JOIN Facility f ON sf.FacilityID = f.FacilityID
           WHERE f.OwnerID = @OwnerID) as TotalFields,
          
          -- Pending bookings
          (SELECT COUNT(*) FROM Booking b
           JOIN SportField sf ON b.FieldID = sf.FieldID
           JOIN Facility f ON sf.FacilityID = f.FacilityID
           WHERE f.OwnerID = @OwnerID
             AND b.Status = 'Pending') as PendingBookings
      `);

    console.log('✅ Dashboard summary:', result.recordset[0]);
    return result.recordset[0];
  }

  /**
   * Get top customers by revenue
   */
  static async getTopCustomers(ownerId, startDate, endDate, limit = 10) {
    const pool = await poolPromise;
    
    console.log(`👥 Getting top customers for owner ${ownerId} from ${startDate} to ${endDate}`);
    
    const result = await pool.request()
      .input('OwnerID', sql.Int, ownerId)
      .input('StartDate', sql.Date, startDate)
      .input('EndDate', sql.Date, endDate)
      .input('Limit', sql.Int, limit)
      .query(`
        SELECT TOP (@Limit)
          acc.AccountID,
          acc.Username,
          acc.FullName,
          acc.PhoneNumber,
          COUNT(DISTINCT b.BookingID) as TotalBookings,
          COUNT(DISTINCT CASE WHEN b.Status = 'Confirmed' THEN b.BookingID END) as ConfirmedBookings,
          COUNT(DISTINCT CASE WHEN b.Status = 'Completed' THEN b.BookingID END) as CompletedBookings,
          COUNT(DISTINCT CASE WHEN b.Status = 'Cancelled' THEN b.BookingID END) as CancelledBookings,
          COUNT(DISTINCT CASE WHEN b.Status = 'Pending' THEN b.BookingID END) as PendingBookings,
          ISNULL(SUM(CASE WHEN b.Status IN ('Confirmed', 'Completed') 
              THEN ISNULL(b.TotalAmount, DATEDIFF(HOUR, b.StartTime, b.EndTime) * sf.RentalPrice)
              ELSE 0 END), 0) as TotalRevenue,
          MAX(b.StartTime) as LastBookingDate
        FROM Account acc
        JOIN Booking b ON acc.AccountID = b.CustomerID
        JOIN SportField sf ON b.FieldID = sf.FieldID
        JOIN Facility f ON sf.FacilityID = f.FacilityID
        WHERE f.OwnerID = @OwnerID
          AND b.StartTime >= @StartDate
          AND b.EndTime <= @EndDate
        GROUP BY acc.AccountID, acc.Username, acc.FullName, acc.PhoneNumber
        ORDER BY TotalRevenue DESC
      `);

    console.log(`✅ Top customers: ${result.recordset.length} records`);
    if (result.recordset.length > 0) {
      console.log('Sample:', result.recordset[0]);
    }
    
    return result.recordset;
  }
}

module.exports = OwnerDashboardDAL;
