const BookingDAL = require('../../DAL/Sport/bookingDAL');
const { sendSuccess, sendError } = require('../../utils/responseHelper');

class CustomerController {
  /**
   * Get all customers who have booked at owner's facilities
   * GET /api/customers
   */
  static async getCustomers(req, res) {
    try {
      // req.user is populated by auth middleware and exposes AccountID
      const ownerId = req.user.AccountID || req.user.userId;
      const { search, page, limit } = req.query;

      const filters = {
        search: search || '',
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20
      };

      const result = await BookingDAL.getCustomersByOwner(ownerId, filters);

      return sendSuccess(res, result.data, 'Lấy danh sách khách hàng thành công', 200, {
        meta: { pagination: result.pagination }
      });
    } catch (error) {
      console.error('CustomerController.getCustomers error:', error);
      return sendError(res, 'Lỗi khi lấy danh sách khách hàng', 500, { error });
    }
  }

  /**
   * Get customer booking history
   * GET /api/customers/:customerId/bookings
   */
  static async getCustomerBookings(req, res) {
    try {
      const ownerId = req.user.AccountID || req.user.userId;
      const customerId = parseInt(req.params.customerId);
      const { status, startDate, endDate, page, limit } = req.query;

      const filters = {
        status,
        startDate,
        endDate,
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20
      };

      const result = await BookingDAL.getCustomerBookingHistory(ownerId, customerId, filters);

      return sendSuccess(res, result.data, 'Lấy lịch sử đặt sân thành công', 200, {
        meta: { pagination: result.pagination }
      });
    } catch (error) {
      console.error('CustomerController.getCustomerBookings error:', error);
      return sendError(res, 'Lỗi khi lấy lịch sử đặt sân', 500, { error });
    }
  }

  /**
   * Get customer statistics
   * GET /api/customers/:customerId/stats
   */
  static async getCustomerStats(req, res) {
    try {
      const ownerId = req.user.AccountID || req.user.userId;
      const customerId = parseInt(req.params.customerId);
      const { startDate, endDate } = req.query;

      const filters = { startDate, endDate };

      const result = await BookingDAL.getCustomerStats(ownerId, customerId, filters);

      return sendSuccess(res, result.data, 'Lấy thống kê khách hàng thành công');
    } catch (error) {
      console.error('CustomerController.getCustomerStats error:', error);
      return sendError(res, 'Lỗi khi lấy thống kê khách hàng', 500, { error });
    }
  }
}

module.exports = CustomerController;
