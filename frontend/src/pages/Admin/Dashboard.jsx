import React, { useState, useEffect } from 'react';
import { 
  Users, Building2, Calendar, DollarSign, 
  TrendingUp, Activity, UserCheck, Flag,
  MessageSquare, Heart, RefreshCw, BarChart3,
  ArrowUpRight, ArrowDownRight, Clock, CheckCircle
} from 'lucide-react';
import { API_BASE_URL } from '../../config/apiConfig';
import { useI18n } from '../../i18n/hooks';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [revenueByMonth, setRevenueByMonth] = useState([]);
  const [sportTrends, setSportTrends] = useState([]);
  const [userGrowth, setUserGrowth] = useState({ newUsers: [], totalUsers: [] });
  const [activityTrends, setActivityTrends] = useState({ posts: [], comments: [] });
  const [courtsAreMock, setCourtsAreMock] = useState(false);
  // Remove unused occupancyData

  useEffect(() => {
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      // Fetch stats and analytics data
      const [statsRes, monthlyRes, sportRes, userGrowthRes, activityTrendsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/dashboard/stats`, { headers }).then(r => r.json()),
        fetch(`${API_BASE_URL}/admin/dashboard/revenue-by-month`, { headers }).then(r => r.json()),
        fetch(`${API_BASE_URL}/admin/dashboard/sport-trends`, { headers }).then(r => r.json()),
        fetch(`${API_BASE_URL}/admin/dashboard/user-growth`, { headers }).then(r => r.json()),
        fetch(`${API_BASE_URL}/admin/dashboard/activity-trends`, { headers }).then(r => r.json())
      ]);

      if (statsRes.success) {
        let statsData = statsRes.data || {};
        let usedMock = false;
        if (!statsData.courts || !Array.isArray(statsData.courts)) {
          statsData.courts = [
            { name: 'Sunrise Badminton Court', bookings: 145, rating: 4.8 },
            { name: 'Elite Football Arena', bookings: 132, rating: 4.9 },
            { name: 'Downtown Tennis Center', bookings: 128, rating: 4.6 },
            { name: 'Royal Tennis Academy', bookings: 115, rating: 4.9 },
            { name: 'Victory Badminton Hall', bookings: 98, rating: 4.4 }
          ];
          usedMock = true;
        }
        setStats(statsData);
        setCourtsAreMock(usedMock);
      } else {
        setCourtsAreMock(false);
      }
      if (monthlyRes.success) setRevenueByMonth(monthlyRes.data || []);
      if (sportRes.success) setSportTrends(sportRes.data || []);
      if (userGrowthRes.success) setUserGrowth(userGrowthRes.data || { newUsers: [], totalUsers: [] });
      if (activityTrendsRes.success) setActivityTrends(activityTrendsRes.data || { posts: [], comments: [] });
    } catch (error) {
      console.error('Dashboard fetch error:', error);
      toast.error(t('common.error') || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };
  // User Growth Area/Line Chart
  const UserGrowthChart = ({ newUsers, totalUsers }) => {
  if (!newUsers.length && !totalUsers.length) return null;
  // Merge months for X-axis
  const months = Array.from(new Set([...newUsers, ...totalUsers].map(d => `${d.Year}-${d.Month}`)));
  // Map data for chart
  const newUsersMap = Object.fromEntries(newUsers.map(d => [`${d.Year}-${d.Month}`, d.NewUsers]));
  const totalUsersMap = Object.fromEntries(totalUsers.map(d => [`${d.Year}-${d.Month}`, d.TotalUsers]));
  const maxTotal = Math.max(1, ...Object.values(totalUsersMap));
    return (
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 mb-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-1">{t('admin.users.growthTitle','User growth')}</h2>
          <p className="text-sm text-gray-500">{t('admin.users.growthHelp','New users & total users per month')}</p>
        </div>
        <div className="relative h-80">
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-12 flex flex-col justify-between text-xs font-semibold text-gray-600">
            <span>{maxTotal}</span>
            <span>{Math.round(maxTotal * 0.75)}</span>
            <span>{Math.round(maxTotal * 0.5)}</span>
            <span>{Math.round(maxTotal * 0.25)}</span>
            <span>0</span>
          </div>
          <svg className="w-full h-full ml-8" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <linearGradient id="userArea" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polyline
              fill="url(#userArea)"
              stroke="none"
              points={(() => {
                const pts = months.map((m, i) => {
                  const x = (i / (months.length - 1)) * 100;
                  const y = 100 - ((totalUsersMap[m] || 0) / maxTotal) * 100;
                  return `${x},${y}`;
                });
              <UserGrowthChart newUsers={userGrowth.newUsers} totalUsers={userGrowth.totalUsers} />

              {/* Activity Trends Chart (moved to bottom) */}
              <ActivityTrendsChart posts={activityTrends.posts} comments={activityTrends.comments} />
                return ['0,100', ...pts, '100,100'].join(' ');
              })()}
            />
            <polyline
              fill="none"
              stroke="#6366f1"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={months.map((m, i) => {
                const x = (i / (months.length - 1)) * 100;
                const y = 100 - ((totalUsersMap[m] || 0) / maxTotal) * 100;
                return `${x},${y}`;
              }).join(' ')}
            />
            <polyline
              fill="none"
              stroke="#22c55e"
              strokeWidth="1.6"
              strokeDasharray="2 2"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={months.map((m, i) => {
                const x = (i / (months.length - 1)) * 100;
                const y = 100 - ((newUsersMap[m] || 0) / maxTotal) * 100;
                return `${x},${y}`;
              }).join(' ')}
            />
            {months.map((m, i) => {
              const x = (i / (months.length - 1)) * 100;
              const yTotal = 100 - ((totalUsersMap[m] || 0) / maxTotal) * 100;
              const yNew = 100 - ((newUsersMap[m] || 0) / maxTotal) * 100;
              return (
                <g key={m}>
                  <circle cx={x} cy={yTotal} r="1.6" fill="#6366f1" stroke="#fff" strokeWidth="0.4" />
                  <circle cx={x} cy={yNew} r="1.6" fill="#22c55e" stroke="#fff" strokeWidth="0.4" />
                  <text x={x} y={yTotal - 3} textAnchor="middle" fontSize="2.5" fontWeight="600" fill="#6366f1">
                    {totalUsersMap[m] || 0}
                  </text>
                  <text x={x} y={yNew - 3} textAnchor="middle" fontSize="2.5" fontWeight="600" fill="#22c55e">
                    {newUsersMap[m] || 0}
                  </text>
                </g>
              );
            })}
            {[0, 25, 50, 75, 100].map((pct) => (
              <line key={pct} x1="0" x2="100" y1={`${100 - pct}`} y2={`${100 - pct}`} stroke="#e5e7eb" strokeWidth="0.4" strokeDasharray="2 2" />
            ))}
          </svg>
          <div className="flex justify-between mt-4 ml-8">
            {months.map((m) => (
              <span key={m} className="text-xs font-medium text-gray-600">{(() => {
                const [year, month] = m.split('-');
                return `T${month}/${year.slice(-2)}`;
              })()}</span>
            ))}
          </div>
        </div>
        <div className="flex justify-center gap-6 text-sm mt-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded-full shadow" />
            <span className="text-gray-600 font-medium">{t('admin.users.newUsersLabel','New users')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-indigo-500 rounded-full shadow" />
            <span className="text-gray-600 font-medium">{t('admin.users.totalUsersLabel','Total users')}</span>
          </div>
        </div>
      </div>
    );
  };
  const ActivityTrendsChart = ({ posts, comments }) => {
  if (!posts.length && !comments.length) return null;
  const days = Array.from(new Set([...posts, ...comments].map(d => d.Date)));
  const postsMap = Object.fromEntries(posts.map(d => [d.Date, d.Posts]));
  const commentsMap = Object.fromEntries(comments.map(d => [d.Date, d.Comments]));
  const maxVal = Math.max(1, ...days.map(d => Math.max(postsMap[d] || 0, commentsMap[d] || 0)));
    return (
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 mb-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-1">{t('admin.activity.title','Community activity')}</h2>
          <p className="text-sm text-gray-500">{t('admin.activity.help','New posts & comments per day')}</p>
        </div>
        <div className="relative h-80">
          <div className="absolute left-0 top-0 bottom-12 flex flex-col justify-between text-xs font-semibold text-gray-600">
            <span>{maxVal}</span>
            <span>{Math.round(maxVal * 0.75)}</span>
            <span>{Math.round(maxVal * 0.5)}</span>
            <span>{Math.round(maxVal * 0.25)}</span>
            <span>0</span>
          </div>
          <svg className="w-full h-full ml-8" viewBox="0 0 100 100" preserveAspectRatio="none">
            <polyline
              fill="none"
              stroke="#2563eb"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={days.map((d, i) => {
                const x = (i / (days.length - 1)) * 100;
                const y = 100 - ((postsMap[d] || 0) / maxVal) * 100;
                return `${x},${y}`;
              }).join(' ')}
            />
            <polyline
              fill="none"
              stroke="#ef4444"
              strokeWidth="1.6"
              strokeDasharray="2 2"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={days.map((d, i) => {
                const x = (i / (days.length - 1)) * 100;
                const y = 100 - ((commentsMap[d] || 0) / maxVal) * 100;
                return `${x},${y}`;
              }).join(' ')}
            />
            {days.map((d, i) => {
              const x = (i / (days.length - 1)) * 100;
              const yPost = 100 - ((postsMap[d] || 0) / maxVal) * 100;
              const yComment = 100 - ((commentsMap[d] || 0) / maxVal) * 100;
              return (
                <g key={d}>
                  <circle cx={x} cy={yPost} r="1.6" fill="#2563eb" stroke="#fff" strokeWidth="0.4" />
                  <circle cx={x} cy={yComment} r="1.6" fill="#ef4444" stroke="#fff" strokeWidth="0.4" />
                  <text x={x} y={yPost - 3} textAnchor="middle" fontSize="2.5" fontWeight="600" fill="#2563eb">
                    {postsMap[d] || 0}
                  </text>
                  <text x={x} y={yComment - 3} textAnchor="middle" fontSize="2.5" fontWeight="600" fill="#ef4444">
                    {commentsMap[d] || 0}
                  </text>
                </g>
              );
            })}
            {[0, 25, 50, 75, 100].map((pct) => (
              <line key={pct} x1="0" x2="100" y1={`${100 - pct}`} y2={`${100 - pct}`} stroke="#e5e7eb" strokeWidth="0.4" strokeDasharray="2 2" />
            ))}
          </svg>
          <div className="flex justify-between mt-4 ml-8">
            {days.map((d) => (
              <span key={d} className="text-xs font-medium text-gray-600">{(() => {
                const date = new Date(d);
                return `${date.getDate()}/${date.getMonth() + 1}`;
              })()}</span>
            ))}
          </div>
        </div>
        <div className="flex justify-center gap-6 text-sm mt-8">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-600 rounded-full shadow" />
            <span className="text-gray-600 font-medium">{t('admin.charts.newPosts', 'New posts')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded-full shadow" />
            <span className="text-gray-600 font-medium">{t('admin.charts.newComments', 'New comments')}</span>
          </div>
        </div>
      </div>
    );
  };

  // eslint-disable-next-line no-unused-vars
  const StatCard = ({ icon: Icon, title, value, subtitle, color = 'blue', trend }) => {
    const colorClasses = {
      blue: {
        bg: 'bg-gradient-to-br from-blue-500 to-blue-600',
        icon: 'bg-blue-100 text-blue-600',
        accent: 'bg-blue-50'
      },
      green: {
        bg: 'bg-gradient-to-br from-green-500 to-green-600',
        icon: 'bg-green-100 text-green-600',
        accent: 'bg-green-50'
      },
      purple: {
        bg: 'bg-gradient-to-br from-purple-500 to-purple-600',
        icon: 'bg-purple-100 text-purple-600',
        accent: 'bg-purple-50'
      },
      orange: {
        bg: 'bg-gradient-to-br from-orange-500 to-orange-600',
        icon: 'bg-orange-100 text-orange-600',
        accent: 'bg-orange-50'
      },
      red: {
        bg: 'bg-gradient-to-br from-red-500 to-red-600',
        icon: 'bg-red-100 text-red-600',
        accent: 'bg-red-50'
      },
      indigo: {
        bg: 'bg-gradient-to-br from-indigo-500 to-indigo-600',
        icon: 'bg-indigo-100 text-indigo-600',
        accent: 'bg-indigo-50'
      },
      yellow: {
        bg: 'bg-gradient-to-br from-yellow-500 to-yellow-600',
        icon: 'bg-yellow-100 text-yellow-600',
        accent: 'bg-yellow-50'
      }
    };

    return (
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 transition-shadow hover:shadow-lg">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-3 rounded-xl ${colorClasses[color].icon}`}>
            <Icon className="w-6 h-6" />
          </div>
          {trend && (
            <div className={`flex items-center gap-1 text-sm font-semibold ${trend.direction === 'up' ? 'text-green-600' : 'text-red-600'}`}>
              {trend.direction === 'up' ? (
                <ArrowUpRight className="w-4 h-4" />
              ) : (
                <ArrowDownRight className="w-4 h-4" />
              )}
              <span>{trend.value}%</span>
            </div>
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-600 mb-2">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mb-1">{value}</p>
          {subtitle && (
            <p className="text-sm text-gray-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {subtitle}
            </p>
          )}
        </div>
      </div>
    );
  };

  // Bookings status chart -> Donut chart styled like image 1
  const BookingsStatusChart = ({ bookings }) => {
    if (!bookings) return null;

    const total = bookings.total || 0;
    const segments = [
      { label: t('admin.bookings.pending','Pending'), value: bookings.pending || 0, color: '#fbbf24' }, // yellow-400
      { label: t('admin.bookings.confirmed','Confirmed'), value: bookings.confirmed || 0, color: '#2563eb' }, // blue-600
      { label: t('admin.bookings.completed','Completed'), value: bookings.completed || 0, color: '#22c55e' }, // green-500
      { label: t('admin.bookings.cancelled','Cancelled'), value: bookings.cancelled || 0, color: '#ef4444' } // red-500
    ];

    const radius = 60;
    const stroke = 28;
    const circumference = 2 * Math.PI * radius;

    let offsetAcc = 0;
    const segs = segments.map((s) => {
      const portion = total > 0 ? s.value / total : 0;
      const dash = portion * circumference;
      const seg = { ...s, dash, offset: offsetAcc };
      offsetAcc += dash;
      return seg;
    });

    return (
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="relative w-56 h-56 flex items-center justify-center">
          <svg width="200" height="200" viewBox="0 0 200 200">
            <g transform="translate(100,100) rotate(-90)">
              {segs.map((s, i) => (
                <circle
                  key={i}
                  r={radius}
                  cx={0}
                  cy={0}
                  fill="transparent"
                  stroke={s.color}
                  strokeWidth={stroke}
                  strokeDasharray={`${s.dash} ${circumference}`}
                  strokeDashoffset={-s.offset}
                  strokeLinecap="butt"
                />
              ))}
            </g>
            {/* center hole */}
            <circle cx="100" cy="100" r="46" fill="#fff" />
            <text x="100" y="98" textAnchor="middle" fontSize="2rem" fontWeight="bold" fill="#ef4444">{total}</text>
            <text x="100" y="120" textAnchor="middle" fontSize="1rem" fill="#6b7280">{t('admin.bookings.totalLabel','Total orders')}</text>
          </svg>
        </div>
        <div className="flex flex-col gap-2 mt-4 w-full max-w-xs">
          {segments.map((s, i) => {
            const percent = total > 0 ? ((s.value / total) * 100).toFixed(1) : '0.0';
            return (
              <div key={i} className="flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <div style={{ width: 14, height: 14, background: s.color, borderRadius: 7 }} />
                  <span className="text-sm font-medium text-gray-700" style={{ minWidth: 90 }}>{s.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">{s.value}</span>
                  <span className="text-xs text-gray-500">({percent}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Revenue by Month - Line Chart (12 months)
  const RevenueByMonthChart = ({ data }) => {
    if (!data || data.length === 0) {
      return (
        <div className="h-64 flex items-center justify-center">
          <div className="text-center">
            <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">{t('admin.revenue.noData','No data')}</p>
          </div>
        </div>
      );
    }

  const maxRevenue = Math.max(1, ...data.map(item => item.Revenue || 0));
  const avgRevenue = data.length > 0 ? data.reduce((sum, item) => sum + (item.Revenue || 0), 0) / data.length : 0;

    return (
      <div className="space-y-6">
        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
            <p className="text-xs font-medium text-blue-600 mb-1">{t('admin.revenue.max','Highest')}</p>
            <p className="text-2xl font-bold text-blue-700">{maxRevenue.toLocaleString()} đ</p>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
            <p className="text-xs font-medium text-purple-600 mb-1">{t('admin.revenue.avg','Average')}</p>
            <p className="text-2xl font-bold text-purple-700">{Math.round(avgRevenue).toLocaleString()} đ</p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
            <p className="text-xs font-medium text-green-600 mb-1">{t('admin.revenue.total12','Total 12 months')}</p>
            <p className="text-2xl font-bold text-green-700">{data.reduce((sum, item) => sum + (item.Revenue || 0), 0).toLocaleString()} đ</p>
          </div>
        </div>

        {/* Revenue Column Chart */}
        <div className="relative h-80 rounded-xl p-6 bg-white">
          {/* Left Y-axis labels */}
          <div className="absolute left-0 top-6 bottom-16 flex flex-col justify-between text-xs font-semibold text-gray-600">
            <span>{maxRevenue.toLocaleString()}</span>
            <span>{Math.round(maxRevenue * 0.75).toLocaleString()}</span>
            <span>{Math.round(maxRevenue * 0.5).toLocaleString()}</span>
            <span>{Math.round(maxRevenue * 0.25).toLocaleString()}</span>
            <span>0</span>
          </div>

          <svg className="w-full h-full ml-12" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Horizontal grid lines */}
            {[0, 25, 50, 75, 100].map((pct) => (
              <line key={pct} x1="0" x2="100" y1={`${100 - pct}`} y2={`${100 - pct}`} stroke="#e5e7eb" strokeWidth="0.4" strokeDasharray="2 2" />
            ))}

            {/* Bars */}
            {(() => {
              const n = data.length;
              const step = 100 / n;
              const barWidth = Math.max(2, step * 0.6);
              return data.map((item, i) => {
                const x = i * step + (step - barWidth) / 2;
                const heightPct = ((item.Revenue || 0) / maxRevenue) * 100;
                const y = 100 - heightPct;
                return (
                  <g key={i}>
                    <rect
                      x={`${x}%`}
                      y={`${y}%`}
                      width={`${barWidth}%`}
                      height={`${heightPct}%`}
                      rx="1"
                      fill="url(#revGrad)"
                      stroke="#1e3a8a"
                      strokeWidth="0.2"
                    />
                    {/* value label */}
                    <text x={`${x + barWidth / 2}%`} y={`${y - 2}%`} textAnchor="middle" fontSize="2.8" fontWeight="700" fill="#0f172a">
                      {Number(item.Revenue || 0).toLocaleString()}
                    </text>
                    {/* month label (below) */}
                    <text x={`${x + barWidth / 2}%`} y={`98%`} textAnchor="middle" fontSize="2.8" fontWeight="600" fill="#4b5563">
                      {`T${item.Month}`}
                    </text>
                  </g>
                );
              });
            })()}

            <defs>
              <linearGradient id="revGrad" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.9" />
              </linearGradient>
            </defs>
          </svg>

          {/* small X-axis spacing handled inside SVG - keep extra bottom margin */}
        </div>

        {/* Legend */}
        <div className="flex justify-center gap-6 text-sm mt-3">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gradient-to-t from-blue-600 to-blue-400 rounded shadow" />
            <span className="text-gray-600 font-medium">{t('admin.charts.revenue', 'Revenue (VND)')}</span>
          </div>
        </div>
      </div>
    );
  };

  // SportTrendsChart - horizontal bar chart
  const SportTrendsChart = ({ data }) => {
    if (!data || data.length === 0) {
      return (
        <div className="h-80 flex items-center justify-center">
          <div className="text-center">
            <Activity className="w-16 h-16 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">No data</p>
          </div>
        </div>
      );
    }
    // Group by SportType (assume SportTypeID exists, fallback to SportName)
    const grouped = {};
    data.forEach(item => {
      const key = item.SportTypeID || item.SportName;
      if (!grouped[key]) {
        grouped[key] = {
          SportTypeID: item.SportTypeID,
          SportName: item.SportName,
          BookingsCount: 0
        };
      }
      grouped[key].BookingsCount += item.BookingsCount || 0;
    });
    const sports = Object.values(grouped);
    // Sort by BookingsCount desc
    const sorted = sports.sort((a, b) => (b.BookingsCount || 0) - (a.BookingsCount || 0));
    const maxCount = Math.max(...sorted.map(s => s.BookingsCount || 0));
    return (
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-1">{t('admin.trends.sportsTitle','Trending Sports')}</h2>
        </div>
        <div className="relative">
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between h-full py-2">
            {sorted.map((sport) => (
              <span key={sport.SportTypeID || sport.SportName} className="text-gray-600 text-base font-medium" style={{ height: '48px', display: 'flex', alignItems: 'center' }}>{sport.SportName}</span>
            ))}
          </div>
          {/* Chart bars */}
          <div className="ml-32">
            {sorted.map((sport) => (
              <div key={sport.SportTypeID || sport.SportName} className="flex items-center h-12 mb-4">
                <div
                  className="rounded-lg bg-blue-500 transition-all duration-300"
                  style={{ width: `${(sport.BookingsCount / maxCount) * 90}%`, height: '32px' }}
                ></div>
                <span className="ml-4 text-gray-700 font-semibold text-base">{sport.BookingsCount}</span>
              </div>
            ))}
          </div>
          <svg className="absolute left-32 top-0 h-full w-full pointer-events-none" style={{ zIndex: 0 }}>
            {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
              <line
                key={i}
                x1={`${pct * 90}%`} x2={`${pct * 90}%`} y1="0" y2="100%"
                stroke="#d1d5db" strokeDasharray="4 2" strokeWidth="2"
              />
              ))}
          </svg>
        </div>
      </div>
    );
  };

  // TrendingCourts - list
  const TrendingCourts = ({ courts, isMock = false }) => {
    if (!courts || courts.length === 0) return null;
    return (
      <div className="p-6">
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-gray-900 mb-1">{t('admin.trends.courtsTitle','Trending Courts')}</h2>
            {isMock && (
              <span className="inline-block text-xs bg-yellow-50 text-yellow-800 px-2 py-0.5 rounded-full border border-yellow-100">{t('admin.trends.mockLabel','Mock')}</span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-4">
          {courts.map((court, i) => (
            <div key={i} className="flex items-center justify-between bg-gray-50 rounded-xl px-5 py-3 shadow-sm">
              <div>
                <div className="font-semibold text-gray-800 text-base">{court.name}</div>
                <div className="text-sm text-gray-500">{court.bookings} {t('admin.trends.bookingsThisMonth','bookings this month')}</div>
              </div>
              <div className="flex items-center gap-2 bg-yellow-100 px-3 py-1 rounded-lg">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 2l2.39 6.94H19l-5.2 3.78L15.59 18 10 13.97 4.41 18l1.79-5.28L1 8.94h6.61L10 2z" fill="#facc15"/></svg>
                <span className="font-bold text-yellow-700">{court.rating}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Occupancy Rate - Combo Chart (by time slot)
  const OccupancyChart = ({ data }) => {
    if (!data || data.length === 0) {
      return (
        <div className="h-80 flex items-center justify-center">
          <div className="text-center">
            <Clock className="w-16 h-16 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">{t('admin.charts.noData', 'No data available')}</p>
          </div>
        </div>
      );
    }

    const maxBookings = Math.max(...data.map(item => item.TotalBookings || 0));

    return (
      <div className="space-y-6">
        <div className="relative h-96 rounded-xl p-6">
          {/* Y-axis labels - Left (Bookings) */}
          <div className="absolute left-0 top-6 bottom-16 flex flex-col justify-between text-xs font-medium text-indigo-600">
            {[maxBookings, Math.round(maxBookings * 0.75), Math.round(maxBookings * 0.5), Math.round(maxBookings * 0.25), 0].map((val, i) => (
              <span key={i}>{val}</span>
            ))}
          </div>

          {/* Y-axis labels - Right (Percentage) */}
          <div className="absolute right-0 top-6 bottom-16 flex flex-col justify-between text-xs font-medium text-green-600">
            <span>100%</span>
            <span>75%</span>
            <span>50%</span>
            <span>25%</span>
            <span>0%</span>
          </div>

          {/* Grid lines */}
          <div className="absolute left-12 right-12 top-6 bottom-16">
            {[0, 25, 50, 75, 100].map((percent) => (
              <div 
                key={percent}
                className="absolute w-full border-t border-gray-200"
                style={{ bottom: `${percent}%` }}
              />
            ))}
          </div>

          {/* Chart area */}
          <div className="ml-12 mr-12 h-full flex items-end justify-between gap-2 relative z-10 pb-16">
            {data.map((item, index) => {
              const barHeight = maxBookings > 0 ? (item.TotalBookings / maxBookings) * 100 : 0;
              const occupancyRate = item.OccupancyRate || 0;
              
              return (
                <div key={index} className="flex-1 flex flex-col items-center gap-2 group relative">
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-all bg-gray-900 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap z-20 shadow-xl">
                    <div className="font-bold text-center mb-1">{item.Hour}:00 - {item.Hour + 1}:00</div>
                    <div className="flex items-center gap-2 text-indigo-300">
                      <div className="w-2 h-2 bg-indigo-400 rounded"></div>
                      <span>{t('admin.occupancy.total','Total')}: {item.TotalBookings} {t('admin.occupancy.orders','orders')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-green-300">
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                      <span>{t('admin.occupancy.confirmed','Confirmed')}: {item.ConfirmedBookings}</span>
                    </div>
                    <div className="flex items-center gap-2 text-yellow-300 font-semibold">
                      <TrendingUp className="w-3 h-3" />
                      <span>{t('admin.occupancy.rate','Rate')}: {occupancyRate.toFixed(1)}%</span>
                    </div>
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                  </div>

                  {/* Bar for bookings */}
                  <div className="w-full flex-1 flex items-end justify-center">
                    <div 
                      className="w-full rounded-t-lg transition-all duration-500 hover:opacity-80 relative shadow-lg"
                      style={{ 
                        height: `${barHeight}%`, 
                        minHeight: item.TotalBookings > 0 ? '8px' : '0',
                        background: 'linear-gradient(to top, #4f46e5, #6366f1, #818cf8)'
                      }}
                    >
                      {/* Value label on top of bar */}
                      {barHeight > 15 && (
                        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 text-white text-xs font-bold drop-shadow-md">
                          {item.TotalBookings}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Hour label */}
                  <span className="text-xs font-semibold text-gray-700 mt-2">{item.Hour}h</span>
                </div>
              );
            })}
          </div>

          {/* Occupancy line overlay */}
          <svg className="absolute left-12 right-12 top-6 bottom-16 pointer-events-none">
            <defs>
              <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="50%" stopColor="#059669" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
            </defs>
            
            <polyline
              fill="none"
              stroke="url(#lineGradient)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={data.map((item, index) => {
                const x = (index / (data.length - 1)) * 100;
                const y = 100 - (item.OccupancyRate || 0);
                return `${x}%,${y}%`;
              }).join(' ')}
            />
            
            {data.map((item, index) => {
              const x = (index / (data.length - 1)) * 100;
              const y = 100 - (item.OccupancyRate || 0);
              return (
                <circle
                  key={index}
                  cx={`${x}%`}
                  cy={`${y}%`}
                  r="4"
                  fill="#10b981"
                  stroke="white"
                  strokeWidth="2"
                  className="transition-all"
                />
              );
            })}
          </svg>
        </div>

        {/* Legend */}
        <div className="flex justify-center gap-6">
          <div className="flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-200">
            <div className="w-4 h-4 bg-gradient-to-t from-indigo-600 to-indigo-400 rounded shadow-md"></div>
            <span className="text-sm font-medium text-indigo-700">{t('admin.bookings.totalLabelShort','Total bookings')}</span>
          </div>
          <div className="flex items-center gap-2 bg-green-50 px-4 py-2 rounded-lg border border-green-200">
            <div className="w-4 h-4 bg-green-500 rounded-full shadow-sm"></div>
            <span className="text-sm font-medium text-green-700">{t('admin.occupancy.rateLabel','Occupancy rate (%)')}</span>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">{t('common.loading') || 'Loading...'}</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Flag className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">{t('admin.errors.loadFailed','Failed to load dashboard data')}</p>
          <button 
            onClick={fetchDashboardData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <RefreshCw className="w-4 h-4 inline mr-2" />
            {t('admin.errors.retry','Retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                  {t('admin.dashboard.title','Admin Dashboard')}
                </h1>
                <p className="text-gray-600 flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  {t('admin.dashboard.overview','System overview and statistics')}
                </p>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={Users}
            title={t('admin.stats.totalUsers','Total users')}
            value={stats.users.total.toLocaleString()}
            subtitle={`${stats.users.active.toLocaleString()} ${t('admin.stats.active','active')}`}
            color="blue"
            trend={{ direction: 'up', value: 12 }}
          />
          <StatCard
            icon={Building2}
            title={t('admin.stats.facilities','Sports facilities')}
            value={stats.facilities.total.toLocaleString()}
            subtitle={t('admin.stats.activeFacilities','Active')}
            color="green"
            trend={{ direction: 'up', value: 8 }}
          />
          <StatCard
            icon={Calendar}
            title={t('admin.stats.totalBookings','Total bookings')}
            value={stats.bookings.total.toLocaleString()}
            subtitle={`${stats.bookings.pending} ${t('admin.stats.pending','pending')}`}
            color="purple"
            trend={{ direction: 'up', value: 15 }}
          />
          <StatCard
            icon={DollarSign}
            title={t('admin.stats.revenue','Revenue')}
            value={`${stats.revenue.total.toLocaleString()}đ`}
            subtitle={t('admin.stats.totalRevenue','Total revenue')}
            color="orange"
            trend={{ direction: 'up', value: 23 }}
          />
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={TrendingUp}
            title={t('admin.stats.growthRate','Growth rate')}
            value={`${stats.growth.rate}%`}
            subtitle={`${stats.growth.recent} ${t('admin.stats.recentOrders','recent orders')}`}
            color="green"
            trend={{ direction: 'up', value: 5 }}
          />
          <StatCard
            icon={MessageSquare}
            title={t('admin.stats.posts','Posts')}
            value={stats.social.posts.toLocaleString()}
            subtitle={t('admin.stats.totalPosts','Total posts')}
            color="indigo"
            trend={{ direction: 'up', value: 18 }}
          />
          <StatCard
            icon={Heart}
            title={t('admin.stats.interactions','Interactions')}
            value={stats.social.reactions.toLocaleString()}
            subtitle={`${stats.social.comments} ${t('admin.stats.comments','comments')}`}
            color="red"
            trend={{ direction: 'up', value: 9 }}
          />
          <StatCard
            icon={Flag}
            title={t('admin.stats.flaggedContent','Flagged content')}
            value={stats.moderation.flagged}
            subtitle={t('admin.stats.needsReview','Needs review')}
            color="yellow"
            trend={{ direction: 'down', value: 3 }}
          />
        </div>

        {/* Charts Section */}
        <div className="space-y-6">
          {/* Booking Status & Revenue by Month side-by-side (swapped) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 flex flex-col md:col-span-2">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-1">{t('admin.revenue.by12Months','Revenue by 12 months')}</h2>
                <p className="text-sm text-gray-500">{t('admin.revenue.trendAnalysis','Long-term revenue trend analysis')}</p>
              </div>
              <RevenueByMonthChart data={revenueByMonth} />
            </div>
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 flex flex-col md:col-span-1">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-1">{t('admin.bookings.statusTitle','Booking status')}</h2>
                <p className="text-sm text-gray-500">{t('admin.bookings.statusHelp','Analysis of booking order statuses')}</p>
              </div>
              <BookingsStatusChart bookings={stats.bookings} />
            </div>
          </div>

          {/* Sport Trends & Courts side-by-side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
              <SportTrendsChart data={sportTrends} />
            </div>
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
                <TrendingCourts courts={stats.courts || []} isMock={courtsAreMock} />
            </div>
          </div>

          {/* User Growth Chart (moved to bottom) */}
          <UserGrowthChart newUsers={userGrowth.newUsers} totalUsers={userGrowth.totalUsers} />

          {/* Activity Trends Chart (moved to bottom) */}
          <ActivityTrendsChart posts={activityTrends.posts} comments={activityTrends.comments} />
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
