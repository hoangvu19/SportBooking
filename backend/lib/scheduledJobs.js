/**
 * Scheduled Jobs
 * Cron jobs để tự động thực hiện các tác vụ định kỳ
 */
const cron = require('node-cron');
const BookingPost = require('../models/Social/BookingPost');
const StoryDAL = require('../DAL/Social/StoryDAL');

class ScheduledJobs {
  /**
   * Khởi động tất cả scheduled jobs
   */
  static start() {
    console.log('🕐 Starting scheduled jobs...');

    // Tự động ẩn bài đăng "đã đặt sân" hết hạn mỗi 30 phút
    cron.schedule('*/30 * * * *', async () => {
      try {
        console.log('🔄 Running auto-hide expired booking posts job...');
        const hiddenCount = await BookingPost.autoHideExpiredPosts();
        console.log(`✅ Auto-hidden ${hiddenCount} expired booking posts`);
      } catch (error) {
        console.error('❌ Error in auto-hide job:', error);
      }
    });

    // Có thể thêm các jobs khác ở đây
    // Ví dụ: Dọn dẹp thông báo cũ, backup data, etc.

    // Tự động chuyển các story đã hết hạn vào kho lưu trữ mỗi 15 phút
    cron.schedule('*/15 * * * *', async () => {
      try {
        console.log('🔄 Running archive expired stories job...');
        const count = await StoryDAL.archiveExpiredStories();
        console.log(`✅ Archived ${count} expired stories`);
      } catch (error) {
        console.error('❌ Error in archive expired stories job:', error);
      }
    });

    console.log('✅ Scheduled jobs started successfully');
  }

  /**
   * Dừng tất cả scheduled jobs
   */
  static stop() {
    console.log('🛑 Stopping scheduled jobs...');
    // Node-cron sẽ tự động dừng khi process kết thúc
  }
}

module.exports = ScheduledJobs;
