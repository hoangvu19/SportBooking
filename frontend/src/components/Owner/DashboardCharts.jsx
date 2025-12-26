import React from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useI18n } from '../../i18n/hooks';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export const MonthlyRevenueChart = ({ data }) => {
  const { t } = useI18n();
  const chartData = data.map(item => ({
    month: `${item.Month}/${item.Year}`,
    revenue: item.Revenue || 0,
    bookings: item.TotalBookings || 0
  }));

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-800 mb-2">{data.month}</p>
          <p className="text-sm text-blue-600">
            💰 {t('owner.charts.monthlyRevenue.revenue')}: <span className="font-bold">{new Intl.NumberFormat('vi-VN').format(data.revenue)} {t('common.currency')}</span>
          </p>
          <p className="text-sm text-green-600">
            📊 {t('owner.charts.monthlyRevenue.numBookings')}: <span className="font-bold">{data.bookings}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-white p-6 rounded-xl shadow-md border border-blue-100 hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <span className="text-2xl">📈</span>
          {t('owner.charts.monthlyRevenue.title')}
        </h3>
        <div className="flex gap-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-gray-600">{t('owner.charts.monthlyRevenue.revenue')}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-gray-600">{t('owner.charts.monthlyRevenue.bookings')}</span>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
            </linearGradient>
            <linearGradient id="colorBookings" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.6}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.05}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="month" 
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
            tick={{ fill: '#6b7280' }}
          />
          <YAxis 
            yAxisId="left" 
            stroke="#3b82f6"
            style={{ fontSize: '12px' }}
            tick={{ fill: '#3b82f6' }}
            tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`}
          />
          <YAxis 
            yAxisId="right" 
            orientation="right" 
            stroke="#10b981"
            style={{ fontSize: '12px' }}
            tick={{ fill: '#10b981' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area 
            yAxisId="left" 
            type="monotone" 
            dataKey="revenue" 
            stroke="#3b82f6" 
            strokeWidth={3}
            fill="url(#colorRevenue)" 
            name="Doanh thu"
            animationDuration={1000}
          />
          <Area 
            yAxisId="right" 
            type="monotone" 
            dataKey="bookings" 
            stroke="#10b981" 
            strokeWidth={2}
            fill="url(#colorBookings)" 
            name="Số booking"
            animationDuration={1000}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export const RevenueByFieldChart = ({ data }) => {
  const { t } = useI18n();
  const chartData = data.map((item, index) => ({
    name: item.FieldName,
    revenue: item.Revenue || 0,
    bookings: item.TotalBookings || 0,
    facility: item.FacilityName,
    color: COLORS[index % COLORS.length]
  })).slice(0, 8); // Top 8 fields

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-800 mb-1">{payload[0].payload.name}</p>
          <p className="text-xs text-gray-500 mb-2">{payload[0].payload.facility}</p>
          <p className="text-sm text-blue-600">
            💰 {t('owner.charts.monthlyRevenue.revenue')}: <span className="font-bold">{new Intl.NumberFormat('vi-VN').format(payload[0].value)} {t('common.currency')}</span>
          </p>
          <p className="text-sm text-green-600">
            📋 {t('owner.charts.monthlyRevenue.bookings')}: <span className="font-bold">{payload[0].payload.bookings}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-white p-6 rounded-xl shadow-md border border-indigo-100 hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <span className="text-2xl">🏆</span>
          {t('owner.charts.revenueByField.title')}
        </h3>
        <span className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full font-medium">
          {t('owner.charts.revenueByField.topFields')}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={380}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <defs>
            {chartData.map((entry, index) => (
              <linearGradient key={`gradient-${index}`} id={`barGradient${index}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="5%" stopColor={entry.color} stopOpacity={0.8}/>
                <stop offset="95%" stopColor={entry.color} stopOpacity={0.4}/>
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={true} vertical={false} />
          <XAxis 
            type="number" 
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
            tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
          />
          <YAxis 
            dataKey="name" 
            type="category" 
            width={140} 
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
            tick={{ fill: '#374151' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar 
            dataKey="revenue" 
            name="Doanh thu"
            radius={[0, 8, 8, 0]}
            animationDuration={1000}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={`url(#barGradient${index})`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-3 flex flex-wrap gap-2 justify-center">
        {chartData.slice(0, 4).map((item, index) => (
          <div key={index} className="flex items-center gap-1 text-xs">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: item.color }}></div>
            <span className="text-gray-600">{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const BookingTrendsChart = ({ data }) => {
  const { t } = useI18n();
  const dayNames = [
    t('owner.charts.days.sunday'),
    t('owner.charts.days.monday'),
    t('owner.charts.days.tuesday'),
    t('owner.charts.days.wednesday'),
    t('owner.charts.days.thursday'),
    t('owner.charts.days.friday'),
    t('owner.charts.days.saturday')
  ];
  const chartData = data.map(item => ({
    day: dayNames[item.DayOfWeek - 1] || item.DayName,
    bookings: item.TotalBookings || 0,
    revenue: item.Revenue || 0
  }));

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border">
      <h3 className="text-lg font-semibold mb-4">{t('owner.charts.bookingTrends.title')}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="day" />
          <YAxis yAxisId="left" />
          <YAxis yAxisId="right" orientation="right" />
          <Tooltip 
            formatter={(value, name) => {
              if (name === 'revenue') return [new Intl.NumberFormat('vi-VN').format(value) + ' ' + t('common.currency'), t('owner.charts.monthlyRevenue.revenue')];
              return [value, t('owner.charts.monthlyRevenue.numBookings')];
            }}
          />
          <Legend />
          <Line yAxisId="left" type="monotone" dataKey="bookings" stroke="#3b82f6" strokeWidth={2} name={t('owner.charts.monthlyRevenue.numBookings')} />
          <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} name={t('owner.charts.monthlyRevenue.revenue')} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export const PeakHoursChart = ({ data }) => {
  const { t } = useI18n();
  const chartData = data.map(item => ({
    hour: `${item.Hour}:00`,
    bookings: item.TotalBookings || 0,
    revenue: item.Revenue || 0
  }));

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border">
      <h3 className="text-lg font-semibold mb-4">{t('owner.charts.peakHours.title')}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="hour" />
          <YAxis />
          <Tooltip 
            formatter={(value, name) => {
              if (name === 'bookings') return [value, t('owner.charts.monthlyRevenue.numBookings')];
              return [new Intl.NumberFormat('vi-VN').format(value) + ' ' + t('common.currency'), t('owner.charts.monthlyRevenue.revenue')];
            }}
          />
          <Legend />
          <Bar dataKey="bookings" fill="#3b82f6" name={t('owner.charts.monthlyRevenue.numBookings')} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const FieldUtilizationChart = ({ data }) => {
  const { t } = useI18n();
  const chartData = data.map(item => {
    const rate = parseFloat(item.UtilizationRate) || 0;
    return {
      name: item.FieldName,
      rate: rate,
      facility: item.FacilityName,
      color: rate >= 80 ? '#10b981' : rate >= 50 ? '#f59e0b' : '#ef4444'
    };
  }).slice(0, 10);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const rate = payload[0].value;
      const status = rate >= 80 ? t('owner.charts.fieldUtilization.good') : rate >= 50 ? t('owner.charts.fieldUtilization.average') : t('owner.charts.fieldUtilization.needsImprovement');
      const statusColor = rate >= 80 ? 'text-green-600' : rate >= 50 ? 'text-yellow-600' : 'text-red-600';
      
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-800 mb-1">{payload[0].payload.name}</p>
          <p className="text-xs text-gray-500 mb-2">{payload[0].payload.facility}</p>
          <div className="flex items-center gap-2">
            <p className="text-lg font-bold text-blue-600">{rate.toFixed(1)}%</p>
            <span className={`text-xs font-medium ${statusColor}`}>{status}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-gradient-to-br from-green-50 to-white p-6 rounded-xl shadow-md border border-green-100 hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <span className="text-2xl">⚡</span>
          {t('owner.charts.fieldUtilization.title')}
        </h3>
        <div className="flex gap-2 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-gray-600">≥80%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span className="text-gray-600">50-80%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-gray-600">&lt;50%</span>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
          <defs>
            <linearGradient id="gradientGreen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.9}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.4}/>
            </linearGradient>
            <linearGradient id="gradientYellow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.9}/>
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.4}/>
            </linearGradient>
            <linearGradient id="gradientRed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.9}/>
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0.4}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="name" 
            stroke="#6b7280"
            angle={-45}
            textAnchor="end"
            height={80}
            interval={0}
            style={{ fontSize: '11px' }}
            tick={{ fill: '#374151' }}
          />
          <YAxis 
            domain={[0, 100]} 
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
            tick={{ fill: '#6b7280' }}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar 
            dataKey="rate" 
            name={t('owner.charts.fieldUtilization.utilizationRate')}
            radius={[8, 8, 0, 0]}
            animationDuration={1000}
          >
            {chartData.map((entry, index) => {
              const gradientId = entry.rate >= 80 ? 'gradientGreen' : entry.rate >= 50 ? 'gradientYellow' : 'gradientRed';
              return <Cell key={`cell-${index}`} fill={`url(#${gradientId})`} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const BookingStatusChart = ({ data }) => {
  const { t } = useI18n();
  const chartData = data.map((item, index) => ({
    name: item.Status === 'Confirmed' ? t('owner.charts.topCustomers.confirmed') : 
          item.Status === 'Pending' ? t('owner.charts.topCustomers.pending') : 
          item.Status === 'Cancelled' ? t('owner.charts.topCustomers.cancelled') : item.Status,
    value: item.Count || 0,
    color: COLORS[index % COLORS.length]
  }));

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border">
      <h3 className="text-lg font-semibold mb-4">{t('owner.charts.bookingStatus.title')}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export const TopCustomersTable = ({ data }) => {
  const { t } = useI18n();
  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border">
      <h3 className="text-lg font-semibold mb-4">👥 {t('owner.charts.topCustomers.title')}</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('owner.charts.topCustomers.customer')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('owner.charts.topCustomers.totalBookings')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('owner.charts.topCustomers.details')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('owner.charts.topCustomers.totalRevenue')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('owner.charts.topCustomers.lastBooking')}</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((customer, index) => (
              <tr key={customer.AccountID} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{customer.FullName || customer.Username}</div>
                  <div className="text-sm text-gray-500">{customer.PhoneNumber || 'N/A'}</div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="text-sm font-bold text-gray-900">{customer.TotalBookings}</div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="text-xs space-y-1">
                    <div className="flex items-center gap-1">
                      <span className="inline-block w-2 h-2 bg-blue-500 rounded-full"></span>
                      <span className="text-blue-700">{t('owner.charts.topCustomers.confirmed')}: {customer.ConfirmedBookings || 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full"></span>
                      <span className="text-yellow-700">{t('owner.charts.topCustomers.pending')}: {customer.PendingBookings || 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="inline-block w-2 h-2 bg-red-500 rounded-full"></span>
                      <span className="text-red-700">{t('owner.charts.topCustomers.cancelled')}: {customer.CancelledBookings || 0}</span>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-green-600">
                  {new Intl.NumberFormat('vi-VN').format(customer.TotalRevenue || 0)} {t('common.currency')}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  {customer.LastBookingDate ? new Date(customer.LastBookingDate).toLocaleDateString('vi-VN') : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const SummaryCards = ({ summary }) => {
  const { t } = useI18n();
  const currentMonthRevenue = summary?.CurrentMonthRevenue || 0;
  const lastMonthRevenue = summary?.LastMonthRevenue || 0;
  const revenueChange = lastMonthRevenue > 0 
    ? ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue * 100).toFixed(1)
    : 0;

  const currentMonthBookings = summary?.CurrentMonthBookings || 0;
  const lastMonthBookings = summary?.LastMonthBookings || 0;
  const bookingChange = lastMonthBookings > 0 
    ? ((currentMonthBookings - lastMonthBookings) / lastMonthBookings * 100).toFixed(1)
    : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">{t('owner.charts.summary.revenueThisMonth')}</p>
            <p className="text-2xl font-bold text-gray-900">
              {new Intl.NumberFormat('vi-VN').format(currentMonthRevenue)} {t('common.currency')}
            </p>
            <p className={`text-xs mt-1 ${revenueChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {revenueChange >= 0 ? '↑' : '↓'} {Math.abs(revenueChange)}% {t('owner.charts.summary.vsLastMonth')}
            </p>
          </div>
          <div className="text-blue-500 text-3xl">💰</div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">{t('owner.charts.summary.bookingsThisMonth')}</p>
            <p className="text-2xl font-bold text-gray-900">{currentMonthBookings}</p>
            <p className={`text-xs mt-1 ${bookingChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {bookingChange >= 0 ? '↑' : '↓'} {Math.abs(bookingChange)}% {t('owner.charts.summary.vsLastMonth')}
            </p>
          </div>
          <div className="text-green-500 text-3xl">📅</div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">{t('owner.charts.summary.pendingBookings')}</p>
            <p className="text-2xl font-bold text-yellow-600">{summary?.PendingBookings || 0}</p>
            <p className="text-xs text-gray-500 mt-1">{t('owner.charts.summary.needsProcessing')}</p>
          </div>
          <div className="text-yellow-500 text-3xl">⏳</div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">{t('owner.charts.summary.totalFields')}</p>
            <p className="text-2xl font-bold text-gray-900">{summary?.TotalFields || 0}</p>
            <p className="text-xs text-gray-500 mt-1">{t('owner.charts.summary.atFacilities', { count: summary?.TotalFacilities || 0 }).replace('{{count}}', summary?.TotalFacilities || 0)}</p>
          </div>
          <div className="text-purple-500 text-3xl">🏟️</div>
        </div>
      </div>
    </div>
  );
};
