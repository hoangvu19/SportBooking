const generateNextDays = (days = 7) => {
  const result = [];
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const iso = date.toISOString().split('T')[0];
    const display = date.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' });
    result.push({ date: iso, display });
  }
  return result;
};
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
export const generateScheduleForSan = () => {
  const days = generateNextDays();
  const defaultPrice = 200000;
  return days.map(day => ({
    ...day,
    slots: timeSlots.map(slot => ({ ...slot, isBooked: false, price: defaultPrice }))
  }));
};

export const getScheduleForSan = () => generateScheduleForSan();

export default { generateScheduleForSan, getScheduleForSan };
