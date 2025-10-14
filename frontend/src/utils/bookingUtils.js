// Shared booking utilities: time slots, helpers and status colors
export const timeSlots = [
  "07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30",
  "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00"
];

// For simple 30-minute slot end-time calculation
export function getEndTime(start) {
  const [h, m] = start.split(":").map(Number);
  let endM = m + 30;
  let endH = h;
  if (endM >= 60) {
    endH += 1;
    endM -= 60;
  }
  return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
}

// Generate time slots with booking status for a specific date
export function generateTimeSlots(date, basePrice) {
  const slots = [];
  
  for (let i = 0; i < timeSlots.length; i++) {
    const startTime = timeSlots[i];
    const endTime = getEndTime(startTime);
    
    // Simulate booked slots (in real app, fetch from API)
    const isBooked = Math.random() > 0.7; // 30% chance of being booked
    
    slots.push({
      id: `${date}-${startTime}`,
      start: startTime,
      end: endTime,
      price: basePrice,
      isBooked: isBooked
    });
  }
  
  return slots;
}

// Slot status -> tailwind classes (kept minimal and reusable)
export const statusColors = {
  "trong": "bg-white",
  "dadat": "bg-red-100",
  "khoa": "bg-gray-200",
  "chon": "bg-green-200"
};

export default {
  timeSlots,
  getEndTime,
  generateTimeSlots,
  statusColors,
};
