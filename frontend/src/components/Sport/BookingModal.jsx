import React from 'react';
import { getVnIsoDate } from '../../utils/vnTime';
import { getEndTime, timeSlots } from "../../utils/bookingUtils";
import { bookingAPI } from "../../utils/api";
import { determineFieldStatus } from '../../utils/statusUtils';
import toast from 'react-hot-toast';
import { useI18n } from '../../i18n/hooks';
import { getPhone, normalizeUser } from '../../utils/normalize';

// Modal đặt sân
const BookingModal = ({ san, onClose, initialDate = null, initialSelectedSlots = [], initialArea = null, onBookingSuccess }) => {
  const [date, setDate] = React.useState(initialDate || getVnIsoDate());
  const { t } = useI18n();
  // activeArea will be an object { id, name } when available
  const [activeArea, setActiveArea] = React.useState(
    initialArea ? (typeof initialArea === 'object' ? initialArea : { id: initialArea, name: null }) : null
  );
  const [selectedSlots, setSelectedSlots] = React.useState(Array.isArray(initialSelectedSlots) ? initialSelectedSlots : []);
  const [form, _setForm] = React.useState({ note: "" });
  const [guestName, setGuestName] = React.useState('');
  const [guestPhone, setGuestPhone] = React.useState('');
  const [guestEmail, setGuestEmail] = React.useState('');
  const hasLocalUser = (() => {
    try {
      const s = localStorage.getItem('userData');
      return !!(s && s !== 'undefined');
    } catch (err) { return false; }
  })();

  // Fetch areas from facility data (not from assets)
  // areas: array of { id, name }
  const [areas, setAreas] = React.useState([]);
  const [availabilityLoading, setAvailabilityLoading] = React.useState(false);
  const [availabilityError, setAvailabilityError] = React.useState(null);
  const [bookedIntervals, setBookedIntervals] = React.useState([]); // array of { start: Date, end: Date }

  React.useEffect(() => {
    // Prefer explicit sportFields (each sport field becomes a selectable "area")
    if (san && Array.isArray(san.sportFields) && san.sportFields.length > 0) {
      // If sportFields were enriched with status info upstream, reuse it; otherwise compute fallback using shared util
      const areaObjs = san.sportFields.map(sf => {
        const code = sf._statusCode || determineFieldStatus(sf);
        const display = sf.TrangThai || sf.Status || (code === 'available' ? t('booking.available','Available') : (code === 'maintenance' ? t('booking.maintenance','Maintenance') : (code === 'unavailable' ? t('booking.unavailable','Unavailable') : 'Unknown')));
        return {
          id: sf.FieldID || sf.SanID || sf.FieldId || null,
          name: sf.FieldName || sf.TenSan || (`Field ${sf.FieldID || sf.SanID || ''}`),
          _statusCode: code,
          TrangThai: display,
          // include any media attached to the sportField so area thumbnails can use it directly
          images: Array.isArray(sf.images) ? sf.images : (sf.images ? [sf.images] : []),
          // copy common metadata so the UI can show full area details
          FieldType: sf.FieldType || sf.LoaiSan || null,
          RentalPrice: sf.RentalPrice || sf.GiaThue || null,
          Status: sf.Status || sf.TrangThai || null,
          SportTypeID: sf.SportTypeID || null,
          SportTypeName: sf.SportTypeName || sf.SportType || null,
          Rating: sf.Rating || null,
          ReviewCount: sf.ReviewCount || sf.Reviews || null,
          Description: sf.MoTa || sf.Description || sf.GioiThieu || null
        };
      });
      setAreas(areaObjs);
      setActiveArea(areaObjs[0]);
      return;
    }

    // Get areas from the facility's FieldArea if sportFields not present
    if (san && san.FieldArea) {
      const list = san.FieldArea.includes(',') ? san.FieldArea.split(',').map(a => a.trim()) : [san.FieldArea];
      const areaObjs = list.map(name => ({ id: null, name }));
      setAreas(areaObjs);
      setActiveArea(areaObjs[0]);
      return;
    }

    if (san && san.KhuVuc) {
      const list = san.KhuVuc.includes(',') ? san.KhuVuc.split(',').map(a => a.trim()) : [san.KhuVuc];
      const areaObjs = list.map(name => ({ id: null, name }));
      setAreas(areaObjs);
      setActiveArea(areaObjs[0]);
      return;
    }

    // Fallback if no area data
    const fallback = [{ id: null, name: 'Main area' }];
    setAreas(fallback);
    setActiveArea(fallback[0]);
  }, [san, t]);

  // Get image for an area (prefer sportField image if available, fallback to facility image)
  const getAreaImage = (area) => {
    // Prefer sportField-level images when area maps to a sportField id
    try {
      // If area object already carries images (we set this when mapping), prefer it
      if (area && area.images && Array.isArray(area.images) && area.images.length > 0) {
        const am = area.images[0];
        return am.ImageUrl || am.URL || am.Data || area.HinhAnh || area.Image;
      }
      const areaId = area && (area.id || area.FieldID || area.SanID);
      if (areaId && san && Array.isArray(san.sportFields)) {
        const sf = san.sportFields.find(s => String(s.FieldID || s.SanID || s.id) === String(areaId));
        if (sf) {
          const m = sf.images && sf.images[0];
          if (m) return m.ImageUrl || m.URL || m.Data || sf.HinhAnh || sf.Image;
          // fallback to legacy field image
          if (sf.HinhAnh || sf.Image) return sf.HinhAnh || sf.Image;
        }
      }

      // Fallback to facility-level image
      const fm = san && (san.images && san.images[0]);
      if (fm) return fm.ImageUrl || fm.URL || fm.Data || san?.HinhAnh;
  } catch { /* ignore */ }
    return san?.HinhAnh || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 140" fill="%23E2E8F0"%3E%3Crect width="200" height="140" fill="%23E2E8F0"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="%23718096"%3ENo Image%3C/text%3E%3C/svg%3E';
  };

  // Determine slot status (try real data first, fallback heuristics)
  const getSlotStatus = (areaObj, slot) => {
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
    if (slot < '08:00' && areaObj && areaObj.name === 'A1') return 'booked';
    if (slot > '20:00' && areaObj && (areaObj.name === 'A3' || areaObj.name === 'B1')) return 'booked';
    return 'available';
  };

  // Chọn slot - CHỈ CHO PHÉP CHỌN 1 SLOT DUY NHẤT
  const handleSelectSlot = (slot) => {
    const st = getSlotStatus(activeArea, slot);
    if (st === 'booked' || st === 'past') return;

    // Nếu click vào slot đã chọn → bỏ chọn
    if (selectedSlots.includes(slot)) {
      setSelectedSlots([]);
    } else {
      // Nếu click vào slot mới → thay thế slot cũ (chỉ giữ 1 slot)
      setSelectedSlots([slot]);
    }
  };

  // Initialize from props when they change
  React.useEffect(() => { if (initialDate) setDate(initialDate); }, [initialDate]);

  // Sync initialArea prop (can be id or object)
  React.useEffect(() => {
    if (!initialArea) return;
    if (typeof initialArea === 'object' && initialArea.id) setActiveArea(initialArea);
    else setActiveArea({ id: initialArea, name: null });
  }, [initialArea]);

  React.useEffect(() => {
    if (Array.isArray(initialSelectedSlots) && initialSelectedSlots.length) {
      setSelectedSlots(initialSelectedSlots);
    }
  }, [initialSelectedSlots]);

  // Fetch real availability for the selected date and active area/field
  React.useEffect(() => {
    // Determine the field id to fetch availability for. Prefer the active sport field id.
    const fieldId = (activeArea && activeArea.id) ? activeArea.id : (san && (san.FieldID || san.SanID) ? (san.FieldID || san.SanID) : null);
    if (!fieldId || !date) {
      setBookedIntervals([]);
      return;
    }
    let cancelled = false;
    const fetchAvail = async () => {
      setAvailabilityLoading(true);
      setAvailabilityError(null);
      try {
        const resp = await bookingAPI.getFieldAvailability(fieldId, date);
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
  }, [san, date, activeArea, t]);

  // When active area changes, clear selected slots (user should reselect for that area)
  React.useEffect(() => {
    setSelectedSlots([]);
  }, [activeArea]);

  // Tổng tiền (moved below to use area price when available)

  // Form xác nhận
  const handleSubmit = async () => {
    // Block booking if facility or selected area is not available
    if (san && san._statusCode && san._statusCode !== 'available') {
      toast.error(t('booking.cannotBookFacility','This facility is not available for booking'));
      return;
    }
    if (activeArea && activeArea._statusCode && activeArea._statusCode !== 'available') {
      toast.error(t('booking.cannotBookArea','Selected area is not available for booking'));
      return;
    }

    if (selectedSlots.length === 0) {
      toast.error(t('booking.selectSlot','Please select a time slot'));
      return;
    }

    // Get user info from localStorage (if present). If not present, fall back to guest inputs.
    let userData = null;
    try {
      const userStr = localStorage.getItem('userData');
      if (userStr && userStr !== 'undefined') {
        userData = JSON.parse(userStr);
      }
    } catch (err) {
      console.error('Failed to parse user data:', err);
    }

    // If not logged in, require guest info (admin can fill customer details)
    if (!userData) {
      if (!guestName || guestName.trim() === '') {
        toast.error('Vui lòng nhập tên khách hàng');
        return;
      }
      if (!guestPhone || guestPhone.trim() === '') {
        toast.error('Vui lòng nhập số điện thoại khách hàng');
        return;
      }
    }

    try {
      // Chỉ có 1 slot (30 phút)
      const selectedSlot = selectedSlots[0];
      
      // Create full datetime strings
      const startTime = `${date}T${selectedSlot}:00`;
      const endTime = `${date}T${getEndTime(selectedSlot)}:00`;

      // Prepare booking payload using logged user or guest inputs
      const bookingData = {
        fieldId: (activeArea && activeArea.id) ? activeArea.id : (san.FieldID || san.SanID),
        startTime: startTime,
        endTime: endTime,
        deposit: 0, // Optional
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        note: form.note || ''
      };

      if (userData) {
        const u = normalizeUser(userData || {});
        bookingData.customerName = u.fullName || userData.FullName || userData.Username || 'Customer';
        bookingData.customerPhone = getPhone(u) || getPhone(userData) || '';
        bookingData.customerEmail = u.email || userData.Email || '';
      } else {
        bookingData.customerName = guestName.trim();
        bookingData.customerPhone = guestPhone.trim();
        bookingData.customerEmail = guestEmail.trim();
      }

      console.log('Booking data:', bookingData);
      const result = await bookingAPI.create(bookingData);
      
      if (result.success) {
        toast.success(t('booking.bookingSuccess'));
        
        // PRIORITY 1: Notify parent callback immediately (sync)
        console.log('✅ BookingModal: Booking created successfully, calling onBookingSuccess');
        if (typeof onBookingSuccess === 'function') onBookingSuccess(result.data);
        
        // PRIORITY 2: Dispatch local event (sync)
        console.log('✅ BookingModal: Dispatching booking:created event with full time range');
        console.log('   StartTime:', startTime, 'EndTime:', endTime);
        window.dispatchEvent(new CustomEvent('booking:created', { 
          detail: { 
            booking: {
              ...result.data,
              BookingID: result.data.BookingID,
              FieldID: bookingData.fieldId,
              StartTime: startTime,
              EndTime: endTime,
              Status: 'Pending'
            }
          } 
        }));
        
        // PRIORITY 3: Wait a bit for event to propagate before closing modal
        console.log('⏳ BookingModal: Waiting 100ms for event propagation...');
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Note: Server will emit to other clients automatically via realtimeEmitter
        
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

  // derive area-specific display values for header
  const areaSource = (activeArea && activeArea.id && Array.isArray(san?.sportFields)) ? san.sportFields.find(sf => String(sf.FieldID || sf.SanID || sf.id) === String(activeArea.id)) : null;
  const areaNameDisplay = activeArea?.name || areaSource?.FieldName || areaSource?.TenSan || '';
  const areaTypeDisplay = areaSource?.FieldType || areaSource?.LoaiSan || areaSource?.Type || '';
  const areaPriceVal = areaSource?.RentalPrice || areaSource?.Rental || areaSource?.GiaThue || san?.GiaThue || 0;
  const areaPriceDisplay = areaPriceVal ? Number(areaPriceVal).toLocaleString() + 'đ' : '—';
  const areaStatusDisplay = (areaSource && (areaSource.TrangThai || areaSource.Status)) || activeArea?.TrangThai || (activeArea && activeArea._statusCode) || '';
  const areaSportType = areaSource?.SportTypeName || areaSource?.SportType || areaSource?.SportTypeID || '';
  // Tính tiền: vì chỉ có 1 slot (30 phút) nên tongTien = giá cho 1 slot
  const tongTien = selectedSlots.length > 0 ? (areaPriceVal || 200000) : 0;
  return (
    <div data-testid="booking-modal" className="fixed inset-0 bg-white/95 flex items-center justify-center z-50 p-2 md:p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-[95vw] md:max-w-[1200px] max-h-[96vh] overflow-y-auto">
        {/* Top: image + main details */}
        <div className="sticky top-0 bg-white z-10 border-b">
          <div className="flex flex-col md:flex-row">
            <div className="md:w-1/3 w-full h-44 md:h-56 overflow-hidden rounded-t-xl md:rounded-l-xl md:rounded-tr-none">
              <img src={getAreaImage(activeArea)} alt={`Area ${activeArea ? activeArea.name : ''}`} className="w-full h-full object-cover object-center" />
            </div>
            <div className="md:w-2/3 w-full p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex-1">
                <h3 className="text-lg md:text-2xl font-semibold">{t('booking.book','Book')} — {san?.TenSan || ''}</h3>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-2 text-sm text-gray-700">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800">{areaNameDisplay}</span>
                    {areaSportType ? <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{areaSportType}</span> : null}
                    {areaTypeDisplay ? <span className="text-xs text-gray-500">· {areaTypeDisplay}</span> : null}
                  </div>
                  <div className="flex items-center gap-2 sm:ml-4">
                    <span className={`inline-block px-2 py-0.5 rounded text-sm font-medium ${String(areaStatusDisplay).toLowerCase().includes('available') ? 'bg-green-100 text-green-700' : (String(areaStatusDisplay).toLowerCase().includes('maintenance') ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700')}`}>{areaStatusDisplay || ''}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-start md:items-center gap-3">
                <div className="text-right">
                    <div className="text-sm text-gray-500">{t('booking.pricePerSlot','Price / slot')}</div>
                    <div className="text-lg font-bold text-green-600">{areaPriceDisplay}</div>
                </div>
                <button data-testid="booking-close" onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl">&times;</button>
              </div>
            </div>
          </div>
        </div>

        {/* Controls: date + areas */}
        <div className="p-4 border-b">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div>
                <label className="block font-medium text-sm mb-1">{t('booking.dateLabel','Date')}</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border rounded px-3 py-2" min={getVnIsoDate()} />
              </div>
              <div>
                <label className="block font-medium text-sm mb-1">{t('booking.area','Area')}</label>
                <div className="flex gap-2 items-center">
                  {areas.map((area) => {
                    const imgSrc = getAreaImage(area);
                    const isSelected = activeArea && ((activeArea.id && area.id && String(activeArea.id) === String(area.id)) || (activeArea.name && activeArea.name === area.name));
                    const disabledArea = area._statusCode === 'unavailable';
                    return (
                      <button
                        key={area.id || area.name}
                        onClick={() => { if (!disabledArea) setActiveArea(area); }}
                        className={`flex items-center gap-2 overflow-hidden rounded-md border px-2 py-1 ${isSelected ? 'ring-2 ring-indigo-500' : 'hover:shadow-sm'} ${disabledArea ? 'opacity-60 cursor-not-allowed' : ''}`}
                        type="button"
                        disabled={disabledArea}
                        aria-label={area.TrangThai || ''}
                      >
                        <img src={imgSrc} alt={area.name} className="w-10 h-8 object-cover rounded-sm" />
                        <div className="text-xs text-left">
                          <div className="font-medium">{area.name}</div>
                          <div className={`text-[11px] ${area._statusCode === 'available' ? 'text-green-600' : (area._statusCode === 'maintenance' ? 'text-yellow-600' : 'text-red-600')}`}>
                            {area.TrangThai}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="text-sm text-gray-600">
              {availabilityLoading ? <span>{t('booking.loadingAvailability','Loading availability...')}</span> : availabilityError ? <span className="text-red-500">{availabilityError}</span> : <span>{t('booking.pickSlots','Pick your time slots')}</span>}
            </div>
          </div>
        </div>

        {/* Body: slots grid + summary */}
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <h4 className="text-lg font-semibold mb-3">{t('booking.selectTimeSlots','Select time slots').replace('{area}', activeArea ? activeArea.name : '')}</h4>
            <div className="flex items-center gap-4 mb-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="w-3 h-3 bg-green-500 rounded-sm inline-block" /> <span>{t('booking.legend.selected','Selected')}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="w-3 h-3 bg-red-100 border border-red-300 rounded-sm inline-block" /> <span>{t('booking.legend.booked','Booked')}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="w-3 h-3 bg-gray-100 rounded-sm inline-block" /> <span>{t('booking.legend.past','Past')}</span>
              </div>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-72 overflow-y-auto">
              {timeSlots.map((slot) => {
                const status = getSlotStatus(activeArea, slot);
                const isSelected = selectedSlots.includes(slot);
                let classes = 'px-2 py-3 rounded text-sm text-center transition-all';
                let disabled = false;
                if (status === 'past') { classes += ' bg-gray-100 text-gray-400 cursor-not-allowed'; disabled = true; }
                else if (status === 'booked') { classes += ' bg-red-100 text-red-600 cursor-not-allowed border border-red-200'; disabled = true; }
                else { if (isSelected) classes += ' bg-green-500 text-white'; else classes += ' bg-white hover:bg-green-50 border'; }

                return (
                  <button
                    key={slot}
                    className={classes}
                    onClick={() => handleSelectSlot(slot)}
                    disabled={disabled}
                    aria-disabled={disabled}
                    title={status === 'booked' ? t('booking.booked','Booked') : status === 'past' ? t('booking.past','Past') : ''}
                  >
                    <div className="flex flex-col items-center">
                      <span className="font-medium">{slot}</span>
                      <span className="text-[11px] text-gray-500">{getEndTime(slot)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="md:col-span-1 p-3 border rounded-md h-full flex flex-col justify-between">
            <div>
              <h5 className="font-semibold">{t('booking.selectedSlot','Selected Time') || t('booking.timeSlotsLabel')}</h5>
              {selectedSlots.length === 0 ? (
                <p className="text-gray-500 mt-2">{t('booking.noSlotSelected','Please select a time slot')}</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {selectedSlots.map(slot => (
                    <li key={slot} className="flex items-center justify-between bg-blue-50 px-2 py-1 rounded">
                      <div className="text-sm">{slot} — {getEndTime(slot)}</div>
                      <button className="text-red-500 text-sm" onClick={() => setSelectedSlots([])}>&times;</button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-4 text-sm text-gray-600">
                <div>{t('booking.duration','Duration')}: <span className="font-medium">30 {t('booking.minutes','minutes')}</span></div>
                <div className="mt-1">{t('booking.price','Price')}: <span className="font-medium text-green-600">{areaPriceDisplay}</span></div>
              </div>
            </div>

              {/* Guest info: show when no logged user (admin/guest booking) */}
              {!hasLocalUser && (
                <div className="mt-4 p-3 border rounded mb-4">
                  <h6 className="font-medium mb-2">Thông tin khách hàng</h6>
                  <div className="space-y-2">
                    <input value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Họ và tên" className="w-full border rounded px-2 py-1" />
                    <input value={guestPhone} onChange={e => setGuestPhone(e.target.value)} placeholder="Số điện thoại" className="w-full border rounded px-2 py-1" />
                    <input value={guestEmail} onChange={e => setGuestEmail(e.target.value)} placeholder="Email (không bắt buộc)" className="w-full border rounded px-2 py-1" />
                  </div>
                </div>
              )}

              <div className="mt-4">
              <div className="text-lg font-bold">{t('booking.total','Total')}: <span className="text-green-600">{tongTien.toLocaleString()}đ</span></div>
              <div className="flex gap-2 mt-3">
                <button onClick={onClose} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded">{t('common.cancel')}</button>
                <button
                  onClick={handleSubmit}
                  disabled={
                    selectedSlots.length === 0 ||
                    (san && san._statusCode && san._statusCode !== 'available') ||
                    (activeArea && activeArea._statusCode && activeArea._statusCode !== 'available')
                  }
                  className={`flex-1 px-4 py-2 rounded ${(
                    selectedSlots.length === 0 ||
                    (san && san._statusCode && san._statusCode !== 'available') ||
                    (activeArea && activeArea._statusCode && activeArea._statusCode !== 'available')
                  ) ? 'bg-gray-300 text-gray-700' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                >
                  {t('booking.confirmButton')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingModal;
