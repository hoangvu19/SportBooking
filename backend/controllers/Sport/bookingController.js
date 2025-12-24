const BookingModel = require('../../models/Sport/Booking');
const InvoiceModel = require('../../models/Sport/Invoice');
const SportFieldModel = require('../../models/Sport/sportField');
const realtimeEmitter = require('../../lib/realtimeEmitter');

/**
 * Create new booking
 */
async function createBooking(req, res) {
  try {
    console.log('📦 Received booking request body:', JSON.stringify(req.body, null, 2));
    console.log('👤 User from token:', req.user);
    
    const { fieldId, startTime, endTime, deposit } = req.body;
    const customerId = req.user?.AccountID;
    
    // Validate required fields
    if (!fieldId || !startTime || !endTime) {
      console.log('❌ Validation failed:', { fieldId, startTime, endTime });
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin bắt buộc: sân, thời gian bắt đầu, thời gian kết thúc'
      });
    }
    
    // Validate time
    const start = new Date(startTime);
    const end = new Date(endTime);
    const now = new Date();
    
    if (start <= now) {
      return res.status(400).json({
        success: false,
        message: 'Thời gian đặt sân phải là trong tương lai'
      });
    }
    
    if (end <= start) {
      return res.status(400).json({
        success: false,
        message: 'Thời gian kết thúc phải sau thời gian bắt đầu'
      });
    }
    
    // Get field info for pricing
    const fieldResult = await SportFieldModel.getSportFieldById(fieldId);
    if (!fieldResult || !fieldResult.success) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sân'
      });
    }
    
    const field = fieldResult.data;
    
    // Create booking
    const result = await BookingModel.createBooking({
      FieldID: parseInt(fieldId),
      CustomerID: customerId,
      StartTime: startTime,
      EndTime: endTime,
      Deposit: deposit || 0
    });
    
    if (result.success) {
      // Calculate total amount and create invoice
      const calculation = InvoiceModel.calculateBookingAmount(
        startTime, 
        endTime, 
        field.RentalPrice, 
        deposit || 0
      );
      
      const totalAmount = calculation.totalAmount;
      
      // Update TotalAmount in booking record
      const { poolPromise } = require('../../config/db');
      const sql = require('mssql');
      const pool = await poolPromise;
      await pool.request()
        .input('BookingID', sql.Int, result.data.BookingID)
        .input('TotalAmount', sql.Decimal(18, 2), totalAmount)
        .query('UPDATE Booking SET TotalAmount = @TotalAmount WHERE BookingID = @BookingID');
      
      // Create invoice
      if (totalAmount > 0) {
        await InvoiceModel.createInvoice({
          bookingId: result.data.BookingID,
          totalAmount: totalAmount
        });
      }
      
      // Emit realtime event for new booking
      console.log('✅ Emitting booking:created event for BookingID:', result.data.BookingID);
      realtimeEmitter.emitEvent('booking:created', null, {
        booking: {
          ...result.data,
          TotalAmount: totalAmount,
          FieldID: parseInt(fieldId),
          CustomerID: customerId,
          StartTime: startTime,
          EndTime: endTime,
          CreatedDate: new Date().toISOString(), // Add timestamp
          FieldName: field.FieldName || field.TenSan,
          FacilityName: field.FacilityName || field.TenCoSo,
          SportTypeName: field.SportTypeName || field.MonTheThao
        }
      });
      
      res.status(201).json({
        success: true,
        message: 'Đặt sân thành công',
        data: {
          booking: result.data,
          pricing: calculation
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message || 'Không thể đặt sân'
      });
    }
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi đặt sân',
      error: error.message
    });
  }
}

/**
 * Get booking by ID
 */
async function getBookingById(req, res) {
  try {
    const { bookingId } = req.params;
    
    const result = await BookingModel.getBookingById(parseInt(bookingId));
    
    if (result && result.success) {
      // Check if user can view this booking
      const booking = result.data;
      const userId = req.user.AccountID;
      
      // User can view if they're the customer or the facility owner
      if (booking.CustomerID === userId || booking.OwnerID === userId || req.user.isAdmin) {
        res.json({
          success: true,
          message: 'Lấy thông tin booking thành công',
          data: booking
        });
      } else {
        res.status(403).json({
          success: false,
          message: 'Không có quyền xem booking này'
        });
      }
    } else {
      res.status(404).json({
        success: false,
        message: 'Không tìm thấy booking'
      });
    }
  } catch (error) {
    console.error('Get booking by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy thông tin booking',
      error: error.message
    });
  }
}

/**
 * Get user's bookings
 */
async function getMyBookings(req, res) {
  try {
    const customerId = req.user.AccountID;
    const { status, page = 1, limit = 20 } = req.query;
    
    const result = await BookingModel.getBookingsByCustomer(
      customerId, 
      status, 
      parseInt(page), 
      parseInt(limit)
    );
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Lấy danh sách booking thành công',
        data: result.data,
        pagination: result.pagination
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Không thể lấy danh sách booking'
      });
    }
  } catch (error) {
    console.error('Get my bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách booking',
      error: error.message
    });
  }
}

/**
 * Get bookings for facility owner
 */
async function getFacilityBookings(req, res) {
  try {
    const ownerId = req.user.AccountID;
    const { status, page = 1, limit } = req.query;

    // If client did not provide a limit (or provided 0/invalid),
    // default to a very large number so owner sees the full list.
    // We still accept client-specified pagination if desired.
    let parsedLimit = typeof limit !== 'undefined' ? parseInt(limit) : NaN;
    if (!parsedLimit || parsedLimit <= 0 || Number.isNaN(parsedLimit)) {
      parsedLimit = 100000; // effectively 'all' for typical datasets
    }

    const result = await BookingModel.getBookingsByFacilityOwner(
      ownerId,
      status,
      parseInt(page),
      parsedLimit
    );

    if (result.success) {
      // Return pagination info and summary so client can render counts
      res.json({
        success: true,
        message: 'Lấy danh sách booking của cơ sở thành công',
        data: result.data,
        pagination: result.pagination || { page: parseInt(page), limit: parsedLimit, total: result.data.length },
        summary: result.summary || null
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Không thể lấy danh sách booking của cơ sở'
      });
    }
  } catch (error) {
    console.error('Get facility bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách booking của cơ sở',
      error: error.message
    });
  }
}

/**
 * Confirm booking (facility owner only)
 */
async function confirmBooking(req, res) {
  try {
    const { bookingId } = req.params;
    const ownerId = req.user.AccountID;
    
    // First check if the user owns this facility
    const bookingResult = await BookingModel.getBookingById(parseInt(bookingId));
    if (!bookingResult || !bookingResult.success) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy booking'
      });
    }
    
    // TODO: Add facility owner check logic here
    
    const result = await BookingModel.updateBookingStatus(parseInt(bookingId), 'AwaitingPayment');
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Xác nhận booking thành công',
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Không thể xác nhận booking'
      });
    }
  } catch (error) {
    console.error('Confirm booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi xác nhận booking',
      error: error.message
    });
  }
}

/**
 * Cancel booking
 */
async function cancelBooking(req, res) {
  try {
    const { bookingId } = req.params;
    const userId = req.user.AccountID;
    
    const result = await BookingModel.cancelBooking(parseInt(bookingId), userId);
    
    if (result.success) {
      // Emit realtime event for cancelled booking
      console.log('✅ Emitting booking:cancelled event for BookingID:', bookingId);
      realtimeEmitter.emitEvent('booking:cancelled', null, {
        bookingId: parseInt(bookingId),
        booking: result.data
      });
      
      res.json({
        success: true,
        message: 'Hủy booking thành công',
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message || 'Không thể hủy booking'
      });
    }
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi hủy booking',
      error: error.message
    });
  }
}

/**
 * Get field availability
 */
async function getFieldAvailability(req, res) {
  try {
    const { fieldId } = req.params;
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin ngày'
      });
    }
    
    const result = await SportFieldModel.getFieldAvailability(parseInt(fieldId), date);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Lấy lịch trống của sân thành công',
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Không thể lấy lịch trống của sân'
      });
    }
  } catch (error) {
    console.error('Get field availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy lịch trống của sân',
      error: error.message
    });
  }
}

/**
 * Get revenue statistics (facility owner only)
 */
async function getRevenueStats(req, res) {
  try {
    const ownerId = req.user.AccountID;
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin ngày bắt đầu hoặc ngày kết thúc'
      });
    }
    
    // Use InvoiceModel for revenue aggregation (invoices/payments reflect actual revenue)
    const rev = await InvoiceModel.getRevenueStatistics(ownerId, startDate, endDate);

    if (rev) {
      // InvoiceModel returns raw aggregation; normalize response
      res.json({
        success: true,
        message: 'Lấy thống kê doanh thu thành công',
        data: rev
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Không thể lấy thống kê doanh thu'
      });
    }
  } catch (error) {
    console.error('Get revenue stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy thống kê doanh thu',
      error: error.message
    });
  }
}

module.exports = {
  createBooking,
  getBookingById,
  getMyBookings,
  getFacilityBookings,
  confirmBooking,
  cancelBooking,
  getFieldAvailability,
  getRevenueStats
};