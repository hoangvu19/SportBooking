import React, { useMemo, useState, useEffect } from 'react';
import { getVnIsoDate } from '../../utils/vnTime';
import BookingCard from './BookingCard';
import { useI18n } from '../../i18n/hooks';
const BookingCalendar = ({ dateRange, startHour = 6, endHour = 23, bookings = [], courts = ['A','B','C'] }) => {
  const hours = [];
  for (let h = startHour; h <= endHour; h++) hours.push(h);
  // visual constants
  const rowHeight = 48;
  const bookingsByDate = {};
  bookings.forEach(b => {
    const d = b.date ? getVnIsoDate(new Date(b.date)) : null;
    if (!d) return;
    bookingsByDate[d] = bookingsByDate[d] || [];
    bookingsByDate[d].push(b);
  });

  const formatDateKey = (d) => getVnIsoDate(d);

  // Short date formatter (dd-mm-yyyy) for column headers
  const pad2 = (n) => n.toString().padStart(2,'0');
  // (We no longer show short date in the column header; headers show court names.)

  // Internal state: current start date for the visible range.
  const [startDate, setStartDate] = useState(() => (dateRange && dateRange[0]) ? new Date(dateRange[0]) : new Date());

  // If the parent passes a new dateRange prop, sync the startDate to it.
  useEffect(() => {
    if (dateRange && dateRange[0]) setStartDate(new Date(dateRange[0]));
  }, [dateRange]);

  // Build the visible date range from startDate
  const visibleRange = useMemo(() => {
    const arr = [];
    for (let i = 0; i < (dateRange ? dateRange.length : 7); i++) {
      const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, [startDate, dateRange]);

  const shiftBy = (days) => setStartDate(s => new Date(s.getFullYear(), s.getMonth(), s.getDate() + days));
  const goToday = () => setStartDate(new Date());

  const viWeekdays = ['Chủ nhật','Thứ hai','Thứ ba','Thứ tư','Thứ năm','Thứ sáu','Thứ bảy'];
  const formatFullHeader = (date) => {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const weekday = viWeekdays[d.getDay()];
    const dd = pad2(d.getDate());
    const mm = pad2(d.getMonth() + 1);
    const yyyy = d.getFullYear();
    return `${weekday}, ${dd}-${mm}-${yyyy}`;
  };

  const { t } = useI18n();

  return (
    <div className="owner-calendar">
      {/* Top controls: add booking, date navigation, today button (visual only) */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
            <button className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-md font-semibold">+ {t('booking.newBooking') || 'New Booking'}</button>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => shiftBy(-1)} className="w-9 h-9 rounded-full border flex items-center justify-center text-gray-600">◀</button>

          <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-white shadow-sm">
            <span className="text-gray-600">📅</span>
            <div className="text-sm text-gray-800">{formatFullHeader(startDate)}</div>
            <span className="text-gray-400">▾</span>
          </div>

          <button onClick={() => shiftBy(1)} className="w-9 h-9 rounded-full border flex items-center justify-center text-gray-600">▶</button>

            <button onClick={goToday} className="px-3 py-2 border rounded-md text-purple-700 font-medium" style={{background: 'white'}}>{t('common.today') || 'Today'}</button>
        </div>

        <div className="flex items-center gap-2">
          <button className="w-8 h-8 rounded-md flex items-center justify-center text-gray-600">📅</button>
          <button className="w-8 h-8 rounded-md flex items-center justify-center text-gray-600">🔍</button>
        </div>
      </div>

  <div className="grid grid-cols-[100px_1fr] gap-0">
        {/* left-hour column */}
        <div className="border-r bg-white">
          <div style={{height: rowHeight}}></div>
          {hours.map(h => (
            <div key={h} className={`flex items-start justify-center text-sm text-gray-600 border-b`} style={{height: rowHeight}}>{h}h</div>
          ))}
        </div>

        {/* calendar columns */}
        <div className="overflow-auto">
          {/* build columns for each date × court */}
          {(() => {
            const totalCols = visibleRange.length * courts.length;
            return (
              <div className="grid" style={{gridTemplateColumns: `repeat(${totalCols}, minmax(160px, 1fr))`}}>
                {/* header: for each date, render a header cell per court */}
                {visibleRange.map((d, dateIdx) => (
                  courts.map((court) => {
                    const template = (t('calendar.courtLabel') || 'Court {court}');
                    const label = template.replace('{court}', court);
                    return (
                      <div key={`${dateIdx}-${court}`} className="border-l flex items-center justify-center text-sm font-medium text-gray-700" style={{height: rowHeight}}>
                        {label}
                      </div>
                    );
                  })
                ))}

                {/* cells container: one column per date×court */}
                <div className="col-span-full grid" style={{gridTemplateColumns: `repeat(${totalCols}, minmax(160px, 1fr))`}}>
                  {visibleRange.map((d, dateIdx) => {
                    const key = formatDateKey(d);
                    const dayBookings = bookingsByDate[key] || [];
                    return courts.map((court) => {
                      const colKey = `${dateIdx}-${court}`;
                      // filter bookings for this court (fallback to 'A' if booking.court not set)
                      const courtBookings = dayBookings.filter(b => ((b.court || 'A') === court));
                      return (
                        <div key={colKey} className="border-l" style={{minHeight: `${hours.length * rowHeight}px`, position: 'relative'}}>
                          {hours.map((h, rowIdx) => (
                            <div key={rowIdx} className="border-b" style={{height: rowHeight}}></div>
                          ))}

                          {courtBookings.map(b => {
                            const top = (b.startHour - startHour) * rowHeight; // px per hour
                            const height = (b.durationHours || 1) * rowHeight - 8;
                            return (
                              <div key={b.id} style={{position: 'absolute', left: 8, right: 8, top: top + 6, height}}>
                                <BookingCard booking={b} />
                              </div>
                            );
                          })}
                        </div>
                      );
                    });
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

export default BookingCalendar;
