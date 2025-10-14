/**
 * Booking Model Class
 * Represents a Booking entity with all properties and business logic
 */
class Booking {
  constructor({ 
    BookingID, 
    FieldID, 
    CustomerID, 
    StartTime, 
    EndTime, 
    Status, 
    Deposit,
    TotalAmount,
    CreatedDate,
    FieldName,
    FieldType,
    RentalPrice,
    FacilityName,
    SportName,
    AreaName,
    Username,
    FullName,
    PhoneNumber,
    Email
  }) {
    this.BookingID = BookingID;
    this.FieldID = FieldID;
    this.CustomerID = CustomerID;
    this.StartTime = StartTime;
    this.EndTime = EndTime;
    this.Status = Status || 'Pending';
    this.Deposit = Deposit || 0;
    this.TotalAmount = TotalAmount;
    this.CreatedDate = CreatedDate;
    
    // Field information
    this.FieldName = FieldName;
    this.FieldType = FieldType;
    this.RentalPrice = RentalPrice;
    
    // Facility information
    this.FacilityName = FacilityName;
    this.SportName = SportName;
    this.AreaName = AreaName;
    
    // Customer information
    this.Username = Username;
    this.FullName = FullName;
    this.PhoneNumber = PhoneNumber;
    this.Email = Email;
  }

  /**
   * Convert to frontend-compatible format
   */
  toFrontendFormat() {
    return {
      _id: this.BookingID?.toString(),
      BookingID: this.BookingID,
      field: {
        _id: this.FieldID?.toString(),
        FieldID: this.FieldID,
        name: this.FieldName,
        type: this.FieldType,
        price: this.RentalPrice,
        facility: this.FacilityName,
        sport: this.SportName,
        area: this.AreaName
      },
      customer: {
        _id: this.CustomerID?.toString(),
        CustomerID: this.CustomerID,
        username: this.Username,
        full_name: this.FullName,
        phone: this.PhoneNumber,
        email: this.Email
      },
      start_time: this.StartTime,
      end_time: this.EndTime,
      status: this.Status,
      deposit: this.Deposit,
      total_amount: this.TotalAmount,
      created_date: this.CreatedDate
    };
  }

  /**
   * Validate booking data
   */
  static validate(bookingData) {
    const errors = [];
    
    if (!bookingData.FieldID) {
      errors.push('FieldID là bắt buộc');
    }
    
    if (!bookingData.CustomerID) {
      errors.push('CustomerID là bắt buộc');
    }
    
    if (!bookingData.StartTime) {
      errors.push('Thời gian bắt đầu là bắt buộc');
    }
    
    if (!bookingData.EndTime) {
      errors.push('Thời gian kết thúc là bắt buộc');
    }
    
    if (bookingData.StartTime && bookingData.EndTime) {
      const start = new Date(bookingData.StartTime);
      const end = new Date(bookingData.EndTime);
      
      if (end <= start) {
        errors.push('Thời gian kết thúc phải sau thời gian bắt đầu');
      }
      
      if (start < new Date()) {
        errors.push('Thời gian bắt đầu không được trong quá khứ');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Calculate duration in hours
   */
  getDuration() {
    if (!this.StartTime || !this.EndTime) return 0;
    
    const start = new Date(this.StartTime);
    const end = new Date(this.EndTime);
    const diffMs = end - start;
    const diffHours = diffMs / (1000 * 60 * 60);
    
    return diffHours;
  }

  /**
   * Calculate total amount based on duration and rental price
   */
  calculateTotalAmount() {
    if (!this.RentalPrice) return 0;
    
    const duration = this.getDuration();
    return duration * this.RentalPrice;
  }

  /**
   * Check if booking is confirmed
   */
  isConfirmed() {
    return this.Status === 'Confirmed';
  }

  /**
   * Check if booking is pending
   */
  isPending() {
    return this.Status === 'Pending';
  }

  /**
   * Check if booking is cancelled
   */
  isCancelled() {
    return this.Status === 'Cancelled';
  }

  /**
   * Check if booking is completed
   */
  isCompleted() {
    return this.Status === 'Completed';
  }

  /**
   * Check if booking time has passed
   */
  hasPassed() {
    if (!this.EndTime) return false;
    return new Date(this.EndTime) < new Date();
  }

  /**
   * Check if booking is upcoming
   */
  isUpcoming() {
    if (!this.StartTime) return false;
    return new Date(this.StartTime) > new Date();
  }

  /**
   * Check if booking is currently active
   */
  isActive() {
    if (!this.StartTime || !this.EndTime) return false;
    const now = new Date();
    return new Date(this.StartTime) <= now && now <= new Date(this.EndTime);
  }

  /**
   * Get status display text
   */
  getStatusText() {
    const statusMap = {
      'Pending': 'Chờ xác nhận',
      'Confirmed': 'Đã xác nhận',
      'Cancelled': 'Đã hủy',
      'Completed': 'Đã hoàn thành'
    };
    
    return statusMap[this.Status] || this.Status;
  }

  /**
   * Format time range as string
   */
  getTimeRangeText() {
    if (!this.StartTime || !this.EndTime) return '';
    
    const start = new Date(this.StartTime);
    const end = new Date(this.EndTime);
    
    const formatTime = (date) => {
      return date.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };
    
    return `${formatTime(start)} - ${formatTime(end)}`;
  }

  // ========== Static methods delegating to DAL ==========
  
  /**
   * Create new booking (delegates to DAL)
   */
  static async createBooking(bookingData) {
    const BookingDAL = require('../../DAL/Sport/bookingDAL');
    return BookingDAL.create(bookingData);
  }

  /**
   * Get booking by ID (delegates to DAL)
   */
  static async getBookingById(bookingId) {
    const BookingDAL = require('../../DAL/Sport/bookingDAL');
    const booking = await BookingDAL.getById(bookingId);
    return booking ? { success: true, data: booking } : { success: false, message: 'Booking not found' };
  }

  /**
   * Get bookings by customer (delegates to DAL)
   */
  static async getBookingsByCustomer(customerId, status = null, page = 1, limit = 20) {
    const BookingDAL = require('../../DAL/Sport/bookingDAL');
    const bookings = await BookingDAL.getByCustomerId(customerId, page, limit);
    
    // Filter by status if provided
    let filteredBookings = bookings;
    if (status) {
      filteredBookings = bookings.filter(b => b.Status === status);
    }
    
    return {
      success: true,
      data: filteredBookings,
      pagination: {
        page,
        limit,
        total: filteredBookings.length
      }
    };
  }

  /**
   * Cancel booking
   */
  static async cancelBooking(bookingId) {
    const BookingDAL = require('../../DAL/Sport/bookingDAL');
    const booking = await BookingDAL.cancel(bookingId);
    return { success: true, data: booking, message: 'Booking cancelled successfully' };
  }

  /**
   * Get field availability
   */
  static async getFieldAvailability(fieldId, date) {
    const BookingDAL = require('../../DAL/Sport/bookingDAL');
    // Delegate the availability lookup to the DAL
    return BookingDAL.getFieldAvailability(fieldId, date);
  }
}

module.exports = Booking;