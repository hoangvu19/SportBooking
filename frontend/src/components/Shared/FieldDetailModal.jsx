import React, { useEffect, useState } from 'react';
import BookingModal from '../../components/Sport/BookingModal';
import Loading from '../Shared/Loading';
import { facilityAPI, bookingAPI, sportFieldAPI } from '../../utils/api';
import { getVnIsoDate } from '../../utils/vnTime';
import { generateTimeSlots } from '../../utils/bookingUtils';
import { useI18n } from '../../i18n';

const FieldDetailModal = ({ fieldId, isOpen, onClose }) => {
  const [san, setSan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [selectedInitialSlots, setSelectedInitialSlots] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() => getVnIsoDate());
  const [activeArea, setActiveArea] = useState(null);
  const [bookedIntervals, setBookedIntervals] = useState([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !fieldId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        // Try SportField first (more common case from field lists)
        let res = await sportFieldAPI.getById(Number(fieldId)).catch(() => null);
        if (res && res.success && res.data) {
          // Successfully got sport field data
          const s = res.data;
          const sanLike = {
            FieldID: s.FieldID || s.SanID || s.id,
            TenSan: s.FieldName || s.TenSan || s.name,
            GiaThue: s.RentalPrice || s.GiaThue || 0,
            TrangThai: s.Status || s.TrangThai || 'Available',
            KhuVuc: s.AreaName || s.KhuVuc || null,
            HinhAnh: (s.images && s.images[0] && (s.images[0].ImageUrl || s.images[0].URL || s.images[0].Data)) || s.HinhAnh || s.Image || null,
            images: Array.isArray(s.images) ? s.images : (s.images ? [s.images] : []),
            sportFields: []
          };
          res = { success: true, data: sanLike };
        } else {
          // Fallback: try as facility ID
          res = await facilityAPI.getById(Number(fieldId)).catch(() => null);
        }

        if (!cancelled && res && res.success && res.data) {
          setSan(res.data);
          if (Array.isArray(res.data.sportFields) && res.data.sportFields.length > 0) {
            setActiveArea(res.data.sportFields[0]);
          } else {
            setActiveArea({ id: res.data.FieldID || res.data.SanID || null, name: res.data.TenSan || res.data.FieldName || res.data.TenCoSo || 'Main' });
          }
        }
      } catch (err) {
        console.error('FieldDetailModal load error', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [isOpen, fieldId]);

  useEffect(() => {
    const fieldIdToFetch = activeArea && (activeArea.FieldID || activeArea.id || activeArea.SanID) ? (activeArea.FieldID || activeArea.id || activeArea.SanID) : (san && (san.FieldID || san.SanID) ? (san.FieldID || san.SanID) : null);
    if (!fieldIdToFetch || !selectedDate) {
      setBookedIntervals([]);
      return;
    }
    let cancelled = false;
    const fetchAvail = async () => {
      setAvailabilityLoading(true);
      try {
        const resp = await bookingAPI.getFieldAvailability(fieldIdToFetch, selectedDate).catch(() => null);
        if (cancelled) return;
        if (resp && resp.success && Array.isArray(resp.data)) {
          const intervals = resp.data.map(b => ({ start: new Date(b.StartTime), end: new Date(b.EndTime) }));
          setBookedIntervals(intervals);
        } else {
          setBookedIntervals([]);
        }
      } catch (err) {
        console.error('FieldDetail availability fetch error', err);
        setBookedIntervals([]);
      } finally {
        if (!cancelled) setAvailabilityLoading(false);
      }
    };
    fetchAvail();
    return () => { cancelled = true; };
  }, [activeArea, selectedDate, san]);

  const { t } = useI18n();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b flex justify-between items-start gap-2">
          <div>
            <h3 className="text-lg font-bold">{san ? (san.TenSan || san.FieldName || san.TenCoSo) : t('fieldDetail.title','Field details')}</h3>
            <div className="text-sm text-gray-600">{san && (san.KhuVuc || san.AreaName || san.KhuVuc)}</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowBooking(true)} className="px-3 py-2 bg-indigo-600 text-white rounded">{t('booking.bookNow','Book')}</button>
            <button onClick={onClose} className="px-3 py-2 border rounded">{t('common.close','Close')}</button>
          </div>
        </div>

        <div className="p-4">
          {loading ? (
            <Loading />
          ) : san ? (
            <div className="grid md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <div className="w-full h-48 bg-gray-100 rounded overflow-hidden">
                  {(() => {
                    const rawImg = san && (san.HinhAnh || (san.images && san.images[0] && (san.images[0].ImageUrl || san.images[0].URL || san.images[0].Data)));
                    const imgSrc = (typeof rawImg === 'string' && rawImg.trim() !== '') ? rawImg : null;
                    if (imgSrc) {
                      return <img src={imgSrc} alt="san" className="w-full h-full object-cover" />;
                    }
                    return (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">{t('common.noImage','No Image')}</div>
                    );
                  })()}
                </div>
                <div className="mt-3 text-sm text-gray-700">
                  <div><strong>{t('booking.price','Price')}:</strong> {(san.GiaThue || san.RentalPrice || san.RentalPrice) ? (Number(san.GiaThue || san.RentalPrice || 0).toLocaleString() + 'đ') : '—'}</div>
                  <div className="mt-1"><strong>{t('fieldDetail.status','Status')}:</strong> {san.TrangThai || san.Status || '—'}</div>
                </div>
              </div>

              <div className="md:col-span-2">
                <div className="mb-4 text-sm text-gray-700">{san.MoTa || san.Description || ''}</div>

                <div>
                  <h4 className="font-medium mb-2">{t('fieldDetail.scheduleTitle','Availability & Booking')}</h4>
                  <p className="text-xs text-gray-500 mb-2">{t('fieldDetail.scheduleHelp','Select a date and time slot below, then click a slot to open the booking modal.')}</p>
                  <div className="flex items-center gap-3 mb-3">
                    <label className="text-sm">{t('fieldDetail.chooseDate','Choose date')}:</label>
                    <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="border rounded px-2 py-1" min={getVnIsoDate()} />
                  </div>

                  <div className="mb-3">
                    <div className="flex gap-2 flex-wrap">
                      {(Array.isArray(san.sportFields) && san.sportFields.length > 0 ? san.sportFields : (san && [{ id: san.FieldID || san.SanID, name: san.TenSan || san.FieldName }])).map((area) => {
                        const aid = area.FieldID || area.id || area.SanID || null;
                        const isSel = activeArea && (String(activeArea.FieldID || activeArea.id || activeArea.SanID) === String(aid));
                        return (
                          <button key={aid || area.name} onClick={() => setActiveArea(area)} className={`px-3 py-1 rounded border ${isSel ? 'ring-2 ring-indigo-500' : 'hover:shadow-sm'}`}>
                            {area.FieldName || area.TenSan || area.name || t('fieldDetail.areaFallback','Area')}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    {availabilityLoading ? <div className="text-sm text-gray-500">{t('common.loading','Loading...')}</div> : (
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                        {generateTimeSlots(selectedDate, san.GiaThue || san.RentalPrice || 0).map(slot => {
                          // determine if slot is booked by comparing bookedIntervals
                          const slotStart = new Date(`${selectedDate}T${slot.start}:00`);
                          const slotEnd = new Date(`${selectedDate}T${slot.end}:00`);
                          const isPast = slotStart < new Date();
                          const isBooked = bookedIntervals.some(it => slotStart < it.end && slotEnd > it.start);
                          return (
                            <button
                              key={slot.id}
                              onClick={() => {
                                if (isBooked || isPast) return;
                                setSelectedInitialSlots([slot.start]);
                                // set active area id/object for BookingModal
                                setShowBooking(true);
                              }}
                              className={`px-2 py-2 text-sm rounded text-left border ${isBooked ? 'bg-red-100 text-red-700 cursor-not-allowed' : isPast ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'hover:bg-green-50 bg-white'}`}
                              disabled={isBooked || isPast}
                            >
                              <div className="font-medium">{slot.start}</div>
                              <div className="text-xs text-gray-500">{slot.price ? (Number(slot.price).toLocaleString() + 'đ') : ''}</div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Optionally, show a short list of sport fields if present */}
                {Array.isArray(san.sportFields) && san.sportFields.length > 0 && (
                  <div className="mt-4">
                    <h5 className="font-medium">{t('fieldDetail.subFields','Sub fields')}</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      {san.sportFields.map(sf => (
                        <div key={sf.FieldID || sf.SanID || sf.id} className="p-2 border rounded">
                          <div className="font-semibold">{sf.FieldName || sf.TenSan || `Field ${sf.FieldID || sf.SanID || ''}`}</div>
                          <div className="text-sm text-gray-600">{sf.FieldType || sf.LoaiSan || ''} • {(sf.RentalPrice || sf.GiaThue) ? Number(sf.RentalPrice || sf.GiaThue).toLocaleString() + 'đ' : '—'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </div>
          ) : (
            <div>{t('fieldDetail.notFound','Field information not found.')}</div>
          )}
        </div>
      </div>

      {showBooking && san && (
        <BookingModal
          san={san}
          onClose={() => { setShowBooking(false); setSelectedInitialSlots([]); }}
          initialDate={selectedDate}
          initialSelectedSlots={selectedInitialSlots}
          initialArea={activeArea}
          onBookingSuccess={(data) => {
            // After booking, close booking modal and optionally close field detail
            setShowBooking(false);
            setSelectedInitialSlots([]);
            // dispatch booking event so other components update
            window.dispatchEvent(new CustomEvent('booking:created', { detail: { booking: data } }));
          }}
        />
      )}
    </div>
  );
};

export default FieldDetailModal;
