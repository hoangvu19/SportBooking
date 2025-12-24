import React from 'react';
import { Calendar, MapPin, Clock, DollarSign } from 'lucide-react';
import { useI18n } from '../../i18n/hooks';

/**
 * BookingInfoCard Component
 * Hiển thị thông tin booking trên bài post với trạng thái real-time
 * Trạng thái sẽ tự động cập nhật khi booking thay đổi (Pending → Confirmed → Cancelled)
 */
const BookingInfoCard = ({ booking }) => {
  const { t } = useI18n();
  if (!booking) return null;

  const {
    BookingStatus,
    FacilityName,
    FieldName,
    SportName,
    StartTime,
    EndTime,
    TotalAmount
  } = booking;

  // Format thời gian
  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Format tiền
  const formatCurrency = (amount) => {
    if (!amount) return '0đ';
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  // Hiển thị badge theo trạng thái (TỰ ĐỘNG CẬP NHẬT)
  const getStatusBadge = () => {
    switch (BookingStatus) {
      case 'Pending':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
            ⏳ {t('booking.status.Pending', 'Pending')}
          </span>
        );
      case 'Confirmed':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            ✅ {t('booking.status.Confirmed', 'Confirmed')}
          </span>
        );
      case 'Cancelled':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
            ❌ {t('booking.status.Cancelled', 'Cancelled')}
          </span>
        );
      case 'Completed':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
            🏁 {t('booking.status.Completed', 'Completed')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
            📋 {BookingStatus}
          </span>
        );
    }
  };

  return (
    <div className="mt-3 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200 shadow-sm">
      {/* Header với icon sân thể thao */}
      <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
            <span className="text-2xl">⚽</span>
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-lg">{FieldName}</h3>
            <p className="text-sm text-gray-600">{FacilityName}</p>
          </div>
        </div>
        {getStatusBadge()}
      </div>

      {/* Thông tin chi tiết */}
      <div className="space-y-2">
  {/* Sport */}
        <div className="flex items-center gap-2 text-gray-700">
          <span className="text-lg">🏃</span>
          <span className="font-medium">{SportName}</span>
        </div>

        {/* Thời gian bắt đầu */}
        <div className="flex items-center gap-2 text-gray-700">
          <Clock className="w-4 h-4 text-blue-600" />
          <span className="text-sm">
            <strong>{t('booking.date')}:</strong> {formatTime(StartTime)}
          </span>
        </div>

        {/* Thời gian kết thúc */}
        <div className="flex items-center gap-2 text-gray-700">
          <Clock className="w-4 h-4 text-blue-600" />
          <span className="text-sm">
            <strong>{t('booking.time')}:</strong> {formatTime(EndTime)}
          </span>
        </div>

        {/* Tổng tiền */}
        <div className="flex items-center gap-2 text-gray-700">
          <DollarSign className="w-4 h-4 text-green-600" />
          <span className="text-sm">
            <strong>{t('booking.total')}:</strong> {formatCurrency(TotalAmount)}
          </span>
        </div>
      </div>

      {/* Footer note */}
      <div className="mt-3 pt-3 border-t border-blue-200">
        <p className="text-xs text-gray-500 italic">
          ℹ️ {t('booking.statusInfo') || 'Status auto-updates when the booking changes'}
        </p>
      </div>
    </div>
  );
};

export default BookingInfoCard;
