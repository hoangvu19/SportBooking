import React from 'react';
import DEFAULT_AVATAR from '../../utils/defaults';
import { API_BASE_URL } from '../../config/apiConfig';

const FacilityReportCard = ({
  report,
  facility,
  facilityId,
  facilityDBId,
  onDelete,
  onDismiss,
  onResolve,
  adminEnabled = true,
  t,
  DEFAULT_AVATAR: INJECTED_DEFAULT_AVATAR,
  rawOpenMap,
  setRawOpenMap,
}) => {
  const src = facility || {};
  // helper that uses i18n `t` but falls back to a plain string when translation missing
  const tt = (key, fallback) => {
    try {
      const v = (typeof t === 'function') ? t(key) : null;
      if (!v) return fallback;
      // some i18n implementations return the key itself when missing
      if (v === key) return fallback;
      return v;
    } catch {
      return fallback;
    }
  };
  // If the facility was marked not-found in cache, render a compact not-found card
  if (src && src.__notFound) {
    return (
      <div className="p-4">
        <div className="bg-white rounded-lg shadow-md overflow-hidden p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">{t('report.unknownFacility') || 'Facility not found'}</h3>
              <div className="text-xs text-gray-500">{t('report.noLongerAvailable') || 'The facility could not be retrieved from the server.'}</div>
            </div>
            <div className="text-right text-xs text-gray-500">{report?.CreatedAt ? new Date(report.CreatedAt).toLocaleString('vi-VN') : ''}</div>
          </div>
          <div className="mt-3 text-sm text-gray-700">{t('report.tryRefresh') || 'Try refreshing or check DB.'}</div>
          <div className="mt-4 flex gap-2">
            <button onClick={onDismiss} className="flex-1 px-3 py-2 bg-yellow-100 text-yellow-800 rounded text-sm">{t('report.dismissReport') || 'Đóng'}</button>
            <button onClick={onResolve} className="flex-1 px-3 py-2 bg-green-100 text-green-800 rounded text-sm">{t('report.resolveReport') || 'Xử lý'}</button>
          </div>
        </div>
      </div>
    );
  }

  const raw = src && src.__raw ? src.__raw : src;
  const ownerName = (raw && (raw.OwnerFullName || raw.OwnerName)) || src.OwnerFullName || src.OwnerName || (src.ChuSoHuu && (src.ChuSoHuu.HoTen || src.ChuSoHuu.FullName)) || src.Owner || '';
  const ownerAvatar = (raw && (raw.OwnerAvatar)) || src.OwnerAvatar || (src.ChuSoHuu && (src.ChuSoHuu.Avatar || src.ChuSoHuu.avatar)) || INJECTED_DEFAULT_AVATAR || DEFAULT_AVATAR;
  const facilityTitle = (raw && (raw.TenCoSo || raw.FacilityName || raw.facilityName)) || src.TenCoSo || src.FacilityName || src.TenSan || src.name || src.Facility || (facilityId ? ('Facility ' + facilityId) : (t('report.unknownFacility') || 'Unknown facility'));
  const areaName = (raw && (raw.KhuVuc || raw.AreaName || raw.areaName)) || src.KhuVuc || src.AreaName || src.areaName || '';
  const address = (raw && (raw.Address || raw.address || raw.Location || raw.location || raw.Street)) || src.Address || src.address || '';
  // Description may come from several places: the facility row, or the report payload
  const description = (
    // explicit description on the report (fallback reports often carry it)
    report?.description || report?.ReportDescription ||
    // reportedContent sometimes nests the content
    (report?.reportedContent && (report.reportedContent.Description || report.reportedContent.description || (report.reportedContent.content && (report.reportedContent.content.Description || report.reportedContent.content.description)))) ||
    // older shapes
    (raw && (raw.Description || raw.description)) || src.Description || src.description || ''
  );
  const sportFields = (src.__raw && Array.isArray(src.__raw.sportFields)) ? src.__raw.sportFields : (Array.isArray(src.sportFields) ? src.sportFields : []);
  const resolveImageUrl = (val) => {
    if (!val) return null;
    if (typeof val === 'string') {
      const s = val.trim();
      if (!s) return null;
      if (/^https?:\/\//i.test(s)) return s;
      if (/^data:/i.test(s) || /^blob:/i.test(s)) return s;
      // If it's a relative path, prefix with API host (strip trailing /api)
      try {
        const host = API_BASE_URL.replace(/\/api\/?$/i, '');
        return host + (s.startsWith('/') ? s : ('/' + s));
      } catch { return s; }
    }
    if (typeof val === 'object') {
      const candidates = [val.Data, val.data, val.ImageUrl, val.URL, val.url, val.path, val.Path, val.FilePath, val.imageUrl, val.ThumbUrl, val.FileName, val.fileName, val.PathName, val.pathName, val.FilePathName, val.filePathName];
      for (const c of candidates) {
        if (c) {
          const r = resolveImageUrl(c);
          if (r) return r;
        }
      }
    }
    return null;
  };

  const firstImage = (() => {
    try {
      if (Array.isArray(src.image_urls) && src.image_urls.length) {
        const first = src.image_urls[0];
        const r = resolveImageUrl(first);
        if (r) {
          console.debug('FacilityReportCard: resolved firstImage from image_urls', r);
          return r;
        }
      } else if (typeof src.image_urls === 'string') {
        try {
          const parsed = JSON.parse(src.image_urls);
          if (Array.isArray(parsed) && parsed.length) {
            const r = resolveImageUrl(parsed[0]);
            if (r) {
              console.debug('FacilityReportCard: resolved firstImage from parsed image_urls string', r);
              return r;
            }
          }
        } catch { /* ignore */ }
      }
      if (Array.isArray(src.images) && src.images.length) {
        const r = resolveImageUrl(src.images[0]);
        if (r) {
          console.debug('FacilityReportCard: resolved firstImage from images array', r);
          return r;
        }
      }
      if (src.__raw && Array.isArray(src.__raw.images) && src.__raw.images.length) {
        const r = resolveImageUrl(src.__raw.images[0]);
        if (r) {
          console.debug('FacilityReportCard: resolved firstImage from __raw.images', r);
          return r;
        }
      }
      // fallback: some APIs return single image fields
      const fallbacks = [src.ImageUrl, src.URL, src.url, src.imageUrl];
      for (const f of fallbacks) {
        const r = resolveImageUrl(f);
        if (r) {
          console.debug('FacilityReportCard: resolved firstImage from fallback field', r);
          return r;
        }
      }
    } catch (e) { void e; }
    return null;
  })();

  const haveSports = Array.isArray(sportFields) && sportFields.length > 0;
  const reasonText = report?.reason ?? report?.ReportReason ?? report?.Reason ?? report?.ReportDescription ?? report?.description ?? '-';
  const reporterName = report?.reporter?.name || report?.reporter?.fullName || report?.ReporterName || report?.Reporter || report?.ReporterUsername || '-';

  return (
    <div className="p-4">
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="grid grid-cols-12 gap-4 p-4 items-start">
          <div className="col-span-3">
            <div className="w-full h-36 bg-gray-100 rounded overflow-hidden flex items-center justify-center">
              {firstImage ? (
                <img src={firstImage} alt={facilityTitle} className="w-full h-full object-cover" onError={(e)=>{ e.target.onerror=null; e.target.src=''; }} />
              ) : (
                <div className="text-gray-400 text-sm">{tt('report.noImage', 'No image')}</div>
              )}
            </div>
          </div>

          <div className="col-span-6">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold truncate">{facilityTitle}</h3>
              <div className="text-xs text-gray-400">{areaName}{address ? ` · ${address}` : ''}</div>
            </div>
            <div className="mt-2 text-sm text-gray-700 line-clamp-3">{description || tt('report.noDescription', 'No description')}</div>

            <div className="mt-3 flex items-center gap-3">
              <img src={ownerAvatar || DEFAULT_AVATAR} alt={ownerName} className="w-9 h-9 rounded-full object-cover border" />
              <div>
                <div className="text-sm text-gray-700">{tt('report.owner', 'Chủ sân')}: <strong>{ownerName || tt('report.ownerUnknown', 'Unknown')}</strong></div>
                <div className="text-xs text-gray-400">{tt('report.dbIds', 'DB ids')}: <strong>{facilityDBId || facilityId || '-'}</strong></div>
              </div>
            </div>

            {haveSports && (
              <div className="mt-3 flex flex-wrap gap-2">
                {sportFields.slice(0,6).map((sf, idx) => {
                  const fname = sf.FieldName || sf.fieldName || sf.Name || sf.name || sf.Field || `Field ${idx+1}`;
                  const stype = sf.SportName || sf.sportName || sf.Sport || sf.fieldType || '';
                  return (
                    <div key={idx} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded">
                      {fname}{stype ? ` · ${stype}` : ''}
                    </div>
                  );
                })}
                {sportFields.length > 6 && <div className="text-xs text-gray-400">{tt('report.moreFieldsShort', '...more')}</div>}
              </div>
            )}
          </div>

          <div className="col-span-3 flex flex-col gap-3">
            <div className="bg-gray-50 p-3 rounded text-sm text-gray-600">
              <div className="text-xs text-gray-500">{tt('report.reason', 'Lý do')}</div>
              <div className="mt-2 text-sm text-gray-800 font-medium break-words">{reasonText}</div>
              <div className="mt-2 text-xs text-gray-500">{tt('report.reportedBy', 'Báo cáo bởi')}: <strong className="text-sm">{reporterName}</strong></div>
            </div>

            <div className="flex gap-2">
              <button onClick={onDismiss} disabled={!adminEnabled} className="flex-1 px-3 py-2 bg-yellow-100 text-yellow-800 rounded text-sm" title={!adminEnabled ? (t('moderation.loginAsAdmin') || 'Sign in as admin to perform this action') : ''}>{tt('report.dismissReport', 'Đóng')}</button>
              <button onClick={onResolve} disabled={!adminEnabled} className="flex-1 px-3 py-2 bg-green-100 text-green-800 rounded text-sm" title={!adminEnabled ? (t('moderation.loginAsAdmin') || 'Sign in as admin to perform this action') : ''}>{tt('report.resolveReport', 'Xử lý')}</button>
            </div>

            <div className="flex gap-2">
              <button onClick={onDelete} disabled={!adminEnabled} className="flex-1 px-3 py-2 bg-red-100 text-red-700 rounded text-sm" title={!adminEnabled ? (t('moderation.loginAsAdmin') || 'Sign in as admin to perform this action') : ''}>{tt('report.deleteContent', 'Xóa')}</button>
            </div>

            <div className="text-xs text-gray-400 mt-2">{report?.CreatedAt ? new Date(report.CreatedAt).toLocaleString('vi-VN') : ''}</div>

            <div>
              <button
                onClick={() => setRawOpenMap(prev => ({ ...prev, [facilityId || facilityDBId || facilityTitle]: !prev[facilityId || facilityDBId || facilityTitle] }))}
                className="text-xs text-gray-400 hover:text-gray-600 mt-2"
              >{rawOpenMap[facilityId || facilityDBId || facilityTitle] ? (tt('report.hideRaw', 'Hide raw')) : (tt('report.showRaw','Show raw'))}</button>
              {rawOpenMap[facilityId || facilityDBId || facilityTitle] && (
                <pre className="mt-2 p-2 bg-gray-100 text-xs rounded max-h-40 overflow-auto">{JSON.stringify(raw || src, null, 2)}</pre>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FacilityReportCard;
