import React, { useState, useEffect } from 'react';
import { getVnIsoDate } from '../../utils/vnTime';
import { useParams, useNavigate } from 'react-router-dom';
import { sportFieldAPI } from '../../utils/api';
import Loading from '../../components/Shared/Loading';
import { bookingAPI } from '../../utils/api';
import { useI18n } from '../../i18n/hooks';
import DEFAULT_AVATAR from '../../utils/defaults';
import { generateTimeSlots } from '../../utils/bookingUtils';

export default function FacilitiesDetail() {
  const { fieldId } = useParams();
  const [field, setField] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [selectedDate, _setSelectedDate] = useState(0);
  const navigate = useNavigate();
  const { t } = useI18n();

  const generateSchedule = React.useCallback((basePrice, fieldIds) => {
    const days = [];
    const today = new Date();
    const ids = Array.isArray(fieldIds) ? fieldIds : (fieldIds ? [fieldIds] : []);

    for (let i = 0; i < 7; i++) {
  const currentDate = new Date(today);
  currentDate.setDate(today.getDate() + i);
  const dateStr = getVnIsoDate(currentDate);
      const displayStr = i === 0 ? t('common.today','Today') : (i === 1 ? t('common.tomorrow','Tomorrow') : currentDate.toLocaleDateString());

      let slots = generateTimeSlots(dateStr, basePrice).map(s => ({ ...s, availableCount: ids.length > 0 ? ids.length : undefined, isBooked: false }));

      if (ids.length > 0) {
        (async () => {
          try {
            const results = await Promise.all(ids.map(id => bookingAPI.getFieldAvailability(id, dateStr).catch(() => ({ success: false, data: [] }))));
            const bookedSets = results.map(r => {
              const set = new Set();
              try {
                if (r && r.success && Array.isArray(r.data)) {
                  r.data.forEach(b => {
                    try {
                      const start = new Date(b.StartTime);
                      const hh = String(start.getHours()).padStart(2, '0');
                      const mm = String(start.getMinutes()).padStart(2, '0');
                      set.add(`${hh}:${mm}`);
                    } catch (e) { console.debug('parse booked time error', e); }
                  });
                }
              } catch (e) { console.debug('error building booked set', e); }
              return set;
            });

            const totalFields = ids.length;
            const primaryBookedSet = bookedSets[0] || new Set();

            const patched = slots.map(s => {
              let bookedCount = 0;
              for (const bs of bookedSets) {
                if (bs.has(s.start)) bookedCount++;
              }
              const availableCount = Math.max(0, totalFields - bookedCount);
              return { ...s, availableCount, isBooked: primaryBookedSet.has(s.start) };
            });

            setSchedule(prev => prev.map(d => d.date === dateStr ? { ...d, slots: patched } : d));
          } catch (err) {
            console.debug('Could not fetch availability for date', dateStr, err);
          }
        })();
      }

      days.push({ date: dateStr, display: displayStr, slots });
    }

    setSchedule(days);
  }, [t]);

  const fetchField = React.useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await sportFieldAPI.getById(Number(fieldId));
      if (res && res.success && res.data) {
        const f = res.data;
        const mapped = {
          FieldID: f.FieldID || f.SanID || f.id,
          FieldName: f.FieldName || f.TenSan || f.name,
          FieldType: f.FieldType || f.LoaiSan || 'Unknown',
          RentalPrice: f.RentalPrice || f.GiaThue || 0,
          Status: f.Status || f.TrangThai || 'Available',
          AreaName: f.AreaName || f.KhuVuc || '',
          // Prefer backend media assets (object with ImageUrl/URL/Data) when available
          HinhAnh: (() => {
            const m = f && f.images && f.images[0];
            if (m) return m.ImageUrl || m.URL || m.Data || f.Image || f.HinhAnh || null;
            return f.Image || f.HinhAnh || null;
          })(),
          SportName: f.SportName || f.MonTheThao || null,
          FacilityName: f.FacilityName || f.TenCoSo || null,
          Owner: f.Owner || f.ChuSoHuu || { HoTen: f.OwnerName || 'Unknown', Avatar: DEFAULT_AVATAR },
        };
        setField(mapped);

        const ids = [mapped.FieldID].filter(Boolean);
        generateSchedule(mapped.RentalPrice, ids);
      } else {
        setError((res && res.message) || t('owner.facilityDetail.loadError'));
      }
    } catch (err) {
      console.error('Fetch field error', err);
      setError(t('owner.facilityDetail.fetchError'));
    } finally {
      setLoading(false);
    }
  }, [fieldId, generateSchedule]);

  useEffect(() => { fetchField(); }, [fetchField]);

  if (loading) return <Loading />;
  if (error) return (
    <div className="p-6">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
        <button onClick={fetchField} className="mt-2 px-4 py-2 bg-red-600 text-white rounded">{t('common.retry','Retry')}</button>
      </div>
    </div>
  );

  if (!field) return <div className="p-6">{t('booking.fieldNotFound','Field not found')}</div>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="md:flex">
            <div className="md:w-1/2 h-64 bg-gray-100">
              {field.HinhAnh ? (
                <img src={field.HinhAnh} alt={field.FieldName} className="w-full h-full object-cover" />
              ) : (
                <img src={'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 140" fill="%23E2E8F0"%3E%3Crect width="200" height="140" fill="%23E2E8F0"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="%23718096"%3ENo Image%3C/text%3E%3C/svg%3E'} alt="no-image" className="w-full h-full object-cover" />
              )}
            </div>
            <div className="md:w-1/2 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold">{field.FieldName}</h1>
                  <div className="text-sm text-gray-600 mt-1">{t('owner.facilityDetail.facilityLabel')}: {field.FacilityName || 'N/A'}</div>
                </div>
                <div>
                  <span className="px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800">{field.Status}</span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Môn</div>
                  <div className="font-medium">{field.SportName || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Loại</div>
                  <div className="font-medium">{field.FieldType}</div>
                </div>
              </div>

              <div className="mt-4">
                <div className="text-sm text-gray-500">{t('owner.facilities.rentalPrice')}</div>
                <div className="text-lg font-semibold">{field.RentalPrice}</div>
              </div>

              <div className="mt-6 flex items-center gap-3">
                <button className="px-4 py-2 bg-indigo-600 text-white rounded" onClick={() => navigate(-1)}>{t('owner.facilityDetail.back')}</button>
                <button className="px-4 py-2 border rounded text-indigo-600" onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}>{t('owner.facilityDetail.viewSchedule')}</button>
              </div>
            </div>
          </div>
        </div>

        {/* Schedule Section */}
        <div className="mt-6 bg-white rounded-lg shadow-sm p-6">
          <h3 className="font-semibold mb-4">{t('owner.facilityDetail.viewSchedule')} (7 {t('owner.dashboard.dateRange.7days')})</h3>
          {schedule.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {schedule[selectedDate]?.slots.map(slot => (
                <div key={slot.id} className="p-3 rounded border text-sm text-center bg-gray-50">{slot.start}<div className="text-xs text-gray-400">- {slot.end}</div></div>
              ))}
            </div>
          ) : (
            <div className="text-gray-600">{t('owner.dashboard.empty.title')}</div>
          )}
        </div>
      </div>
    </div>
  );
}
