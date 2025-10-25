import React from 'react';
import { getEndTime, timeSlots } from "../../utils/bookingUtils";
import { bookingAPI } from "../../utils/api";
import toast from 'react-hot-toast';
import { useI18n } from '../../i18n/hooks';

// Modal đặt sân
const BookingModal = ({ san, onClose, initialDate = null, initialSelectedSlots = [], initialArea = null }) => {
  const [date, setDate] = React.useState(initialDate || new Date().toISOString().split('T')[0]);
  const { t } = useI18n();
  const [activeArea, setActiveArea] = React.useState(initialArea || 'A1');
  const [selectedSlots, setSelectedSlots] = React.useState(Array.isArray(initialSelectedSlots) ? initialSelectedSlots : []);
  const [form, _setForm] = React.useState({ note: "" });
  
  // Make sure san is defined - render guard is moved to after hooks to avoid conditional hook calls
  
  // Fetch areas from facility data (not from assets)
  const [areas, setAreas] = React.useState([]);
  const [availabilityLoading, setAvailabilityLoading] = React.useState(false);
  const [availabilityError, setAvailabilityError] = React.useState(null);
  const [bookedIntervals, setBookedIntervals] = React.useState([]); // array of { start: Date, end: Date }
  
  React.useEffect(() => {
    // Get areas from the facility's FieldArea
    if (san && san.FieldArea) {
      // FieldArea can be like "C1,C2,C3" or just "C1"
      const areaList = san.FieldArea.includes(',') 
        ? san.FieldArea.split(',').map(a => a.trim())
        : [san.FieldArea];
      setAreas(areaList);
      setActiveArea(areaList[0]);
    } else if (san && san.KhuVuc) {
      // Fallback to KhuVuc if FieldArea not available
      const areaList = san.KhuVuc.includes(',') 
        ? san.KhuVuc.split(',').map(a => a.trim())
        : [san.KhuVuc];
      setAreas(areaList);
      setActiveArea(areaList[0]);
    } else {
      // Fallback if no area data
        setAreas(['Main area']);
        setActiveArea('Main area');
    }
  }, [san]);

  // Use facility image instead of area images
  const getAreaImage = () => {
    return san?.HinhAnh || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 140" fill="%23E2E8F0"%3E%3Crect width="200" height="140" fill="%23E2E8F0"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="%23718096"%3ENo Image%3C/text%3E%3C/svg%3E';
  };
  
  // Determine slot status (try real data first, fallback heuristics)
  const getSlotStatus = (area, slot) => {
    // Parse slot datetime
    let slotDt;
    try {
      slotDt = new Date(`${date}T${slot}:00`);
      const now = new Date();
    if (slotDt < now) return 'past';
    } catch { /* ignore parse errors and continue */ }

    // Check real booked intervals (overlap)
    for (const it of bookedIntervals) {
      if (!it || !it.start || !it.end) continue;
      const slotEnd = new Date(slotDt.getTime() + 30 * 60 * 1000);
  if (slotDt && slotEnd > it.start && slotDt < it.end) return 'booked';
    }

    // Fallback mock heuristics
  if (date === '2025-09-12' && slot > '18:00') return 'booked';
  if (slot < '08:00' && area === 'A1') return 'booked';
  if (slot > '20:00' && (area === 'A3' || area === 'B1')) return 'booked';
  return 'available';
  };

  // Chọn slot
  const handleSelectSlot = (slot) => {
  const st = getSlotStatus(activeArea, slot);
  if (st === 'booked' || st === 'past') return;
    
    if (selectedSlots.includes(slot)) {
      setSelectedSlots(prev => prev.filter(s => s !== slot));
    } else {
      setSelectedSlots(prev => [...prev, slot].sort());
    }
  };

  // Initialize from props when they change
  React.useEffect(() => {
    if (initialDate) setDate(initialDate);
  }, [initialDate]);

  // Sync initialArea prop
  React.useEffect(() => {
    if (initialArea) setActiveArea(initialArea);
  }, [initialArea]);

  React.useEffect(() => {
    if (Array.isArray(initialSelectedSlots) && initialSelectedSlots.length) {
      setSelectedSlots(initialSelectedSlots);
    }
  }, [initialSelectedSlots]);

  // Fetch real availability for the selected date and san
  React.useEffect(() => {
    if (!san || !(san.FieldID || san.SanID) || !date) {
      setBookedIntervals([]);
      return;
    }
    let cancelled = false;
    const fetchAvail = async () => {
      setAvailabilityLoading(true);
      setAvailabilityError(null);
      try {
        const resp = await bookingAPI.getFieldAvailability(san.FieldID || san.SanID, date);
        if (cancelled) return;
  if (resp && resp.success && Array.isArray(resp.data)) {
          const intervals = resp.data.map(b => {
            try { return { start: new Date(b.StartTime), end: new Date(b.EndTime) }; } catch { return null; }
          }).filter(Boolean);
          setBookedIntervals(intervals);
        } else {
          setBookedIntervals([]);
        }
  } catch (err) {
    console.error('Error fetching availability:', err);
  setAvailabilityError(t('booking.loadAvailabilityError','Unable to load availability'));
        setBookedIntervals([]);
      } finally {
        if (!cancelled) setAvailabilityLoading(false);
      }
    };
    fetchAvail();
    return () => { cancelled = true; };
  }, [san, date]);

  // When active area changes, clear selected slots (user should reselect for that area)
  React.useEffect(() => {
    setSelectedSlots([]);
  }, [activeArea]);

  // Tổng tiền
  const tongTien = selectedSlots.length * (san?.GiaThue || 200000);

  // Form xác nhận
  const handleSubmit = async () => {
    if (selectedSlots.length === 0) {
      toast.error(t('booking.selectAtLeastOne'));
      return;
    }

    // Get user info from localStorage
    let userData = null;
    try {
      const userStr = localStorage.getItem('userData');
      if (userStr && userStr !== 'undefined') {
        userData = JSON.parse(userStr);
      }
    } catch (err) {
      console.error('Failed to parse user data:', err);
    }

    if (!userData) {
      toast.error(t('booking.pleaseLogin'));
      return;
    }

    try {
      // Convert selected slots to start/end times
      // Assuming each slot is 30 minutes
      const firstSlot = selectedSlots[0];
      const lastSlot = selectedSlots[selectedSlots.length - 1];
      
      // Create full datetime strings
      const startTime = `${date}T${firstSlot}:00`;
      const endTime = `${date}T${getEndTime(lastSlot)}:00`;

      // Prepare booking data in backend format
      const bookingData = {
        fieldId: san.FieldID || san.SanID,
        startTime: startTime,
        endTime: endTime,
        deposit: 0, // Optional
    customerName: userData.FullName || userData.Username || 'Customer',
        customerPhone: userData.PhoneNumber || userData.Phone || '',
        customerEmail: userData.Email || '',
        note: form.note || ''
      };

      console.log('Booking data:', bookingData);
      const result = await bookingAPI.create(bookingData);
      
      if (result.success) {
          toast.success(t('booking.bookingSuccess'));
        onClose();
      } else {
          toast.error(t('booking.bookingFailed').replace('{msg}', result.message || 'Unable to create booking'));
      }
    } catch (error) {
      console.error('Booking error:', error);
        toast.error(t('booking.bookingError').replace('{msg}', error.message || 'Please try again'));
    }
  };

  // Render guard after hooks
    if (!san) {
    console.error("BookingModal: san is undefined");
    return (
      <div data-testid="booking-modal" className="fixed inset-0 bg-white flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-white rounded-xl shadow-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-4 border-b flex justify-between items-center">
            <h3 className="text-xl font-bold">{t('booking.facilityNotFound','Facility not found')}</h3>
            <button data-testid="booking-close" onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl">&times;</button>
          </div>
          <div className="p-4">{t('booking.facilityLoadError','An error occurred while loading facility details')}</div>
        </div>
      </div>
    );
  }

  return (
  <div data-testid="booking-modal" className="fixed inset-0 bg-white flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-0 border-b sticky top-0 bg-white">
          {/* Area image */}
          <div className="w-full h-40 overflow-hidden rounded-t-xl">
            <img src={getAreaImage()} alt={`Area ${activeArea}`} className="w-full h-full object-cover" />
          </div>
          <div className="p-4 border-b flex justify-between items-center">
            <h3 className="text-xl font-bold">{t('booking.book','Book')} - {san?.TenSan || ''} ({t('booking.area','Area')} {activeArea})</h3>
            <button data-testid="booking-close" onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl">&times;</button>
          </div>
        </div>

        {/* Chọn ngày và khu vực */}
        <div className="p-4 flex flex-wrap gap-4 border-b">
            <div>
            <label className="block font-medium mb-2">{t('booking.dateLabel','Date')}</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border rounded px-3 py-2" min={new Date().toISOString().split('T')[0]} />
          </div>
          <div>
            <label className="block font-medium mb-2">{t('booking.area','Area')}</label>
            <div className="flex flex-wrap gap-2">
              {areas.map(area => {
                const imgSrc = getAreaImage();
                const isSelected = activeArea === area;
                return (
                  <button
                    key={area}
                    onClick={() => setActiveArea(area)}
                    className={`flex flex-col items-center overflow-hidden rounded-md border ${isSelected ? 'ring-2 ring-indigo-500' : 'hover:shadow-md'} focus:outline-none`}
                    aria-pressed={isSelected}
                    type="button"
                  >
                    <img src={imgSrc} alt={`Khu ${area}`} className="w-20 h-12 object-cover" />
                    <div className={`w-full text-center text-xs py-1 ${isSelected ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700'}`}>{area}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bảng chọn giờ */}
        <div className="p-4">
          <h4 className="text-lg font-semibold mb-3">{t('booking.selectTimeSlots','Select time slots - Area {area}').replace('{area}', activeArea)}</h4>
            <div className="flex items-center justify-between mb-2">
            <div />
            <div className="text-sm text-gray-500">
              {availabilityLoading ? t('booking.loadingAvailability','Loading availability...') : availabilityError ? availabilityError : ''}
            </div>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-56 overflow-y-auto">
            {timeSlots.map((slot) => {
              const status = getSlotStatus(activeArea, slot); // 'available' | 'booked' | 'past'
              const isSelected = selectedSlots.includes(slot);

              // Determine classes and disabled state
              let classes = 'px-2 py-3 rounded text-sm';
              let disabled = false;
              if (status === 'past') {
                classes += ' bg-gray-100 text-gray-400 cursor-not-allowed';
                disabled = true;
              } else if (status === 'booked') {
                // light red for already-booked slots (non-editable)
                classes += ' bg-red-100 text-red-600 cursor-not-allowed relative border-red-200';
                disabled = true;
              } else {
                // available
                if (isSelected) classes += ' bg-green-500 text-white';
                else classes += ' bg-white hover:bg-green-50 border';
              }

              return (
                <button
                  key={slot}
                  className={classes}
                  onClick={() => handleSelectSlot(slot)}
                  disabled={disabled}
                  aria-disabled={disabled}
                  title={status === 'booked' ? t('booking.booked','Booked') : status === 'past' ? t('booking.past','Past') : ''}
                >
                  <div className="flex items-center justify-center">
                    <span>{slot}</span>
                    {status === 'booked' && (
                      <span className="ml-2 text-xs text-red-600 font-medium">{t('booking.legend.booked')}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Giờ đã chọn */}
          <div className="p-4 border-t">
          <h4 className="text-lg font-semibold mb-2">{t('booking.selectedSlots') || t('booking.timeSlotsLabel')}</h4>
          {selectedSlots.length === 0 ? (
            <p className="text-gray-500">{t('booking.noSlotsSelected')}</p>
          ) : (
            <div className="mb-4">
              <ul className="flex flex-wrap gap-2 mb-3">
                {selectedSlots.map(slot => (
                  <li key={slot} className="bg-blue-100 text-blue-700 px-3 py-1 rounded-lg flex items-center">
                    <span>{slot} - {getEndTime(slot)}</span>
                    <button 
                      className="ml-2 text-blue-500 hover:text-blue-700"
                      onClick={() => setSelectedSlots(prev => prev.filter(s => s !== slot))}
                    >
                      &times;
                    </button>
                  </li>
                ))}
              </ul>
              <div className="font-bold text-lg">{t('booking.total','Total')}: <span className="text-green-600">{tongTien.toLocaleString()}đ</span></div>
            </div>
          )}
        </div>

        {/* Footer */}
          <div className="p-4 border-t flex justify-end">
          <button 
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded mr-2"
            onClick={onClose}
          >
            {t('common.cancel')}
          </button>
          <button 
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-300 hover:bg-blue-700"
            disabled={selectedSlots.length === 0}
            onClick={handleSubmit}
          >
            {t('booking.confirmButton')}
          </button>
        </div>
      </div>
    </div>
  );
};export default BookingModal;
