import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import "../App.css";
import { sanList } from "../assets/sanData";
import { getScheduleForSan } from "../assets/scheduleData";
import BookingModal from "../components/BookingModal";

export default function SanDetail() {
  const { sanId } = useParams();
  const [schedule, setSchedule] = useState([]);
  const [selectedDate, setSelectedDate] = useState(0); // Index of the selected day
  const [showBooking, setShowBooking] = useState(false);
  const san = sanList.find(s => s.SanID === Number(sanId));

  useEffect(() => {
    if (san) {
      try {
        const sanSchedule = getScheduleForSan(san.SanID);
        setSchedule(sanSchedule || []);
      } catch (error) {
        console.error("Error loading schedule:", error);
        setSchedule([]);
      }
    }
  }, [san]);

  if (!san) return <div className="p-6">Không tìm thấy sân!</div>;

  return (
    <div className="max-w-xl mx-auto bg-white rounded-xl shadow p-6 mt-8">
      <img src={san.HinhAnh} alt={san.TenSan} className="rounded-lg h-56 w-full object-cover mb-4" />
      <h2 className="text-2xl font-bold mb-2">{san.TenSan}</h2>
      <div className="mb-2">Loại sân: {san.LoaiSan}</div>
      <div className="mb-2">Môn thể thao: {san.MonTheThao}</div>
      <div className="mb-2">Giá thuê: <span className="font-bold text-indigo-600">{san.GiaThue.toLocaleString()}đ</span></div>
      <div className="mb-2">Trạng thái: <span className={san.TrangThai === "Còn trống" ? "text-green-600" : "text-red-600"}>{san.TrangThai}</span></div>
      <div className="flex items-center mt-3 mb-4">
        <img src={san.ChuSoHuu.Avatar} alt={san.ChuSoHuu.HoTen} className="w-8 h-8 rounded-full mr-2" />
        <span className="text-sm text-gray-700">Chủ sân: {san.ChuSoHuu.HoTen}</span>
      </div>
     
      
      {/* Lịch trống của sân */}
      <div className="mt-6">
        <h3 className="font-semibold text-lg mb-3">Lịch sân còn trống</h3>
        
        {schedule.length > 0 ? (
          <>
            {/* Tab chọn ngày */}
            <div className="flex overflow-x-auto pb-2 mb-4 no-scrollbar">
              {schedule.map((day, idx) => (
                <div 
                  key={day.date} 
                  className={`px-4 py-2 text-center mr-2 rounded-lg cursor-pointer flex-shrink-0 ${selectedDate === idx ? 'bg-indigo-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
                  onClick={() => setSelectedDate(idx)}
                >
                  {day.display}
                </div>
              ))}
            </div>
            
            {/* Hiển thị các khung giờ trống (chỉ hiển thị trạng thái) */}
            <div className="grid grid-cols-2 gap-2">
              {schedule[selectedDate]?.slots.map(slot => (
                <div 
                  key={slot.id}
                  className={`px-3 py-2 rounded-md border ${slot.isBooked ? 'bg-gray-100 text-gray-400' : 'border-green-300 bg-green-50'}`}
                >
                  <div className="font-medium">{slot.start} - {slot.end}</div>
                  <div className={`text-sm ${slot.isBooked ? 'text-gray-400' : 'text-green-600'}`}>
                    {slot.isBooked ? 'Đã đặt' : `${slot.price.toLocaleString()}đ`}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500 mx-auto mb-2"></div>
            Đang tải lịch sân...
          </div>
        )}
      </div>
      
         {/* Đặt sân button - opens booking modal prefilled with selected date */}
      <div className="mt-3 mb-4">
        <button
          onClick={() => setShowBooking(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500"
        >
          Đặt sân
        </button>
      </div>

  {/* Read-only: booking actions removed on detail page */}
      {/* Booking modal (reused from list) */}
      {showBooking && (
        <BookingModal
          san={san}
          onClose={() => setShowBooking(false)}
          initialDate={schedule[selectedDate]?.date || null}
          initialArea={san.KhuVuc || null}
        />
      )}
    </div>
  );
}
