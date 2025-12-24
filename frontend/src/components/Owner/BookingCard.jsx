import React from 'react';
import { useI18n } from '../../i18n/hooks';

const BookingCard = ({ booking }) => {
  const { t } = useI18n();
  // booking: { id, name, code, price, startHour, duration, status }
  return (
    <div className="bg-white rounded-lg shadow-sm p-2 text-xs leading-tight border" style={{boxShadow: '0 1px 4px rgba(16,24,40,0.08)'}}>
      <div className="font-medium text-sm text-gray-800 truncate">{booking.name}</div>
      <div className="text-orange-600 font-semibold text-xs mt-1">{booking.code}</div>
      <div className="text-gray-600 text-xs mt-1">{booking.price?.toLocaleString?.() ?? booking.price} {t('common.currency', 'đ')}</div>
    </div>
  );
};

export default BookingCard;
