import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import "../../App.css";
import { facilityAPI } from "../../utils/api";
import DEFAULT_AVATAR from "../../utils/defaults";
import BookingModal from "../../components/Sport/BookingModal";
import Loading from "../../components/Shared/Loading";
import { generateTimeSlots } from "../../utils/bookingUtils";

export default function SanDetail() {
  const { sanId } = useParams();
  const [schedule, setSchedule] = useState([]);
  const [selectedDate, setSelectedDate] = useState(0); // Index of the selected day
  const [showBooking, setShowBooking] = useState(false);
  const [san, setSan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchFacilityDetail();
  }, [sanId]);

  const fetchFacilityDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await facilityAPI.getById(Number(sanId));
      if (result.success && result.data) {
        const field = result.data;
        // SportField API returns data in correct format already
        const sanData = {
          SanID: field.SanID || field.FieldID,
          FieldID: field.FieldID,
          TenSan: field.TenSan || field.FieldName,
          LoaiSan: field.LoaiSan || field.FieldType || 'Không rõ',
          MonTheThao: field.MonTheThao || field.SportName || 'Không rõ',
          GiaThue: field.GiaThue || field.RentalPrice || 0,
          TrangThai: field.TrangThai || field.Status || 'Còn trống',
          KhuVuc: field.KhuVuc || field.AreaName || 'Không rõ',
          FieldArea: field.FieldArea || field.KhuVuc || 'Không rõ',
          HinhAnh: field.HinhAnh || field.Image || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 140" fill="%23E2E8F0"%3E%3Crect width="200" height="140" fill="%23E2E8F0"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="%23718096"%3ENo Image%3C/text%3E%3C/svg%3E',
          ChuSoHuu: field.ChuSoHuu || {
            HoTen: field.OwnerName || 'Chưa rõ',
            Avatar: field.OwnerAvatar || DEFAULT_AVATAR
          }
        };
        setSan(sanData);
        
        // Generate schedule with time slots for next 7 days
        generateSchedule(sanData.GiaThue);
      } else {
        setError(result.message || 'Không thể tải thông tin sân');
      }
    } catch (err) {
      console.error('Fetch facility detail error:', err);
      setError('Lỗi khi tải thông tin sân');
    } finally {
      setLoading(false);
    }
  };

  const generateSchedule = (basePrice) => {
    const days = [];
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(today);
      currentDate.setDate(today.getDate() + i);
      
      const dateStr = currentDate.toISOString().split('T')[0];
      const displayStr = i === 0 ? 'Hôm nay' : 
                        i === 1 ? 'Ngày mai' :
                        currentDate.toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'numeric' });
      
      // Generate time slots for this day using utility
      const slots = generateTimeSlots(dateStr, basePrice);
      
      days.push({
        date: dateStr,
        display: displayStr,
        slots: slots
      });
    }
    
    setSchedule(days);
  };

  if (loading) return <Loading />;
  
  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
          <button 
            onClick={fetchFacilityDetail}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

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
