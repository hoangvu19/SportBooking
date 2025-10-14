import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingAPI } from "../../utils/api";

const statusColors = {
  Pending: 'bg-yellow-100 text-yellow-800',
  Confirmed: 'bg-green-100 text-green-800',
  Cancelled: 'bg-red-100 text-red-800',
  Completed: 'bg-blue-100 text-blue-800'
};

const statusLabels = {
  Pending: 'Chờ xác nhận',
  Confirmed: 'Đã xác nhận',
  Cancelled: 'Đã hủy',
  Completed: 'Hoàn thành'
};

export default function MyBookings() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // all, Pending, Confirmed, Cancelled, Completed

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await bookingAPI.getMyBookings();
      if (result.success) {
        setBookings(result.data || []);
      } else {
        setError(result.message || 'Không thể tải danh sách booking');
      }
    } catch (err) {
      console.error('Fetch bookings error:', err);
      setError('Lỗi khi tải danh sách booking');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm('Bạn có chắc muốn hủy booking này?')) {
      return;
    }

    try {
      const result = await bookingAPI.cancel(bookingId);
      if (result.success) {
        alert('✅ Hủy booking thành công!');
        fetchBookings(); // Refresh list
      } else {
        alert(`❌ Hủy booking thất bại: ${result.message || 'Vui lòng thử lại'}`);
      }
    } catch (err) {
      console.error('Cancel booking error:', err);
      alert('❌ Lỗi khi hủy booking');
    }
  };

  const filteredBookings = filter === 'all' 
    ? bookings 
    : bookings.filter(b => b.Status === filter);

  const formatDateTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString('vi-VN');
  };

  const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="text-lg">Đang tải...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
          <button 
            onClick={fetchBookings}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Lịch sử đặt sân</h1>
        <button
          onClick={() => navigate('/sanlist')}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          Đặt sân mới
        </button>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded ${filter === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
          >
            Tất cả ({bookings.length})
          </button>
          {Object.keys(statusLabels).map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded ${filter === status ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
            >
              {statusLabels[status]} ({bookings.filter(b => b.Status === status).length})
            </button>
          ))}
        </div>
      </div>

      {/* Bookings List */}
      {filteredBookings.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <p className="text-gray-500">Không có booking nào</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBookings.map(booking => (
            <div key={booking.BookingID} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">{booking.FieldName || booking.TenSan || `Sân #${booking.FieldID}`}</h3>
                  <p className="text-sm text-gray-600">
                    {booking.FacilityName && `${booking.FacilityName} • `}
                    {booking.SportTypeName && `${booking.SportTypeName}`}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[booking.Status]}`}>
                  {statusLabels[booking.Status]}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-600">Ngày đặt</p>
                  <p className="font-medium">{formatDate(booking.StartTime)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Thời gian</p>
                  <p className="font-medium">
                    {formatTime(booking.StartTime)} - {formatTime(booking.EndTime)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Tổng tiền</p>
                  <p className="font-medium text-indigo-600">
                    {booking.TotalAmount ? `${Number(booking.TotalAmount).toLocaleString()}đ` : 'Chưa có'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Ngày tạo</p>
                  <p className="font-medium">{formatDateTime(booking.CreatedDate)}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-gray-200">
                <button
                  onClick={() => navigate(`/sandetail?sanId=${booking.FieldID}`)}
                  className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200"
                >
                  Xem sân
                </button>
                {booking.Status === 'Pending' || booking.Status === 'Confirmed' ? (
                  <button
                    onClick={() => handleCancelBooking(booking.BookingID)}
                    className="px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
                  >
                    Hủy đặt sân
                  </button>
                ) : null}
                {booking.Status === 'Confirmed' && (
                  <button
                    className="px-4 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200"
                  >
                    Thanh toán
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
