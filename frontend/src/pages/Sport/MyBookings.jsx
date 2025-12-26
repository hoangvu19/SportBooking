import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingAPI } from "../../utils/api";
import CreateBookingPostButton from "../../components/Social/CreateBookingPostButton";
import { useI18n } from '../../i18n/hooks';
import toast from 'react-hot-toast';
import axios from 'axios';

const statusColors = {
  Pending: 'bg-yellow-100 text-yellow-800',
  AwaitingPayment: 'bg-orange-100 text-orange-800',
  Confirmed: 'bg-green-100 text-green-800',
  Cancelled: 'bg-red-100 text-red-800',
  Completed: 'bg-blue-100 text-blue-800'
};
export default function MyBookings() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [processingPayment, setProcessingPayment] = useState(null); 

  useEffect(() => {
    fetchBookings();
  }, []);

  // Handle redirects from payment gateway (VNPAY)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const status = params.get('status');
      const _orderId = params.get('orderId');
      const msg = params.get('msg');

      if (status) {
        if (status === 'success') {
          toast.success(t('booking.payment.success'));
          // Refresh bookings to pick up updated status
          fetchBookings();
        } else if (status === 'failed') {
          toast.error(t('booking.payment.failed'));
          fetchBookings();
        } else if (status === 'error') {
          toast.error(t('booking.payment.error', { msg: msg || 'unknown' }));
        } else if (status === 'cancel') {
          toast(t('booking.payment.cancelled'));
        }

        // Remove query params so toast won't reappear on refresh
        try { window.history.replaceState({}, '', window.location.pathname); } catch { /* ignore */ }
      }
    } catch (e) {
      console.error('Payment return handling error', e);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for realtime booking events
  useEffect(() => {
    const onBookingCreated = (event) => {
      const payload = event?.detail;
      if (!payload || !payload.booking) {
        console.warn('⚠️ MyBookings: booking:created event missing booking data');
        return;
      }
      
      const newBooking = payload.booking;
      console.log('📥 MyBookings: Received booking:created event', newBooking);
      
      setBookings(prev => {
        // Check if already exists (duplicate prevention)
        const exists = prev.some(b => String(b.BookingID) === String(newBooking.BookingID));
        if (exists) {
          console.log('⚠️ MyBookings: Booking already exists, skipping duplicate');
          return prev;
        }
        
        console.log('✅ MyBookings: Adding new booking to state');
        // Add to beginning and re-sort by CreatedDate DESC
        const updated = [newBooking, ...prev].sort((a, b) => {
          const dateA = new Date(a.CreatedDate || a.BookingDate || 0);
          const dateB = new Date(b.CreatedDate || b.BookingDate || 0);
          return dateB - dateA;
        });
        return updated;
      });
    };

    const onBookingCancelled = (event) => {
      const payload = event?.detail;
      if (!payload || !payload.bookingId) {
        console.warn('⚠️ MyBookings: booking:cancelled event missing bookingId');
        return;
      }
      
      const cancelledId = String(payload.bookingId);
      console.log('🗑️ MyBookings: Received booking:cancelled event for ID:', cancelledId);
      
      setBookings(prev => {
        const filtered = prev.map(b => {
          if (String(b.BookingID) === cancelledId) {
            console.log('✅ MyBookings: Updating booking status to Cancelled');
            return { ...b, Status: 'Cancelled' };
          }
          return b;
        });
        return filtered;
      });
    };

    console.log('✅ MyBookings: Registering booking event listeners');
    window.addEventListener('booking:created', onBookingCreated);
    window.addEventListener('booking:cancelled', onBookingCancelled);

    return () => {
      console.log('🧹 MyBookings: Cleaning up booking event listeners');
      window.removeEventListener('booking:created', onBookingCreated);
      window.removeEventListener('booking:cancelled', onBookingCancelled);
    };
  }, []);

  const fetchBookings = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await bookingAPI.getMyBookings();
      if (result.success) {
        // Sort by CreatedDate DESC (newest first)
        const sorted = (result.data || []).sort((a, b) => {
          const dateA = new Date(a.CreatedDate || a.BookingDate || 0);
          const dateB = new Date(b.CreatedDate || b.BookingDate || 0);
          return dateB - dateA;
        });
        setBookings(sorted);
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

  // Status filters: merge Pending + AwaitingPayment into one group 'Chờ xác nhận'
  const statusFilters = [
    { key: 'all', label: t('booking.all'), predicate: () => true },
    { key: 'pending_awaiting', label: t('booking.pendingConfirm'), predicate: b => b.Status === 'Pending' || b.Status === 'AwaitingPayment' },
    { key: 'Confirmed', label: t('booking.status.Confirmed'), predicate: b => b.Status === 'Confirmed' },
    { key: 'Cancelled', label: t('booking.status.Cancelled'), predicate: b => b.Status === 'Cancelled' }
  ];

  // Helper function: Kiểm tra xem có thể hủy booking không
  // Không cho phép hủy nếu đã xác nhận và còn dưới 30 phút trước giờ bắt đầu
  const canCancelBooking = (booking) => {
    if (booking.Status === 'Confirmed') {
      const now = new Date();
      const startTime = new Date(booking.StartTime);
      const minutesUntilStart = (startTime - now) / (1000 * 60);
      // Nếu còn dưới 30 phút thì không cho hủy
      return minutesUntilStart > 30;
    }
    // Các trạng thái khác (Pending, AwaitingPayment) vẫn cho phép hủy
    return true;
  };

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm(t('booking.cancelConfirm'))) {
      return;
    }

    try {
      console.log('🗑️ MyBookings: Cancelling booking:', bookingId);
      const result = await bookingAPI.cancel(bookingId);
      
      if (result.success) {
        toast.success(t('booking.canceledSuccess'));
        
        // PRIORITY 1: Update local state immediately (sync)
        console.log('✅ MyBookings: Updating local booking status to Cancelled');
        setBookings(prev => prev.map(b => 
          b.BookingID === bookingId ? { ...b, Status: 'Cancelled' } : b
        ));
        
        // PRIORITY 2: Dispatch local event (sync)
        console.log('✅ MyBookings: Dispatching booking:cancelled event');
        window.dispatchEvent(new CustomEvent('booking:cancelled', { 
          detail: { bookingId, booking: result.data } 
        }));
        
        // Note: Server will emit to other clients automatically
      } else {
        toast.error(t('booking.cancelFailed').replace('{msg}', result.message || 'Please try again'));
      }
    } catch (err) {
      console.error('Cancel booking error:', err);
      toast.error(t('booking.cancelError'));
    }
  };

  const handlePayment = async (booking) => {
    try {
        setProcessingPayment(booking.BookingID);
        const response = await axios.post('http://localhost:5000/api/payment/create_payment_url', {
            bookingId: booking.BookingID,
            amount: booking.TotalAmount,
            language: 'vn'
        });

        if (response.data && response.data.paymentUrl) {
            window.location.href = response.data.paymentUrl;
        } else {
            toast.error(t('booking.payment.urlFailed'));
        }
    } catch (error) {
        console.error("Payment error:", error);
        toast.error(t('booking.payment.createError', { msg: error.response?.data?.msg || error.message }));
    } finally {
        setProcessingPayment(null);
    }
  };

  const filteredBookings = (() => {
    if (filter === 'all') return bookings;
    // Find a matching status filter (we define these below) or fallback to simple status match
    const sf = statusFilters ? statusFilters.find(s => s.key === filter) : null;
    return sf ? bookings.filter(b => sf.predicate(b)) : bookings.filter(b => b.Status === filter);
  })();

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
    AwaitingPayment: 'Chờ thanh toán',
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
          {statusFilters.map(s => (
            <button
              key={s.key}
              onClick={() => setFilter(s.key)}
              className={`px-4 py-2 rounded ${filter === s.key ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
            >
              {s.label} ({bookings.filter(b => s.predicate(b)).length})
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
                  <h3 className="text-lg font-semibold">{booking.FieldName || booking.TenSan || `${t('booking.fieldNumber', 'Sân #')}${booking.FieldID}`}</h3>
                  <p className="text-sm text-gray-600">
                    {booking.FacilityName && `${booking.FacilityName} • `}
                    {booking.SportTypeName && `${booking.SportTypeName}`}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[booking.Status]}`}>
                  {(booking.Status === 'Pending' || booking.Status === 'AwaitingPayment') ? 'Chờ xác nhận' : statusLabels[booking.Status]}
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
                  onClick={() => navigate(`/san/${booking.FieldID}`)}
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
                    FieldName: booking.FieldName || booking.TenSan || `${t('booking.fieldNumber', 'Sân #')}${booking.FieldID}`,
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
                {/* 4. Cập nhật điều kiện nút Cancel: Cho phép hủy cả khi Chờ thanh toán */}
                {(booking.Status === 'Pending' || booking.Status === 'Confirmed' || booking.Status === 'AwaitingPayment') ? (
                  <button
                    onClick={() => handleCancelBooking(booking.BookingID)}
                    disabled={!canCancelBooking(booking)}
                    className={`px-4 py-2 rounded transition ${
                      !canCancelBooking(booking) 
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                    }`}
                    title={!canCancelBooking(booking) && booking.Status === 'Confirmed' ? t('booking.cannotCancelConfirmed') : ''}
                  >
                    🚫 {t('booking.cancelBooking','Cancel booking')}
                  </button>
                ) : null}
                
                {/* 5. Logic hiển thị nút Pay: Hiện khi AwaitingPayment hoặc Pending hoặc chưa thanh toán */}
                {(booking.Status === 'AwaitingPayment' || booking.Status === 'Pending' || booking.PaymentStatus === 'Unpaid') && (
                    <button
                    onClick={() => handlePayment(booking)}
                    disabled={processingPayment === booking.BookingID}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition flex items-center gap-2"
                  >
                    {processingPayment === booking.BookingID ? (
                        <>⏳ Processing...</>
                    ) : (
                        <>💳 Pay Now ({Number(booking.TotalAmount).toLocaleString()}đ)</>
                    )}
                  </button>
                )}

                {/* Nếu đã Confirmed (đã thanh toán xong) thì hiện nút đã thanh toán (disabled) */}
                {booking.Status === 'Confirmed' && (
                    <button disabled className="px-4 py-2 bg-green-100 text-green-800 rounded cursor-default border border-green-200">
                        ✅ Paid & Confirmed
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
