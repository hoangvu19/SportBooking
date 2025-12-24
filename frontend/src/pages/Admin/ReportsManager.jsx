import React, { useEffect, useState, useCallback } from 'react';
import { reportAPI } from '../../utils/reportAPI';
import { facilityAPI } from '../../utils/api';
import PostCard from '../../components/Social/PostCard';
import FacilityReportCard from '../../components/Admin/FacilityReportCard';
import toast from 'react-hot-toast';
import DEFAULT_AVATAR from '../../utils/defaults';
import { useI18n } from '../../i18n/hooks';
import apiClient, { getAuthInfo } from '../../utils/apiClient';
import { useNavigate } from 'react-router-dom';
import { normalizeUser } from '../../utils/normalize';

const ReportsManager = () => {
  const { t } = useI18n();
  const [reports, setReports] = useState([]);
  const [reportType, setReportType] = useState('post'); // 'post' | 'facility' | 'all'
  const [loading, setLoading] = useState(true);
  const [facilityCache, setFacilityCache] = useState({});
  const [rawOpenMap, setRawOpenMap] = useState({});
  const fetchingRef = React.useRef(new Set());

  const getReportId = (r) => r?.ReportID ?? r?.ReportId ?? r?._id ?? r?.id ?? r?.Id ?? null;

  const authInfo = getAuthInfo();
  const isAdminAuth = !!(authInfo && authInfo.authToken && (String(authInfo.activeRole || '').toLowerCase().includes('admin')));
  const navigate = useNavigate();

  const getContentId = (r) => {
    if (!r) return null;
    return r?.contentId ?? r?.ContentId ?? r?.ReportedContentID ?? r?.ReportedContent?.id ?? r?.ReportedContent?.FacilityID ?? r?.reportedContent?.id ?? r?.reportedContent?.FacilityID ?? r?.ReportedContent?.contentId ?? r?.reportedContent?.contentId ?? null;
  };

  const normalizeToArray = useCallback((v) => {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    if (typeof v === 'string') {
      try {
        const parsed = JSON.parse(v);
        if (Array.isArray(parsed)) return parsed;
      } catch  { /* ignore */ }
      return [v];
    }
    if (typeof v === 'object') {
      const out = [];
      if (v.URL) out.push(v.URL);
      if (v.url) out.push(v.url);
      if (v.ImageUrl) out.push(v.ImageUrl);
      return out;
    }
    return [];
  }, []);

  const mapReportedToPost = useCallback((reportRow) => {
    if (!reportRow) return null;
    let rc = reportRow;
    if (typeof rc === 'string') {
      try { rc = JSON.parse(rc); } catch { /* ignore */ }
    }
    if (rc && typeof rc === 'object') {
      if (rc.ReportedContent || rc.reportedContent) rc = rc.ReportedContent || rc.reportedContent;
      else if (rc.Content && typeof rc.Content === 'object') rc = rc.Content;
      else if (rc.content && typeof rc.content === 'object') rc = rc.content;
    }

    const candidatePost = rc.Post || rc.post || rc.PostData || rc.PostContent || rc.Payload || rc;
    const postObj = candidatePost && (candidatePost._id || candidatePost.PostID || candidatePost.PostId || candidatePost.id || candidatePost.content) ? candidatePost : rc;

    const userObj = postObj.user || postObj.User || postObj.author || postObj.Author || postObj.Account || postObj.ReportedBy || postObj.Reporter || reportRow.user || reportRow.User || reportRow.Reporter || {};
    const normalized = normalizeUser(userObj || {});
    const mappedUser = {
      _id: normalized?.id || normalized?.raw?._id || normalized?.raw?.id || postObj.AccountID || postObj.AccountId || reportRow.UserID || reportRow.ReporterID || null,
      username: normalized?.username || normalized?.fullName || postObj.AuthorUsername || reportRow.ReporterUsername || '',
      full_name: normalized?.fullName || normalized?.raw?.full_name || postObj.AuthorName || reportRow.ReporterName || normalized?.username || '',
      profile_picture: normalized?.avatar || normalized?.avatarUrl || normalized?.raw?.profile_picture || postObj.AuthorAvatar || reportRow.ReporterAvatar || null,
    };

    const rawImages = postObj.MediaURLs || postObj.media_urls || postObj.image_urls || postObj.Images || postObj.images || postObj.ImageUrls || postObj.ImageUrl || postObj.media || null;
    const altRawImages = reportRow?.MediaURLs || reportRow?.media_urls || reportRow?.image_urls || reportRow?.Images || reportRow?.images || null;
    const image_urls = normalizeToArray(rawImages).length ? normalizeToArray(rawImages) : normalizeToArray(altRawImages);
    const media_urls = normalizeToArray(postObj.media_urls || postObj.MediaURLs || postObj.media || altRawImages || reportRow?.media);

    const mapped = {
      _id: postObj.PostID || postObj._id || postObj.id || postObj.PostId || null,
      content: postObj.Content || postObj.content || postObj.Text || postObj.Body || '',
      image_urls: image_urls,
      media_urls: media_urls,
      user: mappedUser,
      createdAt: postObj.CreatedAt || postObj.createdAt || postObj.Created || postObj.PostedAt || postObj.created || null,
      likes_count: postObj.LikeCount || postObj.likes_count || postObj.likes || 0,
      comments_count: postObj.CommentsCount || postObj.comments_count || postObj.comments || 0,
      shares_count: postObj.SharesCount || postObj.shares_count || 0,
      is_shared: !!postObj.is_shared || !!postObj.Shared,
      shared_post: postObj.shared_post || postObj.sharedPost || postObj.shared || null,
    };

    if (!mapped.user.full_name || mapped.user.full_name.trim() === '') mapped.user.full_name = mapped.user.username || mapped.user._id || 'Unknown User';

    return mapped;
  }, [normalizeToArray]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // load reports filtered by selected reportType
      const filters = {};
      if (reportType && reportType !== 'all') filters.contentType = reportType;
      const res = await reportAPI.getAll(filters);
      if (res && res.success) {
        const all = res.data || [];
        // Filter out reports whose reported post is already deleted/closed or reports already handled
        const filtered = all.filter((r) => {
          try {
            // If report row itself indicates it's resolved/dismissed, skip it
            const repStatus = r?.Status || r?.status || null;
            if (typeof repStatus === 'string') {
              const rs = repStatus.toLowerCase();
              if (rs === 'resolved' || rs === 'dismissed' || rs === 'closed') return false;
            }

            const rawReported = r?.reportedContent || r?.ReportedContent || r;
            // Lightweight extraction of the underlying post-like object (avoid calling mapReportedToPost here)
            let asPost = rawReported;
            if (rawReported && typeof rawReported === 'object') {
              const candidate = rawReported.Post || rawReported.post || rawReported.PostData || rawReported.PostContent || rawReported.Payload || rawReported;
              asPost = (candidate && (candidate._id || candidate.PostID || candidate.PostId || candidate.id || candidate.content)) ? candidate : rawReported;
            }

            // Inline visibility checks (deleted/closed flags)
            if (asPost) {
              const status = asPost.Status || asPost.status || asPost.Visibility || asPost.visibility || null;
              if (typeof status === 'string') {
                const s = status.toLowerCase();
                if (s === 'deleted' || s === 'closed' || s === 'hidden' || s === 'removed' || s === 'inactive') return false;
              }
              if (asPost.isDeleted || asPost.IsDeleted || asPost.deleted || asPost.Removed) return false;
              if (asPost.DeletedAt || asPost.deletedAt) return false;
              const bookingStatus = asPost.booking?.Status || asPost.booking?.status || null;
              if (typeof bookingStatus === 'string' && bookingStatus.toLowerCase() === 'closed') return false;
            }

            return true;
          } catch (e) { void e; return true; }
        });
        setReports(filtered);
      } else setReports([]);
    } catch (err) {
      console.error('Error loading reports for ReportsManager', err);
      toast.error(t('report.loadError') || 'Không thể tải danh sách báo cáo');
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [t, reportType]);

  useEffect(() => { load(); }, [load, reportType]);
  

  // When reports change, prefetch facility details for facility-type reports missing detail fields
  
  // When reports change, prefetch facility details for facility-type reports missing detail fields
  useEffect(() => {
    if (!reports || reports.length === 0) return;
    const idsToFetch = new Set();
    try {
      for (const r of reports) {
        const rawReported = r?.reportedContent || r?.ReportedContent || r;
        let asPost = (rawReported && typeof rawReported === 'object' && (rawReported._id || rawReported.PostID || rawReported.image_urls || rawReported.media_urls)) ? rawReported : null;
        if (!asPost) {
          // try mapReportedToPost shape
          try { asPost = mapReportedToPost(r); } catch { asPost = null; }
        }

        const isFacility = (String(r?.contentType || r?.ReportedContentType || r?.report?.ReportedContentType || '').toLowerCase() === 'facility') || (asPost && (asPost.FacilityID || asPost.facilityId || asPost.FacilityName));
        if (!isFacility) continue;

        const fac = asPost || rawReported || {};
        const facilityId = getContentId(r) || fac.FacilityID || fac.facilityId || fac.id || fac.FacilityId || null;
        const hasName = fac.FacilityName || fac.name;
        if (facilityId && !hasName && !facilityCache[facilityId] && !fetchingRef.current.has(String(facilityId))) {
          idsToFetch.add(String(facilityId));
        }
      }
    } catch { /* ignore */ }

    if (idsToFetch.size === 0) return;

    idsToFetch.forEach(id => {
      fetchingRef.current.add(String(id));
      (async () => {
        try {
          const res = await facilityAPI.getById(Number(id));
          // facilityAPI may return either { success, data } envelope or the raw facility object directly.
          const facilityObj = (res && res.success && res.data) ? res.data : (res && res.data ? res.data : res);
          // Basic normalization to increase chance of finding common fields in the UI
          const normalizeFacility = (f) => {
            if (!f || typeof f !== 'object') return f;
            const ownerObj = f.ChuSoHuu || f.Owner || f.owner || (f.OwnerFullName || f.OwnerName ? { HoTen: f.OwnerFullName || f.OwnerName } : null) || null;
            return {
              FacilityName: f.FacilityName || f.name || f.Name || f.facilityName || f.Facility || null,
              TenCoSo: f.TenCoSo || f.FacilityName || f.TenCoSo || f.TenSan || null,
              TenSan: f.TenSan || f.FieldName || f.Field || null,
              OwnerName: f.OwnerName || (ownerObj && (ownerObj.HoTen || ownerObj.FullName || ownerObj.full_name)) || null,
              OwnerFullName: f.OwnerFullName || (ownerObj && (ownerObj.HoTen || ownerObj.FullName || ownerObj.full_name)) || null,
              OwnerAvatar: f.OwnerAvatar || (ownerObj && (ownerObj.Avatar || ownerObj.avatar)) || null,
              ChuSoHuu: ownerObj,
              AreaName: f.AreaName || f.areaName || f.area || f.Area || null,
              KhuVuc: f.KhuVuc || f.AreaName || f.area || null,
              Address: f.Address || f.address || f.Location || f.location || null,
              Description: f.Description || f.description || f.Desc || f.DescriptionLong || null,
              image_urls: f.image_urls || f.images || f.ImageUrls || f.ImageUrls || null,
              images: f.images || f.image_urls || null,
              sportFields: Array.isArray(f.sportFields) ? f.sportFields : (Array.isArray(f.fields) ? f.fields : (f.sportFields || [])),
              __raw: f
            };
          };

          if (facilityObj) {
            setFacilityCache(prev => ({ ...prev, [id]: normalizeFacility(facilityObj) }));
          } else {
            // Mark as not found to avoid repeated 404s
            setFacilityCache(prev => ({ ...prev, [id]: { __notFound: true } }));
          }
        } catch (err) {
          // If API returned 404 or other error, cache a not-found marker so we don't retry repeatedly
          setFacilityCache(prev => ({ ...prev, [id]: { __notFound: true, __error: String(err && err.message ? err.message : err) } }));
          console.debug('Could not fetch facility detail for id', id, err);
        } finally {
          fetchingRef.current.delete(String(id));
        }
      })();
    });
  }, [reports, facilityCache, mapReportedToPost]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">{t('report.reportsManagerTitle') || 'Reported Items'}</h1>
          <p className="text-gray-600">{t('report.reportsManagerDescription') || 'Danh sách các nội dung bị báo cáo bởi người dùng.'}</p>

          <div className="mt-3 flex items-center gap-2">
            <button onClick={() => setReportType('post')} className={`px-3 py-1 rounded ${reportType === 'post' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-800'}`}>{t('report.tabPosts') || 'Posts'}</button>
            <button onClick={() => setReportType('facility')} className={`px-3 py-1 rounded ${reportType === 'facility' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-800'}`}>{t('report.tabFacilities') || 'Facilities'}</button>
            <button onClick={() => setReportType('all')} className={`px-3 py-1 rounded ${reportType === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-800'}`}>{t('report.tabAll') || 'All'}</button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow divide-y">
          {!isAdminAuth && (
            <div className="p-3 bg-yellow-50 border-l-4 border-yellow-400 text-sm text-yellow-800 flex items-center justify-between">
              <div>{t('report.needsAdmin') || 'Bạn chưa đăng nhập với tài khoản admin — một số hành động bị vô hiệu hóa.'}</div>
              <div className="flex gap-2">
                <button onClick={() => navigate('/login')} className="px-3 py-1 bg-blue-600 text-white rounded text-sm">{t('moderation.loginAsAdmin') || 'Sign in as admin'}</button>
                <button onClick={() => {
                  try {
                    const info = getAuthInfo();
                    console.log('Auth info:', info);
                    // try decode JWT payload for easier debugging
                    if (info && info.authToken && info.authToken.split('.').length === 3) {
                      try {
                        const payload = JSON.parse(atob(info.authToken.split('.')[1]));
                        console.log('Decoded token payload:', payload);
                      } catch (e) { console.debug('Failed to decode token payload', e); }
                    }
                    alert('See console for auth info.');
                  } catch (e) { console.debug('Debug action failed', e); alert('Debug failed — see console'); }
                }} className="px-3 py-1 bg-gray-100 text-gray-800 rounded text-sm">Debug</button>
              </div>
            </div>
          )}
          {loading ? (
            <div className="p-6 text-center">{t('common.loading') || 'Đang tải...'}</div>
          ) : reports.length === 0 ? (
            <div className="p-6 text-center text-gray-500">{t('report.noReports') || 'Không có báo cáo nào'}</div>
          ) : (
            reports.map((r) => {
              const rid = getReportId(r);
              const rawReported = r?.reportedContent || r?.ReportedContent || r;
              const asPost = (rawReported && typeof rawReported === 'object' && (rawReported._id || rawReported.PostID || rawReported.image_urls || rawReported.media_urls)) ? rawReported : mapReportedToPost(r);
              const key = rid || ('rep-' + Math.random().toString(36).slice(2,8));

              // normalize common report fields (backend may return legacy or frontend-shaped keys)
              const reasonText = r?.reason ?? r?.ReportReason ?? r?.Reason ?? r?.ReportDescription ?? r?.description ?? '-';
              const reporterName = r?.reporter?.name || r?.reporter?.fullName || r?.ReporterName || r?.Reporter || r?.ReporterUsername || (t('common.none') || '-');

              // Action handlers
              const handleDelete = async () => {
                if (!rid) return toast.error(t('report.cantIdentifyReport') || 'Không xác định được báo cáo');
                const ok = window.confirm(t('report.confirmDelete') || 'Bạn có chắc muốn xóa nội dung này không?');
                if (!ok) return;
                if (!isAdminAuth) return toast.error(t('moderation.unauthorized') || 'Không được phép — vui lòng đăng nhập bằng tài khoản admin');
                try {
                  toast.loading(t('report.deleting') || 'Đang xóa...');
                  await reportAPI.update(rid, 'resolved', (t('report.adminDeleted') || 'Nội dung bị xóa bởi admin'), true);
                  toast.dismiss();
                  toast.success(t('report.deleted') || 'Đã xóa nội dung');
                  // Remove the report from the list
                  setReports(prev => prev.filter(p => getReportId(p) !== rid));
                  // Notify the rest of the app that the associated post was deleted so feed and other views can remove it immediately
                  try {
                    const postId = asPost && (asPost._id || asPost.PostID || asPost.id);
                    if (postId) window.dispatchEvent(new CustomEvent('post:deleted', { detail: { postId } }));
                  } catch { /* ignore */ }
                } catch (err) {
                  console.error('Error deleting reported content', err);
                  toast.dismiss();
                  if (err && err.status === 401) {
                    console.debug('Unauthorized API call while deleting report. Local auth:', getAuthInfo());
                    toast.error(t('moderation.unauthorized') || 'Không được phép — vui lòng đăng nhập lại bằng tài khoản admin');
                  } else {
                    toast.error(t('report.deleteFailed') || 'Xóa thất bại');
                  }
                }
              };

              const handleDismiss = async () => {
                if (!rid) return toast.error(t('report.cantIdentifyReport') || 'Không xác định được báo cáo');
                const confirm = window.confirm(t('report.confirmDismiss') || 'Bạn có chắc muốn đóng báo cáo này?');
                if (!confirm) return;
                if (!isAdminAuth) return toast.error(t('moderation.unauthorized') || 'Không được phép — vui lòng đăng nhập bằng tài khoản admin');
                const defaultMsg = t('report.defaultDismissMessage') || 'No violation found — closing report.';
                const msg = window.prompt(t('report.promptDismissMessage') || 'Enter a note for closing the report:', defaultMsg);
                // if prompt cancelled, msg === null -> treat as cancelled
                if (msg === null) return;
                try {
                  toast.loading(t('report.sendingDismiss') || 'Đang đóng báo cáo...');
                  // Mark report as dismissed on the backend
                  await reportAPI.update(rid, 'dismissed', msg, false);
                  toast.dismiss();
                  toast.success(t('report.dismissed') || 'Đã đóng báo cáo');
                  setReports(prev => prev.filter(p => getReportId(p) !== rid));
                } catch (err) {
                  console.error('Error dismissing report', err);
                  toast.dismiss();
                  if (err && err.status === 401) {
                    console.debug('Unauthorized API call while dismissing report. Local auth:', getAuthInfo());
                    toast.error(t('moderation.unauthorized') || 'Không được phép — vui lòng đăng nhập lại bằng tài khoản admin');
                  } else {
                    toast.error(t('report.dismissFailed') || 'Đóng báo cáo thất bại');
                  }
                }
              };

              const isFacility = (String(r?.contentType || r?.ReportedContentType || r?.report?.ReportedContentType || '').toLowerCase() === 'facility') || (asPost && (asPost.FacilityID || asPost.facilityId || asPost.FacilityName));

              const handleResolve = async () => {
                if (!rid) return toast.error(t('report.cantIdentifyReport') || 'Không xác định được báo cáo');
                const note = window.prompt(t('report.promptResolveNote') || 'Ghi chú xử lý (tùy chọn):', 'Đã xử lý');
                if (!isAdminAuth) return toast.error(t('moderation.unauthorized') || 'Không được phép — vui lòng đăng nhập bằng tài khoản admin');
                try {
                  toast.loading(t('report.resolving') || 'Đang xử lý...');
                  await reportAPI.update(rid, 'resolved', note || '', false);
                  toast.dismiss();
                  toast.success(t('report.resolved') || 'Đã xử lý');
                  setReports(prev => prev.filter(p => getReportId(p) !== rid));
                } catch (err) {
                  console.error('Error resolving report', err);
                  toast.dismiss();
                  if (err && err.status === 401) {
                    console.debug('Unauthorized API call while resolving report. Local auth:', getAuthInfo());
                    toast.error(t('moderation.unauthorized') || 'Không được phép — vui lòng đăng nhập lại bằng tài khoản admin');
                  } else {
                    toast.error(t('report.resolveFailed') || 'Xử lý thất bại');
                  }
                }
              };

              if (isFacility) {
                const fac = asPost || rawReported || {};
                const facilityId = getContentId(r) || fac.FacilityID || fac.facilityId || fac.id || fac.FacilityId || null;
                const cached = facilityId ? facilityCache[String(facilityId)] : null;
                const src = cached || fac;
                const facilityDBId = (src && (src.__raw && (src.__raw.FacilityID || src.__raw.facilityId || src.__raw.id))) || facilityId;
                return (
                  <FacilityReportCard
                    key={key}
                    report={r}
                    facility={src}
                    facilityId={facilityId}
                    facilityDBId={facilityDBId}
                    onDelete={handleDelete}
                    onDismiss={handleDismiss}
                    onResolve={handleResolve}
                    adminEnabled={isAdminAuth}
                    t={t}
                    DEFAULT_AVATAR={DEFAULT_AVATAR}
                    rawOpenMap={rawOpenMap}
                    setRawOpenMap={setRawOpenMap}
                  />
                );
              }

              return (
                <div key={key} className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      {asPost ? (
                        <PostCard post={asPost} />
                      ) : (
                        <div className="p-3 bg-gray-50 rounded text-sm">{rawReported?.Content || rawReported?.content || JSON.stringify(rawReported).slice(0,300)}</div>
                      )}
                    </div>
                    <div className="w-56 bg-gray-50 border rounded p-3 flex-shrink-0">
                      <div className="text-xs text-gray-500">{t('report.reason') || 'Lý do báo cáo'}</div>
                      <div className="mt-2 text-sm text-gray-800 font-medium">{reasonText}</div>
                      {/* show verbose description if provided */}
                      { (r?.ReportDescription || r?.description) && (
                        <div className="mt-2 text-xs text-gray-600">{r?.ReportDescription || r?.description}</div>
                      )}
                      <div className="mt-3 text-xs text-gray-500">{t('report.reportedBy') || 'Báo cáo bởi'}: <strong className="text-sm">{reporterName}</strong></div>
                      <div className="mt-4 flex gap-2">
                        <button disabled={!isAdminAuth} onClick={handleDismiss} className="flex-1 text-sm px-3 py-1 bg-yellow-100 text-yellow-800 rounded" title={!isAdminAuth ? (t('moderation.loginAsAdmin') || 'Sign in as admin to perform this action') : ''}>{t('report.dismissReport') || 'Đóng báo cáo'}</button>
                        <button disabled={!isAdminAuth} onClick={handleDelete} className="flex-1 text-sm px-3 py-1 bg-red-100 text-red-700 rounded" title={!isAdminAuth ? (t('moderation.loginAsAdmin') || 'Sign in as admin to perform this action') : ''}>{t('report.deleteContent') || 'Xóa bài'}</button>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">{r?.CreatedAt ? new Date(r.CreatedAt).toLocaleString('vi-VN') : ''}</div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportsManager;
