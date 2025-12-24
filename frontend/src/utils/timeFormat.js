/**
 * Format datetime string thành "time ago" format (VN timezone aware)
 * Xử lý datetime từ SQL Server (có thể có hoặc không có timezone)
 */
export const formatTimeAgo = (dateString) => {
  if (!dateString) return 'Không rõ';
  
  try {
    let date;
    
    if (dateString instanceof Date) {
      date = dateString;
    } else {
      const dateStr = String(dateString).trim();
      
      // SQL Server trả về format: "2025-11-06T19:32:16.727Z"
      // NHƯNG datetime trong DB là VN local time, KHÔNG phải UTC!
      // => Cần remove 'Z' và thêm '+07:00' để parse đúng
      
      if (dateStr.endsWith('Z')) {
        // Remove 'Z' và thêm '+07:00'
        const vnDateStr = dateStr.slice(0, -1) + '+07:00';
        date = new Date(vnDateStr);
      } else if (dateStr.includes('+')) {
        // Đã có timezone, parse trực tiếp
        date = new Date(dateStr);
      } else {
        // Không có timezone, thêm +07:00
        const isoStr = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
        date = new Date(isoStr + '+07:00');
      }
    }
    
    if (!date || isNaN(date.getTime())) {
      return 'Không rõ';
    }
    
    const now = new Date();
    const diffInMs = now - date;
    const diffInSeconds = Math.floor(diffInMs / 1000);

    // Xử lý thời gian âm (từ tương lai do clock skew)
    if (diffInSeconds < 0) return 'Vừa xong';
    
    // Dưới 1 phút
    if (diffInSeconds < 60) return 'Vừa xong';
    
    // Dưới 1 giờ - hiển thị theo phút
    if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} phút trước`;
    }
    
    // Dưới 1 ngày - hiển thị theo giờ
    if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} giờ trước`;
    }
    
    // Dưới 1 tuần - hiển thị theo ngày
    if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} ngày trước`;
    }
    
    // Trên 1 tuần - hiển thị ngày tháng năm đầy đủ
    return date.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  } catch (error) {
    console.error('Error formatting time:', error, dateString);
    return 'Không rõ';
  }
};

export default formatTimeAgo;
