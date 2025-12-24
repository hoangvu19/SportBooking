import React, { useState, useEffect, useCallback } from 'react';
import { bookingAPI } from '../../utils/api';
import Loading from '../../components/Shared/Loading';
import toast from 'react-hot-toast';
import moment from 'moment';
import { parseServerDatetime } from '../../utils/vnTime';
import { AlertCircle, X, Eye, Mail, Phone } from 'lucide-react';
import { getPhone, normalizeUser } from '../../utils/normalize';
import { loadAreas, getCachedAreaName } from '../../utils/areaCache';
import '../../components/Shared/modal.css';
import { useI18n } from '../../i18n/hooks';

const BookingCancellations = () => {
  const [cancelledBookings, setCancelledBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalResults, setTotalResults] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [stats, setStats] = useState({ total: 0, today: 0, thisWeek: 0, thisMonth: 0 });
  const { t } = useI18n();
  const [loadingAll, setLoadingAll] = useState(false);
  const loadCancelledBookings = useCallback(async (page = 1, limit = 20, bypassCache = false) => {
    setLoading(true);
    try {
      const res = await bookingAPI.getFacilityBookings({ status: 'Cancelled', page, limit }, bypassCache);
      if (res && res.success) {
        const data = Array.isArray(res.data) ? res.data : [];
        const sorted = data.sort((a, b) => {
          const ta = parseServerDatetime(a.CancelledAt || a.StartTime) || new Date(a.CancelledAt || a.StartTime);
          const tb = parseServerDatetime(b.CancelledAt || b.StartTime) || new Date(b.CancelledAt || b.StartTime);
          return tb - ta;
        });
        setCancelledBookings(sorted);

        // Stats: prefer server-provided summary when available
        if (res.summary) {
          setStats({
            total: res.summary.cancelled || res.summary.total || 0,
            today: res.summary.today || 0,
            thisWeek: res.summary.thisWeek || 0,
            thisMonth: res.summary.thisMonth || 0
          });
        } else {
          const todayStart = moment().startOf('day');
          const weekStart = moment().startOf('week');
          const monthStart = moment().startOf('month');

          const today = sorted.filter(b => moment(parseServerDatetime(b.CancelledAt || b.StartTime)).isAfter(todayStart)).length;
          const thisWeek = sorted.filter(b => moment(parseServerDatetime(b.CancelledAt || b.StartTime)).isAfter(weekStart)).length;
          const thisMonth = sorted.filter(b => moment(parseServerDatetime(b.CancelledAt || b.StartTime)).isAfter(monthStart)).length;
          setStats({ total: sorted.length, today, thisWeek, thisMonth });
        }

        const total = res.pagination?.total || res.summary?.total || res.summary?.cancelled || data.length;
        setTotalResults(total || data.length);
        setTotalPages(Math.max(1, Math.ceil((total || data.length) / limit)));
        setPage(page);
        setLimit(limit);
      } else {
        setCancelledBookings([]);
        setTotalResults(0);
        setTotalPages(1);
      }
    } catch (err) {
      console.error('Load cancelled bookings error', err);
      toast.error(t('owner.bookingCancellations.loadError'));
      setCancelledBookings([]);
      setTotalResults(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // preload areas so we can resolve AreaName when backend doesn't include it
    loadAreas().catch(() => {});
    loadCancelledBookings(page, limit);
  }, [loadCancelledBookings, page, limit]);

  const formatDateTime = (dateStr) => {
    try {
      return moment(parseServerDatetime(dateStr)).format('DD/MM/YYYY HH:mm');
    } catch {
      return dateStr || '';
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
  };

  const getTimeAgo = (dateStr) => {
    try {
      return moment(parseServerDatetime(dateStr)).fromNow();
    } catch {
      return '';
    }
  };

  const viewBookingDetail = (booking) => {
    setSelectedBooking(booking);
    setShowDetailModal(true);
  };

  if (loading) return <Loading />;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">{t('owner.bookingCancellations.title') || 'Cancelled bookings'}</h2>
        <p className="text-gray-600">{t('owner.bookingCancellations.subtitle') || 'List of cancelled bookings for your facility'}</p>
        <div className="mt-3">
          <button className="px-3 py-2 mr-2 rounded border bg-white" onClick={() => loadCancelledBookings(1, limit, true)}>{t('common.load') || 'Reload'}</button>
          <button className="px-3 py-2 rounded bg-white border" onClick={async () => { setLoadingAll(true); await loadCancelledBookings(1, 100000, true); setLoadingAll(false); }}>{loadingAll ? (t('common.loading') || 'Loading...') : (t('owner.bookingCancellations.showAll') || 'Show all')}</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-500">{t('owner.bookingCancellations.stats.total') || 'Total'}</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-500">{t('owner.bookingCancellations.stats.today') || 'Today'}</div>
          <div className="text-2xl font-bold">{stats.today}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-500">{t('owner.bookingCancellations.stats.thisWeek') || 'This week'}</div>
          <div className="text-2xl font-bold">{stats.thisWeek}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-500">{t('owner.bookingCancellations.stats.thisMonth') || 'This month'}</div>
          <div className="text-2xl font-bold">{stats.thisMonth}</div>
        </div>
      </div>

      <div className="space-y-3">
          {cancelledBookings.length === 0 ? (
          <div className="p-6 bg-white rounded text-center text-gray-500">{t('owner.bookingCancellations.empty') || 'No cancelled bookings'}</div>
        ) : (
          cancelledBookings.map((booking) => {
            const cu = normalizeUser(booking || {});
            return (
              <div key={booking.BookingID} className="bg-white p-4 rounded-lg border border-red-100 shadow-sm flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-bold text-gray-900">#{booking.BookingID}</span>
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">{t('owner.bookingCancellations.labels.cancelled') || 'Cancelled'}</span>
                  </div>

                  <div className="text-sm text-gray-700 mb-1">
                    <strong>{t('owner.bookingCancellations.labels.customer') || 'Customer'}:</strong> {cu.fullName || booking.FullName || cu.username || booking.Username}
                  </div>
                  <div className="text-sm text-gray-500 mb-1">
                    <strong>{t('owner.bookingCancellations.labels.contact') || 'Contact'}:</strong>
                    <div className="mt-1 flex flex-col text-gray-700">
                      {(getPhone(cu) || getPhone(booking)) && (
                        <a href={`tel:${getPhone(cu) || getPhone(booking)}`} className="flex items-center gap-2 hover:underline">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span>{getPhone(cu) || getPhone(booking)}</span>
                        </a>
                      )}
                      {(cu.email || booking.Email) && (
                        <a href={`mailto:${cu.email || booking.Email}`} className="flex items-center gap-2 mt-1 hover:underline text-gray-500">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <span>{cu.email || booking.Email}</span>
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="text-sm text-gray-700 mb-1">
                    <strong>{t('owner.bookingCancellations.labels.facility') || 'Facility'}:</strong> {booking.FacilityName} - {booking.FieldName} ({booking.FieldType})
                    <div className="text-sm text-gray-500">{booking.AreaName || getCachedAreaName(booking.AreaID)}</div>
                  </div>

                  <div className="text-sm text-gray-700 mb-1"><strong>{t('owner.bookingCancellations.labels.time') || 'Time'}:</strong> {formatDateTime(booking.StartTime)} → {formatDateTime(booking.EndTime)}</div>

                  <div className="flex items-center gap-6 text-sm mb-3">
                    <div>
                      <span className="text-gray-500">{t('owner.bookingCancellations.labels.totalAmount') || 'Total amount'}: </span>
                      <span className="font-bold text-red-600">{formatCurrency(booking.TotalAmount || 0)}</span>
                    </div>
                  </div>

                  {booking.CancelReason && (
                    <div className="mt-2 p-2 bg-red-50 rounded border border-red-200">
                      <div className="text-xs text-red-800 mb-1">{t('owner.bookingCancellations.labels.cancelReason') || 'Cancel reason'}:</div>
                      <div className="text-sm text-gray-700">{booking.CancelReason}</div>
                    </div>
                  )}
                </div>

                <div className="flex-shrink-0 ml-4">
                  <button onClick={() => viewBookingDetail(booking)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    <Eye className="w-4 h-4" /> {t('common.details') || 'Details'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-700">{t('owner.bookingCancellations.pagination.showing') || `Showing ${ (page-1)*limit + 1 } to ${ Math.min(page*limit, totalResults) } of ${ totalResults } results`}</div>
          <div className="flex gap-2">
            <button onClick={() => loadCancelledBookings(Math.max(1, page-1), limit)} disabled={page===1} className="px-3 py-2 border rounded">← {t('common.prev') || 'Prev'}</button>
            {Array.from({ length: totalPages }).slice(0, 10).map((_, i) => (
              <button key={i} onClick={() => loadCancelledBookings(i+1, limit)} className={`px-3 py-2 border rounded ${page===i+1 ? 'bg-blue-600 text-white' : ''}`}>{i+1}</button>
            ))}
            <button onClick={() => loadCancelledBookings(Math.min(totalPages, page+1), limit)} disabled={page===totalPages} className="px-3 py-2 border rounded">{t('common.next') || 'Next'} →</button>
          </div>
        </div>
      )}

      {/* Detail Panel (inline card) */}
      {showDetailModal && selectedBooking && (() => {
        const sel = normalizeUser(selectedBooking || {});
        return (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-6 h-6 text-red-600" />
                <h3 className="text-lg font-bold">{t('owner.bookingCancellations.detailModal.title') || 'Cancelled booking detail'}</h3>
              </div>
              <button className="close-button" onClick={() => setShowDetailModal(false)}><X /></button>
            </div>

            <div className="modal-body">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('owner.bookingCancellations.labels.bookingId') || 'Booking ID'}</label>
                    <div className="text-gray-900">#{selectedBooking.BookingID}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('owner.bookingCancellations.labels.status') || 'Status'}</label>
                    <div className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">{t('owner.bookingCancellations.labels.cancelled') || 'Cancelled'}</div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('owner.bookingCancellations.labels.customer') || 'Customer'}</label>
                  <div className="text-gray-900">{sel.fullName || selectedBooking.FullName || sel.username || selectedBooking.Username}</div>
                  <div className="text-sm text-gray-500 mb-1">
                    <strong>{t('owner.bookingCancellations.labels.contact') || 'Contact'}:</strong>
                    <div className="mt-1 flex flex-col text-gray-700">
                      {(getPhone(sel) || getPhone(selectedBooking)) && (
                        <a href={`tel:${getPhone(sel) || getPhone(selectedBooking)}`} className="flex items-center gap-2 hover:underline">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span>{getPhone(sel) || getPhone(selectedBooking)}</span>
                        </a>
                      )}
                      {(sel.email || selectedBooking.Email) && (
                        <a href={`mailto:${sel.email || selectedBooking.Email}`} className="flex items-center gap-2 mt-1 hover:underline text-gray-500">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <span>{sel.email || selectedBooking.Email}</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('owner.bookingCancellations.labels.facility') || 'Facility'}</label>
                    <div className="text-gray-900">{selectedBooking.FacilityName}</div>
                    <div className="text-sm text-gray-500">{selectedBooking.AreaName || getCachedAreaName(selectedBooking.AreaID)}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('owner.bookingCancellations.labels.field') || 'Field'}</label>
                    <div className="text-gray-900">{selectedBooking.FieldName} - {selectedBooking.FieldType}</div>
                    <div className="text-sm text-gray-500">{t('owner.bookingCancellations.labels.sport') || 'Sport'}: {selectedBooking.SportName}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('owner.bookingCancellations.labels.startTime') || 'Start time'}</label>
                    <div className="text-gray-900">{formatDateTime(selectedBooking.StartTime)}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('owner.bookingCancellations.labels.endTime') || 'End time'}</label>
                    <div className="text-gray-900">{formatDateTime(selectedBooking.EndTime)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('owner.bookingCancellations.labels.rentalPrice') || 'Rental price/hr'}</label>
                    <div className="text-gray-900">{formatCurrency(selectedBooking.RentalPrice || 0)}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('owner.bookingCancellations.labels.totalAmount') || 'Total amount'}</label>
                    <div className="text-gray-900 font-bold">{formatCurrency(selectedBooking.TotalAmount || 0)}</div>
                  </div>
                </div>

                {selectedBooking.CancelledAt && (
                  <div className="border-t pt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('owner.bookingCancellations.labels.cancelTime') || 'Cancel time'}</label>
                    <div className="text-gray-900">{formatDateTime(selectedBooking.CancelledAt)}</div>
                    <div className="text-sm text-gray-500">{getTimeAgo(selectedBooking.CancelledAt)}</div>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={() => setShowDetailModal(false)} className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50">{t('common.close') || 'Close'}</button>
            </div>
          </div>
          </div>
        );
      })()}
    </div>
  );
};

export default BookingCancellations;
