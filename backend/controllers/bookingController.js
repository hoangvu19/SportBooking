/**
 * Booking Controller  
 * Handles court booking operations
 */
const BookingModel = require('../models/Booking');
const InvoiceModel = require('../models/Invoice');
const SportFieldModel = require('../models/SportField');

/**
 * Create new booking
 */
async function createBooking(req, res) {
  try {
    const { fieldId, startTime, endTime, deposit } = req.body;
    const customerId = req.user.AccountID;
    
    // Validate required fields
    if (!fieldId || !startTime || !endTime) {
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
      fieldId: parseInt(fieldId),
      customerId,
      startTime,
      endTime,
      deposit: deposit || 0
    });
    
    if (result.success) {
      // Calculate total amount and create invoice
      const calculation = InvoiceModel.calculateBookingAmount(
        startTime, 
        endTime, 
        field.RentalPrice, 
        deposit || 0
      );
      
      if (calculation.totalAmount > 0) {
        await InvoiceModel.createInvoice({
          bookingId: result.data.BookingID,
          totalAmount: calculation.totalAmount
        });
      }
      
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
    const { status, page = 1, limit = 20 } = req.query;
    
    const result = await BookingModel.getBookingsByFacilityOwner(
      ownerId, 
      status, 
      parseInt(page), 
      parseInt(limit)
    );
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Lấy danh sách booking của cơ sở thành công',
        data: result.data
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
    
    const result = await BookingModel.updateBookingStatus(parseInt(bookingId), 'Confirmed');
    
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
    
    const result = await BookingModel.getRevenueStats(ownerId, startDate, endDate);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Lấy thống kê doanh thu thành công',
        data: result.data
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