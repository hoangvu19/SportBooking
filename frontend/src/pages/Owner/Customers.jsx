import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { customerAPI } from '../../utils/api';
import Loading from '../../components/Shared/Loading';
import toast from 'react-hot-toast';
import moment from 'moment';
import { parseServerDatetime } from '../../utils/vnTime';
import { getPhone, normalizeUser } from '../../utils/normalize';
import '../../components/Shared/modal.css';
import { loadAreas, getCachedAreaName } from '../../utils/areaCache';
import { 
  Users, Eye, X, Calendar, TrendingUp, 
  DollarSign, Phone, Mail, MapPin, User 
} from 'lucide-react';
import { useI18n } from '../../i18n/hooks';
import { useOwnerSearch } from '../../contexts/OwnerSearchContext';

const Customers = () => {
  const { searchQuery } = useOwnerSearch();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [customerBookings, setCustomerBookings] = useState([]);
  const [customerStats, setCustomerStats] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });
  const { t } = useI18n();

  const loadCustomers = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      // When searching, load all customers for client-side filtering
      const hasSearch = searchQuery && searchQuery.trim() !== '';
      const res = await customerAPI.getAll({ 
        page: hasSearch ? 1 : page, 
        limit: hasSearch ? 100000 : pagination.limit 
      }, true);
      
      if (res && res.success && Array.isArray(res.data)) {
        setCustomers(res.data);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      } else {
        setCustomers([]);
        toast.error(t('owner.customers.loadError'));
      }
    } catch (err) {
      console.error('Load customers error:', err);
      toast.error(t('owner.customers.loadError'));
    } finally {
      setLoading(false);
    }
  }, [pagination.limit, searchQuery, t]);

  useEffect(() => {
    loadAreas().catch(() => {});
    loadCustomers(1);
  }, [loadCustomers]);

  const handlePageChange = (newPage) => {
    loadCustomers(newPage);
  };

  const viewCustomerDetail = async (customer) => {
    setSelectedCustomer(customer);
    setShowDetailModal(true);
    const cid = (normalizeUser(customer || {}).id) || customer.AccountID || customer._id || customer.id;
    try {
      const [bookingsRes, statsRes] = await Promise.all([
        customerAPI.getBookings(cid, { limit: 10 }, true),
        customerAPI.getStats(cid, {}, true)
      ]);

      if (bookingsRes && bookingsRes.success) {
        setCustomerBookings(bookingsRes.data || []);
      }

      if (statsRes && statsRes.success) {
        setCustomerStats(statsRes.data || null);
      }
    } catch (err) {
      console.error('Load customer details error:', err);
      toast.error(t('owner.customers.detailLoadError'));
    } 
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', { 
      style: 'currency', 
      currency: 'VND' 
    }).format(amount || 0);
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'N/A';
    return moment(parseServerDatetime(dateStr)).format('DD/MM/YYYY HH:mm');
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return moment(parseServerDatetime(dateStr)).format('DD/MM/YYYY');
  };

  // derive selected customer normalized shape for modal rendering
  const sel = selectedCustomer ? normalizeUser(selectedCustomer || {}) : null;

  if (loading) return <Loading />;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Users className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold">{t('owner.customers.title') || 'Manage customers'}</h2>
        </div>
        <p className="text-gray-600">{t('owner.customers.subtitle') || 'List of customers who booked at your facilities'}</p>
      </div>

      <div className="mb-6" />

      {/* Customers Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {customers.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">{t('owner.customers.empty') || 'No customers yet'}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('owner.customers.tableHeaders.customer')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('owner.customers.tableHeaders.contact')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('owner.customers.tableHeaders.bookings')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('owner.customers.tableHeaders.totalSpent')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('owner.customers.tableHeaders.lastBooking')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('owner.customers.tableHeaders.actions')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(() => {
                    // Filter customers by search query
                    const filtered = customers.filter(c => {
                      if (!searchQuery || searchQuery.trim() === '') return true;
                      const q = searchQuery.toLowerCase().trim();
                      const fullName = (c.FullName || '').toString().toLowerCase();
                      const username = (c.Username || '').toString().toLowerCase();
                      const email = (c.Email || '').toString().toLowerCase();
                      return fullName.includes(q) || username.includes(q) || email.includes(q);
                    });
                    return filtered.map((customer) => {
                    const cu = normalizeUser(customer || {});
                    return (
                      <tr key={customer.AccountID || cu.id || customer.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {(cu.avatar || customer.AvatarUrl) ? (
                              <img src={cu.avatar || customer.AvatarUrl} alt={cu.fullName || customer.FullName || cu.username || customer.Username} className="w-10 h-10 rounded-full object-cover" />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                <User className="w-6 h-6 text-blue-600" />
                              </div>
                            )}
                            <div>
                              <div className="font-medium text-gray-900">{cu.fullName || customer.FullName || cu.username || customer.Username}</div>
                              <div className="text-sm text-gray-500">@{cu.username || customer.Username}</div>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <div className="text-sm">
                            <div className="flex items-center gap-1 text-gray-900 mb-1">
                              <Mail className="w-4 h-4 text-gray-400" />
                              {cu.email || customer.Email}
                            </div>
                            {(getPhone(cu) || getPhone(customer)) && (
                              <div className="flex items-center gap-1 text-gray-600">
                                <Phone className="w-4 h-4 text-gray-400" />
                                {getPhone(cu) || getPhone(customer)}
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <div className="text-sm">
                            <div className="font-medium text-gray-900">{customer.TotalBookings} {t('owner.customers.times') || 'times'}</div>
                            <div className="text-xs text-gray-500">
                              <span className="text-green-600">{customer.CompletedBookings} {t('owner.customers.completed') || 'completed'}</span>
                              {customer.CancelledBookings > 0 && (
                                <>
                                  {' · '}
                                  <span className="text-red-600">{customer.CancelledBookings} {t('owner.customers.cancelled') || 'cancelled'}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <div className="font-bold text-green-600">{formatCurrency(customer.TotalSpent)}</div>
                        </td>

                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{formatDate(customer.LastBookingDate)}</div>
                          <div className="text-xs text-gray-500">{moment(parseServerDatetime(customer.LastBookingDate)).fromNow()}</div>
                        </td>

                        <td className="px-6 py-4">
                          <button onClick={() => viewCustomerDetail(customer)} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm">
                            <Eye className="w-4 h-4" />
                            {t('common.details') || 'Details'}
                          </button>
                        </td>
                      </tr>
                    );
                  });
                })()}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {(() => {
              // Calculate filtered results count for pagination when searching
              const hasSearch = searchQuery && searchQuery.trim() !== '';
              let filteredTotal = pagination.total;
              let filteredPages = pagination.totalPages;
              
              if (hasSearch) {
                const filtered = customers.filter(c => {
                  const q = searchQuery.toLowerCase().trim();
                  const fullName = (c.FullName || '').toString().toLowerCase();
                  const username = (c.Username || '').toString().toLowerCase();
                  const email = (c.Email || '').toString().toLowerCase();
                  return fullName.includes(q) || username.includes(q) || email.includes(q);
                });
                filteredTotal = filtered.length;
                filteredPages = Math.max(1, Math.ceil(filteredTotal / pagination.limit));
              }
              
              if (filteredPages <= 1) return null;
              
              return (
                <div className="px-6 py-4 bg-gray-50 border-t flex items-center justify-between">
                  <div className="text-sm text-gray-700">{t('owner.customers.pagination.showing')} <strong>{(pagination.page - 1) * pagination.limit + 1}</strong> {t('owner.customers.pagination.to')} <strong>{Math.min(pagination.page * pagination.limit, filteredTotal)}</strong> {t('owner.customers.pagination.of')} <strong>{filteredTotal}</strong> {t('owner.customers.pagination.results')}</div>
                  <div className="flex gap-2 items-center">
                    <button onClick={() => handlePageChange(pagination.page - 1)} disabled={pagination.page === 1} className="px-4 py-2 border rounded-lg disabled:opacity-50">{t('owner.customers.pagination.previous')}</button>
                    <div className="flex gap-2">
                      {Array.from({ length: Math.min(filteredPages, 10) }, (_, i) => (
                        <button key={i} onClick={() => handlePageChange(i + 1)} className={`w-10 h-10 flex items-center justify-center rounded-lg border ${pagination.page === i + 1 ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}>
                          {i + 1}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => handlePageChange(pagination.page + 1)} disabled={pagination.page === filteredPages} className="px-4 py-2 border rounded-lg disabled:opacity-50">{t('owner.customers.pagination.next')}</button>
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>

      {/* Customer Detail Modal (overlay) */}
      {showDetailModal && selectedCustomer && sel && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="text-lg font-bold">{sel.fullName || selectedCustomer.FullName || sel.username || selectedCustomer.Username}</h2>
                <div className="text-sm text-gray-500">@{sel.username || selectedCustomer.Username}</div>
              </div>
              <button className="close-button" onClick={() => setShowDetailModal(false)}>✕</button>
            </div>
                <div className="modal-body">
              <div className="bg-gray-50 p-4 rounded mb-4">
                <h4 className="font-semibold mb-2">{t('owner.customers.modal.contact')}</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-gray-400" />
                    <div>{sel.email || selectedCustomer.Email}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-gray-400" />
                    <div>{sel.areaName || selectedCustomer.AreaName || getCachedAreaName(selectedCustomer.AreaID) || sel.address || selectedCustomer.Address || '---'}</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4 mb-4">
                <div className="bg-blue-50 p-4 rounded">
                  <div className="text-sm text-gray-500">{t('owner.customers.stats.total')}</div>
                  <div className="text-2xl font-bold">{(customerStats && customerStats.summary) ? customerStats.summary.TotalBookings : (selectedCustomer.TotalBookings || 0)}</div>
                </div>
                <div className="bg-green-50 p-4 rounded">
                  <div className="text-sm text-gray-500">{t('owner.customers.stats.completed')}</div>
                  <div className="text-2xl font-bold">{(customerStats && customerStats.summary) ? customerStats.summary.CompletedBookings : (selectedCustomer.CompletedBookings || 0)}</div>
                </div>
                <div className="bg-yellow-50 p-4 rounded">
                  <div className="text-sm text-gray-500">{t('owner.customers.stats.pending')}</div>
                  <div className="text-2xl font-bold">{(customerStats && customerStats.summary) ? customerStats.summary.PendingBookings : (selectedCustomer.PendingBookings || 0)}</div>
                </div>
                <div className="bg-red-50 p-4 rounded">
                  <div className="text-sm text-gray-500">{t('owner.customers.stats.cancelled')}</div>
                  <div className="text-2xl font-bold">{(customerStats && customerStats.summary) ? customerStats.summary.CancelledBookings : (selectedCustomer.CancelledBookings || 0)}</div>
                </div>
              </div>

              <div className="mb-4">
                <h4 className="font-semibold mb-3">{t('owner.customers.modal.recentBookings')}</h4>
                {((customerBookings && customerBookings.length) || (selectedCustomer.RecentBookings && selectedCustomer.RecentBookings.length)) ? (
                  ((customerBookings && customerBookings.length) ? customerBookings : selectedCustomer.RecentBookings || []).map(b => (
                    <div key={b.BookingID} className="p-4 border rounded mb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold">{b.FacilityName}</div>
                          <div className="text-sm text-gray-500">{b.FieldName} ({b.SportName})</div>
                        </div>
                        <div className="text-sm text-gray-500">{formatDateTime(b.StartTime)}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-8">{t('owner.customers.modal.noBookings')}</p>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowDetailModal(false)} className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50">{t('owner.customers.modal.close')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
