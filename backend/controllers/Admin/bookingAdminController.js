const { poolPromise } = require('../../config/db');
const sql = require('mssql');
const BookingModel = require('../../models/Sport/Booking');

/**
 * GET /api/admin/bookings/list
 * Query params: region, status, search, page, limit
 */
async function getAdminBookingList(req, res) {
  try {
    const { region, status, search, month, page = 1, limit = 20 } = req.query;
    const pool = await poolPromise;
    let query = `SELECT b.*, 
      COUNT(*) OVER() AS TotalCount,
      SUM(CASE WHEN b.Status = 'Pending' THEN 1 ELSE 0 END) OVER() AS PendingCount,
      SUM(CASE WHEN b.Status = 'Confirmed' THEN 1 ELSE 0 END) OVER() AS ConfirmedCount,
      SUM(CASE WHEN b.Status = 'Cancelled' THEN 1 ELSE 0 END) OVER() AS CancelledCount,
      sf.FieldName, sf.FieldType, sf.RentalPrice, f.FacilityName, st.SportName, a.AreaName, acc.Username, acc.FullName, acc.Email, acc.PhoneNumber
      FROM Booking b
      JOIN SportField sf ON b.FieldID = sf.FieldID
      JOIN Facility f ON sf.FacilityID = f.FacilityID
      JOIN SportType st ON sf.SportTypeID = st.SportTypeID
      JOIN Area a ON f.AreaID = a.AreaID
      JOIN Account acc ON b.CustomerID = acc.AccountID
      WHERE 1=1`;
    if (region && region !== 'All') {
      query += ` AND a.AreaName = @Region`;
    }
    if (status && status !== 'all') {
      query += ` AND b.Status = @Status`;
    }
    if (month) {
      // expect month in YYYY-MM format; filter by StartTime (database column)
      const parts = month.split('-');
      if (parts.length === 2) {
        const yr = parseInt(parts[0], 10);
        const mo = parseInt(parts[1], 10);
        query += ` AND YEAR(b.StartTime) = @Year AND MONTH(b.StartTime) = @Month`;
      }
    }
    if (search) {
      query += ` AND (
        acc.FullName LIKE @Search OR acc.Username LIKE @Search OR
        sf.FieldID LIKE @Search OR acc.AccountID LIKE @Search OR b.BookingID LIKE @Search
      )`;
    }
    query += ` ORDER BY b.StartTime DESC OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY`;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const request = pool.request()
      .input('Offset', sql.Int, offset)
      .input('Limit', sql.Int, parseInt(limit));
    if (region && region !== 'All') request.input('Region', sql.NVarChar(100), region);
    if (status && status !== 'all') request.input('Status', sql.NVarChar(50), status);
    if (search) request.input('Search', sql.NVarChar(100), `%${search}%`);
    if (month) {
      const parts = month.split('-');
      if (parts.length === 2) {
        request.input('Year', sql.Int, parseInt(parts[0], 10));
        request.input('Month', sql.Int, parseInt(parts[1], 10));
      }
    }
    const result = await request.query(query);
    // Map to frontend shape
    const rows = result.recordset || [];
    const data = rows.map(r => new BookingModel(r));
    const total = rows.length > 0 ? (rows[0].TotalCount || rows.length) : 0;
    const summary = rows.length > 0 ? {
      total: rows[0].TotalCount || rows.length,
      pending: rows[0].PendingCount || 0,
      confirmed: rows[0].ConfirmedCount || 0,
      cancelled: rows[0].CancelledCount || 0
    } : { total: 0, pending: 0, confirmed: 0, cancelled: 0 };

    res.json({ success: true, data, pagination: { page: parseInt(page), limit: parseInt(limit), total }, summary });
  } catch (err) {
    console.error('getAdminBookingList error', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * PUT /api/admin/bookings/:bookingId/status
 * Body: { status, invoiceId }
 */
async function updateBookingStatus(req, res) {
  try {
    const { bookingId } = req.params;
    const { status } = req.body;
    if (!status) return res.status(400).json({ success: false, message: 'Missing status' });
    const updated = await BookingModel.updateBookingStatus(parseInt(bookingId), status);
    res.json({ success: true, data: updated.data });
  } catch (err) {
    console.error('updateBookingStatus error', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getAdminBookingList,
  updateBookingStatus
};
