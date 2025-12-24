import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Edit2, User, MapPin, Star, TrendingUp, Sparkles, Flame } from 'lucide-react';
import "../../App.css";
import { facilityAPI, ratingAPI, sportTypeAPI, aiAPI } from "../../utils/api";
import { areaAPI } from "../../utils/api";
import getBackendOrigin, { toAbsoluteUrl } from '../../utils/urlHelpers';
import { determineStatusCodeFromFields } from "../../utils/statusUtils";
import DEFAULT_AVATAR from "../../utils/defaults";
import { useI18n } from '../../i18n/hooks';
import Loading from "../../components/Shared/Loading";

function SanList() {
  const navigate = useNavigate();
  const { t } = useI18n();
  // navigation will open booking modal on SanDetail via location.state.openBooking
  const [searchTenSan, setSearchTenSan] = useState('');
  const [filterMonTheThao, setFilterMonTheThao] = useState('');
  const [filterLoaiSan, setFilterLoaiSan] = useState('');
  const [filterKhuVuc, setFilterKhuVuc] = useState('');
  const [filterTrangThai, setFilterTrangThai] = useState('');
  const [sanList, setSanList] = useState([]);
  const [areas, setAreas] = useState([]);
  const [sportTypes, setSportTypes] = useState([]);
  const [serverSportFilter, setServerSportFilter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // AI Features State
  const [_trendingPosts, setTrendingPosts] = useState([]);
  const [personalizedFeed, setPersonalizedFeed] = useState([]);
  const [trendingFields, setTrendingFields] = useState([]);
  const [_aiLoading, setAiLoading] = useState(false);
  const [_showAiSection, setShowAiSection] = useState(false);

  // Fetch facilities from API
  // (moved below after fetch functions are defined so we can include them in the dependency array)

  const fetchSportTypes = useCallback(async () => {
    try {
      const res = await sportTypeAPI.getAll();
      if (res && res.success && Array.isArray(res.data)) {
        // Expect each item to contain SportTypeID and SportName
        setSportTypes(res.data);
      }
    } catch (err) {
      console.debug('Could not load sport types, falling back to facility-derived list', err);
    }
  }, []);

  const fetchFacilities = useCallback(async (options) => {
    setLoading(true);
    setError(null);
    try {
      const result = options ? await facilityAPI.search(options) : await facilityAPI.getAll();
      if (options && options.sportTypeId) setServerSportFilter(options.sportTypeId);
      else setServerSportFilter(null);
        if (result.success && result.data) {
        const facilities = result.data.map(field => ({
          SanID: field.FacilityID || field.SanID || field.FieldID,
          FieldID: field.FieldID || null,
          TenSan: field.TenSan || field.FieldName || field.FacilityName,
          LoaiSan: field.LoaiSan || field.FieldType || 'Unknown',
          MonTheThao: field.MonTheThao || (field.sportFields && field.sportFields[0] && (field.sportFields[0].SportName || field.sportFields[0].SportType)) || field.SportName || 'Unknown',
          sportFields: field.sportFields || field.SportFields || [],
          GiaThue: field.GiaThue || field.RentalPrice || 0,
          TrangThai: field.TrangThai || field.Status || 'Available',
          KhuVuc: field.KhuVuc || field.AreaName || 'Unknown',
          FieldArea: field.FieldArea || field.KhuVuc || 'Unknown',
          // Normalize opening hours if backend provides them
          OpeningHours: (field.OpenTime && field.CloseTime) ? `${field.OpenTime} - ${field.CloseTime}` : (field.OpeningHours || field.OpeningTime || null),
          HinhAnh: (() => {
            const base = getBackendOrigin();
            const pick = (candidate) => {
              if (!candidate) return null;
              if (typeof candidate === 'string') return candidate;
              // common fields
              const keys = ['ImageUrl','ImageURL','URL','url','image_url','imageUrl','Data','data','FileName','fileName','FilePath','path','File'];
              for (const k of keys) {
                if (candidate[k]) return candidate[k];
              }
              if (candidate.Data && typeof candidate.Data === 'object') {
                for (const k of keys) if (candidate.Data[k]) return candidate.Data[k];
              }
              return null;
            };

            const m = field && field.images && field.images[0];
            let raw = null;
            if (m) raw = pick(m) || (typeof m === 'string' ? m : null);
            if (!raw) raw = pick(field) || field.HinhAnh || field.Image || null;
            if (raw) return toAbsoluteUrl(base, raw, 'facilities') || raw;
            return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 140" fill="%23E2E8F0"%3E%3Crect width="200" height="140" fill="%23E2E8F0"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="%23718096"%3ENo Image%3C/text%3E%3C/svg%3E';
          })(),
          ChuSoHuu: field.ChuSoHuu || {
            HoTen: field.OwnerName || 'Unknown',
            Avatar: field.OwnerAvatar || DEFAULT_AVATAR
          }
        }));
        // Ensure we have up-to-date sportFields for each facility (some list endpoints don't include them)
        const facilitiesWithFields = await Promise.all(facilities.map(async (f) => {
          try {
            // Try to fetch sport fields for the facility; API may return different shapes.
            const resp = await facilityAPI.getByFacilityId(f.SanID).catch(() => null);
            if (resp && resp.success && resp.data) {
              // resp.data might be the array itself, or an object containing sportFields
              if (Array.isArray(resp.data)) return { ...f, sportFields: resp.data };
              if (Array.isArray(resp.data.sportFields)) return { ...f, sportFields: resp.data.sportFields };
              if (Array.isArray(resp.data.SportFields)) return { ...f, sportFields: resp.data.SportFields };
              // Some APIs wrap payload under `data` again
              if (resp.data.data && Array.isArray(resp.data.data)) return { ...f, sportFields: resp.data.data };
            }
          } catch {
            // ignore and keep original sportFields
          }
          return f;
        }));

        const facilitiesFinal = facilitiesWithFields.map(f => {
          const code = determineStatusCodeFromFields(f.sportFields, f.TrangThai || f.Status || 'Available');
          // Map canonical code to display label (use i18n)
          const display = code === 'available' ? t('booking.available','Available') : (code === 'maintenance' ? t('booking.maintenance','Maintenance') : (code === 'unavailable' ? t('booking.unavailable','Unavailable') : (f.TrangThai || f.Status || 'Unknown')));
          return { ...f, _statusCode: code, TrangThai: display };
        });

        // Fetch rating stats for each facility in parallel (attach AverageRating)
        try {
          const rated = await Promise.all(facilitiesFinal.map(async (f) => {
            try {
              const stats = await ratingAPI.getStats('Facility', f.SanID);
              if (stats && stats.success && stats.data && typeof stats.data.averageRating === 'number') {
                return { ...f, AverageRating: stats.data.averageRating, RatingCount: stats.data.totalCount };
              }
            } catch (e) {
              console.debug('No rating for', f.SanID, e);
            }
            return { ...f, AverageRating: null, RatingCount: 0 };
          }));
          setSanList(rated);
        } catch {
          setSanList(facilitiesFinal);
        }
        } else {
        setError(result.message || 'Unable to load facility list');
      }
    } catch (err) {
      console.error('Fetch facilities error:', err);
  setError('Error loading facility list');
    } finally {
      setLoading(false);
    }
  }, [t]);

  const fetchAreas = useCallback(async () => {
    try {
      const res = await areaAPI.getAll();
      if (res && res.success && Array.isArray(res.data)) {
        setAreas(res.data);
      }
    } catch (err) {
      console.debug('Could not load areas list, falling back to facility-derived areas', err);
    }
  }, []);

  // Fetch AI Features
  const fetchAIFeatures = useCallback(async () => {
    setAiLoading(true);
    try {
      // Check if user is authenticated first
      const authToken = localStorage.getItem('authToken');
      
      // Only call personalized recommendations if user is logged in
      if (authToken) {
        const fieldRecsRes = await aiAPI.getFieldRecommendations({ limit: 20 }).catch(() => null);
        
        if (fieldRecsRes?.success && fieldRecsRes.data) {
          // Backend trả về { recommendations: [], count, filters, location }
          // Extract recommendations array từ response
          const recommendationsArray = fieldRecsRes.data.recommendations || [];
          
          const personalizedFields = recommendationsArray.map(facility => ({
            facilityId: facility.fieldId || facility.facilityId || facility.FacilityID || facility.SanID,
            FacilityID: facility.fieldId || facility.facilityId || facility.FacilityID || facility.SanID,
            relevanceScore: facility.recommendationScore || facility.score || 0,
            sportTypeId: facility.sportTypeId || facility.SportTypeID,
            ...facility
          }));
          
          setPersonalizedFeed(personalizedFields);
        } else {
          setPersonalizedFeed([]);
        }
      } else {
        setPersonalizedFeed([]);
      }
      
      // Trending fields endpoint
      const trendingFieldsRes = await aiAPI.getTrendingFields(20).catch(() => null);
      
      if (trendingFieldsRes?.success && trendingFieldsRes.data?.data) {
        // Backend trả về { data: [], count: 0 }
        const trendingData = trendingFieldsRes.data.data || [];
        const trendingFields = trendingData.map(facility => ({
          facilityId: facility.FacilityID || facility.SanID,
          FacilityID: facility.FacilityID || facility.SanID,
          trendingScore: facility.trendingScore || 0,
          bookingCount: facility.TotalBookings || 0,
          sportTypeId: facility.SportTypeID,
          ...facility
        }));
        
        setTrendingFields(trendingFields);
      } else {
        setTrendingFields([]);
      }
      
      // Trending posts (optional - for feed display)
      const trendingPostsRes = await aiAPI.getTrendingPosts(5).catch(() => null);
      if (trendingPostsRes?.success) {
        setTrendingPosts(trendingPostsRes.data?.data || []);
      }
      
      setShowAiSection(true);
    } catch (err) {
      console.error('❌ Failed to fetch AI features:', err);
      // Graceful degradation - continue without AI
      setPersonalizedFeed([]);
      setTrendingFields([]);
    } finally {
      setAiLoading(false);
    }
  }, []);

  // Now call the initial fetches (include callbacks in deps)
  useEffect(() => {
    fetchFacilities();
    fetchAreas();
    fetchSportTypes();
    fetchAIFeatures(); // Fetch AI data on mount
  }, [fetchFacilities, fetchAreas, fetchSportTypes, fetchAIFeatures]);

  // Listen for realtime rating updates and patch the list in-place
  useEffect(() => {
    const handler = (ev) => {
      try {
        const payload = ev && ev.detail ? ev.detail : ev;
        if (!payload || !payload.targetType) return;
        if (String(payload.targetType).toLowerCase() !== 'facility') return;
        const id = String(payload.targetId || payload.targetID || payload.target_id || payload.target);
        if (!id) return;
        setSanList((prev) => prev.map((s) => {
          const sid = String(s.SanID || s.FacilityID || s.facilityId || '');
          if (sid === id) {
            return {
              ...s,
              AverageRating: (payload.stats && typeof payload.stats.averageRating === 'number') ? payload.stats.averageRating : s.AverageRating,
              RatingCount: (payload.stats && typeof payload.stats.totalCount === 'number') ? payload.stats.totalCount : s.RatingCount
            };
          }
          return s;
        }));
  } catch { /* ignore */ }
    };

    window.addEventListener('rating:updated', handler);
    return () => window.removeEventListener('rating:updated', handler);
  }, []);

  // Listen for booking events to potentially update facility status/availability
  useEffect(() => {
    const onBookingEvent = (event) => {
      try {
        const payload = event?.detail;
        if (!payload || !payload.booking) return;
        
        const booking = payload.booking;
        const fieldId = String(booking.FieldID || '');
        
        console.log('📥 SanList: Received booking event for FieldID:', fieldId);
        
        // Update facility in list if it exists
        setSanList(prev => {
          const updated = prev.map(facility => {
            const facilityFieldIds = [
              String(facility.FieldID || ''),
              String(facility.SanID || ''),
              String(facility.FacilityID || ''),
              ...(Array.isArray(facility.sportFields) 
                ? facility.sportFields.map(sf => String(sf.FieldID || sf.SanID || ''))
                : []
              )
            ].filter(Boolean);
            
            // If this facility contains the booked field, mark it as updated
            if (facilityFieldIds.includes(fieldId)) {
              console.log('✅ SanList: Updating facility:', facility.TenSan);
              // You could update status or other fields here if needed
              return { ...facility, _lastBookingUpdate: Date.now() };
            }
            return facility;
          });
          return updated;
        });
      } catch (err) {
        console.debug('SanList booking event error:', err);
      }
    };

    console.log('✅ SanList: Registering booking event listeners');
    window.addEventListener('booking:created', onBookingEvent);
    window.addEventListener('booking:cancelled', onBookingEvent);

    return () => {
      console.log('🧹 SanList: Cleaning up booking event listeners');
      window.removeEventListener('booking:created', onBookingEvent);
      window.removeEventListener('booking:cancelled', onBookingEvent);
    };
  }, []);

  // Lấy các tùy chọn bộ lọc duy nhất từ dữ liệu
  // Prefer canonical sport types fetched from /api/sport-types; if unavailable, derive from facilities
  const sportTypeOptions = (sportTypes && sportTypes.length > 0)
    ? sportTypes.map(st => ({ id: String(st.SportTypeID || st.id || st.SportTypeId), label: st.SportName || st.sportName || st.label }))
    : [...new Set(sanList.flatMap(san => {
      if (san.sportFields && san.sportFields.length > 0) {
        return san.sportFields.map(sf => sf.SportName || sf.SportType || sf.MonTheThao).filter(Boolean);
      }
      return [san.MonTheThao];
    }))].map(name => ({ id: String(name), label: name }));
  const loaiSanOptions = [...new Set(sanList.map(san => san.LoaiSan))];
  // Prefer canonical areas from /api/areas if available, otherwise derive from facilities
  const khuVucOptions = (areas && areas.length > 0)
    ? areas.map(a => a.AreaName)
    : [...new Set(sanList.map(san => san.KhuVuc))];
  // Build canonical status filter options from _statusCode when available, falling back to normalized TrangThai
  const statusCodes = [...new Set(sanList.map(san => (san._statusCode || (san.TrangThai || '').toString().trim().toLowerCase() || 'available')))];
  const trangThaiOptions = statusCodes.map(code => ({
    value: code,
    label: code === 'available' ? t('booking.available','Available') : (code === 'maintenance' ? t('booking.maintenance','Maintenance') : (code === 'unavailable' ? t('booking.unavailable','Unavailable') : code))
  }));

  const filteredSanList = sanList.filter(san => {
    const matchesText = san.TenSan.toLowerCase().includes(searchTenSan.toLowerCase());
    const matchesSport = (filterMonTheThao === '') || (() => {
      if (serverSportFilter && String(serverSportFilter) === String(filterMonTheThao)) return true;
      if (san.sportFields && san.sportFields.length > 0) {
        return san.sportFields.some(sf => {
          const sfTypeId = sf.SportTypeID || sf.sportTypeId || sf.SportTypeId || sf.SportType;
          const sfName = sf.SportName || sf.SportType || sf.SportTypeName || sf.MonTheThao;
          // Match by ID (string comparison to tolerate types) or by name
          if (sfTypeId && String(sfTypeId) === String(filterMonTheThao)) return true;
          if (sfName && String(sfName) === String(filterMonTheThao)) return true;
          return false;
        });
      }
      return san.MonTheThao === filterMonTheThao;
    })();
    const matchesLoai = (filterLoaiSan === '' || san.LoaiSan === filterLoaiSan);
    const matchesKhuVuc = (filterKhuVuc === '' || san.KhuVuc === filterKhuVuc);
  const matchesTrangThai = (filterTrangThai === '' || san._statusCode === filterTrangThai);

    return matchesText && matchesSport && matchesLoai && matchesKhuVuc && matchesTrangThai;
  });

  // AI-POWERED SORTING: Sắp xếp danh sách theo AI recommendations
  const sortedSanList = React.useMemo(() => {
    if (!filteredSanList || filteredSanList.length === 0) return [];

    // Tạo map của trending fields để tra cứu nhanh
    const trendingFieldMap = new Map();
    trendingFields.forEach((field, index) => {
      const facilityId = field.facilityId || field.FacilityID;
      if (facilityId) {
        trendingFieldMap.set(String(facilityId), {
          score: field.trendingScore || 0,
          rank: index,
          bookingCount: field.bookingCount || 0
        });
      }
    });

    // Tạo map của personalized recommendations
    const personalizedFieldMap = new Map();
    personalizedFeed.forEach((item, index) => {
      // Personalized feed có thể chứa info về facilities
      const facilityId = item.facilityId || item.FacilityID;
      if (facilityId) {
        personalizedFieldMap.set(String(facilityId), {
          score: item.relevanceScore || 0,
          rank: index
        });
      }
    });

    // Sắp xếp facilities theo AI scores
    return [...filteredSanList].sort((a, b) => {
      const aId = String(a.SanID || a.FacilityID || a.facilityId);
      const bId = String(b.SanID || b.FacilityID || b.facilityId);

      // 1. Ưu tiên personalized (AI recommendations)
      const aPersonalized = personalizedFieldMap.get(aId);
      const bPersonalized = personalizedFieldMap.get(bId);
      
      // Nếu CẢ HAI đều có AI score (kể cả score = 0), sắp xếp theo score
      if (aPersonalized !== undefined && bPersonalized !== undefined) {
        // Cả 2 đều có AI score, ưu tiên theo score cao → thấp
        if (bPersonalized.score !== aPersonalized.score) {
          return bPersonalized.score - aPersonalized.score;
        }
        // Nếu score bằng nhau, ưu tiên theo rank (thứ tự trong AI response)
        return aPersonalized.rank - bPersonalized.rank;
      }
      
      // Nếu chỉ một trong hai có AI score, ưu tiên cái có AI score
      if (aPersonalized !== undefined && bPersonalized === undefined) return -1;
      if (aPersonalized === undefined && bPersonalized !== undefined) return 1;

      // 2. Nếu cả 2 KHÔNG có AI score, ưu tiên trending
      const aTrending = trendingFieldMap.get(aId);
      const bTrending = trendingFieldMap.get(bId);
      
      if (aTrending && !bTrending) return -1;
      if (!aTrending && bTrending) return 1;
      if (aTrending && bTrending) {
        // Cả 2 đều trending, ưu tiên theo trending score
        return bTrending.score - aTrending.score;
      }

      // 3. Cuối cùng sắp xếp theo rating
      const aRating = a.AverageRating || 0;
      const bRating = b.AverageRating || 0;
      if (aRating !== bRating) return bRating - aRating;

      // 4. Nếu rating bằng nhau, sắp xếp theo tên
      return (a.TenSan || '').localeCompare(b.TenSan || '');
    });
  }, [filteredSanList, trendingFields, personalizedFeed]);

  if (loading) {
    return <Loading />;
  }

  if (error) {
    return (
      <div className="h-full overflow-y-scroll no-scrollbar py-6 xl:pr-5">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
          <button 
            onClick={fetchFacilities}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            {t('booking.retry', 'Retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-scroll no-scrollbar py-6 xl:pr-5">
  <h2 className="text-2xl font-bold mb-4">{t('booking.findFields','Book a sports field now')}</h2>
      <div className="bg-white rounded-xl shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">

          <div className="col-span-2 md:col-span-2">
            <label className="block text-sm font-medium mb-1 invisible md:visible">&nbsp;</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={searchTenSan}
                onChange={e => setSearchTenSan(e.target.value)}
                placeholder={t('booking.searchFieldPlaceholder','Search ...')}
                aria-label={t('booking.searchFieldPlaceholder','Search ...')}
                className="w-full pl-12 pr-10 py-3 rounded-full border border-gray-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-100"
              />
              {searchTenSan && (
                <button
                  type="button"
                  onClick={() => setSearchTenSan('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 bg-white rounded-full p-1"
                  aria-label={t('booking.clearSearch', 'Clear search')}
                >
                  ✕
                </button>
              )}
            </div>
          </div>
          <div className="col-span-1">
            <label className="block text-sm font-medium mb-1">{t('booking.sport','Sport')}</label>
                      <select value={filterMonTheThao} onChange={e => {
                          const val = e.target.value;
                          setFilterMonTheThao(val);
                          // When a sport type is selected, fetch facilities filtered by that sportType from server
                          if (val) {
                            fetchFacilities({ sportTypeId: val });
                          } else {
                            fetchFacilities();
                          }
                        }} className="w-full border rounded px-3 py-2 bg-white">
                        <option value="">{t('booking.all','All')}</option>
                        {sportTypeOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                      </select>
          </div>
          <div className="col-span-1">
            <label className="block text-sm font-medium mb-1">{t('booking.fieldType','Field type')}</label>
            <select value={filterLoaiSan} onChange={e => setFilterLoaiSan(e.target.value)} className="w-full border rounded px-3 py-2 bg-white">
              <option value="">{t('booking.all','All')}</option>
              {loaiSanOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>

          <div className="col-span-1">
            <label className="block text-sm font-medium mb-1">{t('booking.area','Area')}</label>
            <select value={filterKhuVuc} onChange={e => setFilterKhuVuc(e.target.value)} className="w-full border rounded px-3 py-2 bg-white">
              <option value="">{t('booking.all','All')}</option>
              {khuVucOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>

          <div className="col-span-1">
            <label className="block text-sm font-medium mb-1">{t('booking.statusLabel','Status')}</label>
            <select value={filterTrangThai} onChange={e => setFilterTrangThai(e.target.value)} className="w-full border rounded px-3 py-2 bg-white">
              <option value="">{t('booking.all','All')}</option>
              {trangThaiOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedSanList.length === 0 ? (
          <div className="col-span-3 text-center text-gray-500">{t('booking.noMatchingFields','No matching fields')}</div>
        ) : (
          sortedSanList.map((san) => {
            // Kiểm tra xem facility có trong personalized feed không
            const isPersonalized = personalizedFeed.some(item => {
              const itemFacilityId = String(item.facilityId || item.FacilityID || '');
              const sanId = String(san.SanID || san.FacilityID || '');
              return itemFacilityId === sanId;
            });

            // Kiểm tra xem facility có trending không
            const trendingInfo = trendingFields.find(field => {
              const fieldFacilityId = String(field.facilityId || field.FacilityID || '');
              const sanId = String(san.SanID || san.FacilityID || '');
              return fieldFacilityId === sanId;
            });

            return (
            <div
              key={san.SanID}
              data-testid="san-card"
              data-sanid={san.SanID}
              className="bg-white rounded-2xl border border-gray-200 shadow-md p-4 flex flex-col items-center cursor-pointer hover:shadow-lg hover:border-indigo-300 transition-all relative"
              style={{ minHeight: 340 }}
              onClick={() => navigate(`/san/${san.SanID}`)}
            >
              {/* AI Badges - Hiển thị nếu là personalized hoặc trending */}
              {isPersonalized && (
                <div className="absolute top-2 left-2 z-10">
                  <span className="inline-flex items-center gap-1 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">
                    <Sparkles size={12} />
                    {t('booking.aiRecommendation', 'Gợi ý cho bạn')}
                  </span>
                </div>
              )}
              {!isPersonalized && trendingInfo && (
                <div className="absolute top-2 left-2 z-10">
                  <span className="inline-flex items-center gap-1 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">
                    <Flame size={12} />
                    {t('booking.hotTrending', 'Hot')}
                  </span>
                </div>
              )}
              
              <div className="w-full flex justify-center mb-3 relative">
                <img
                  src={san.HinhAnh || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 140" fill="%23E2E8F0"%3E%3Crect width="200" height="140" fill="%23E2E8F0"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="%23718096"%3ENo Image%3C/text%3E%3C/svg%3E'}
                  alt={san.TenSan}
                  className="rounded-lg object-cover bg-gray-100"
                  style={{ width: 200, height: 140 }}
                />
                {san.AverageRating != null && (
                  <span className="absolute top-2 right-2 bg-yellow-400 text-white text-xs font-bold px-2 py-1 rounded">{san.AverageRating.toFixed(1)} <span className="ml-1">★</span></span>
                )}
              </div>
              {/* Opening hours */}
              {san.OpeningHours && (
                <div className="text-sm text-gray-400 mb-2">{t('booking.openingHours','Mở cửa')}: {san.OpeningHours}</div>
              )}
              <h3 className="font-semibold text-base mb-1 text-center line-clamp-2" style={{ minHeight: 48 }}>{san.TenSan}</h3>
              <div className="flex items-center justify-center gap-2 text-sm text-gray-600 mb-2">
                <MapPin className="w-4 h-4 text-red-500" />
                <span>{san.KhuVuc}</span>
              </div>
              {/* Rating shown in top-right badge; removed duplicate under-title rating per UX request */}
              <div className="mb-2 text-center">{t('booking.statusLabel','Status')}: <span className={san._statusCode === 'available' ? 'text-green-600' : 'text-red-600'}>{san._statusCode === 'available' ? t('booking.available','Available') : san.TrangThai}</span></div>
              {/* <button
                data-testid={`san-book-btn-${san.SanID}`}
                className="mt-auto px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 w-full font-semibold"
                onClick={e => {
                  e.stopPropagation(); // Prevent card navigation
                      // Navigate to SanDetail and request it open the booking modal.
                      // We pass both location.state.openBooking (immediate) and a query param
                      // `openBooking=1` as a robust fallback that survives refresh/back.
                      if (san._statusCode === 'available') {
                        navigate({ pathname: `/san/${san.SanID}`, search: '?openBooking=1' }, { state: { openBooking: true, initialDate: null, initialSlots: [] } });
                      }
                }}
                disabled={san._statusCode !== 'available'}
              >
                Book
              </button> */}
            </div>
            );
          })
        )}
      </div>
      {/* Booking modal is handled on the SanDetail page when navigated with state.openBooking */}
    </div>
  );
}

export default SanList;
