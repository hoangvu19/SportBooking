import React, { useState, useEffect } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import "../../App.css";
import { facilityAPI, reportAPI } from "../../utils/api";
import toast from 'react-hot-toast';
import { determineStatusCodeFromFields } from "../../utils/statusUtils";
import { useI18n } from '../../i18n/hooks';
import { getVnIsoDate } from '../../utils/vnTime';
import DEFAULT_AVATAR from "../../utils/defaults";
import BookingModal from "../../components/Sport/BookingModal";
import FeedbackSection from "../../components/Sport/FeedbackSection";
import Loading from "../../components/Shared/Loading";
import { generateTimeSlots } from "../../utils/bookingUtils";
import { bookingAPI } from "../../utils/api";

export default function SanDetail() {
  const { sanId } = useParams();
  const [schedule, setSchedule] = useState([]);
  const [selectedDate, setSelectedDate] = useState(0); // Index of the selected day
  const [showBooking, setShowBooking] = useState(false);
  const [bookingInitialSlots, setBookingInitialSlots] = useState([]);
  const [bookingInitialDate, setBookingInitialDate] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [san, setSan] = useState(null);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { t } = useI18n();
  const generateSchedule = React.useCallback((basePrice, fieldIds) => {
    const days = [];
    const today = new Date();

    const ids = Array.isArray(fieldIds) ? fieldIds : (fieldIds ? [fieldIds] : []);

    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(today);
      currentDate.setDate(today.getDate() + i);

      const dateStr = getVnIsoDate(currentDate);
      const displayStr = i === 0 ? t('common.today','Today') : 
        i === 1 ? t('common.tomorrow','Tomorrow') :
        new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'short', day: 'numeric', month: 'numeric' }).format(currentDate);

      // create placeholder slots and set optimistic availableCount (number of areas)
      let slots = generateTimeSlots(dateStr, basePrice).map(s => ({
        ...s,
        availableCount: ids.length > 0 ? ids.length : undefined,
        isBooked: false
      }));

      // If we have multiple field ids, fetch availability for each and aggregate
      if (ids.length > 0) {
        (async () => {
          try {
            const results = await Promise.all(ids.map(id => bookingAPI.getFieldAvailability(id, dateStr).catch(() => ({ success: false, data: [] }))));

            // Build sets of booked start times per field
            const bookedSets = results.map(r => {
              const set = new Set();
              try {
                if (r && r.success && Array.isArray(r.data)) {
                  r.data.forEach(b => {
                    try {
                      const startTime = new Date(b.StartTime);
                      const endTime = new Date(b.EndTime);
                      
                      // Add ALL 30-minute slots between StartTime and EndTime
                      let current = new Date(startTime);
                      while (current < endTime) {
                        const hh = String(current.getHours()).padStart(2, '0');
                        const mm = String(current.getMinutes()).padStart(2, '0');
                        set.add(`${hh}:${mm}`);
                        console.log(`🔒 Marking slot as booked: ${hh}:${mm} (BookingID: ${b.BookingID})`);
                        
                        // Move to next 30-minute slot
                        current = new Date(current.getTime() + 30 * 60 * 1000);
                      }
                    } catch (err) {
                      console.warn('Error parsing booking time:', err);
                    }
                  });
                }
              } catch { /* ignore */ }
              return set;
            });

            const totalFields = ids.length;

            const patched = slots.map(s => {
              let bookedCount = 0;
              for (const bs of bookedSets) {
                if (bs.has(s.start)) bookedCount++;
              }
              const availableCount = Math.max(0, totalFields - bookedCount);
              // Mark as booked if ANY field has this slot booked
              const isBooked = bookedCount > 0;
              return { ...s, availableCount, isBooked };
            });

            console.log(`✅ Updated ${dateStr} with ${patched.filter(s => s.isBooked).length} booked slots`);
            setSchedule(prev => prev.map(d => d.date === dateStr ? { ...d, slots: patched } : d));
          } catch (err) {
            console.debug('Could not fetch aggregated availability for date', dateStr, err);
          }
        })();
      }

      days.push({
        date: dateStr,
        display: displayStr,
        slots: slots
      });
    }

    setSchedule(days);
  }, [t]);

  const fetchFacilityDetail = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await facilityAPI.getById(Number(sanId));
      if (result.success && result.data) {
        const field = result.data;
        // Map facility -> sanData but preserve sportFields list when present
        const sanData = {
          SanID: field.SanID || field.FieldID,
          FieldID: field.FieldID,
          TenSan: field.TenSan || field.FieldName,
          LoaiSan: field.LoaiSan || field.FieldType || 'Unknown',
          MonTheThao: field.MonTheThao || field.SportName || 'Unknown',
          GiaThue: field.GiaThue || field.RentalPrice || 0,
          TrangThai: field.TrangThai || field.Status || 'Available',
          KhuVuc: field.KhuVuc || field.AreaName || 'Unknown',
          FieldArea: field.FieldArea || field.KhuVuc || 'Unknown',
          HinhAnh: (() => {
            const m = field && field.images && field.images[0];
            if (m) return m.ImageUrl || m.URL || m.Data || field.HinhAnh || field.Image;
            return field.HinhAnh || field.Image || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 140" fill="%23E2E8F0"%3E%3Crect width="200" height="140" fill="%23E2E8F0"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="%23718096"%3ENo Image%3C/text%3E%3C/svg%3E';
          })(),
          ChuSoHuu: field.ChuSoHuu || {
            HoTen: field.OwnerName || 'Unknown',
            Avatar: field.OwnerAvatar || DEFAULT_AVATAR
          },
          // Facility ID (when using facility API the id is FacilityID; legacy sport-field responses may include CoSoID/FacilityID)
          FacilityID: field.FacilityID || field.CoSoID || field.CoSoID || null,
          TenCoSo: field.TenCoSo || field.FacilityName || field.TenCoSo || null,
          // attach sportFields if backend provided them
          sportFields: Array.isArray(field.sportFields) ? field.sportFields : (field.sportFields || [])
        };
        const _statusCode = determineStatusCodeFromFields(sanData.sportFields, sanData.TrangThai || sanData.Status || 'Available');
        const displayTrangThai = _statusCode === 'available' ? t('booking.available','Available') : (_statusCode === 'maintenance' ? t('booking.maintenance','Maintenance') : (_statusCode === 'unavailable' ? t('booking.unavailable','Unavailable') : (sanData.TrangThai || sanData.Status || 'Unknown')));
        sanData._statusCode = _statusCode;
        sanData.TrangThai = displayTrangThai;

        setSan(sanData);

        // Determine field ids to generate schedule for: include explicit FieldID and all sportFields
        const fieldIds = [];
        if (sanData.FieldID) fieldIds.push(sanData.FieldID);
        if (Array.isArray(sanData.sportFields)) {
          sanData.sportFields.forEach(sf => {
            const id = sf.FieldID || sf.SanID;
            if (id && !fieldIds.includes(id)) fieldIds.push(id);
          });
        }
        // If we didn't collect multiple ids, fall back to first available id (previous behavior)
        const firstFieldId = fieldIds.length > 0 ? fieldIds[0] : null;
        generateSchedule(sanData.GiaThue, fieldIds.length > 0 ? fieldIds : firstFieldId);
      } else {
  setError(result.message || 'Unable to load facility details');
      }
    } catch (err) {
      console.error('Fetch facility detail error:', err);
  setError('Error loading facility details');
    } finally {
      setLoading(false);
    }
  }, [sanId, generateSchedule, t]);

  React.useEffect(() => {
    fetchFacilityDetail();
  }, [fetchFacilityDetail]);

  // Listen for realtime booking events to refresh schedule
  useEffect(() => {
    const onBookingEvent = (event) => {
      const payload = event?.detail;
      if (!payload || !payload.booking) {
        console.log('⚠️ SanDetail: Invalid booking event payload', event);
        return;
      }
      
      const booking = payload.booking;
      const bookingFieldId = booking.FieldID;
      
      console.log('📥 SanDetail: Received booking event, FieldID:', bookingFieldId, 'StartTime:', booking.StartTime, 'EndTime:', booking.EndTime);
      console.log('🔍 SanDetail: Current facility IDs:', {
        'san.FieldID': san?.FieldID,
        'san.FacilityID': san?.FacilityID,
        'san.SanID': san?.SanID,
        'san.sportFields': san?.sportFields?.map(sf => ({ FieldID: sf.FieldID, SanID: sf.SanID }))
      });
      
      // Check if this booking affects current facility
      const isRelevant = san && (
        String(san.FieldID) === String(bookingFieldId) ||
        String(san.FacilityID) === String(bookingFieldId) ||
        String(san.SanID) === String(bookingFieldId) ||
        (Array.isArray(san.sportFields) && san.sportFields.some(sf => 
          String(sf.FieldID || sf.SanID) === String(bookingFieldId)
        ))
      );
      
      if (isRelevant) {
        console.log('✅ SanDetail: Booking affects this facility, UPDATING schedule directly');
        
        // Instead of fetching API again (race condition), update state directly
        const startTime = new Date(booking.StartTime);
        const endTime = new Date(booking.EndTime);
        const bookingDate = getVnIsoDate(startTime);
        
        console.log('🔄 SanDetail: Marking slots as booked for date:', bookingDate);
        
        setSchedule(prevSchedule => {
          return prevSchedule.map(day => {
            if (day.date !== bookingDate) return day;
            
            // Build set of times to mark as booked
            const bookedTimes = new Set();
            let current = new Date(startTime);
            while (current < endTime) {
              const hh = String(current.getHours()).padStart(2, '0');
              const mm = String(current.getMinutes()).padStart(2, '0');
              const timeStr = `${hh}:${mm}`;
              bookedTimes.add(timeStr);
              console.log(`🔒 SanDetail: Marking ${timeStr} as booked for ${bookingDate}`);
              current = new Date(current.getTime() + 30 * 60 * 1000);
            }
            
            // Update slots
            const updatedSlots = day.slots.map(slot => {
              if (bookedTimes.has(slot.start)) {
                console.log(`✅ SanDetail: Slot ${slot.start} updated to booked`);
                return {
                  ...slot,
                  isBooked: true,
                  availableCount: Math.max(0, (slot.availableCount || 1) - 1)
                };
              }
              return slot;
            });
            
            console.log(`✅ SanDetail: Updated ${bookingDate} - marked ${bookedTimes.size} slots as booked`);
            return { ...day, slots: updatedSlots };
          });
        });
      } else {
        console.log('ℹ️ SanDetail: Booking not relevant to this facility');
      }
    };

    console.log('✅ SanDetail: Registering booking event listeners');
    window.addEventListener('booking:created', onBookingEvent);
    window.addEventListener('booking:cancelled', onBookingEvent);

    return () => {
      console.log('🧹 SanDetail: Cleaning up booking event listeners');
      window.removeEventListener('booking:created', onBookingEvent);
      window.removeEventListener('booking:cancelled', onBookingEvent);
    };
  }, [san]); // Removed generateSchedule dependency - we update state directly now

  // If navigated here with state.openBooking, open the booking modal and clear the state
  useEffect(() => {
    try {
      // First check navigation state
      const st = location && location.state ? location.state : null;
      const params = new URLSearchParams(location.search);
      const qpOpen = params.get('openBooking');

      const shouldOpenFromState = st && st.openBooking;
      const shouldOpenFromQuery = qpOpen === '1' || qpOpen === 'true';

      if (shouldOpenFromState || shouldOpenFromQuery) {
        // If we already have san data, open immediately; otherwise wait for san fetch
        if (san) {
          // Prefer state-provided initial values, fall back to query-based defaults
          setBookingInitialDate(st?.initialDate || null);
          setBookingInitialSlots(st?.initialSlots || []);
          setShowBooking(true);
        } else {
          // If san is not yet loaded, do NOT clear the navigation state or query here.
          // Wait until san is available so the effect can open the modal on re-run.
          return;
        }

        // Clear history state and query so refresh/back does not reopen modal --- do this only after
        // we've successfully opened the modal (san existed and setShowBooking was called).
        try {
          navigate(location.pathname, { replace: true, state: {} });
        } catch { /* ignore */ }
      }
    } catch (err) { console.debug('No navigation state', err); }
  }, [location, san, navigate]);

  

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
            {t('common.retry','Retry')}
          </button>
        </div>
      </div>
    );
  }

  if (!san) return <div className="p-6">{t('booking.facilityNotFound','Field not found!')}</div>;

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
            <div className="absolute top-4 right-4 z-40">
              <span className={`px-4 py-2 rounded-full text-sm font-semibold shadow-lg ${
                san._statusCode === 'available' 
                  ? 'bg-green-500 text-white' 
                  : 'bg-red-500 text-white'
              }`}>
                {san.TrangThai}
              </span>
            </div>
            <div className="absolute top-4 left-4 z-40">
              {!showReportForm ? (
                <button
                  onClick={() => setShowReportForm(true)}
                  className="px-3 py-1 bg-red-600 text-white rounded-md text-sm shadow hover:bg-red-700"
                >
                  {t('report.report','Report')}
                </button>
              ) : (
                <div className="bg-white p-3 rounded-md shadow-lg w-80">
                  <div className="flex items-center justify-between mb-2">
                    <strong className="text-sm">{t('report.reportFacility','Report facility')}</strong>
                    <button onClick={() => setShowReportForm(false)} className="text-gray-500 text-sm">{t('common.close','Close')}</button>
                  </div>
                  <div className="mb-2">
                    <input
                      placeholder={t('report.reasonPlaceholder','Reason (spam, inappropriate, other)')}
                      value={reportReason}
                      onChange={(e) => setReportReason(e.target.value)}
                      className="w-full border rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="mb-3">
                    <textarea
                      placeholder={t('report.descriptionPlaceholder','Optional details')}
                      value={reportDescription}
                      onChange={(e) => setReportDescription(e.target.value)}
                      className="w-full border rounded px-2 py-1 text-sm h-20"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => { setShowReportForm(false); setReportReason(''); setReportDescription(''); }} className="px-3 py-1 text-sm rounded border">{t('common.cancel','Cancel')}</button>
                    <button
                      onClick={async () => {
                        if (!reportReason) return toast.error(t('report.requireReason','Please provide a reason'));
                        setReportLoading(true);
                        try {
                          const payload = {
                            contentType: 'facility',
                            contentId: san.FacilityID || san.SanID || san.FieldID,
                            reason: reportReason,
                            description: reportDescription
                          };
                          const res = await reportAPI.create(payload);
                          if (res && res.success) {
                            toast.success(t('report.thanks','Report submitted — thank you'));
                            setShowReportForm(false);
                            setReportReason('');
                            setReportDescription('');
                          } else {
                            throw new Error(res && res.message ? res.message : 'Report failed');
                          }
                        } catch (err) {
                          console.error('Report submit error', err);
                          toast.error(err && err.message ? err.message : t('report.failed','Could not submit report'));
                        } finally {
                          setReportLoading(false);
                        }
                      }}
                      disabled={reportLoading}
                      className="px-3 py-1 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 disabled:opacity-60"
                    >
                      {reportLoading ? t('common.submitting','Submitting...') : t('common.submit','Submit')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
  {/* Schedule Section */}
  <div className="bg-white rounded-2xl shadow-lg p-6 mb-10">
            <div className="flex items-center space-x-2 mb-6">
            <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h2 className="text-2xl font-bold text-gray-800">{t('booking.availableSchedule','Available schedule')}</h2>
          </div>
          
          {schedule.length > 0 ? (
            <>
              {/* Date Tabs */}
              <div className="flex overflow-x-auto pb-2 mb-4 space-x-2 no-scrollbar">
                {schedule.map((day, idx) => (
                  <button 
                    key={day.date} 
                    className={`px-3 py-2 text-sm text-center rounded-md cursor-pointer flex-shrink-0 font-medium transition-colors duration-150 ${
                      selectedDate === idx 
                        ? 'bg-indigo-600 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    onClick={() => setSelectedDate(idx)}
                  >
                    {day.display}
                  </button>
                ))}
              </div>
              {/* Legend + Time Slots Grid */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-200 inline-block"/> {t('booking.legend.available')}</span>
                    <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-200 inline-block"/> {t('booking.legend.booked')}</span>
                    <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-indigo-200 inline-block"/> {t('booking.legend.selected')}</span>
                  </div>
                </div>
                <div>
                    <button
                    className={`${san && san._statusCode !== 'available' ? 'text-gray-400 cursor-not-allowed' : 'text-indigo-600'} text-sm underline`}
                    onClick={() => {
                      if (!san || san._statusCode !== 'available') return;
                      setBookingInitialDate(schedule[selectedDate]?.date || null);
                      setBookingInitialSlots([]);
                      setShowBooking(true);
                    }}
                    disabled={!(san && san._statusCode === 'available')}
                  >
                    {t('booking.bookMultipleSlots','Book multiple slots')}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 lg:grid-cols-8 gap-2">
                {schedule[selectedDate]?.slots.map(slot => (
                  (() => {
                    const day = schedule[selectedDate]?.date;
                    const isoStart = `${day}T${slot.start}:00+07:00`;
                    const startDt = new Date(isoStart);
                    const now = new Date();
                    const isPastTime = startDt < now;
                    const allBooked = (typeof slot.availableCount === 'number') ? slot.availableCount <= 0 : false;
                    let slotState = 'available';
                    if (slot.isBooked) slotState = 'booked';
                    else if (isPastTime || allBooked) slotState = 'past';
                    const canBook = slotState === 'available' && !isPastTime && san && san._statusCode === 'available';
                    const baseClass = slotState === 'booked'
                      ? 'bg-red-100 border-red-200 text-red-600'
                      : slotState === 'past'
                        ? 'bg-gray-50 border-gray-100 text-gray-400 opacity-80'
                        : 'bg-green-50 border-green-100 text-gray-800';

                    return (
                  <div 
                    key={slot.id}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' && canBook) { setBookingInitialDate(schedule[selectedDate].date); setBookingInitialSlots([slot.start]); setShowBooking(true); } }}
                    onClick={() => { if (canBook) { setBookingInitialDate(schedule[selectedDate].date); setBookingInitialSlots([slot.start]); setShowBooking(true); } }}
                    className={`relative p-2 rounded-md border text-xs flex flex-col justify-between ${baseClass} ${canBook ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                      <div>
                        <div className="flex items-center gap-1 mb-0">
                          <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className={`font-semibold text-sm ${slotState === 'past' ? 'text-gray-500' : 'text-gray-800'}`}>{slot.start}</span>
                          <span className={`text-[11px] ${slotState === 'past' ? 'text-gray-400' : 'text-gray-400'}`}> - {slot.end}</span>
                        </div>
                        <div className="mt-1">
                                  {slotState === 'booked' ? (
                                      <span className="text-red-600 text-[12px]">{t('booking.legend.booked')}</span>
                                    ) : slotState === 'past' ? (
                                      <span className="text-gray-400 text-[12px]">{t('booking.past')}</span>
                                    ) : (
                                      <span className="text-green-700 text-sm">{t('')}</span>
                                    )}
                        </div>
                      </div>
                    </div>
                    );
                  })()
                ))}
              </div>
            </>
          ) : (
                <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent mx-auto mb-4"></div>
                <p className="text-gray-500 font-medium">{t('booking.loadingSchedule','Loading schedule...')}</p>
            </div>
          )}
  </div>
  <FeedbackSection targetType="Facility" targetId={san.FacilityID || san.CoSoID || san.SanID || san.FieldID} />
      </div>

    

      {/* Booking Modal */}
      {showBooking && (
        <BookingModal
          san={san}
          onClose={() => { setShowBooking(false); setBookingInitialSlots([]); setBookingInitialDate(null); }}
          onBookingSuccess={() => {
            // Don't refetch - realtime listener will update schedule automatically
            console.log('✅ SanDetail: Booking created, realtime will update schedule');
          }}
          initialDate={bookingInitialDate || schedule[selectedDate]?.date || null}
          initialSelectedSlots={bookingInitialSlots}
          initialArea={
            (san && Array.isArray(san.sportFields) && san.sportFields[0])
              ? { id: san.sportFields[0].FieldID || san.sportFields[0].SanID, name: san.sportFields[0].FieldName || san.sportFields[0].TenSan }
              : (san.KhuVuc || null)
          }
        />
      )}
    </div>
  );
}
