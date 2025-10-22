import React, { useState } from "react";
import { useParams } from "react-router-dom";
import "../../App.css";
import { facilityAPI } from "../../utils/api";
import DEFAULT_AVATAR from "../../utils/defaults";
import BookingModal from "../../components/Sport/BookingModal";
import FeedbackSection from "../../components/Sport/FeedbackSection";
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

  const fetchFacilityDetail = React.useCallback(async () => {
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
  }, [sanId]);

  React.useEffect(() => {
    fetchFacilityDetail();
  }, [fetchFacilityDetail]);

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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Hero Section - Image & Basic Info */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-6">
          <div className="relative h-80 md:h-96">
            <img 
              src={san.HinhAnh} 
              alt={san.TenSan} 
              className="w-full h-full object-cover"
            />
            <div className="absolute top-4 right-4">
              <span className={`px-4 py-2 rounded-full text-sm font-semibold shadow-lg ${
                san.TrangThai === "Còn trống" 
                  ? 'bg-green-500 text-white' 
                  : 'bg-red-500 text-white'
              }`}>
                {san.TrangThai}
              </span>
            </div>
          </div>
          
          {/* Info Section */}
          <div className="p-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-4">{san.TenSan}</h1>
            
            {/* Info Grid */}
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              {/* Sport Type */}
              <div className="flex items-center space-x-3 p-4 bg-gradient-to-r from-indigo-50 to-indigo-100 rounded-xl">
                <div className="bg-indigo-500 p-3 rounded-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Môn thể thao</p>
                  <p className="text-sm font-bold text-gray-800">{san.MonTheThao}</p>
                </div>
              </div>
              
              {/* Field Type */}
              <div className="flex items-center space-x-3 p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl">
                <div className="bg-purple-500 p-3 rounded-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Loại sân</p>
                  <p className="text-sm font-bold text-gray-800">{san.LoaiSan}</p>
                </div>
              </div>
              
              {/* Price */}
              <div className="flex items-center space-x-3 p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-xl">
                <div className="bg-green-500 p-3 rounded-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Giá thuê</p>
                  <p className="text-lg font-bold text-green-600">{san.GiaThue.toLocaleString()}đ</p>
                </div>
              </div>
            </div>
            
            {/* Owner Info */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center space-x-3">
                <img 
                  src={san.ChuSoHuu.Avatar} 
                  alt={san.ChuSoHuu.HoTen} 
                  className="w-12 h-12 rounded-full border-2 border-indigo-500"
                />
                <div>
                  <p className="text-xs text-gray-500">Chủ sân</p>
                  <p className="font-semibold text-gray-800">{san.ChuSoHuu.HoTen}</p>
                </div>
              </div>
              <button
                onClick={() => setShowBooking(true)}
                className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg transform hover:scale-105 transition-all duration-200"
              >
                Đặt sân ngay
              </button>
            </div>
          </div>
        </div>
        
        {/* Schedule Section */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center space-x-2 mb-6">
            <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h2 className="text-2xl font-bold text-gray-800">Lịch sân còn trống</h2>
          </div>
          
          {schedule.length > 0 ? (
            <>
              {/* Date Tabs */}
              <div className="flex overflow-x-auto pb-3 mb-6 space-x-2 no-scrollbar">
                {schedule.map((day, idx) => (
                  <button 
                    key={day.date} 
                    className={`px-5 py-3 text-center rounded-xl cursor-pointer flex-shrink-0 font-semibold transition-all duration-200 ${
                      selectedDate === idx 
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg transform scale-105' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    onClick={() => setSelectedDate(idx)}
                  >
                    {day.display}
                  </button>
                ))}
              </div>
              
              {/* Time Slots Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {schedule[selectedDate]?.slots.map(slot => (
                  <div 
                    key={slot.id}
                    className={`relative p-4 rounded-xl border-2 transition-all duration-200 ${
                      slot.isBooked 
                        ? 'bg-gray-50 border-gray-200 opacity-60' 
                        : 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-300 hover:shadow-md hover:scale-105 cursor-pointer'
                    }`}
                  >
                    {slot.isBooked && (
                      <div className="absolute top-2 right-2">
                        <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                    <div className="flex items-center space-x-2 mb-2">
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="font-bold text-gray-800">{slot.start} - {slot.end}</span>
                    </div>
                    <div className={`text-sm font-semibold ${
                      slot.isBooked ? 'text-gray-400' : 'text-green-600'
                    }`}>
                      {slot.isBooked ? '❌ Đã đặt' : `💰 ${slot.price.toLocaleString()}đ`}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent mx-auto mb-4"></div>
              <p className="text-gray-500 font-medium">Đang tải lịch sân...</p>
            </div>
          )}
        </div>
      </div>

      {/* Feedback Section */}
      <FeedbackSection targetType="Field" targetId={san.FieldID || san.SanID} />

      {/* Booking Modal */}
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
