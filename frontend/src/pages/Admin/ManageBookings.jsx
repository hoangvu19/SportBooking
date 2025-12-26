import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Users, Zap, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { API_BASE_URL } from '../../config/apiConfig';
import apiClient from '../../utils/apiClient';
import { useI18n } from '../../i18n/hooks';
import { useAdminSearch } from '../../contexts/AdminSearchContext';
import 'date-fns/locale/vi';

const fetchBookings = async ({ region = null, status = null, month = null, page = 1, limit = 20 } = {}) => {
  try {
    const params = new URLSearchParams();
    if (region && region !== 'All') params.set('region', region);
    if (status && status !== 'all') params.set('status', status);
    if (month) params.set('month', month); // format YYYY-MM
    params.set('page', String(page));
    params.set('limit', String(limit));

    // Prefer apiClient which attaches auth token and standardizes responses
    const apiResp = await apiClient.get(`/admin/bookings/list?${params.toString()}`);
    // apiClient.get returns { data }
    return apiResp && apiResp.data ? apiResp.data : apiResp;
  } catch (err) {
    console.error('fetchBookings API error', err);
    return { success: false, message: err.message };
  }
};

// areas will be loaded from backend
// const regionsList = ['All', 'Hanoi', 'Ho Chi Minh', 'Da Nang', 'Hue'];

const StatusBadge = ({ status }) => {
  const s = status?.toLowerCase?.() || '';
  if (s === 'confirmed') return <span className="px-3 py-1 rounded-lg text-sm font-semibold bg-green-100 text-green-700">{status}</span>;
  if (s === 'pending') return <span className="px-3 py-1 rounded-lg text-sm font-semibold bg-yellow-100 text-yellow-700">{status}</span>;
  if (s === 'completed') return <span className="px-3 py-1 rounded-lg text-sm font-semibold bg-blue-100 text-blue-700">{status}</span>;
  return <span className="px-3 py-1 rounded-lg text-sm font-semibold bg-gray-100 text-gray-700">{status}</span>;
};

const StatCard = ({ icon: Icon, label, value, color }) => (
  <div className={`${color} rounded-xl p-4 text-white shadow-lg`}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm opacity-90">{label}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
      </div>
      {Icon && <Icon size={32} className="opacity-30" />}
    </div>
  </div>
);

const ManageBookings = () => {
  const { t } = useI18n();
  const { searchQuery } = useAdminSearch();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [areas, setAreas] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRegion, setFilterRegion] = useState('All');
  const [filterMonth, setFilterMonth] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isServerPaged, setIsServerPaged] = useState(false);
  const [stats, setStats] = useState({ total: 0, pending: 0, confirmed: 0, cancelled: 0 });
  const itemsPerPage = 8;
  const [savingStatus, setSavingStatus] = useState({});
  const [loadingAll, setLoadingAll] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // When searching, load all bookings to search across all pages
        const hasSearch = searchQuery && searchQuery.trim() !== '';
        const limit = hasSearch ? 100000 : itemsPerPage;
        const page = hasSearch ? 1 : currentPage;
        
        const res = await fetchBookings({ region: filterRegion, status: filterStatus, month: filterMonth, page, limit });
        if (res && res.success) {
          // Map backend booking shape to frontend-friendly shape
          const mapped = (res.data || []).map(b => {
            return {
              id: b.BookingID || b.BookingId || b.BookingID,
              fieldId: b.FieldID || b.FieldId || (b.Field && b.Field.FieldID) || b.FieldID,
              customerId: b.CustomerID || b.CustomerId,
              userName: b.FullName || b.Username || (b.customer && b.customer.full_name) || '',
              sportType: b.SportName || (b.field && b.field.sport) || '',
              region: b.AreaName || b.area || (b.field && b.field.area) || '',
              startTimeISO: b.StartTime,
              endTimeISO: b.EndTime,
              status: b.Status || b.status,
              deposit: b.Deposit || 0,
              totalAmount: b.TotalAmount || 0,
              raw: b
            };
          });

          setBookings(mapped);
          setIsServerPaged(!hasSearch && !!res.pagination);
          // prefer server pagination when provided
          const serverTotal = res.pagination?.total || (res.summary && (res.summary.total || res.summary.Total)) || mapped.length;
          setTotalResults(serverTotal || mapped.length);
          setTotalPages(Math.max(1, Math.ceil((serverTotal || mapped.length) / itemsPerPage)));
          if (res.summary) {
            setStats({
              total: res.summary.total || res.summary.Total || serverTotal || mapped.length,
              pending: res.summary.pending || res.summary.Pending || 0,
              confirmed: res.summary.confirmed || res.summary.Confirmed || 0,
              cancelled: res.summary.cancelled || res.summary.Cancelled || 0
            });
          } else {
            // derive counts from mapped rows
            const pending = mapped.filter(m => (m.status || '').toString().toLowerCase() === 'pending').length;
            const confirmed = mapped.filter(m => (m.status || '').toString().toLowerCase() === 'confirmed').length;
            const cancelled = mapped.filter(m => (m.status || '').toString().toLowerCase() === 'cancelled').length;
            setStats({ total: serverTotal || mapped.length, pending, confirmed, cancelled });
          }
        } else {
          setBookings([]);
          setTotalResults(0);
          setTotalPages(1);
          setIsServerPaged(false);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [filterRegion, filterStatus, currentPage, filterMonth, searchQuery]);

  const changeBookingStatus = async (bookingId, newStatus, invoiceId) => {
    try {
      setSavingStatus(s => ({ ...s, [bookingId]: true }));
      const apiResp = await apiClient.put(`/admin/bookings/${bookingId}/status`, { status: newStatus, invoiceId });
      const json = apiResp && apiResp.data ? apiResp.data : apiResp;
      if (json && json.success) {
      const res = await fetchBookings({ region: filterRegion, status: filterStatus, month: filterMonth, page: currentPage, limit: itemsPerPage });
        if (res && res.success) {
          const mapped = (res.data || []).map(b => {
            return {
              id: b.BookingID || b.BookingId || b.BookingID,
              fieldId: b.FieldID || b.FieldId || (b.Field && b.Field.FieldID) || b.FieldID,
              customerId: b.CustomerID || b.CustomerId,
              userName: b.FullName || b.Username || (b.customer && b.customer.full_name) || '',
              sportType: b.SportName || (b.field && b.field.sport) || '',
              region: b.AreaName || b.area || (b.field && b.field.area) || '',
              startTimeISO: b.StartTime,
              endTimeISO: b.EndTime,
              status: b.Status || b.status,
              deposit: b.Deposit || 0,
              totalAmount: b.TotalAmount || 0,
              raw: b
            };
          });
          setBookings(mapped);
        }
      } else {
        throw new Error(json.message || 'Unknown error');
      }
    } catch (err) {
      console.error('Change status error', err);
      alert(t('admin.manageBookings.changeStatusError', 'Could not change status') + ': ' + (err.message || 'error'));
    } finally {
      setSavingStatus(s => ({ ...s, [bookingId]: false }));
    }
  };

  // load areas for the Area dropdown
  useEffect(() => {
    const loadAreas = async () => {
      try {
          const resp = await apiClient.get('/areas');
          const body = resp && resp.data ? resp.data : resp;
          if (body && body.success && Array.isArray(body.data)) setAreas(body.data);
          else if (Array.isArray(body)) setAreas(body);
        } catch (err) {
          console.error('Failed to load areas', err);
          setAreas([]);
        }
    };
    loadAreas();
  }, []);

  const formatDateTime = (iso) => {
    if (!iso) return '';
    try { return format(new Date(iso), 'dd/MM/yyyy HH:mm'); } catch { return iso; }
  };

  // Bookings are loaded server-side with region filter; apply client-side status and search
  const filtered = bookings.filter(b => {
    // Status filter
    const statusMatch = filterStatus === 'all' || (b.status || '').toString().toLowerCase() === (filterStatus || '').toString().toLowerCase();
    
    // Search filter from header
    if (!searchQuery || searchQuery.trim() === '') return statusMatch;
    const q = searchQuery.toLowerCase().trim();
    const userName = (b.userName || '').toString().toLowerCase();
    const sportType = (b.sportType || '').toString().toLowerCase();
    const region = (b.region || '').toString().toLowerCase();
    const bookingId = (b.id || '').toString().toLowerCase();
    const fieldId = (b.fieldId || '').toString().toLowerCase();
    const customerId = (b.customerId || '').toString().toLowerCase();
    const searchMatch = userName.includes(q) || sportType.includes(q) || region.includes(q) || bookingId.includes(q) || fieldId.includes(q) || customerId.includes(q);
    
    return statusMatch && searchMatch;
  });

  const displayResults = searchQuery && searchQuery.trim() !== '' ? filtered.length : totalResults;
  const displayPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const startIdx = (currentPage - 1) * itemsPerPage;
  const pageItems = (searchQuery && searchQuery.trim() !== '') ? filtered.slice(startIdx, startIdx + itemsPerPage) : (isServerPaged ? bookings : filtered.slice(startIdx, startIdx + itemsPerPage));

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center">
            <MapPin size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-gray-900">{t('admin.manageBookings.title', 'Manage Bookings')}</h1>
            <p className="text-gray-500 mt-1">{t('admin.manageBookings.subtitle', 'Filter by area, view booking details and financials')}</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <StatCard icon={Users} label={t('admin.manageBookings.totalBookings', 'Total bookings')} value={stats.total} color="bg-blue-600" />
          <StatCard icon={Zap} label={t('admin.manageBookings.pending', 'Pending')} value={stats.pending} color="bg-yellow-500" />
          <StatCard icon={Calendar} label={t('admin.manageBookings.confirmed', 'Confirmed')} value={stats.confirmed} color="bg-green-600" />
          <StatCard icon={Clock} label={t('admin.manageBookings.cancelled', 'Cancelled')} value={stats.cancelled} color="bg-red-600" />
        </div>

        {/* Filters: Region & Status */}
        <div className="mb-6 flex items-center gap-4">
          <div>
            <label className="text-sm text-gray-600 block mb-1">{t('admin.manageBookings.region', 'Region')}</label>
            <select
              value={filterRegion}
              onChange={e => { setFilterRegion(e.target.value); setCurrentPage(1); }}
              className="px-3 py-2 border rounded-md bg-white text-sm"
            >
              <option value="All">{t('admin.manageBookings.allRegions', 'All')}</option>
              {areas.map(a => (
                <option key={a.AreaID || a.id || a} value={a.AreaName || a.name || a}>{a.AreaName || a.name || a}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm text-gray-600 block mb-1">{t('admin.manageBookings.status', 'Status')}</label>
            <select
              value={filterStatus}
              onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}
              className="px-3 py-2 border rounded-md bg-white text-sm"
            >
              <option value="all">{t('admin.manageBookings.allStatus', 'All')}</option>
              <option value="pending">{t('admin.manageBookings.pending', 'Pending')}</option>
              <option value="confirmed">{t('admin.manageBookings.confirmed', 'Confirmed')}</option>
              <option value="cancelled">{t('admin.manageBookings.cancelled', 'Cancelled')}</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-gray-600 block mb-1">{t('admin.manageBookings.month', 'Month')}</label>
            <input
              type="month"
              value={filterMonth}
              onChange={e => { setFilterMonth(e.target.value); setCurrentPage(1); }}
              className="px-3 py-2 border rounded-md bg-white text-sm"
              placeholder="YYYY-MM"
            />
          </div>

          <div className="ml-auto">
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  try {
                    setLoadingAll(true);
                    const res = await fetchBookings({ region: filterRegion, status: filterStatus, month: filterMonth, page: 1, limit: 100000 });
                    if (res && res.success && Array.isArray(res.data)) {
                      const mapped = (res.data || []).map(b => ({
                        id: b.BookingID || b.BookingId || b.BookingID,
                        fieldId: b.FieldID || b.FieldId || (b.Field && b.Field.FieldID) || b.FieldID,
                        customerId: b.CustomerID || b.CustomerId,
                        userName: b.FullName || b.Username || (b.customer && b.customer.full_name) || '',
                        sportType: b.SportName || (b.field && b.field.sport) || '',
                        region: b.AreaName || b.area || (b.field && b.field.area) || '',
                        startTimeISO: b.StartTime,
                        endTimeISO: b.EndTime,
                        status: b.Status || b.status,
                        deposit: b.Deposit || 0,
                        totalAmount: b.TotalAmount || 0,
                        raw: b
                      }));
                      setBookings(mapped);
                      setTotalResults(mapped.length || 0);
                      setCurrentPage(1);
                    } else {
                      setBookings([]);
                      setTotalResults(0);
                    }
                  } catch (err) {
                    console.error('Load all bookings error', err);
                    alert(t('admin.manageBookings.loadAllError', 'Cannot load all bookings'));
                  } finally {
                    setLoadingAll(false);
                  }
                }}
                className="px-4 py-2 border rounded-lg text-sm bg-white hover:bg-gray-50"
                disabled={loadingAll}
              >
                {t('admin.manageBookings.loadAll', 'Load all bookings')}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">{t('admin.manageBookings.bookingId', 'Booking ID')}</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">{t('admin.manageBookings.fieldId', 'Field ID')}</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">{t('admin.manageBookings.customerId', 'Customer ID')}</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">{t('admin.manageBookings.user', 'User')}</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">{t('admin.manageBookings.region', 'Region')}</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">{t('admin.manageBookings.sportType', 'Sport Type')}</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">{t('admin.manageBookings.startTime', 'Start Time')}</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">{t('admin.manageBookings.endTime', 'End Time')}</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">{t('admin.manageBookings.deposit', 'Deposit')}</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">{t('admin.manageBookings.total', 'Total')}</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">{t('admin.manageBookings.status', 'Status')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={11} className="px-6 py-12 text-center">{t('admin.manageBookings.loading', 'Loading...')}</td>
                  </tr>
                ) : pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-6 py-12 text-center">{t('admin.manageBookings.noBookings', 'No bookings found for current filters')}</td>
                  </tr>
                ) : (
                  pageItems.map((b, idx) => (
                    <tr key={b.id} className={`border-b ${idx%2===0?'bg-white':'bg-gray-50'}`}>
                      <td className="px-4 py-3 font-semibold">#{b.id}</td>
                      <td className="px-4 py-3">{b.fieldId}</td>
                      <td className="px-4 py-3">{b.customerId}</td>
                      <td className="px-4 py-3 flex items-center gap-2"><Users size={14} className="text-blue-500"/>{b.userName}</td>
                      <td className="px-4 py-3">{b.region}</td>
                      <td className="px-4 py-3">{b.sportType}</td>
                      <td className="px-4 py-3">{formatDateTime(b.startTimeISO)}</td>
                      <td className="px-4 py-3">{formatDateTime(b.endTimeISO)}</td>
                      <td className="px-4 py-3">${b.deposit}</td>
                      <td className="px-4 py-3">${b.totalAmount}</td>
                      <td className="px-4 py-3 flex items-center gap-2">
                        <StatusBadge status={b.status} />
                        <select
                          disabled={!!savingStatus[b.id]}
                          value={b.status || 'Pending'}
                          onChange={e => {
                            const newStatus = e.target.value;
                            const invoiceId = b.raw && (b.raw.InvoiceID || b.raw.invoiceId || b.raw.InvoiceID);
                            if (!window.confirm(t('admin.manageBookings.changeStatus', 'Change status of booking #{{id}} to {{status}}?').replace('{{id}}', b.id).replace('{{status}}', newStatus))) return;
                            changeBookingStatus(b.id, newStatus, invoiceId);
                          }}
                          className="px-3 py-1 border rounded-md text-sm"
                        >
                          {['Pending','Confirmed','Completed','Cancelled','Refunded'].map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {(searchQuery && searchQuery.trim() !== '' ? displayPages : totalPages) > 1 && (
            <div className="bg-white border-t px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-sm text-gray-700">{t('admin.manageBookings.showing', 'Showing')} <strong>{startIdx + 1}</strong> {t('admin.manageBookings.to', 'to')} <strong>{Math.min(startIdx + itemsPerPage, displayResults)}</strong> {t('admin.manageBookings.of', 'of')} <strong>{displayResults}</strong> {t('admin.manageBookings.results', 'results')}</div>
              <div className="flex gap-2 items-center">
                <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage===1} className="px-4 py-2 border rounded-lg disabled:opacity-50">← {t('admin.manageBookings.previous', 'Previous')}</button>
                <div className="flex gap-2">
                  {Array.from({ length: Math.min(searchQuery && searchQuery.trim() !== '' ? displayPages : totalPages, 10) }).map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentPage(idx + 1)}
                      className={`w-10 h-10 flex items-center justify-center rounded-lg border ${currentPage === idx + 1 ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
                <button onClick={() => setCurrentPage(p => Math.min((searchQuery && searchQuery.trim() !== '' ? displayPages : totalPages), p+1))} disabled={currentPage===(searchQuery && searchQuery.trim() !== '' ? displayPages : totalPages)} className="px-4 py-2 border rounded-lg disabled:opacity-50">{t('admin.manageBookings.next', 'Next')} →</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManageBookings;