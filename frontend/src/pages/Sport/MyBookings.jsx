import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingAPI } from "../../utils/api";
import CreateBookingPostButton from "../../components/Social/CreateBookingPostButton";
import { useI18n } from '../../i18n/hooks';
import toast from 'react-hot-toast';

const statusColors = {
  Pending: 'bg-yellow-100 text-yellow-800',
  Confirmed: 'bg-green-100 text-green-800',
  Cancelled: 'bg-red-100 text-red-800',
  Completed: 'bg-blue-100 text-blue-800'
};

// statusLabels will be computed within the component to allow i18n

export default function MyBookings() {
  const navigate = useNavigate();
  const { t } = useI18n();
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
        setError(result.message || 'Unable to load bookings');
      }
    } catch (err) {
      console.error('Fetch bookings error:', err);
      setError('Error loading bookings');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm(t('booking.cancelConfirm'))) {
      return;
    }

    try {
      const result = await bookingAPI.cancel(bookingId);
      if (result.success) {
        toast.success(t('booking.canceledSuccess'));
        fetchBookings(); // Refresh list
      } else {
        toast.error(t('booking.cancelFailed').replace('{msg}', result.message || 'Please try again'));
      }
    } catch (err) {
      console.error('Cancel booking error:', err);
      toast.error(t('booking.cancelError'));
    }
  };

  const filteredBookings = filter === 'all' 
    ? bookings 
    : bookings.filter(b => b.Status === filter);

  const formatDateTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
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
    return date.toLocaleDateString('en-US');
  };

  const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="text-lg">{t('common.loading')}</div>
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
            Retry
          </button>
        </div>
      </div>
    );
  }

  const statusLabels = {
    Pending: t('booking.status.Pending'),
    Confirmed: t('booking.status.Confirmed'),
    Cancelled: t('booking.status.Cancelled'),
    Completed: t('booking.status.Completed')
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
  <h1 className="text-2xl font-bold">{t('menu.myBookings')}</h1>
        <button
          onClick={() => navigate('/sanlist')}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          {t('booking.newBooking')}
        </button>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded ${filter === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
          >
            {t('booking.all')} ({bookings.length})
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
          <p className="text-gray-500">{t('booking.noBookings')}</p>
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
                  <p className="text-sm text-gray-600">{t('booking.bookingDate')}</p>
                  <p className="font-medium">{formatDate(booking.StartTime)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">{t('booking.time')}</p>
                  <p className="font-medium">
                    {formatTime(booking.StartTime)} - {formatTime(booking.EndTime)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">{t('booking.total')}</p>
                  <p className="font-medium text-indigo-600">
                    {booking.TotalAmount ? `${Number(booking.TotalAmount).toLocaleString()}` : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">{t('booking.created')}</p>
                  <p className="font-medium">{formatDateTime(booking.CreatedDate)}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-gray-200 flex-wrap">
                <button
                  onClick={() => navigate(`/sandetail?sanId=${booking.FieldID}`)}
                  className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200 transition"
                >
                  📋 {t('booking.viewField')}
                </button>
                
                {/* CreateBookingPostButton - Đăng lên Feed */}
                <CreateBookingPostButton 
                  booking={{
                    BookingID: booking.BookingID,
                    BookingStatus: booking.Status,
                    FacilityName: booking.FacilityName || t('booking.defaultFacility'),
                    FieldName: booking.FieldName || booking.TenSan || `Sân #${booking.FieldID}`,
                    SportName: booking.SportTypeName || 'Thể thao',
                    StartTime: booking.StartTime,
                    EndTime: booking.EndTime,
                    TotalAmount: booking.TotalAmount,
                    DepositPaid: booking.DepositPaid || false,
                    PaymentStatus: booking.PaymentStatus || 'Unpaid',
                  }}
                  onSuccess={() => {
                    // Optionally refresh bookings or show success message
                    console.log('Post created successfully');
                  }}
                />
                
                {booking.Status === 'Pending' || booking.Status === 'Confirmed' ? (
                  <button
                    onClick={() => handleCancelBooking(booking.BookingID)}
                    className="px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 transition"
                  >
                    🚫 {t('booking.cancelBooking','Cancel booking')}
                  </button>
                ) : null}
                
                {booking.Status === 'Confirmed' && (
                    <button
                    className="px-4 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 transition"
                  >
                    💳 Pay
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
