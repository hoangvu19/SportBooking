// import React, { useState, useEffect } from "react";
// import { useLocation } from "react-router-dom";
// import "../App.css";
// import { sanList, bookingSanList, timeSlots, statusColors, fakeBookingData, getEndTime } from "../assets/sanData";

// function BookingFull() {
//   const location = useLocation();
//   const [selectedSlots, setSelectedSlots] = useState([]);
//   const [showModal, setShowModal] = useState(false);
//   const [form, setForm] = useState({ name: "", phone: "", email: "", note: "" });
  
//   const queryParams = new URLSearchParams(location.search);
//   const sanId = queryParams.get('sanId');
//   const queryTimeSlot = queryParams.get('timeSlot');
  
//   const san = sanList.find(s => s.SanID === Number(sanId)) || 
//               bookingSanList.find(s => s.SanID === Number(sanId)) || 
//               bookingSanList[0];
  
//   useEffect(() => {
//     if (queryTimeSlot) {
//       const slotIndex = parseInt(queryTimeSlot) - 1;
//       if (slotIndex >= 0 && slotIndex < timeSlots.length) {
//         const timeSlot = timeSlots[slotIndex];
//         const status = fakeBookingData[san.SanID]?.[timeSlot];
//         if (status === "trong") {
//           setSelectedSlots([timeSlot]);
//         }
//       }
//     }
//   }, [queryTimeSlot, san.SanID]);

//   const giaSan = 90000;
//   const handleSelectSlot = (slot) => {
//     const status = fakeBookingData[san.SanID][slot];
//     if (status !== "trong") return;
//     setSelectedSlots(prev =>
//       prev.includes(slot) ? prev.filter(s => s !== slot) : [...prev, slot]
//     );
//   };

//   const tongTien = selectedSlots.length * giaSan;

//   const openBookingModal = () => setShowModal(true);
//   const handleFormChange = (e) => {
//     const { name, value } = e.target;
//     setForm(prev => ({ ...prev, [name]: value }));
//   };
//   const handleBooking = (e) => {
//     e.preventDefault();
//     alert(`Đặt sân thành công! Tổng thanh toán: ${tongTien.toLocaleString()}đ`);
//     setForm({ name: "", phone: "", email: "", note: "" });
//     setSelectedSlots([]);
//     setShowModal(false);
//   };

//   return (
//     <div className="container mx-auto px-4 py-8">
//       <h1 className="text-2xl font-bold mb-4">Đặt sân {san?.TenSan}</h1>
//       <p className="text-sm text-gray-600">(Đây là bản sao dự phòng: BookingFull.jsx)</p>
//     </div>
//   );
// }

// export default BookingFull;
