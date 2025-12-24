const OwnerDashboardDAL = require('../../DAL/Sport/OwnerDashboardDAL');

/**
 * Get comprehensive dashboard summary
 */
async function getDashboardSummary(req, res) {
  try {
    const ownerId = req.user.AccountID;
    const summary = await OwnerDashboardDAL.getDashboardSummary(ownerId);
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Get dashboard summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy tổng quan dashboard',
      error: error.message
    });
  }
}

/**
 * Get monthly revenue statistics
 */
async function getMonthlyRevenue(req, res) {
  try {
    const ownerId = req.user.AccountID;
    const months = parseInt(req.query.months) || 12;
    
    const data = await OwnerDashboardDAL.getMonthlyRevenue(ownerId, months);
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Get monthly revenue error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy doanh thu theo tháng',
      error: error.message
    });
  }
}

/**
 * Get revenue by field
 */
async function getRevenueByField(req, res) {
  try {
    const ownerId = req.user.AccountID;
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin ngày bắt đầu hoặc ngày kết thúc'
      });
    }
    
    const data = await OwnerDashboardDAL.getRevenueByField(ownerId, startDate, endDate);
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Get revenue by field error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy doanh thu theo sân',
      error: error.message
    });
  }
}

/**
 * Get booking trends by day of week
 */
async function getBookingTrendsByDay(req, res) {
  try {
    const ownerId = req.user.AccountID;
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin ngày bắt đầu hoặc ngày kết thúc'
      });
    }
    
    const data = await OwnerDashboardDAL.getBookingTrendsByDay(ownerId, startDate, endDate);
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Get booking trends by day error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy xu hướng đặt sân theo ngày',
      error: error.message
    });
  }
}

/**
 * Get peak hours analysis
 */
async function getPeakHours(req, res) {
  try {
    const ownerId = req.user.AccountID;
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin ngày bắt đầu hoặc ngày kết thúc'
      });
    }
    
    const data = await OwnerDashboardDAL.getPeakHours(ownerId, startDate, endDate);
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Get peak hours error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy giờ cao điểm',
      error: error.message
    });
  }
}

/**
 * Get field utilization rate
 */
async function getFieldUtilization(req, res) {
  try {
    const ownerId = req.user.AccountID;
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin ngày bắt đầu hoặc ngày kết thúc'
      });
    }
    
    const data = await OwnerDashboardDAL.getFieldUtilization(ownerId, startDate, endDate);
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Get field utilization error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy tỷ lệ sử dụng sân',
      error: error.message
    });
  }
}

/**
 * Get booking status distribution
 */
async function getBookingStatusDistribution(req, res) {
  try {
    const ownerId = req.user.AccountID;
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin ngày bắt đầu hoặc ngày kết thúc'
      });
    }
    
    const data = await OwnerDashboardDAL.getBookingStatusDistribution(ownerId, startDate, endDate);
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Get booking status distribution error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy phân bố trạng thái booking',
      error: error.message
    });
  }
}

/**
 * Get top customers
 */
async function getTopCustomers(req, res) {
  try {
    const ownerId = req.user.AccountID;
    const { startDate, endDate, limit } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin ngày bắt đầu hoặc ngày kết thúc'
      });
    }
    
    const data = await OwnerDashboardDAL.getTopCustomers(
      ownerId, 
      startDate, 
      endDate, 
      parseInt(limit) || 10
    );
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Get top customers error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy khách hàng hàng đầu',
      error: error.message
    });
  }
}

module.exports = {
  getDashboardSummary,
  getMonthlyRevenue,
  getRevenueByField,
  getBookingTrendsByDay,
  getPeakHours,
  getFieldUtilization,
  getBookingStatusDistribution,
  getTopCustomers
};
