const { poolPromise } = require('../config/db');
const sql = require('mssql');

class InvoiceDAL {
  static async createInvoice(invoiceData) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();

      const { bookingId, totalAmount } = invoiceData;

      const result = await transaction.request()
        .input('BookingID', sql.Int, bookingId)
        .input('TotalAmount', sql.Decimal(10, 2), totalAmount)
        .input('Status', sql.VarChar, 'Pending')
        .query(`
          INSERT INTO Invoice (BookingID, CreatedDate, TotalAmount, Status)
          OUTPUT INSERTED.*
          VALUES (@BookingID, GETDATE(), @TotalAmount, @Status)
        `);

      await transaction.commit();
      return { success: true, data: result.recordset[0] };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async getInvoiceById(invoiceId) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('InvoiceID', sql.Int, invoiceId)
      .query(`
        SELECT i.*, 
               b.StartTime, b.EndTime, b.Deposit,
               sf.FieldName, sf.FieldType, sf.RentalPrice,
               f.FacilityName,
               st.SportName,
               a.AreaName,
               acc.Username, acc.FullName, acc.PhoneNumber, acc.Email
        FROM Invoice i
        JOIN Booking b ON i.BookingID = b.BookingID
        JOIN SportField sf ON b.FieldID = sf.FieldID
        JOIN Facility f ON sf.FacilityID = f.FacilityID
        JOIN SportType st ON sf.SportTypeID = st.SportTypeID
        JOIN Area a ON f.AreaID = a.AreaID
        JOIN Account acc ON b.CustomerID = acc.AccountID
        WHERE i.InvoiceID = @InvoiceID
      `);

    if (result.recordset.length === 0) return null;
    return { success: true, data: result.recordset[0] };
  }

  static async getInvoiceByBookingId(bookingId) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('BookingID', sql.Int, bookingId)
      .query(`
        SELECT i.*, 
               b.StartTime, b.EndTime, b.Deposit,
               sf.FieldName, sf.RentalPrice,
               f.FacilityName
        FROM Invoice i
        JOIN Booking b ON i.BookingID = b.BookingID
        JOIN SportField sf ON b.FieldID = sf.FieldID
        JOIN Facility f ON sf.FacilityID = f.FacilityID
        WHERE i.BookingID = @BookingID
      `);

    if (result.recordset.length === 0) return null;
    return { success: true, data: result.recordset[0] };
  }

  static async getInvoicesByCustomer(customerId, status = null, page = 1, limit = 20) {
    const pool = await poolPromise;
    const offset = (page - 1) * limit;

    let query = `
      SELECT i.*, 
             b.StartTime, b.EndTime,
             sf.FieldName,
             f.FacilityName,
             st.SportName
      FROM Invoice i
      JOIN Booking b ON i.BookingID = b.BookingID
      JOIN SportField sf ON b.FieldID = sf.FieldID
      JOIN Facility f ON sf.FacilityID = f.FacilityID
      JOIN SportType st ON sf.SportTypeID = st.SportTypeID
      WHERE b.CustomerID = @CustomerID
    `;

    const request = pool.request()
      .input('CustomerID', sql.Int, customerId)
      .input('Limit', sql.Int, limit)
      .input('Offset', sql.Int, offset);

    if (status) {
      query += ` AND i.Status = @Status`;
      request.input('Status', sql.VarChar, status);
    }

    query += `
      ORDER BY i.CreatedDate DESC
      OFFSET @Offset ROWS
      FETCH NEXT @Limit ROWS ONLY
    `;

    const result = await request.query(query);
    return { success: true, data: result.recordset };
  }

  static async getInvoicesByFacilityOwner(ownerId, status = null, page = 1, limit = 20) {
    const pool = await poolPromise;
    const offset = (page - 1) * limit;

    let query = `
      SELECT i.*, 
             b.StartTime, b.EndTime,
             sf.FieldName,
             f.FacilityName,
             acc.Username, acc.FullName
      FROM Invoice i
      JOIN Booking b ON i.BookingID = b.BookingID
      JOIN SportField sf ON b.FieldID = sf.FieldID
      JOIN Facility f ON sf.FacilityID = f.FacilityID
      JOIN Account acc ON b.CustomerID = acc.AccountID
      WHERE f.OwnerID = @OwnerID
    `;

    const request = pool.request()
      .input('OwnerID', sql.Int, ownerId)
      .input('Limit', sql.Int, limit)
      .input('Offset', sql.Int, offset);

    if (status) {
      query += ` AND i.Status = @Status`;
      request.input('Status', sql.VarChar, status);
    }

    query += `
      ORDER BY i.CreatedDate DESC
      OFFSET @Offset ROWS
      FETCH NEXT @Limit ROWS ONLY
    `;

    const result = await request.query(query);
    return { success: true, data: result.recordset };
  }

  static async updateInvoiceStatus(invoiceId, status) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('InvoiceID', sql.Int, invoiceId)
      .input('Status', sql.VarChar, status)
      .query(`
        UPDATE Invoice 
        SET Status = @Status
        OUTPUT INSERTED.*
        WHERE InvoiceID = @InvoiceID
      `);

    return { success: true, data: result.recordset[0] };
  }

  static async markAsPaid(invoiceId) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();

      const invoiceResult = await transaction.request()
        .input('InvoiceID', sql.Int, invoiceId)
        .query(`
          UPDATE Invoice 
          SET Status = 'Paid'
          OUTPUT INSERTED.BookingID
          WHERE InvoiceID = @InvoiceID AND Status = 'Pending'
        `);

      if (invoiceResult.recordset.length === 0) {
        await transaction.rollback();
        return { success: false, message: 'Invoice không thể được thanh toán' };
      }

      const bookingId = invoiceResult.recordset[0].BookingID;

      await transaction.request()
        .input('BookingID', sql.Int, bookingId)
        .query(`
          UPDATE Booking 
          SET Status = 'Confirmed'
          WHERE BookingID = @BookingID
        `);

      await transaction.commit();
      return { success: true, message: 'Thanh toán thành công' };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async processRefund(invoiceId, refundAmount, reason = null) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('InvoiceID', sql.Int, invoiceId)
      .query(`
        UPDATE Invoice 
        SET Status = 'Refunded'
        OUTPUT INSERTED.*
        WHERE InvoiceID = @InvoiceID AND Status = 'Paid'
      `);

    if (result.recordset.length === 0) {
      return { success: false, message: 'Không thể hoàn tiền cho invoice này' };
    }

    return { success: true, data: result.recordset[0] };
  }

  static async getRevenueStatistics(ownerId, startDate, endDate) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('OwnerID', sql.Int, ownerId)
      .input('StartDate', sql.Date, startDate)
      .input('EndDate', sql.Date, endDate)
      .query(`
        SELECT 
          COUNT(*) as TotalInvoices,
          SUM(CASE WHEN i.Status = 'Paid' THEN i.TotalAmount ELSE 0 END) as TotalRevenue,
          SUM(CASE WHEN i.Status = 'Pending' THEN i.TotalAmount ELSE 0 END) as PendingRevenue,
          SUM(CASE WHEN i.Status = 'Refunded' THEN i.TotalAmount ELSE 0 END) as RefundedAmount,
          CAST(i.CreatedDate AS DATE) as InvoiceDate
        FROM Invoice i
        JOIN Booking b ON i.BookingID = b.BookingID
        JOIN SportField sf ON b.FieldID = sf.FieldID
        JOIN Facility f ON sf.FacilityID = f.FacilityID
        WHERE f.OwnerID = @OwnerID
          AND CAST(i.CreatedDate AS DATE) BETWEEN @StartDate AND @EndDate
        GROUP BY CAST(i.CreatedDate AS DATE)
        ORDER BY InvoiceDate DESC
      `);

    return { success: true, data: result.recordset };
  }
}

module.exports = InvoiceDAL;
