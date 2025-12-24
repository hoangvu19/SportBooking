const TRANSLATIONS = {
  en: {
    report: {
      success: 'Report submitted successfully',
      created: 'Report created',
      duplicate: 'You have already reported this content',
      createError: 'Error creating report',
      loadError: 'Unable to load reports',
      notFound: 'Report not found',
      processed: 'Report processed',
      dismissed: 'Report dismissed',
      fallbackNotFound: 'Fallback report not found',
      fallbackFileMissing: 'Fallback file missing',
      updateError: 'Error updating report',
      statsError: 'Unable to load report statistics'
    },
    common: {
      unauthorized: 'Unauthorized',
      invalid: 'Invalid data'
    }
  },
  vi: {
    report: {
      success: 'Báo cáo đã được gửi thành công',
      created: 'Đã tạo báo cáo',
      duplicate: 'Bạn đã báo cáo nội dung này trước đó',
      createError: 'Lỗi khi tạo báo cáo',
      loadError: 'Không thể tải danh sách báo cáo',
      notFound: 'Không tìm thấy báo cáo',
      processed: 'Báo cáo đã được xử lý',
      dismissed: 'Báo cáo đã bị bỏ qua',
      fallbackNotFound: 'Không tìm thấy báo cáo (fallback)',
      fallbackFileMissing: 'Không tìm thấy file báo cáo fallback',
      updateError: 'Lỗi khi cập nhật báo cáo',
      statsError: 'Lỗi khi lấy thống kê báo cáo'
    },
    common: {
      unauthorized: 'Không được phép',
      invalid: 'Dữ liệu không hợp lệ'
    }
  }
};

module.exports = TRANSLATIONS;
