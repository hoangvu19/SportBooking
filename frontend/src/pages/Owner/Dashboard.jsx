import React, { useEffect, useState } from 'react';
import { 
  SummaryCards,
  MonthlyRevenueChart,
  RevenueByFieldChart,
  BookingTrendsChart,
  PeakHoursChart,
  FieldUtilizationChart,
  BookingStatusChart,
  TopCustomersTable
} from '../../components/Owner/DashboardCharts';
import { API_BASE_URL } from '../../config/apiConfig';
import { useI18n } from '../../i18n/hooks';

const OwnerDashboard = () => {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  
  // Dashboard data states
  const [summary, setSummary] = useState(null);
  const [monthlyRevenue, setMonthlyRevenue] = useState([]);
  const [revenueByField, setRevenueByField] = useState([]);
  const [bookingTrends, setBookingTrends] = useState([]);
  const [peakHours, setPeakHours] = useState([]);
  const [fieldUtilization, setFieldUtilization] = useState([]);
  const [bookingStatus, setBookingStatus] = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);

  // Initialize date range
  useEffect(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);
    
    setDateRange({
      startDate: startDate.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10)
    });
  }, []);

  // Load data when date range changes
  useEffect(() => {
    if (dateRange.startDate && dateRange.endDate) {
      const loadData = async () => {
        setLoading(true);
        setError(null);
        
        try {
          const token = localStorage.getItem('authToken');
          if (!token) {
            throw new Error(t('settings.pleaseLoginAgain'));
          }

          const headers = { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          };

          console.log('📊 Loading dashboard data from:', API_BASE_URL);

          // Fetch all dashboard data in parallel
          const [
            summaryRes,
            monthlyRevenueRes,
            revenueByFieldRes,
            bookingTrendsRes,
            peakHoursRes,
            fieldUtilizationRes,
            bookingStatusRes,
            topCustomersRes
          ] = await Promise.all([
            fetch(`${API_BASE_URL}/bookings/dashboard/summary`, { headers }),
            fetch(`${API_BASE_URL}/bookings/dashboard/monthly-revenue?months=12`, { headers }),
            fetch(`${API_BASE_URL}/bookings/dashboard/revenue-by-field?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`, { headers }),
            fetch(`${API_BASE_URL}/bookings/dashboard/booking-trends?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`, { headers }),
            fetch(`${API_BASE_URL}/bookings/dashboard/peak-hours?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`, { headers }),
            fetch(`${API_BASE_URL}/bookings/dashboard/field-utilization?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`, { headers }),
            fetch(`${API_BASE_URL}/bookings/dashboard/booking-status?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`, { headers }),
            fetch(`${API_BASE_URL}/bookings/dashboard/top-customers?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&limit=10`, { headers })
          ]);

          // Parse JSON responses
          const [
            summaryData,
            monthlyRevenueData,
            revenueByFieldData,
            bookingTrendsData,
            peakHoursData,
            fieldUtilizationData,
            bookingStatusData,
            topCustomersData
          ] = await Promise.all([
            summaryRes.json(),
            monthlyRevenueRes.json(),
            revenueByFieldRes.json(),
            bookingTrendsRes.json(),
            peakHoursRes.json(),
            fieldUtilizationRes.json(),
            bookingStatusRes.json(),
            topCustomersRes.json()
          ]);

          // Check for errors
          if (!summaryRes.ok) {
            console.error('Summary API error:', summaryData);
            throw new Error(summaryData.message || t('owner.dashboard.summaryLoadError'));
          }

          // Update states
          if (summaryData.success) setSummary(summaryData.data);
          if (monthlyRevenueData.success) {
            console.log('📊 Monthly Revenue Data:', monthlyRevenueData.data);
            setMonthlyRevenue(monthlyRevenueData.data || []);
          }
          if (revenueByFieldData.success) setRevenueByField(revenueByFieldData.data || []);
          if (bookingTrendsData.success) setBookingTrends(bookingTrendsData.data || []);
          if (peakHoursData.success) setPeakHours(peakHoursData.data || []);
          if (fieldUtilizationData.success) setFieldUtilization(fieldUtilizationData.data || []);
          if (bookingStatusData.success) setBookingStatus(bookingStatusData.data || []);
          if (topCustomersData.success) setTopCustomers(topCustomersData.data || []);

          console.log('✅ Dashboard data loaded successfully');

        } catch (err) {
          console.error('❌ Dashboard load error:', err);
          setError(err.message || t('owner.dashboard.dashboardLoadError'));
        } finally {
          setLoading(false);
        }
      };
      
      loadData();
    }
  }, [dateRange]);

  const handleDateRangeChange = (e) => {
    const { name, value } = e.target;
    setDateRange(prev => ({ ...prev, [name]: value }));
  };

  const setQuickRange = (days) => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);
    
    setDateRange({
      startDate: startDate.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10)
    });
  };

  const handleRefresh = () => {
    // Trigger reload by updating date range
    setDateRange(prev => ({ ...prev }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('owner.dashboard.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h3 className="text-red-800 font-semibold mb-2">{t('owner.dashboard.error')}</h3>
          <p className="text-red-600">{error}</p>
          <button 
            onClick={handleRefresh}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            {t('owner.dashboard.retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('owner.dashboard.title')}</h1>
          <p className="text-gray-600">{t('owner.dashboard.subtitle')}</p>
        </div>

        {/* Date Range Selector */}
        <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('owner.dashboard.dateRange.from')}</label>
              <input
                type="date"
                name="startDate"
                value={dateRange.startDate}
                onChange={handleDateRangeChange}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('owner.dashboard.dateRange.to')}</label>
              <input
                type="date"
                name="endDate"
                value={dateRange.endDate}
                onChange={handleDateRangeChange}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2 items-end">
              <button 
                onClick={() => setQuickRange(7)}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
              >
                {t('owner.dashboard.dateRange.7days')}
              </button>
              <button 
                onClick={() => setQuickRange(30)}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
              >
                {t('owner.dashboard.dateRange.30days')}
              </button>
              <button 
                onClick={() => setQuickRange(90)}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
              >
                {t('owner.dashboard.dateRange.90days')}
              </button>
            </div>
            <button 
              onClick={handleRefresh}
              className="ml-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              {t('owner.dashboard.dateRange.update')}
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <SummaryCards summary={summary} />

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {monthlyRevenue.length > 0 && <MonthlyRevenueChart data={monthlyRevenue} />}
          {revenueByField.length > 0 && <RevenueByFieldChart data={revenueByField} />}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {bookingTrends.length > 0 && <BookingTrendsChart data={bookingTrends} />}
          {peakHours.length > 0 && <PeakHoursChart data={peakHours} />}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {fieldUtilization.length > 0 && <FieldUtilizationChart data={fieldUtilization} />}
          {bookingStatus.length > 0 && <BookingStatusChart data={bookingStatus} />}
        </div>

        {/* Top Customers Table */}
        {topCustomers.length > 0 && (
          <div className="mb-6">
            <TopCustomersTable data={topCustomers} />
          </div>
        )}

        {/* Empty State */}
        {monthlyRevenue.length === 0 && revenueByField.length === 0 && (
          <div className="bg-white p-8 rounded-lg shadow-sm border text-center">
            <div className="text-gray-400 text-5xl mb-4">📊</div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">{t('owner.dashboard.empty.title')}</h3>
            <p className="text-gray-500">{t('owner.dashboard.empty.message')}</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default OwnerDashboard;
