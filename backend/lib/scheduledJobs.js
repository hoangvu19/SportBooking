const cron = require('node-cron');
const BookingPost = require('../models/Social/BookingPost');
const BookingDAL = require('../DAL/Sport/bookingDAL');
const StoryDAL = require('../DAL/Social/StoryDAL');

class ScheduledJobs {
  /**
   * Khởi động tất cả scheduled jobs
   */
  static start() {
    // Tự động ẩn bài đăng "đã đặt sân" hết hạn mỗi 30 phút
    cron.schedule('*/30 * * * *', async () => {
      try {
        const hiddenCount = await BookingPost.autoHideExpiredPosts();
        if (process.env.DEBUG_JOBS === 'true') {
          console.log(`Auto-hidden ${hiddenCount} expired booking posts`);
        }
      } catch (error) {
        console.error('Error in auto-hide job:', error);
      }
    });

    // Tự động chuyển các story đã hết hạn vào kho lưu trữ mỗi 15 phút
    cron.schedule('*/15 * * * *', async () => {
      try {
        const count = await StoryDAL.archiveExpiredStories();
        if (process.env.DEBUG_JOBS === 'true') {
          console.log(`Archived ${count} expired stories`);
        }
      } catch (error) {
        console.error('Error in archive expired stories job:', error);
      }
    });
    cron.schedule(process.env.AUTO_CANCEL_CRON || '5 0 * * *', async () => {
      try {
        if (process.env.AUTO_CANCEL_ENABLED === 'false') return;
        const res = await BookingDAL.autoCancelPendingBookings();
        if (process.env.DEBUG_JOBS === 'true') {
          console.log(`Auto-cancel pending bookings result:`, res);
        }
      } catch (error) {
        console.error('Error in auto-cancel pending bookings job:', error);
      }
    });

    if (process.env.AUTO_CANCEL_RUN_ON_START === 'true') {
      (async () => {
        try {
          const res = await BookingDAL.autoCancelPendingBookings();
          console.log('AUTO_CANCEL_RUN_ON_START result:', res);
        } catch (err) {
          console.error('AUTO_CANCEL_RUN_ON_START error:', err);
        }
      })();
    }
  }

  static stop() {
  }
}

module.exports = ScheduledJobs;
