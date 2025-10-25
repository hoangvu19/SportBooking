import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import "../../App.css";
import { bookingAPI, facilityAPI } from "../../utils/api";
import { timeSlots } from "../../utils/bookingUtils";
import { useI18n } from '../../i18n/hooks';
import toast from 'react-hot-toast';

function BookingFull() {
  const location = useLocation();
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", note: "" });

  const queryParams = new URLSearchParams(location.search);
  const sanId = queryParams.get("sanId");
  const queryTimeSlot = queryParams.get("timeSlot");

  const [field, setField] = useState(null);
  const [availability, setAvailability] = useState([]);
  const [availLoading, setAvailLoading] = useState(false);
  const [availError, setAvailError] = useState(null);
  const { t } = useI18n();

  useEffect(() => {
    let cancelled = false;
    const fetchFieldAndAvailability = async () => {
      if (!sanId) return;
      setAvailLoading(true);
      setAvailError(null);
  try {
  // try to fetch field details
  let f = null;
  try { f = await facilityAPI.getById(Number(sanId)); } catch { /* ignore */ }
        if (f && f.success && f.data) {
          setField(f.data);
        } else if (f && f.data) {
          setField(f.data);
        }

        const dateStr = new Date().toISOString().split('T')[0];
        const resp = await bookingAPI.getFieldAvailability(Number(sanId), dateStr);
        if (!cancelled) {
          if (resp && resp.success && Array.isArray(resp.data)) {
            setAvailability(resp.data);
            // if queryTimeSlot requested, preselect that slot if available
            if (queryTimeSlot) {
              const slotIndex = parseInt(queryTimeSlot) - 1;
              if (slotIndex >= 0 && slotIndex < resp.data.length) {
                const slot = resp.data[slotIndex];
                const startTime = slot.StartTime ? new Date(slot.StartTime).toTimeString().slice(0,5) : slot.start || slot.Start;
                // only select if free
                const sStatus = slot.Status ? String(slot.Status).toLowerCase() : '';
                if (sStatus === 'available' || sStatus === 'trong' || sStatus === '0' || sStatus === '') {
                  setSelectedSlots([startTime]);
                }
              }
            }
          } else if (Array.isArray(resp)) {
            setAvailability(resp);
          } else {
            setAvailability([]);
          }
        }
      } catch (err) {
        console.error('Failed to load field/availability', err);
        if (!cancelled) setAvailError('Unable to load availability');
      } finally {
        if (!cancelled) setAvailLoading(false);
      }
    };

    fetchFieldAndAvailability();
    return () => { cancelled = true; };
  }, [queryTimeSlot, sanId]);

  const pricePerSlot = field?.GiaThue || 90000;

  const handleSelectSlot = (slot) => {
    // Derive status from availability entries for this field and slot time
    const slotObj = availability.find((s) => {
      const st = s?.StartTime ? new Date(s.StartTime).toTimeString().slice(0,5) : (s.start || s.Start);
      return st === slot;
    });
    const status = slotObj ? (slotObj.Status ?? slotObj.status ?? '') : '';
    const sStatus = String(status).toLowerCase();
    const isAvailable = sStatus === 'available' || sStatus === 'trong' || sStatus === '0' || sStatus === '' || sStatus === 'free';
    if (!isAvailable) return;
    setSelectedSlots((prev) => (prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]));
  };

  const totalPrice = selectedSlots.length * pricePerSlot;

  const openBookingModal = () => setShowModal(true);
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };
  const handleBooking = (e) => {
    e.preventDefault();
    // Mock booking flow
    toast.success(t('booking.bookingSuccessWithTotal').replace('{total}', totalPrice.toLocaleString()));
    setForm({ name: "", phone: "", email: "", note: "" });
    setSelectedSlots([]);
    setShowModal(false);
  };

  return (
    <div className="container mx-auto px-4 py-8">

      <h1 className="text-2xl font-bold mb-4">{t('booking.book')} {field?.TenSan}</h1>
      <p className="text-sm text-gray-600 mb-4">{t('booking.bookingInfoHeading')} (BookingFull.jsx)</p>

      <div className="bg-white rounded-lg shadow p-4 max-w-3xl">
        <h2 className="font-semibold mb-2">{t('booking.timeSlotsLabel')}</h2>
        <div className="flex flex-wrap gap-2">
          {availLoading ? (
            <div className="text-sm text-gray-500">{t('booking.loadingAvailability')}</div>
          ) : availError ? (
            <div className="text-sm text-red-500">{availError}</div>
          ) : (
            (availability.length > 0 ? availability : timeSlots.map((t) => ({ StartTime: null, start: t, Status: 'unknown' }))).map((slotObj, idx) => {
              const start = slotObj.StartTime ? new Date(slotObj.StartTime).toTimeString().slice(0,5) : (slotObj.start || slotObj.Start || timeSlots[idx]);
              const statusRaw = slotObj.Status ?? slotObj.status ?? slotObj.StatusName ?? '';
              const s = String(statusRaw).toLowerCase();
              const isAvailable = s === 'available' || s === 'trong' || s === '0' || s === '' || s === 'free';
              const selected = selectedSlots.includes(start);
              return (
                <button
                  key={start + idx}
                  onClick={() => handleSelectSlot(start)}
                  className={`px-3 py-2 rounded-md border ${selected ? 'bg-indigo-600 text-white' : isAvailable ? 'bg-white text-gray-800' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                  disabled={!isAvailable}
                  aria-pressed={selected}
                >
                  {start}
                </button>
              );
            })
          )}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-600">{t('booking.numberOfSlots')}: {selectedSlots.length}</div>
            <div className="text-lg font-medium">{t('booking.totalAmountLabel')}: {totalPrice.toLocaleString()} VND</div>
          </div>
          <div>
            <button onClick={openBookingModal} disabled={selectedSlots.length === 0} className={`px-4 py-2 rounded-md text-white ${selectedSlots.length === 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}>
              {t('booking.bookButton')}
            </button>
          </div>
        </div>
      </div>

      {/* Booking Modal (simple) */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">{t('booking.confirmBooking')}</h3>
            <form onSubmit={handleBooking}>
              <label className="block text-sm">{t('booking.form.fullName')}</label>
              <input name="name" value={form.name} onChange={handleFormChange} className="w-full border rounded px-3 py-2 mb-3" required />

              <label className="block text-sm">{t('booking.form.phone')}</label>
              <input name="phone" value={form.phone} onChange={handleFormChange} className="w-full border rounded px-3 py-2 mb-3" />

              <label className="block text-sm">{t('booking.form.email')}</label>
              <input name="email" value={form.email} onChange={handleFormChange} className="w-full border rounded px-3 py-2 mb-3" type="email" />

              <label className="block text-sm">{t('booking.form.note')}</label>
              <textarea name="note" value={form.note} onChange={handleFormChange} className="w-full border rounded px-3 py-2 mb-4" rows={3} />

              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded border">{t('common.cancel')}</button>
                <button type="submit" className="px-4 py-2 rounded bg-indigo-600 text-white">{t('booking.confirmButton')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default BookingFull;
