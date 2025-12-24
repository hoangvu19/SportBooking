/**
 * Facility Policy Model
 * Chính sách của chủ sân (hủy, thay đổi lịch, v.v.)
 */
const { poolPromise, sql } = require('../../config/db');

class FacilityPolicy {
  constructor({
    PolicyID,
    FacilityID,
    CancellationPolicy,
    ReschedulePolicy,
    MinAdvanceBooking,
    MaxAdvanceBooking,
    DepositPercentage,
    RefundPercentage,
    CancellationDeadlineHours,
    RescheduleDeadlineHours,
    AutoConfirmBooking,
    CreatedAt,
    UpdatedAt
  }) {
    this.PolicyID = PolicyID;
    this.FacilityID = FacilityID;
    this.CancellationPolicy = CancellationPolicy;
    this.ReschedulePolicy = ReschedulePolicy;
    this.MinAdvanceBooking = MinAdvanceBooking || 1; // Tối thiểu đặt trước (giờ)
    this.MaxAdvanceBooking = MaxAdvanceBooking || 720; // Tối đa đặt trước (giờ) = 30 ngày
    this.DepositPercentage = DepositPercentage || 30; // % cọc
    this.RefundPercentage = RefundPercentage || 0; // % hoàn tiền khi hủy
    this.CancellationDeadlineHours = CancellationDeadlineHours || 24; // Hạn hủy (giờ)
    this.RescheduleDeadlineHours = RescheduleDeadlineHours || 12; // Hạn đổi lịch (giờ)
    this.AutoConfirmBooking = AutoConfirmBooking || false; // Tự động xác nhận
    this.CreatedAt = CreatedAt;
    this.UpdatedAt = UpdatedAt;
  }

  /**
   * Tạo chính sách mới
   */
  static async create(policyData) {
    try {
      const pool = await poolPromise;
      
      const result = await pool.request()
        .input('FacilityID', sql.Int, policyData.FacilityID)
        .input('CancellationPolicy', sql.NVarChar, policyData.CancellationPolicy || 'Flexible')
        .input('ReschedulePolicy', sql.NVarChar, policyData.ReschedulePolicy || 'Allowed')
        .input('MinAdvanceBooking', sql.Int, policyData.MinAdvanceBooking || 1)
        .input('MaxAdvanceBooking', sql.Int, policyData.MaxAdvanceBooking || 720)
        .input('DepositPercentage', sql.Decimal(5, 2), policyData.DepositPercentage || 30)
        .input('RefundPercentage', sql.Decimal(5, 2), policyData.RefundPercentage || 0)
        .input('CancellationDeadlineHours', sql.Int, policyData.CancellationDeadlineHours || 24)
        .input('RescheduleDeadlineHours', sql.Int, policyData.RescheduleDeadlineHours || 12)
        .input('AutoConfirmBooking', sql.Bit, policyData.AutoConfirmBooking || false)
        .query(`
          INSERT INTO FacilityPolicy (
            FacilityID, CancellationPolicy, ReschedulePolicy,
            MinAdvanceBooking, MaxAdvanceBooking, DepositPercentage,
            RefundPercentage, CancellationDeadlineHours, RescheduleDeadlineHours,
            AutoConfirmBooking, CreatedAt, UpdatedAt
          )
          OUTPUT INSERTED.*
          VALUES (
            @FacilityID, @CancellationPolicy, @ReschedulePolicy,
            @MinAdvanceBooking, @MaxAdvanceBooking, @DepositPercentage,
            @RefundPercentage, @CancellationDeadlineHours, @RescheduleDeadlineHours,
            @AutoConfirmBooking, GETDATE(), GETDATE()
          )
        `);
      
      return new FacilityPolicy(result.recordset[0]);
    } catch (error) {
      console.error('Error creating facility policy:', error);
      throw error;
    }
  }

  /**
   * Lấy chính sách theo facility
   */
  static async getByFacilityId(facilityId) {
    try {
      const pool = await poolPromise;
      
      const result = await pool.request()
        .input('FacilityID', sql.Int, facilityId)
        .query('SELECT * FROM FacilityPolicy WHERE FacilityID = @FacilityID');
      
      if (result.recordset.length === 0) {
        // Nếu chưa có chính sách, trả về chính sách mặc định
        return new FacilityPolicy({ FacilityID: facilityId });
      }
      
      return new FacilityPolicy(result.recordset[0]);
    } catch (error) {
      console.error('Error getting facility policy:', error);
      throw error;
    }
  }

  /**
   * Cập nhật chính sách
   */
  static async update(facilityId, policyData) {
    try {
      const pool = await poolPromise;
      
      let query = 'UPDATE FacilityPolicy SET UpdatedAt = GETDATE()';
      const request = pool.request().input('FacilityID', sql.Int, facilityId);
      
      if (policyData.CancellationPolicy !== undefined) {
        query += ', CancellationPolicy = @CancellationPolicy';
        request.input('CancellationPolicy', sql.NVarChar, policyData.CancellationPolicy);
      }
      
      if (policyData.ReschedulePolicy !== undefined) {
        query += ', ReschedulePolicy = @ReschedulePolicy';
        request.input('ReschedulePolicy', sql.NVarChar, policyData.ReschedulePolicy);
      }
      
      if (policyData.MinAdvanceBooking !== undefined) {
        query += ', MinAdvanceBooking = @MinAdvanceBooking';
        request.input('MinAdvanceBooking', sql.Int, policyData.MinAdvanceBooking);
      }
      
      if (policyData.MaxAdvanceBooking !== undefined) {
        query += ', MaxAdvanceBooking = @MaxAdvanceBooking';
        request.input('MaxAdvanceBooking', sql.Int, policyData.MaxAdvanceBooking);
      }
      
      if (policyData.DepositPercentage !== undefined) {
        query += ', DepositPercentage = @DepositPercentage';
        request.input('DepositPercentage', sql.Decimal(5, 2), policyData.DepositPercentage);
      }
      
      if (policyData.RefundPercentage !== undefined) {
        query += ', RefundPercentage = @RefundPercentage';
        request.input('RefundPercentage', sql.Decimal(5, 2), policyData.RefundPercentage);
      }
      
      if (policyData.CancellationDeadlineHours !== undefined) {
        query += ', CancellationDeadlineHours = @CancellationDeadlineHours';
        request.input('CancellationDeadlineHours', sql.Int, policyData.CancellationDeadlineHours);
      }
      
      if (policyData.RescheduleDeadlineHours !== undefined) {
        query += ', RescheduleDeadlineHours = @RescheduleDeadlineHours';
        request.input('RescheduleDeadlineHours', sql.Int, policyData.RescheduleDeadlineHours);
      }
      
      if (policyData.AutoConfirmBooking !== undefined) {
        query += ', AutoConfirmBooking = @AutoConfirmBooking';
        request.input('AutoConfirmBooking', sql.Bit, policyData.AutoConfirmBooking);
      }
      
      query += ' WHERE FacilityID = @FacilityID';
      
      await request.query(query);
      
      return await FacilityPolicy.getByFacilityId(facilityId);
    } catch (error) {
      console.error('Error updating facility policy:', error);
      throw error;
    }
  }

  /**
   * Kiểm tra có thể hủy booking không
   */
  canCancelBooking(bookingStartTime) {
    const now = new Date();
    const startTime = new Date(bookingStartTime);
    const hoursDiff = (startTime - now) / (1000 * 60 * 60);
    
    return {
      allowed: hoursDiff >= this.CancellationDeadlineHours,
      hoursRemaining: Math.max(0, hoursDiff),
      deadline: this.CancellationDeadlineHours,
      refundPercentage: this.RefundPercentage
    };
  }

  /**
   * Kiểm tra có thể đổi lịch không
   */
  canRescheduleBooking(bookingStartTime) {
    const now = new Date();
    const startTime = new Date(bookingStartTime);
    const hoursDiff = (startTime - now) / (1000 * 60 * 60);
    
    return {
      allowed: hoursDiff >= this.RescheduleDeadlineHours,
      hoursRemaining: Math.max(0, hoursDiff),
      deadline: this.RescheduleDeadlineHours
    };
  }

  /**
   * Kiểm tra thời gian đặt sân hợp lệ
   */
  isValidBookingTime(bookingStartTime) {
    const now = new Date();
    const startTime = new Date(bookingStartTime);
    const hoursDiff = (startTime - now) / (1000 * 60 * 60);
    
    return {
      valid: hoursDiff >= this.MinAdvanceBooking && hoursDiff <= this.MaxAdvanceBooking,
      minHours: this.MinAdvanceBooking,
      maxHours: this.MaxAdvanceBooking,
      actualHours: hoursDiff
    };
  }

  /**
   * Tính tiền cọc
   */
  calculateDeposit(totalAmount) {
    return (totalAmount * this.DepositPercentage) / 100;
  }

  /**
   * Tính tiền hoàn lại khi hủy
   */
  calculateRefund(depositAmount, bookingStartTime) {
    const canCancel = this.canCancelBooking(bookingStartTime);
    
    if (!canCancel.allowed) {
      return 0; // Quá hạn, không hoàn tiền
    }
    
    return (depositAmount * this.RefundPercentage) / 100;
  }

  /**
   * Convert to frontend format
   */
  toFrontendFormat() {
    return {
      policyId: this.PolicyID,
      facilityId: this.FacilityID,
      cancellation: {
        policy: this.CancellationPolicy,
        deadlineHours: this.CancellationDeadlineHours,
        refundPercentage: this.RefundPercentage
      },
      reschedule: {
        policy: this.ReschedulePolicy,
        deadlineHours: this.RescheduleDeadlineHours
      },
      booking: {
        minAdvanceHours: this.MinAdvanceBooking,
        maxAdvanceHours: this.MaxAdvanceBooking,
        depositPercentage: this.DepositPercentage,
        autoConfirm: this.AutoConfirmBooking
      },
      createdAt: this.CreatedAt,
      updatedAt: this.UpdatedAt
    };
  }
}

module.exports = FacilityPolicy;
