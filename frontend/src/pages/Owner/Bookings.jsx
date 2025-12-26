import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { bookingAPI } from '../../utils/api';
import Loading from '../../components/Shared/Loading';
import toast from 'react-hot-toast';
import moment from 'moment';
import { parseServerDatetime } from '../../utils/vnTime';
import { getPhone, normalizeUser } from '../../utils/normalize';
import '../../components/Shared/modal.css';
import { loadAreas, getCachedAreaName } from '../../utils/areaCache';
import { useI18n } from '../../i18n/hooks';
import { useOwnerSearch } from '../../contexts/OwnerSearchContext';

const OwnerBookings = () => {
  const { searchQuery } = useOwnerSearch();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [limit] = useState(8);
  const [totalResults, setTotalResults] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [showCancelledModal, setShowCancelledModal] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    confirmed: 0,
    cancelled: 0,
    totalRevenue: 0
  });
  const [pendingBookings, setPendingBookings] = useState([]);
  const [cancelledBookings, setCancelledBookings] = useState([]);
  const { t } = useI18n();

  const normalizeStatus = (s) => {
    const raw = (s || '').toString().toLowerCase().trim();
    // No hardcoded mapping needed anymore - just return normalized raw value
    return raw || 'pending';
  };

  // Helper function: Kiểm tra xem có thể hủy booking không
  // Không cho phép hủy nếu đã xác nhận và còn dưới 30 phút trước giờ bắt đầu
  const canCancelBooking = (booking) => {
    if (booking.Status === 'Confirmed') {
      const now = new Date();
      const startTime = new Date(booking.StartTime);
      const minutesUntilStart = (startTime - now) / (1000 * 60);
      // Nếu còn dưới 30 phút thì không cho hủy
      return minutesUntilStart > 30;
    }
    // Các trạng thái khác (Pending) vẫn cho phép hủy
    return true;
  };

  const loadBookings = useCallback(async (bypassCache = false) => {
    setLoading(true);
    try {
      // When searching, load all bookings for client-side filtering
      const hasSearch = searchQuery && searchQuery.trim() !== '';
      const params = {};
      
      // Only apply status filter when not searching
      if (!hasSearch && statusFilter !== 'all') {
        params.status = statusFilter;
      }
      
      params.page = hasSearch ? 1 : page;
      params.limit = hasSearch ? 100000 : limit;
      const res = await bookingAPI.getFacilityBookings(params, bypassCache);

      if (res && res.success && Array.isArray(res.data)) {
        // Set bookings for current page
        const data = res.data || [];
        setBookings(data);

        // If server returned a summary/pagination, use those values
        if (res.pagination && typeof res.pagination.total !== 'undefined') {
          const total = parseInt(res.pagination.total, 10) || 0;
          setTotalResults(total);
          setTotalPages(Math.max(1, Math.ceil(total / limit)));
        } else if (res.summary && typeof res.summary.total !== 'undefined') {
          const total = parseInt(res.summary.total, 10) || 0;
          setTotalResults(total);
          setTotalPages(Math.max(1, Math.ceil(total / limit)));
        } else {
          setTotalResults(data.length);
          setTotalPages(Math.max(1, Math.ceil(data.length / limit)));
        }

        // Use summary if provided to drive stats (global counts), otherwise compute from page
        if (res.summary) {
          setStats({
            total: res.summary.total || 0,
            pending: res.summary.pending || 0,
            confirmed: res.summary.confirmed || 0,
            cancelled: res.summary.cancelled || 0,
            totalRevenue: res.summary.totalRevenue || 0
          });
        } else {
          const pendingList = data.filter(b => normalizeStatus(b.Status || b.status) === 'pending');
          const confirmedList = data.filter(b => normalizeStatus(b.Status || b.status) === 'confirmed');
          const cancelledList = data.filter(b => normalizeStatus(b.Status || b.status) === 'cancelled');
          const totalRevenue = confirmedList.reduce((sum, b) => sum + (parseFloat(b.TotalAmount) || 0), 0);
          setStats({ 
            total: data.length, 
            pending: pendingList.length, 
            confirmed: confirmedList.length, 
            cancelled: cancelledList.length, 
            totalRevenue 
          });
          setPendingBookings(pendingList);
          setCancelledBookings(cancelledList);
        }
      } else {
        setBookings([]);
        toast.error(t('owner.bookings.errors.loadFailed') || 'Unable to load bookings list');
      }
    } catch (err) {
      console.error('Load bookings error:', err);
      toast.error(t('owner.bookings.errors.loadFailed') || 'Error loading bookings list');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page, limit, t, searchQuery]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  // When filter or search changes, reset to page 1
  useEffect(() => {
    setPage(1);
  }, [statusFilter, limit, searchQuery]);

  // preload area list for synchronous name lookups
  useEffect(() => {
    loadAreas().catch(() => {});
  }, []);

  const handleConfirmBooking = async (bookingId) => {
    if (!window.confirm(t('owner.bookings.confirmPrompt') || 'Xác nhận đơn đặt sân này?')) return;
    try {
      const res = await bookingAPI.confirm(bookingId);
      if (res && res.success) {
        toast.success(t('owner.bookings.confirmSuccess') || 'Xác nhận đơn đặt sân thành công');
        await loadBookings(true); // Bypass cache to get fresh data
        setShowDetailModal(false);
        } else {
        toast.error(res.message || t('owner.bookings.confirmFailed') || 'Unable to confirm booking');
      }
    } catch (err) {
      console.error('Confirm booking error:', err);
      toast.error(t('owner.bookings.confirmFailed') || 'Error confirming booking');
    }
  };

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm(t('owner.bookings.cancelPrompt') || 'Hủy đơn đặt sân này?')) return;
    try {
      const res = await bookingAPI.cancel(bookingId);
      if (res && res.success) {
        toast.success(t('owner.bookings.cancelSuccess') || 'Hủy đơn đặt sân thành công');
        await loadBookings(true); // Bypass cache to get fresh data
        setShowDetailModal(false);
        } else {
        toast.error(res.message || t('owner.bookings.cancelFailed') || 'Unable to cancel booking');
      }
    } catch (err) {
      console.error('Cancel booking error:', err);
      toast.error(t('owner.bookings.cancelFailed') || 'Error cancelling booking');
    }
  };

  const viewBookingDetail = (booking) => {
    setSelectedBooking(booking);
    setShowDetailModal(true);
  };

  const formatDateTime = (dateStr) => {
    try {
      return moment(parseServerDatetime(dateStr)).format('DD/MM/YYYY HH:mm');
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'Pending': { bg: 'bg-yellow-100', text: 'text-yellow-800', label: t('owner.bookings.stats.pending') || 'Pending' },
      'Confirmed': { bg: 'bg-green-100', text: 'text-green-800', label: t('owner.bookings.stats.confirmed') || 'Confirmed' },
      'Cancelled': { bg: 'bg-red-100', text: 'text-red-800', label: t('owner.bookings.stats.cancelled') || 'Cancelled' },
      'Completed': { bg: 'bg-blue-100', text: 'text-blue-800', label: t('owner.bookings.stats.completed') || 'Completed' }
    };
    const s = statusMap[status] || { bg: 'bg-gray-100', text: 'text-gray-800', label: status };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
        {s.label}
      </span>
    );
  };

  if (loading) return <Loading />;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">{t('owner.bookings.title') || 'Manage Bookings'}</h2>
        <p className="text-gray-600">{t('owner.bookings.subtitle') || 'Manage all bookings for your facility'}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-500">{t('owner.bookings.stats.total') || 'Total orders'}</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </div>

        <div
          className="bg-white rounded-lg shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow relative"
          onClick={async () => {
            try {
              setLoading(true);
              const r = await bookingAPI.getFacilityBookings({ status: 'Pending', page: 1, limit: 100000 }, true);
              if (r && r.success && Array.isArray(r.data)) setPendingBookings(r.data);
              setShowPendingModal(true);
            } catch (err) {
              console.error('Error loading pending bookings:', err);
              toast.error(t('owner.bookings.errors.loadPending') || 'Unable to load pending bookings');
            } finally {
              setLoading(false);
            }
          }}
        >
          <div className="text-sm text-gray-500">{t('owner.bookings.stats.pending') || 'Pending'}</div>
          <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          {stats.pending > 0 && (
            <div className="absolute top-2 right-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
              </span>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-500">{t('owner.bookings.stats.confirmed') || 'Confirmed'}</div>
          <div className="text-2xl font-bold text-green-600">{stats.confirmed}</div>
        </div>

        <div
          className="bg-white rounded-lg shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow"
          onClick={async () => {
            try {
              setLoading(true);
              const r = await bookingAPI.getFacilityBookings({ status: 'Cancelled', page: 1, limit: 100000 }, true);
              if (r && r.success && Array.isArray(r.data)) setCancelledBookings(r.data);
              setShowCancelledModal(true);
            } catch (err) {
              console.error('Error loading cancelled bookings:', err);
              toast.error(t('owner.bookings.errors.loadCancelled') || 'Unable to load cancelled bookings');
            } finally {
              setLoading(false);
            }
          }}
        >
          <div className="text-sm text-gray-500">{t('owner.bookings.stats.cancelled') || 'Cancelled'}</div>
          <div className="text-2xl font-bold text-red-600">{stats.cancelled}</div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-500">{t('owner.bookings.stats.revenue') || 'Revenue'}</div>
          <div className="text-xl font-bold text-blue-600">{formatCurrency(stats.totalRevenue)}</div>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">{t('owner.bookings.filter.statusLabel') || 'Status:'}</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value="all">{t('owner.bookings.filter.allOption') || 'All'}</option>
            <option value="Pending">{t('owner.bookings.stats.pending') || 'Pending'}</option>
            <option value="Confirmed">{t('owner.bookings.stats.confirmed') || 'Confirmed'}</option>
            <option value="Cancelled">{t('owner.bookings.stats.cancelled') || 'Cancelled'}</option>
          </select>
        </div>
      </div>

      {/* Bookings Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {bookings.length === 0 ? (
          <div className="p-8 text-center text-gray-500">{t('owner.bookings.empty') || 'No bookings found'}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('owner.bookings.table.bookingId') || 'Booking ID'}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('owner.bookings.table.customer') || 'Customer'}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('owner.bookings.table.facility') || 'Facility / Field'}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('owner.bookings.table.time') || 'Time'}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('owner.bookings.table.total') || 'Total'}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('owner.bookings.table.status') || 'Status'}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('owner.bookings.table.actions') || 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(() => {
                  // Filter bookings by search query
                  const filtered = bookings.filter(b => {
                    if (!searchQuery || searchQuery.trim() === '') return true;
                    const q = searchQuery.toLowerCase().trim();
                    const userName = (b.FullName || b.Username || '').toString().toLowerCase();
                    const email = (b.Email || '').toString().toLowerCase();
                    const bookingId = (b.BookingID || '').toString().toLowerCase();
                    const fieldName = (b.FieldName || '').toString().toLowerCase();
                    return userName.includes(q) || email.includes(q) || bookingId.includes(q) || fieldName.includes(q);
                  });
                  
                  // Pagination for filtered results
                  const startIdx = (page - 1) * limit;
                  const endIdx = startIdx + limit;
                  const paginatedFiltered = filtered.slice(startIdx, endIdx);
                  
                  return paginatedFiltered.map((booking) => {
                  const bnorm = normalizeUser(booking || {});
                  return (
                  <tr key={booking.BookingID} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      #{booking.BookingID}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{bnorm.fullName || booking.FullName || bnorm.username || booking.Username}</div>
                      <div className="text-sm text-gray-500">{bnorm.email || booking.Email}</div>
                        {(getPhone(bnorm) || getPhone(booking)) && (
                          <div className="text-sm text-gray-500 mt-1">
                            <a href={`tel:${getPhone(bnorm) || getPhone(booking)}`} className="hover:underline text-gray-700">{getPhone(bnorm) || getPhone(booking)}</a>
                          </div>
                        )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{booking.FacilityName}</div>
                      <div className="text-sm text-gray-500">{booking.FieldName} - {booking.FieldType}</div>
                      <div className="text-sm text-gray-400">{booking.AreaName || getCachedAreaName(booking.AreaID)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatDateTime(booking.StartTime)}</div>
                      <div className="text-sm text-gray-500">{t('owner.bookings.labels.to') || 'to'} {formatDateTime(booking.EndTime)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(booking.TotalAmount || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(booking.Status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => viewBookingDetail(booking)}
                          className="text-blue-600 hover:text-blue-800"
                          >
                            {t('owner.bookings.actions.details') || 'Details'}
                          </button>
                        {booking.Status === 'Pending' && (
                            <button
                              onClick={() => handleConfirmBooking(booking.BookingID)}
                              className="text-green-600 hover:text-green-800"
                            >
                              {t('owner.bookings.actions.confirm') || 'Confirm'}
                            </button>
                        )}
                        {(booking.Status === 'Pending' || booking.Status === 'Confirmed') && (
                          <button
                            onClick={() => handleCancelBooking(booking.BookingID)}
                            disabled={!canCancelBooking(booking)}
                            className={!canCancelBooking(booking) 
                              ? 'text-gray-400 cursor-not-allowed' 
                              : 'text-red-600 hover:text-red-800'
                            }
                            title={!canCancelBooking(booking) && booking.Status === 'Confirmed' ? 'Không thể hủy sân đã xác nhận trước 30 phút giờ bắt đầu' : ''}
                            >
                              {t('owner.bookings.actions.cancel') || 'Cancel'}
                            </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );})})()}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination / Result summary */}
      <div className="mt-4 flex items-center justify-between px-2">
        <div className="text-sm text-gray-600">
          {(() => {
            // Calculate filtered results count when searching
            const hasSearch = searchQuery && searchQuery.trim() !== '';
            let displayTotal = totalResults || 0;
            
            if (hasSearch) {
              const filtered = bookings.filter(b => {
                const q = searchQuery.toLowerCase().trim();
                const userName = (b.FullName || b.Username || '').toString().toLowerCase();
                const email = (b.Email || '').toString().toLowerCase();
                const bookingId = (b.BookingID || '').toString().toLowerCase();
                const fieldName = (b.FieldName || '').toString().toLowerCase();
                return userName.includes(q) || email.includes(q) || bookingId.includes(q) || fieldName.includes(q);
              });
              displayTotal = filtered.length;
            }
            
            const text = t('owner.bookings.pagination.showing') || 'Showing {from} to {to} of {total} results';
            return text
              .replace('{from}', Math.min((page - 1) * limit + 1, displayTotal))
              .replace('{to}', Math.min(page * limit, displayTotal))
              .replace('{total}', displayTotal);
          })()}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              try {
                setLoading(true);
                const params = statusFilter !== 'all' ? { status: statusFilter } : {};
                params.page = 1;
                params.limit = 100000;
                const r = await bookingAPI.getFacilityBookings(params, true);
                if (r && r.success && Array.isArray(r.data)) {
                  setBookings(r.data);
                  setTotalResults(r.pagination?.total || r.summary?.total || r.data.length);
                  setTotalPages(1);
                  setPage(1);
                }
              } catch (err) {
                console.error('Error loading all bookings:', err);
                toast.error(t('owner.bookings.errors.loadAll') || 'Không thể tải tất cả đơn');
              } finally {
                setLoading(false);
              }
            }}
            className="text-sm text-blue-600 hover:underline mr-2"
          >
            {t('owner.bookings.pagination.showAll') || 'Show all'}
          </button>
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className={`px-3 py-2 rounded border ${page <= 1 ? 'text-gray-300 border-gray-200' : 'text-gray-700 border-gray-300'}`}>
            ← {t('owner.bookings.pagination.prev') || 'Prev'}
          </button>

          <div className="flex items-center gap-1">
            {(() => {
              // Calculate filtered total pages when searching
              const hasSearch = searchQuery && searchQuery.trim() !== '';
              let displayPages = totalPages || 1;
              
              if (hasSearch) {
                const filtered = bookings.filter(b => {
                  const q = searchQuery.toLowerCase().trim();
                  const userName = (b.FullName || b.Username || '').toString().toLowerCase();
                  const email = (b.Email || '').toString().toLowerCase();
                  const bookingId = (b.BookingID || '').toString().toLowerCase();
                  const fieldName = (b.FieldName || '').toString().toLowerCase();
                  return userName.includes(q) || email.includes(q) || bookingId.includes(q) || fieldName.includes(q);
                });
                displayPages = Math.max(1, Math.ceil(filtered.length / limit));
              }
              
              const pages = [];
              const maxShown = 10;
              let start = Math.max(1, page - Math.floor(maxShown / 2));
              let end = Math.min(displayPages, start + maxShown - 1);
              if (end - start < maxShown - 1) start = Math.max(1, end - maxShown + 1);
              for (let p = start; p <= end; p++) {
                pages.push(
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-9 h-9 rounded ${p === page ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-200'}`}
                  >
                    {p}
                  </button>
                );
              }
              return (
                <>
                  {pages}
                  <button
                    onClick={() => setPage(Math.min(displayPages, page + 1))}
                    disabled={page >= displayPages}
                    className={`ml-2 px-3 py-2 rounded border ${page >= displayPages ? 'text-gray-300 border-gray-200' : 'text-gray-700 border-gray-300'}`}>
                    {t('owner.bookings.pagination.next') || 'Next'} →
                  </button>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Pending Bookings Modal */}
      {showPendingModal && (
        <div className="bg-white rounded-lg shadow-xl w-full p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold">{(t('owner.bookings.pendingModal.title') || 'Pending bookings') + ` (${stats.pending})`}</h3>
            <button
              onClick={() => setShowPendingModal(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

            {pendingBookings.length === 0 ? (
            <div className="text-center py-8 text-gray-500">{t('owner.bookings.pendingModal.empty') || 'No pending bookings'}</div>
          ) : (
            <div className="space-y-3">
              {pendingBookings.map((booking) => (
                <div key={booking.BookingID} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-bold text-gray-900">#{booking.BookingID}</span>
                        <span className="text-sm text-gray-500">{booking.FullName || booking.Username}</span>
                      </div>
                      <div className="text-sm text-gray-600 mb-1">
                        <strong>{booking.FacilityName}</strong> - {booking.FieldName} ({booking.FieldType})
                      </div>
                      <div className="text-sm text-gray-700 mb-1">
                        <strong>{t('owner.bookings.labels.contact') || 'Contact'}:</strong> {booking.Email}{getPhone(booking) ? ` · ` : ''}{getPhone(booking) ? <a href={`tel:${getPhone(booking)}`} className="hover:underline text-gray-700">{getPhone(booking)}</a> : ''}
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatDateTime(booking.StartTime)} → {formatDateTime(booking.EndTime)}
                      </div>
                      <div className="text-sm font-medium text-blue-600 mt-1">
                        {formatCurrency(booking.TotalAmount || 0)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setShowPendingModal(false);
                          viewBookingDetail(booking);
                        }}
                        className="px-3 py-2 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                      >
                        {t('owner.bookings.actions.details') || 'Chi tiết'}
                      </button>
                      <button
                        onClick={() => handleConfirmBooking(booking.BookingID)}
                        className="px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        {t('owner.bookings.actions.confirm') || 'Xác nhận'}
                      </button>
                      <button
                        onClick={() => handleCancelBooking(booking.BookingID)}
                        className="px-3 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        {t('owner.bookings.actions.cancel') || 'Hủy'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              onClick={() => setShowPendingModal(false)}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
            >
              {t('owner.bookings.actions.close') || 'Đóng'}
            </button>
          </div>
        </div>
      )}

      {/* Cancelled Bookings Modal */}
      {showCancelledModal && (
        <div className="bg-white rounded-lg shadow-xl w-full p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold">{(t('owner.bookings.cancelledModal.title') || 'Cancelled bookings') + ` (${stats.cancelled})`}</h3>
            <button
              onClick={() => setShowCancelledModal(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          {cancelledBookings.length === 0 ? (
            <div className="text-center py-8 text-gray-500">{t('owner.bookings.cancelledModal.empty') || 'No cancelled bookings'}</div>
          ) : (
            <div className="space-y-3">
              {cancelledBookings.map((booking) => (
                <div key={booking.BookingID} className="border border-red-200 rounded-lg p-4 bg-red-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-bold text-gray-900">#{booking.BookingID}</span>
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">{t('owner.bookings.stats.cancelled') || 'Cancelled'}</span>
                      </div>
                      <div className="text-sm text-gray-700 mb-1">
                        <strong>{t('owner.bookings.labels.customer') || 'Customer'}:</strong> {booking.FullName || booking.Username} ({booking.Email})
                      </div>
                      <div className="text-sm text-gray-700 mb-1">
                        <strong>{t('owner.bookings.labels.facility') || 'Facility'}:</strong> {booking.FacilityName} - {booking.FieldName} ({booking.FieldType})
                      </div>
                      <div className="text-sm text-gray-700 mb-1">
                        <strong>{t('owner.bookings.labels.time') || 'Time'}:</strong> {formatDateTime(booking.StartTime)} → {formatDateTime(booking.EndTime)}
                      </div>
                      <div className="text-sm font-medium text-gray-900 mt-1">
                        <strong>{t('owner.bookings.labels.total') || 'Total'}:</strong> {formatCurrency(booking.TotalAmount || 0)}
                      </div>
                      {booking.CancelReason && (
                        <div className="mt-2 p-2 bg-white rounded border border-red-200">
                            <div className="text-xs text-gray-500 mb-1">{t('owner.bookings.labels.cancelReason') || 'Cancel reason'}:</div>
                            <div className="text-sm text-gray-700">{booking.CancelReason}</div>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setShowCancelledModal(false);
                        viewBookingDetail(booking);
                      }}
                      className="px-3 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
                    >
                      {t('owner.bookings.actions.details') || 'Details'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
                onClick={() => setShowCancelledModal(false)}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                {t('owner.bookings.actions.close') || 'Close'}
              </button>
          </div>
        </div>
      )}

      {/* Detail Modal (overlay) */}
      {showDetailModal && selectedBooking && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="text-lg font-bold">{t('owner.bookings.detailModal.title') || 'Booking details'}</h3>
              <button className="close-button" onClick={() => setShowDetailModal(false)}>✕</button>
            </div>

            <div className="modal-body">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('owner.bookings.labels.bookingId') || 'Booking ID'}</label>
                    <div className="text-gray-900">#{selectedBooking.BookingID}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('owner.bookings.labels.status') || 'Status'}</label>
                    <div>{getStatusBadge(selectedBooking.Status)}</div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('owner.bookings.labels.customer') || 'Customer'}</label>
                  <div className="text-gray-900">{selectedBooking.FullName || selectedBooking.Username}</div>
                  <div className="text-sm text-gray-500">{selectedBooking.Email}</div>
                  {getPhone(selectedBooking) && (
                    <div className="text-sm text-gray-500 mt-1"><a href={`tel:${getPhone(selectedBooking)}`} className="hover:underline text-gray-700">{getPhone(selectedBooking)}</a></div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('owner.bookings.labels.facility') || 'Facility'}</label>
                    <div className="text-gray-900">{selectedBooking.FacilityName}</div>
                    <div className="text-sm text-gray-500">{selectedBooking.AreaName || getCachedAreaName(selectedBooking.AreaID)}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('owner.bookings.labels.field') || 'Field'}</label>
                    <div className="text-gray-900">{selectedBooking.FieldName} - {selectedBooking.FieldType}</div>
                    <div className="text-sm text-gray-500">{(t('owner.bookings.labels.sport') || 'Sport') + ': '}{selectedBooking.SportName}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('owner.bookings.labels.startTime') || 'Start time'}</label>
                    <div className="text-gray-900">{formatDateTime(selectedBooking.StartTime)}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('owner.bookings.labels.endTime') || 'End time'}</label>
                    <div className="text-gray-900">{formatDateTime(selectedBooking.EndTime)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('owner.bookings.labels.rentalPrice') || 'Rental price/hr'}</label>
                    <div className="text-gray-900">{formatCurrency(selectedBooking.RentalPrice || 0)}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('owner.bookings.labels.total') || 'Total'}</label>
                    <div className="text-gray-900 font-bold">{formatCurrency(selectedBooking.TotalAmount || 0)}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
                  {selectedBooking.Status === 'Pending' && (
                <button
                  onClick={() => handleConfirmBooking(selectedBooking.BookingID)}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  {t('owner.bookings.actions.confirmOrder') || 'Confirm order'}
                </button>
              )}
              {(selectedBooking.Status === 'Pending' || selectedBooking.Status === 'Confirmed') && (
                <button
                  onClick={() => handleCancelBooking(selectedBooking.BookingID)}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  {t('owner.bookings.actions.cancelOrder') || 'Cancel order'}
                </button>
              )}
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                {t('owner.bookings.actions.close') || 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerBookings;
