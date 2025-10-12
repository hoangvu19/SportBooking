// Dữ liệu lịch sân thể thao ảo
import { sanList } from './sanData';

// Tạo lịch trống cho các sân
// Mỗi sân có lịch trống cho 7 ngày tới
// Mỗi ngày có 8 khung giờ từ 7:00 đến 23:00, mỗi khung giờ là 2 tiếng

// Hàm để lấy ngày hiện tại và 6 ngày tiếp theo
const generateNextDays = (days = 7) => {
  const result = [];
  try {
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      result.push({
        date: date.toISOString().split('T')[0], // Format: YYYY-MM-DD
        display: date.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })
      });
    }
  } catch (error) {
    console.error("Error generating dates:", error);
    // Fallback to simple date format if locale is not supported
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      result.push({
        date: date.toISOString().split('T')[0],
        display: `${day}/${month}`
      });
    }
  }
  return result;
};

// Khung giờ trong ngày
const timeSlots = [
  { id: 1, start: '07:00', end: '09:00' },
  { id: 2, start: '09:00', end: '11:00' },
  { id: 3, start: '11:00', end: '13:00' },
  { id: 4, start: '13:00', end: '15:00' },
  { id: 5, start: '15:00', end: '17:00' },
  { id: 6, start: '17:00', end: '19:00' },
  { id: 7, start: '19:00', end: '21:00' },
  { id: 8, start: '21:00', end: '23:00' }
];

// Tạo lịch cho các sân
export const generateScheduleForSan = (sanId) => {
  try {
    const days = generateNextDays();
    const san = sanList.find(s => s.SanID === Number(sanId));
    const defaultPrice = 250000;
    
    const schedule = days.map(day => {
      const slots = timeSlots.map(slot => {
        // Random để một số slot đã được đặt (khoảng 25% slot đã đặt)
        const isBooked = Math.random() < 0.25;
        return {
          ...slot,
          isBooked,
          price: san?.GiaThue || defaultPrice
        };
      });
      return {
        ...day,
        slots
      };
    });
    
    return schedule;
  } catch (error) {
    console.error(`Error generating schedule for san ${sanId}:`, error);
    return [];
  }
};

// Lấy lịch cho một sân cụ thể
export const getScheduleForSan = (sanId) => {
  return generateScheduleForSan(sanId);
};
