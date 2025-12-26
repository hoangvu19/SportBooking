import React, { useEffect, useState, useCallback } from 'react';
import { reportAPI } from '../../utils/reportAPI';
import { postAPI, storyAPI } from '../../utils/api';
import { isFlaggedContent, VIETNAMESE_BLACKLIST, VIOLENCE_TOKENS } from '../../utils/moderationBlacklist';
import PostCard from '../../components/Social/PostCard';
import DEFAULT_AVATAR from '../../utils/defaults';
import getBackendOrigin, { toAbsoluteUrl } from '../../utils/urlHelpers';
import toast from 'react-hot-toast';
import { useI18n } from '../../i18n/hooks';
import apiClient, { getAuthInfo } from '../../utils/apiClient';
import { notificationAPI } from '../../utils/api';
import { useNavigate } from 'react-router-dom';
import { normalizeUser } from '../../utils/normalize';

const Moderation = () => {
  const { t } = useI18n();
  const authInfo = getAuthInfo();
  const isAdminAuth = !!(authInfo && authInfo.authToken && (String(authInfo.activeRole || '').toLowerCase().includes('admin')));
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [contentFilter, setContentFilter] = useState('all'); // 'all' | 'posts' | 'stories' | 'bookings' | 'reported'
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [rawItems, setRawItems] = useState([]); // keep original server payloads (used for stories)

  const mapStoryToPost = (s) => {
    if (!s) return null;
    const userObj = s.user || s.User || s.account || s.Author || {};
    const normalized = normalizeUser(userObj || {});
    const mappedUser = {
      _id: normalized?.id || s.UserID || s.userId || s.authorId || null,
      username: normalized?.username || normalized?.fullName || s.authorUsername || '',
      full_name: normalized?.fullName || normalized?.raw?.full_name || normalized?.username || '',
      profile_picture: normalized?.avatar || normalized?.avatarUrl || null,
    };
    // Helper: try to extract a URL-like string from a candidate object/string
    const extractUrlCandidate = (c) => {
      if (!c) return null;
      if (typeof c === 'string') return c;
      if (Array.isArray(c)) return extractUrlCandidate(c[0]);
      if (typeof c === 'object') {
        const keys = ['url','URL','ImageUrl','ImageURL','file','File','FilePath','path','data','Data','Value','value','Thumb','thumbnail','Thumbnail','src'];
        for (const k of keys) {
          if (c[k]) {
            if (typeof c[k] === 'string') return c[k];
            const nested = extractUrlCandidate(c[k]);
            if (nested) return nested;
          }
        }
        // fallback: scan fields for strings that look like urls or image/video extensions
        for (const k of Object.keys(c)) {
          try {
            const v = c[k];
            if (typeof v === 'string' && (/^https?:\/\//i.test(v) || /\.(jpg|jpeg|png|gif|webp|mp4|webm|ogg|mov)(\?|$)/i.test(v))) return v;
            if (typeof v === 'object') {
              const nested = extractUrlCandidate(v);
              if (nested) return nested;
            }
          } catch  { /* ignore */ }
        }
      }
      return null;
    };

    // Collect media candidates from common story fields
    const rawCandidates = [];
    if (s.media) rawCandidates.push(...(Array.isArray(s.media) ? s.media : [s.media]));
    if (s.Media) rawCandidates.push(...(Array.isArray(s.Media) ? s.Media : [s.Media]));
    if (s.files) rawCandidates.push(...(Array.isArray(s.files) ? s.files : [s.files]));
    if (s.Files) rawCandidates.push(...(Array.isArray(s.Files) ? s.Files : [s.Files]));
    if (s.attachments) rawCandidates.push(...(Array.isArray(s.attachments) ? s.attachments : [s.attachments]));
    if (s.Attachments) rawCandidates.push(...(Array.isArray(s.Attachments) ? s.Attachments : [s.Attachments]));
    if (s.items) rawCandidates.push(...(Array.isArray(s.items) ? s.items : [s.items]));
    if (s.images) rawCandidates.push(...(Array.isArray(s.images) ? s.images : [s.images]));
    if (s.image_urls) rawCandidates.push(...(Array.isArray(s.image_urls) ? s.image_urls : [s.image_urls]));
    if (s.imageUrls) rawCandidates.push(...(Array.isArray(s.imageUrls) ? s.imageUrls : [s.imageUrls]));
    if (s.image) rawCandidates.push(s.image);
    if (s.video) rawCandidates.push(s.video);
    // Also consider common alternate fields and nested payloads
    if (s.payload) rawCandidates.push(s.payload);
    if (s.data) rawCandidates.push(s.data);
    if (s.resources) rawCandidates.push(s.resources);
    if (s.resource) rawCandidates.push(s.resource);
    if (s.filesList) rawCandidates.push(s.filesList);
    if (s.assets) rawCandidates.push(s.assets);

    // Deeply traverse the story object to collect any URL-like strings or filenames
    const backendBase = getBackendOrigin();
    const seen = new Set();
    const deepCollectUrls = (obj, depth = 0) => {
      if (!obj || depth > 6) return [];
      const out = [];
      if (typeof obj === 'string') {
        const s = obj.trim();
        if (/^https?:\/\//i.test(s) || /^\/|uploads\//i.test(s) || /\.(jpg|jpeg|png|gif|webp|bmp|svg|mp4|webm|ogg|mov)(\?|$)/i.test(s) || /^data:image|^data:video/i.test(s)) {
          if (!seen.has(s)) { seen.add(s); out.push(s); }
        }
        return out;
      }
      if (Array.isArray(obj)) {
        for (const it of obj) out.push(...deepCollectUrls(it, depth + 1));
        return out;
      }
      if (typeof obj === 'object') {
        // check some likely filename keys
        const filenameKeys = ['filename','fileName','name','file','path','file_path','key','storageKey','url','URL','ImageUrl','ImageURL','src','thumb','thumbnail'];
        for (const k of filenameKeys) {
          if (obj[k]) out.push(...deepCollectUrls(obj[k], depth + 1));
        }
        // then scan all fields shallowly
        for (const k of Object.keys(obj)) {
          try { out.push(...deepCollectUrls(obj[k], depth + 1)); } catch  { /* ignore */ }
        }
      }
      return out;
    };

    const fromCandidates = rawCandidates
      .flatMap(c => Array.isArray(c) ? c : [c])
      .map(c => {
        if (typeof c === 'string') return c;
        const url = extractUrlCandidate(c);
        return url || null;
      })
      .filter(Boolean);

    // Also run a deep collector across the whole story to pick up nested file names or paths
    const deepFound = deepCollectUrls(s);

    // Merge and deduplicate
    const normalizedMedia = Array.from(new Set([...fromCandidates, ...deepFound]));

    // Debug: show normalized media for this story to help adjust mapping
    try {
      console.debug('[Moderation] mapStoryToPost normalizedMedia', { id: s?._id || s?.id || s?.StoryID, normalizedMedia, raw: s });
    } catch  { /* ignore debug errors */ }

    // Separate images vs videos so PostCard renders appropriately
    const imageRegex = /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i;
    const videoRegex = /\.(mp4|webm|ogg|mov)(\?|$)/i;
    // Ensure we convert relative paths and filenames into absolute URLs the frontend can load
    const absNormalized = normalizedMedia.map(u => toAbsoluteUrl(backendBase, u, 'stories') || u).filter(Boolean);
    const images = absNormalized.filter(u => !!u && imageRegex.test(u));
    const videos = absNormalized.filter(u => !!u && (videoRegex.test(u) || /^data:video\//i.test(u)));
    const others = absNormalized.filter(u => !!u && !imageRegex.test(u) && !videoRegex.test(u) && !/^data:video\//i.test(u));

    return {
      _id: s._id || s.id || s.StoryID || ('story-' + (s._id || s.id || Math.random().toString(36).slice(2,8))),
      content: s.caption || s.text || s.Content || s.Description || '',
      image_urls: images.concat(others),
      media_urls: videos,
      user: mappedUser,
      createdAt: s.createdAt || s.CreatedAt || s.postedAt || s.PostedAt || null,
      likes_count: s.views || s.likeCount || 0,
      comments_count: 0,
      shares_count: 0,
      is_story: true,
    };
  };

  const StoryCard = ({ item }) => {
    if (!item) return null;
    const extract = (c) => {
      if (!c) return null;
      if (typeof c === 'string') return c;
      if (Array.isArray(c)) return c.map(extract).filter(Boolean);
      if (typeof c === 'object') {
        const keys = ['url','URL','ImageUrl','ImageURL','file','File','FilePath','path','data','Data','Value','value','Thumb','thumbnail','Thumbnail','src'];
        for (const k of keys) {
          if (c[k]) return extract(c[k]);
        }
        for (const k of Object.keys(c)) {
          const v = c[k];
          if (typeof v === 'string' && (/^https?:\/\//i.test(v) || /\.(jpg|jpeg|png|gif|webp|mp4|webm|ogg|mov)(\?|$)/i.test(v) || /^data:image|^data:video/i.test(v))) return v;
          if (typeof v === 'object') {
            const nested = extract(v);
            if (nested) return nested;
          }
        }
      }
      return null;
    };

    // collect candidate media fields (include common story keys like media_url/media_urls)
    const candidates = [];
    const mediaKeys = ['media','Media','files','Files','attachments','Attachments','items','images','image_urls','imageUrls','image','video','videos','resources','media_url','mediaUrl','media_urls','mediaUrls','file','file_path','path','storageKey','storage_key','url','URL','src'];
    mediaKeys.forEach(k => {
      if (item[k]) {
        if (Array.isArray(item[k])) candidates.push(...item[k]); else candidates.push(item[k]);
      }
    });
    // also include nested payload/data objects if present
    if (item.payload) candidates.push(item.payload);
    if (item.data) candidates.push(item.data);

    // Ensure backend origin is available before coercing URLs
    const backendBase = getBackendOrigin();

    const rawUrls = candidates.flatMap(c => {
      const v = extract(c);
      if (!v) return [];
      if (Array.isArray(v)) return v;
      return [v];
    }).filter(Boolean).map(u => toAbsoluteUrl(backendBase, u, 'stories') || u);

    const imageRegex = /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i;
    const videoRegex = /\.(mp4|webm|ogg|mov)(\?|$)/i;
    const images = rawUrls.filter(u => imageRegex.test(u) || /^data:image/i.test(u));
    const videos = rawUrls.filter(u => videoRegex.test(u) || /^data:video/i.test(u));

    const avatar = item.user?.profile_picture || item.user?.AvatarUrl || item.user?.avatarUrl || DEFAULT_AVATAR;

    return (
      <div className="relative bg-white rounded-lg shadow-md p-4 space-y-2 w-full max-w-3xl">
        <div className="inline-flex items-center gap-3">
          <img src={toAbsoluteUrl(backendBase, avatar, 'avatars') || DEFAULT_AVATAR} alt="" className="w-10 h-10 rounded-full" />
          <div>
            <div className="font-medium">{item.user?.full_name || item.user?.username || item.user?.fullName || 'Người dùng'}</div>
            <div className="text-xs text-gray-400">@{item.user?.username || ''} • {item.createdAt ? item.createdAt : ''}</div>
          </div>
        </div>
        {item.content && <div className="text-sm text-gray-800 whitespace-pre-line">{item.content}</div>}
        {images.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {images.map((src, i) => <img key={i} src={toAbsoluteUrl(backendBase, src, 'stories') || src} className="w-full h-48 object-contain rounded" alt="" />)}
          </div>
        )}
        {videos.length > 0 && (
              <div className="space-y-2">
                {videos.map((src, i) => (
                  <video key={i} src={toAbsoluteUrl(backendBase, src, 'stories') || src} controls className="w-full rounded" preload="metadata" />
                ))}
              </div>
            )}
      </div>
    );
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Load according to selected content filter
      if (contentFilter === 'reported') {
        const res = await reportAPI.getAll({ status: 'pending' });
        if (res && res.success) setReports(res.data || []);
        else setReports([]);
      } else if (contentFilter === 'stories') {
        const res = await storyAPI.getActive();
        console.debug('storyAPI.getActive response', res);
        if (res && res.success) {
          // Normalize possible response shapes: data may be an array or an object wrapping an array
          let stories = [];
          if (Array.isArray(res.data)) stories = res.data;
          else if (Array.isArray(res.data?.stories)) stories = res.data.stories;
          else if (Array.isArray(res.data?.data)) stories = res.data.data;
          else stories = [];
          // map stories into post-shaped objects so PostCard can render them
          const mapped = stories.map(s => mapStoryToPost(s));
          // keep originals so we can render StoryCard when mapping didn't find media
          setRawItems(stories || []);
          // For mapped stories that lack content/media, attempt to fetch detail from /stories/:id
          const needDetailIdx = [];
          mapped.forEach((m, i) => {
            if ((!m || (!m.content || String(m.content).trim() === '')) && (!m || ((!m.image_urls || m.image_urls.length === 0) && (!m.media_urls || m.media_urls.length === 0)))) {
              // attempt detail fetch if story id available
              const original = stories[i];
              const sid = original?._id || original?.id || original?.StoryID;
              if (sid) needDetailIdx.push({ idx: i, id: sid });
            }
          });
          if (needDetailIdx.length > 0) {
            try {
              const detailPromises = needDetailIdx.map(x => storyAPI.getById(x.id).catch(() => null));
              const details = await Promise.all(detailPromises);
              details.forEach((d, j) => {
                const target = needDetailIdx[j];
                if (d && d.success) {
                  const detailObj = d.data || d.data?.story || d;
                  const remapped = mapStoryToPost(detailObj);
                  if (remapped) mapped[target.idx] = remapped;
                }
              });
            } catch  { /* ignore detail failures */ }
          }
          // Prioritize mapped stories too (spam detection uses content field)
          const prioritizedStories = (mapped || []).slice().sort((a,b) => {
            const aNeeds = !!(a && (a.__moderation || a.NeedsReview || a.needsReview || a.Status === 'PendingReview'));
            const bNeeds = !!(b && (b.__moderation || b.NeedsReview || b.needsReview || b.Status === 'PendingReview'));
            if (aNeeds !== bNeeds) return aNeeds ? -1 : 1;
            const aSpam = isFlaggedContent(a?.content || a?.Content || '');
            const bSpam = isFlaggedContent(b?.content || b?.Content || '');
            if (aSpam !== bSpam) return aSpam ? -1 : 1;
            return 0;
          });
          setReports(prioritizedStories);
        } else setReports([]);
      } else {
        // 'all' or 'posts' or 'bookings' -> fetch posts and optionally filter booking posts
        const res = await postAPI.getFeed(1, 50, true); // first 50 posts, bypass cache
        if (res && res.success) {
          let postsArray = res.data.posts || res.data || [];
            // Prioritize obvious spam / flagged items so moderators see them first
            const prioritize = (arr) => {
              if (!Array.isArray(arr)) return arr;
              return arr.slice().sort((a, b) => {
                const aText = (a?.content || a?.Content || '').toString();
                const bText = (b?.content || b?.Content || '').toString();

                // Server-side moderation hint
                const aNeeds = !!(a && (a.__moderation || a.NeedsReview || a.needsReview || a.Status === 'PendingReview'));
                const bNeeds = !!(b && (b.__moderation || b.NeedsReview || b.needsReview || b.Status === 'PendingReview'));
                if (aNeeds !== bNeeds) return aNeeds ? -1 : 1;

                // Client-side spam tokens and broader heuristics
                const aSpam = isFlaggedContent(aText);
                const bSpam = isFlaggedContent(bText);
                if (aSpam !== bSpam) return aSpam ? -1 : 1;

                // fallback: preserve original order
                return 0;
              });
            };

            postsArray = prioritize(postsArray);
          if (contentFilter === 'bookings') {
            postsArray = (postsArray || []).filter(p => !!(p.booking || p.Booking || p.is_booking || p.BookingStatus || p.FacilityName));
          }
          setReports(postsArray);
        } else {
          setReports([]);
        }
      }
    } catch (err) {
      console.error('Error loading moderation list', err);
      toast.error(t('report.loadError') || 'Không thể tải danh sách bài viết');
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [t, contentFilter]);

  useEffect(() => {
    load();
  }, [load]);

  // Listen for post updates (e.g., after an admin marks safe) and reload list
  useEffect(() => {
    const onPostUpdated = () => {
      try {
        // refresh moderation list to reflect status changes
        load();
      } catch (err) {
        console.debug('post:updated handler error', err);
      }
    };
    window.addEventListener('post:updated', onPostUpdated);
    return () => window.removeEventListener('post:updated', onPostUpdated);
  }, [load]);

  const getReportId = (r) => r?.ReportID ?? r?.ReportId ?? r?._id ?? r?.id ?? r?.Id ?? null;

  const normalizeToArray = (v) => {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    if (typeof v === 'string') {
      try {
        // sometimes it's JSON-encoded
        const parsed = JSON.parse(v);
        if (Array.isArray(parsed)) return parsed;
      } catch{ /* ignore */ }
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
  };

  const mapReportedToPost = (reportRow) => {
    if (!reportRow) return null;
    let rc = reportRow;
    if (typeof rc === 'string') {
      try { rc = JSON.parse(rc); } catch  { /* leave string */ }
    }
    if (rc && typeof rc === 'object') {
      if (rc.ReportedContent || rc.reportedContent) rc = rc.ReportedContent || rc.reportedContent;
      else if (rc.Content && typeof rc.Content === 'object') rc = rc.Content;
      else if (rc.content && typeof rc.content === 'object') rc = rc.content;
      // otherwise rc is already an object (possibly frontend-shaped), keep it
    }

    // Some backends wrap the reported payload inside a `Post` or `PostData` field
    const candidatePost = rc.Post || rc.post || rc.PostData || rc.PostContent || rc.Payload || rc;

    // Attempt to locate the canonical post object inside candidatePost
    const postObj = candidatePost && (candidatePost._id || candidatePost.PostID || candidatePost.PostId || candidatePost.id || candidatePost.content) ? candidatePost : rc;

    // Normalize user info using shared helper so we cover many shapes
    const userObj = postObj.user || postObj.User || postObj.author || postObj.Author || postObj.Account || postObj.ReportedBy || postObj.Reporter || reportRow.user || reportRow.User || reportRow.Reporter || {};
    const normalized = normalizeUser(userObj || {});
    const mappedUser = {
      _id: normalized?.id || normalized?.raw?._id || normalized?.raw?.id || postObj.AccountID || postObj.AccountId || reportRow.UserID || reportRow.ReporterID || null,
      username: normalized?.username || normalized?.fullName || postObj.AuthorUsername || reportRow.ReporterUsername || '',
      // PostCard expects `full_name`; preserve both conventions
      full_name: normalized?.fullName || normalized?.raw?.full_name || postObj.AuthorName || reportRow.ReporterName || normalized?.username || '',
      profile_picture: normalized?.avatar || normalized?.avatarUrl || normalized?.raw?.profile_picture || postObj.AuthorAvatar || reportRow.ReporterAvatar || null,
    };

    // Normalize media fields into arrays
    const rawImages = postObj.MediaURLs || postObj.media_urls || postObj.image_urls || postObj.Images || postObj.images || postObj.ImageUrls || postObj.ImageUrl || postObj.media || null;
    // also check top-level report row fields if postObj has none
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

      // Ensure we have a display name fallback
      if (!mapped.user.full_name || mapped.user.full_name.trim() === '') {
        mapped.user.full_name = mapped.user.username || mapped.user._id || 'Unknown User';
      }

    return mapped;
  };

  // small debug: help inspect mapped posts for moderation (safe in dev)
  const debugMapped = (r, m) => {
    try {
      if (!m) return;
      // log cases where name/avatar/media are missing to help debugging
      if (!m.user || !m.user.full_name || (!m.image_urls || m.image_urls.length === 0)) {
        console.debug('[Moderation] mapped post', { reportId: getReportId(r), post: m });
      }
    } catch  { /* ignore */ }
  };

  const RawInspector = ({ data }) => {
    const [open, setOpen] = useState(false);
    return (
      <div className="mt-2">
        <button onClick={() => setOpen(v => !v)} className="text-xs text-gray-500 underline">{open ? 'Hide raw payload' : 'Show raw payload'}</button>
        {open && (
          <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-60">{JSON.stringify(data, null, 2)}</pre>
        )}
      </div>
    );
  };

  const handleDelete = async (report) => {
    // Support deleting either a report row (admin action) or a post object from the feed.
    const rid = getReportId(report);
    const isReportRow = report && (report.ReportID || report.ReportId);
    if (!isReportRow) {
      // treat as post object
      const postId = report?._id || report?.PostID || report?.id || null;
      if (!postId) return toast.error(t('report.invalidId') || 'ID bài viết không hợp lệ');
      if (!window.confirm(t('report.confirmDelete') || 'Bạn có chắc chắn muốn xóa nội dung này?')) return;
      setProcessing(true);
      try {
        const resp = await postAPI.delete(postId);
        if (resp && resp.success) {
          toast.success(t('report.contentDeleted') || 'Nội dung đã bị xóa');
          load();
        } else {
          toast.error(resp?.message || t('report.actionError') || 'Có lỗi xảy ra');
        }
      } catch (err) {
        console.error('Delete error', err);
        if (err && err.status === 401) {
          console.warn('[Moderation] Unauthorized while deleting post', getAuthInfo());
          toast.error(t('moderation.unauthorized') || 'Không được phép — vui lòng đăng nhập bằng tài khoản admin');
        } else {
          toast.error(err?.message || t('report.actionError') || 'Có lỗi xảy ra');
        }
      } finally { setProcessing(false); }
      return;
    }

    // otherwise this is a report row; call report API to resolve/delete
    if (!rid) return toast.error(t('report.invalidId') || 'ID báo cáo không hợp lệ');
    if (!window.confirm(t('report.confirmDelete') || 'Bạn có chắc chắn muốn xóa nội dung này?')) return;
    setProcessing(true);
    try {
      const r = await reportAPI.update(rid, 'resolved', 'Deleted by admin', true);
      if (r && r.success) {
        toast.success(t('report.contentDeleted') || 'Nội dung đã bị xóa');
        load();
      } else {
        toast.error(r?.message || t('report.actionError') || 'Có lỗi xảy ra');
      }
    } catch (err) {
      console.error('Delete error', err);
      if (err && err.status === 401) {
        console.warn('[Moderation] Unauthorized while deleting report', getAuthInfo());
        toast.error(t('moderation.unauthorized') || 'Không được phép — vui lòng đăng nhập bằng tài khoản admin');
      } else {
        toast.error(err?.message || t('report.actionError') || 'Có lỗi xảy ra');
      }
    } finally { setProcessing(false); }
  };


  const handleWarn = async (report) => {
    // try to resolve warned user id from mapped post or report metadata
    const mapped = mapReportedToPost(report);
    const userId = mapped?.user?._id || mapped?.user?.id || report?.UserID || report?.ReporterID || report?.ReporterId || null;
    if (!userId) return toast.error(t('moderation.noUserToWarn') || 'Không có người dùng để cảnh cáo');
    const note = window.prompt(t('moderation.warnPrompt') || 'Enter warning note to send to user:', 'Please stop violating our rules');
    if (note === null) return; // cancelled
    setProcessing(true);
    try {
      // Preferred: use notificationAPI.send (admin endpoint we added) to send a notification to the user
      try {
        const content = t('moderation.warnNotificationContent', 'You have received a moderation warning: {note}').replace('{note}', note || '');
        const res = await notificationAPI.send({ recipientId: Number(userId), type: 'moderation_warning', content });
        if (res && res.success) {
          toast.success(t('moderation.warnSent') || 'Cảnh cáo đã được gửi');
        } else {
          toast.error(res?.message || t('moderation.warnFailed') || 'Không thể gửi cảnh cáo');
        }
      } catch (innerErr) {
        console.warn('notificationAPI.send failed', innerErr);
        if (innerErr && innerErr.status === 401) {
          console.warn('[Moderation] Unauthorized while sending notification', getAuthInfo());
          toast.error(t('moderation.unauthorized') || 'Không được phép — vui lòng đăng nhập bằng tài khoản admin');
        } else {
          // fallback: try legacy moderation endpoint if present
          try {
            await apiClient.post(`/moderation/warn`, { userId, note });
            toast.success(t('moderation.warnSent') || 'Cảnh cáo đã được gửi');
          } catch (legacyErr) {
            console.warn('legacy warn endpoint missing or failed', legacyErr);
            // fallback: add admin note and mark report reviewed
            const rid = getReportId(report);
            if (rid) await reportAPI.update(rid, 'reviewed', `Warned user: ${note}`, false);
            toast(t('moderation.warnQueuedFallback') || 'Cảnh cáo đã được ghi nhận (đang chờ xử lý)', { icon: '⚠️' });
          }
        }
      }
      load();
    } catch (err) {
      console.error('Warn error', err);
        if (err && err.status === 401) {
          console.warn('[Moderation] Unauthorized while warning user', getAuthInfo());
          toast.error(t('moderation.unauthorized') || 'Không được phép — vui lòng đăng nhập bằng tài khoản admin');
        } else {
          toast.error(t('report.actionError') || 'Có lỗi xảy ra');
        }
    } finally { setProcessing(false); }
  };

  const sanitizeContent = (text) => {
    if (!text) return text;
    let out = text;
    try {
      const combined = [...(VIETNAMESE_BLACKLIST || []), ...(VIOLENCE_TOKENS || [])];
      for (const token of combined) {
        if (!token) continue;
        const esc = token.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
        out = out.replace(new RegExp(esc, 'gi'), '');
      }
      // collapse extra spaces and trim
      out = out.replace(/\s{2,}/g, ' ').trim();
    } catch (e) {
      console.warn('Sanitize error', e);
    }
    return out;
  };

  const handleSafe = async (report) => {
    // 'An toàn' action: remove red/blacklisted phrases from post content
    const mapped = mapReportedToPost(report);
    const postId = mapped?._id || mapped?.PostID || mapped?.id || null;
    if (!postId) return toast.error(t('report.invalidId') || 'ID bài viết không hợp lệ');
    const original = (mapped && (mapped.content || mapped.Content || '')) || '';
    if (!original || String(original).trim() === '') return toast.error(t('moderation.noContent') || 'Không có nội dung để chỉnh sửa');

    const cleaned = sanitizeContent(String(original));
    let willEditContent = true;
    if (cleaned === String(original)) {
      // If nothing to remove, offer to mark safe without editing content
      const proceedKeep = window.confirm(t('moderation.noRedFoundKeepConfirm') || 'Không tìm thấy phần cần xóa — bạn có muốn đánh dấu bài an toàn mà không xóa nội dung?');
      if (!proceedKeep) {
        toast(t('moderation.noRedFound') || 'Không tìm thấy phần cần xóa');
        return;
      }
      willEditContent = false;
    }

    if (!window.confirm(t('moderation.confirmSafe') || 'Bạn có muốn xóa phần bị gạch đỏ và đánh dấu bài là an toàn?')) return;

    setProcessing(true);
    try {
      // update content and ensure post status is cleared from pending moderation
      const updatePayload = { Status: 'Active', status: 'Active' };
      if (willEditContent) updatePayload.content = cleaned;
      const resp = await postAPI.update(postId, updatePayload);
      if (resp && resp.success) {
        // Also mark related report as dismissed/resolved so the UI no longer shows "pending"
        try {
          const rid = getReportId(report);
          if (rid) await reportAPI.update(rid, 'dismissed', t('moderation.safeAdminNote') || 'Marked safe by admin', false);
        } catch (reportErr) {
          console.warn('Could not update report status after safe action', reportErr);
        }
        toast.success(t('moderation.safeSuccess') || 'Đã xóa phần không an toàn và cập nhật bài viết');
        // Notify other parts of the app about the updated post so UI updates immediately
        try {
          const updatedPost = Object.assign({}, mapped || {}, { content: (willEditContent ? cleaned : original), Status: 'Active', status: 'Active', __moderation_cleared: true });
          try { window.dispatchEvent(new CustomEvent('post:updated', { detail: { post: updatedPost } })); } catch(e) { console.debug('Could not dispatch post:updated', e); }
        } catch(e) { console.debug('post update notify error', e); }
        load();
      } else {
        toast.error(resp?.message || t('report.actionError') || 'Có lỗi xảy ra');
      }
    } catch (err) {
      console.error('Safe action error', err);
      if (err && err.status === 401) {
        console.warn('[Moderation] Unauthorized while performing safe action', getAuthInfo());
        toast.error(t('moderation.unauthorized') || 'Không được phép — vui lòng đăng nhập bằng tài khoản admin');
      } else {
        toast.error(t('report.actionError') || 'Có lỗi xảy ra');
      }
    } finally { setProcessing(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">{t('moderation.title') || 'Content Moderation'}</h1>
          <p className="text-gray-600">{t('moderation.description') || 'Review flagged content and take action.'}</p>
          <div className="mt-3 flex gap-2">
            {[
              { key: 'all', label: t('moderation.filter.all') || 'All' },
              { key: 'posts', label: t('moderation.filter.posts') || 'Posts' },
              { key: 'stories', label: t('moderation.filter.stories') || 'Stories' },
              { key: 'bookings', label: t('moderation.filter.bookings') || 'Bookings' },
              { key: 'reported', label: t('moderation.filter.reported') || 'Reported' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setContentFilter(f.key)}
                className={`px-3 py-1 rounded ${contentFilter === f.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow divide-y">
          {!isAdminAuth && (
            <div className="p-3 bg-yellow-50 border-l-4 border-yellow-400 text-sm text-yellow-800 flex items-center justify-between">
              <div>{t('moderation.needsAdmin') || 'Bạn chưa đăng nhập với tài khoản admin — một số hành động bị vô hiệu hóa.'}</div>
              <div className="flex gap-2">
                <button onClick={() => navigate('/login')} className="px-3 py-1 bg-blue-600 text-white rounded text-sm">{t('moderation.loginAsAdmin') || 'Sign in as admin'}</button>
                <button onClick={() => { console.log('Auth info:', getAuthInfo()); alert('See console for auth info.'); }} className="px-3 py-1 bg-gray-100 text-gray-800 rounded text-sm">Debug</button>
              </div>
            </div>
          )}
          {loading ? (
            <div className="p-6 text-center">{t('common.loading') || 'Đang tải...'}</div>
          ) : reports.length === 0 ? (
            <div className="p-6 text-center text-gray-500">{t('moderation.noItems') || 'No items to moderate'}</div>
          ) : (
            reports.map((r, idx) => {
              const rid = getReportId(r);
              // For stories we keep originals in `rawItems` (parallel array)
              const rawFromList = rawItems && rawItems[idx] ? rawItems[idx] : null;
              // Prefer reportedContent directly if it's already frontend-shaped (for reported filter)
              const rawReported = rawFromList || r?.reportedContent || r?.ReportedContent || r;

              // If this is a reported row, try to map it; otherwise assume `r` is already a post-shaped object
              const asPost = (rawReported && typeof rawReported === 'object' && (rawReported._id || rawReported.PostID || rawReported.image_urls || rawReported.media_urls))
                ? rawReported
                : (contentFilter === 'reported' ? mapReportedToPost(r) : r);

              // debug if media missing
              try {
                if (asPost && Array.isArray(asPost.image_urls) && asPost.image_urls.length === 0 && Array.isArray(asPost.media_urls) && asPost.media_urls.length === 0) {
                  console.debug('[Moderation] mapped post missing media', { reportId: getReportId(r), reportedRaw: rawReported, mapped: asPost });
                }
              } catch { /* ignore */ }

              const mapped = asPost;
              debugMapped(r, mapped);
              const key = rid || ('rep-' + Math.random().toString(36).slice(2,8));

              const isStoriesView = contentFilter === 'stories';

              return (
                <div key={key} className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      {isStoriesView ? (
                        // In Stories view always render the original story payload with StoryCard
                        <StoryCard item={rawFromList || r} />
                      ) : mapped ? (
                        <PostCard post={mapped} disableUserNavigation={true} />
                      ) : (
                        <div className="p-3 bg-gray-50 rounded text-sm">{rawReported?.Content || rawReported?.content || JSON.stringify(rawReported).slice(0,300)}</div>
                      )}
                      <RawInspector data={rawReported} />
                    </div>
                    <div className="w-44 flex flex-col gap-2">
                      <button disabled={processing || !isAdminAuth} onClick={() => handleDelete(r)} className="px-3 py-2 bg-red-600 text-white rounded" title={!isAdminAuth ? (t('moderation.loginAsAdmin') || 'Sign in as admin to perform this action') : ''}>{t('moderation.delete') || 'Delete'}</button>
                      <button disabled={processing || !isAdminAuth} onClick={() => handleWarn(r)} className="px-3 py-2 bg-blue-600 text-white rounded" title={!isAdminAuth ? (t('moderation.loginAsAdmin') || 'Sign in as admin to perform this action') : ''}>{t('moderation.warn') || 'Warn User'}</button>
                      <button disabled={processing || !isAdminAuth} onClick={() => handleSafe(r)} className="px-3 py-2 bg-green-600 text-white rounded" title={!isAdminAuth ? (t('moderation.loginAsAdmin') || 'Sign in as admin to perform this action') : ''}>{t('moderation.safe') || 'An toàn'}</button>
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

export default Moderation;
