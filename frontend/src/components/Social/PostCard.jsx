import React, { useState, useEffect, useRef } from "react";
import DEFAULT_AVATAR from "../../utils/defaults";
import toast from 'react-hot-toast';
import { BadgeCheck, Heart, MessageCircle, Share2, MoreHorizontal, Flag } from 'lucide-react';
import { useNavigate, useLocation } from "react-router-dom";
import { reactionAPI, commentAPI, shareAPI, postAPI, facilityAPI } from "../../utils/api";
import useAuth from "../../hooks/useAuth";
import { normalizeUser } from '../../utils/normalize';
import PostModal from './PostModal';
import ShareModal from './ShareModal';
import BookingStatusCard from './BookingStatusCard';
import { bookingPostAPI } from '../../utils/bookingPostAPI';
import { useI18n } from '../../i18n/hooks';
import getBackendOrigin, { toAbsoluteUrl } from '../../utils/urlHelpers';
import { formatTimeAgo } from '../../utils/timeFormat';
import ReportModal from '../Shared/ReportModal';
import { isFlaggedContent } from '../../utils/moderationBlacklist';


// Top-level robust extractor to find an image URL inside various shapes (string, object, array)
function extractUrl(candidate) {
    if (!candidate) return null;
    if (typeof candidate === 'string') return candidate;
    if (Array.isArray(candidate)) {
        for (const c of candidate) {
            const found = extractUrl(c);
            if (found) return found;
        }
        return null;
    }
    if (typeof candidate === 'object') {
        const picks = ['ImageUrl','ImageURL','URL','url','image_url','imageUrl','FileName','fileName','FilePath','path','Data','data','Value','value','Thumb','Thumbnail','thumbnail'];
        for (const k of picks) {
            if (candidate[k]) {
                const v = candidate[k];
                if (typeof v === 'string') return v;
                const nested = extractUrl(v);
                if (nested) return nested;
            }
        }
        for (const key of Object.keys(candidate)) {
            try {
                const v = candidate[key];
                if (typeof v === 'string') {
                    if (/^https?:\/\//i.test(v) || /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(v)) return v;
                } else if (typeof v === 'object') {
                    const nested = extractUrl(v);
                    if (nested) return nested;
                }
            } catch (e) { void e; }
        }
    }
    return null;
}


const PostCard = ({post, disableUserNavigation = false, showModerationFlags = true}) => {
    const { t } = useI18n();

    const rawContent = post?.content || '';
    const postWithHashtags = rawContent.replace(/#(\w+)/g, '<span class="text-indigo-600 ">#$1</span>');

    // Booking post detection: prefer normalized `post.booking` (set by transformers)
    // Fall back to legacy shapes to be defensive.
    const isBookingPost = !!(
        post?.booking ||
        post?.Booking ||
        post?.BookingID ||
        post?.is_booking ||
        (post?.PostID && post?.FieldName)
    );

    // normalize likes: use number for count and boolean for whether current user liked
    // canonical postId to support both booking-origin posts and normal posts
    const postId = post?._id || post?.PostID || post?.PostId || post?.id;

    // root ref for viewport detection; defer heavy per-post network calls until visible
    const rootRef = useRef(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (!rootRef.current) return;
        const io = new IntersectionObserver((entries) => {
            entries.forEach(e => {
                if (e.isIntersecting) {
                    setIsVisible(true);
                    io.disconnect();
                }
            });
        }, { root: null, rootMargin: '200px', threshold: 0.1 });
        io.observe(rootRef.current);
        return () => io.disconnect();
    }, []);

    // Helper to check whether an id is a positive integer (backend expects numeric postId)
    const isNumericId = (id) => {
        if (id === null || id === undefined) return false;
        if (typeof id === 'number') return Number.isInteger(id) && id > 0;
        if (typeof id === 'string') return /^\d+$/.test(id);
        return false;
    };
    const [likes, setLikes] = useState(typeof post.likes_count === 'number' ? post.likes_count : (post.likes_count && post.likes_count.length) || 0);
    const [liked, setLiked] = useState(!!post.liked_by_current_user);
    const [isLiking, setIsLiking] = useState(false);
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();
    const [modalOpen, setModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(post.content || '');
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);
    const [commentPreview, setCommentPreview] = useState(null);
    const [commentsCount, setCommentsCount] = useState(post.comments_count || 0);
    const [sharedByUser, setSharedByUser] = useState(false);
    const [sharesCount, setSharesCount] = useState(post.shares_count || 0);
    // embedded shared post full data (used when a shared post references a booking but lacks full booking fields)
    const [embeddedPost, setEmbeddedPost] = useState(null);
    const [reportModalOpen, setReportModalOpen] = useState(false);
    // sharing is handled by the ShareModal; no local isSharing flag needed
    const [shareModalOpen, setShareModalOpen] = useState(false);

    const handleLike = async () => {
        if (isLiking) return; // Prevent double click
        
        try {
            setIsLiking(true);
            
            // Optimistic UI update
            const newLiked = !liked;
            // apply optimistic
            setLiked(newLiked);
            setLikes(prev => newLiked ? (prev || 0) + 1 : Math.max(0, (prev || 0) - 1));

            // Call API
            const response = await reactionAPI.toggleLike(postId);

            if (!response.success) {
                // Revert on error
                setLiked(!newLiked);
                setLikes(prev => !newLiked ? (prev || 0) + 1 : Math.max(0, (prev || 0) - 1));
                console.error('Like failed:', response.message);
            } else {
                // Server indicates action: created, removed, updated
                const action = response.data?.action;

                // If server action matches optimistic action, do nothing (we already applied optimistic change)
                // If it contradicts, adjust accordingly.
                if (action === 'created') {
                    // Server created a reaction. If optimistic already set liked true, nothing to do.
                    if (!newLiked) {
                        // optimistic thought it was a removal, but server created -> correct state
                        setLiked(true);
                        setLikes(prev => (prev || 0) + 1);
                    }
                } else if (action === 'removed') {
                    // Server removed reaction. If optimistic already set liked false, nothing to do.
                    if (newLiked) {
                        // optimistic thought it was created, but server removed -> revert
                        setLiked(false);
                        setLikes(prev => Math.max(0, (prev || 0) - 1));
                    }
                } else if (action === 'updated') {
                    // Reaction changed type (not used for simple Like toggles). Keep liked true.
                    setLiked(true);
                }
            }
        } catch (error) {
            // Revert on error
            setLiked(!liked);
            setLikes(prev => !liked ? Math.max(0, (prev || 0) - 1) : (prev || 0) + 1);
            console.error('Error toggling like:', error);
        } finally {
            setIsLiking(false);
        }
    };

    // initialize likes/liked from backend authoritative values
    useEffect(() => {
        // close menu when clicking outside
        const onDocClick = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, []);

    useEffect(() => {
        if (!isVisible) return;
        let mounted = true;
        const loadReactionState = async () => {
            try {
                if (!postId) return;
                if (!isNumericId(postId)) {
                    return;
                }
                const [countsRes, userRes] = await Promise.all([
                    reactionAPI.getCounts(postId),
                    reactionAPI.getUserReaction(postId)
                ]);

                if (!mounted) return;

                if (countsRes && countsRes.success && Array.isArray(countsRes.data)) {
                    const total = countsRes.data.reduce((s, c) => s + (c.Count || c.count || 0), 0);
                    setLikes(total);
                }

                if (userRes && userRes.success) {
                    setLiked(!!userRes.data);
                }
            } catch {
                // ignore
            }
        };
        loadReactionState();
        return () => { mounted = false; };
    }, [postId, post.comments_count, isVisible]);

    // Load a small comment preview and comments count so the inline preview renders
    useEffect(() => {
        if (!isVisible) return;
        let mounted = true;
        const loadCommentPreview = async () => {
            try {
                if (!postId) return;
                if (!isNumericId(postId)) return;
                const res = await commentAPI.getByPostId(postId).catch(() => null);
                if (!mounted) return;
                const commentsArr = (res && res.data && Array.isArray(res.data.comments)) ? res.data.comments : (Array.isArray(res && res.data) ? res.data : []);
                if (Array.isArray(commentsArr)) {
                    setCommentsCount(commentsArr.length);
                    if (commentsArr.length > 0) {
                        // show the most recent comment as preview
                        const last = commentsArr[commentsArr.length - 1];
                        setCommentPreview(last);
                    }
                }
            } catch {
                // ignore preview failures
            }
        };
        loadCommentPreview();
        return () => { mounted = false; };
    }, [postId, isVisible]);

    // Listen for realtime comment events so counts/preview update without reload
    useEffect(() => {
        const handler = (ev) => {
            try {
                const payload = ev && ev.detail ? ev.detail : ev;
                const c = payload && payload.comment ? payload.comment : payload;
                const pid = c && (c.PostID || c.postId || c.PostId || c.postID || c.postId);
                if (!pid) return;
                if (String(pid) === String(postId)) {
                    setCommentsCount((n) => (n || 0) + 1);
                    // update preview to latest comment
                    setCommentPreview(c);
                }
            } catch { /* ignore */ }
        };

        window.addEventListener('comment:created', handler);
        return () => window.removeEventListener('comment:created', handler);
    }, [postId]);

    // Determine if current user is owner to show edit/delete
    // Use shared normalizeUser so ownership logic matches AuthProvider normalization.
    // Keep legacy fallbacks for robustness against differently-shaped payloads.
    const normalizedCurrent = normalizeUser(currentUser || {});
    const normalizedPostUser = normalizeUser(post?.user || post || {});

    const primaryCurrentId = normalizedCurrent && (normalizedCurrent.id || normalizedCurrent.ID || normalizedCurrent._id) ? (normalizedCurrent.id || normalizedCurrent.ID || normalizedCurrent._id) : null;
    const primaryPostUserId = normalizedPostUser && (normalizedPostUser.id || normalizedPostUser.ID || normalizedPostUser._id) ? (normalizedPostUser.id || normalizedPostUser.ID || normalizedPostUser._id) : null;

    const legacyCurrentId = currentUser?.id || currentUser?.AccountID || currentUser?._id || currentUser?.userId || null;
    const getPostOwnerId = (p) => {
        if (!p) return null;
        const u = p.user || {};
        return u._id || u.AccountID || u.id || p.AccountID || p.OwnerAccountID || p.OwnerID || (p.Owner && (p.Owner._id || p.Owner.AccountID)) || p.UserID || p.userId || null;
    };

    const legacyPostOwnerId = getPostOwnerId(post);

    const isOwner = (
        (primaryCurrentId && primaryPostUserId && String(primaryCurrentId) === String(primaryPostUserId)) ||
        (legacyCurrentId && legacyPostOwnerId && String(legacyCurrentId) === String(legacyPostOwnerId))
    );

    // Detect pending moderation state (backend may set `Status` or attach `__moderation`)
    const backendPending = !!(
        (post && (post.Status === 'PendingReview' || post.status === 'PendingReview')) ||
        post && (post.__moderation || post.needsReview)
    );

    // Lightweight client-side detection: if backend hasn't logged moderation yet,
    // detect obvious obscene keywords and show the same red-flag UX so users/admins
    // see violating posts immediately. This is a temporary UX enhancement.
    const clientFlagged = isFlaggedContent(post?.content || post?.Content || '');

    // If the backend has already marked this post `Active` (admin cleared),
    // prefer the server's status and ignore client heuristic flags so UI does
    // not keep showing the red "Pending review" badge after an admin action.
    const postStatus = (post && (post.Status || post.status || '') || '').toString().toLowerCase();
    const clientFlaggedEffective = clientFlagged && postStatus !== 'active' && !post.__moderation_cleared;

    const isPendingModeration = backendPending || clientFlaggedEffective;

    // Detect if current user is admin
    const currentRoles = Array.isArray(currentUser && currentUser.roles) ? currentUser.roles : [];
    const currentRoleNames = currentRoles.map(r => (r.roleName || r.RoleName || '').toString().toLowerCase());
    const currentIsAdmin = currentRoleNames.some(rn => rn.includes('admin'));
    // Determine if we are on the admin moderation page (only show moderation flags there)
    const location = useLocation();
    const onAdminModerationPage = location && typeof location.pathname === 'string' && location.pathname.includes('/admin/moderation');

    // final decision: show moderation UI only if current user is admin, the post is pending,
    // and either we're on admin moderation page or the caller explicitly asked to show moderation flags
    const shouldShowModeration = currentIsAdmin && isPendingModeration && (onAdminModerationPage || !!showModerationFlags);

    // on mount, check if current user has shared
    useEffect(() => {
        if (!isVisible) return;
        let mounted = true;
        const checkShared = async () => {
            try {
                if (!postId) return;
                // collect postId + any shared_post chain ids so reshares count toward total
                const collectIds = (p) => {
                    const ids = [];
                    if (!p) return ids;
                    const pushId = (x) => {
                        const id = x?._id || x?.PostID || x?.PostId || x?.id;
                        if (id) ids.push(id);
                    };
                    pushId(p);
                    let cur = p.shared_post;
                    while (cur) {
                        pushId(cur);
                        cur = cur.shared_post;
                    }
                    return Array.from(new Set(ids));
                };

                const ids = collectIds(post).filter(isNumericId);
                if (ids.length === 0) return;

                // check if user shared any of these
                const checks = await Promise.all(ids.map((id) => shareAPI.checkUserShared(id).catch(() => null)));
                if (!mounted) return;
                const anyShared = checks.some((r) => r && r.success && !!r.data?.hasShared);
                setSharedByUser(anyShared);

                // fetch counts for all related ids and sum
                const counts = await Promise.all(ids.map((id) => shareAPI.getCount(id).catch(() => null)));
                if (!mounted) return;
                const total = counts.reduce((s, r) => s + ((r && r.success && r.data && Number(r.data.count)) ? Number(r.data.count) : 0), 0);
                setSharesCount(total);
            } catch {
                // ignore
            }
        };
        checkShared();
        return () => { mounted = false; };
    }, [postId, post, isVisible]);

    // If the post is a share, attempt to render the embedded original.
    // For re-shares (A <- B <- C) we try to find the booking-origin post by traversing
    // the shared_post chain. Backend PostDAL.getById now attaches Booking data when BookingID present,
    // so we should see booking fields in shared_post if they exist.
    useEffect(() => {
        const sp = post?.shared_post;
        if (!sp) { setEmbeddedPost(null); return; }

        // Check if shared_post already has booking data (from backend enhancement or Profile enrichment)
        const hasBooking = (obj) => !!(
            obj?.Booking ||
            obj?.booking ||
            obj?.FacilityName ||
            obj?.FieldName ||
            obj?.TotalAmount ||
            (obj?.BookingID && obj?.booking) // If BookingID exists and booking object is present
        );

        // Traverse chain to find any ancestor that already includes booking fields
        let cur = sp;
        let bookingAncestor = null;
        while (cur) {
            if (hasBooking(cur)) {
                bookingAncestor = cur;
                break;
            }
            cur = cur.shared_post;
        }

        if (bookingAncestor) {
            console.debug('[PostCard] ✅ Found booking data in shared_post chain', { postId: postId, hasBookingObject: !!bookingAncestor.booking });
            setEmbeddedPost(bookingAncestor);
            return;
        }

        // No booking data found in chain; attempt to fetch booking-post details
        // from booking-posts endpoint as a fallback (profile APIs sometimes omit full booking fields)
        const attemptFetchBookingPost = async () => {
            try {
                const candidateId = sp?._id || sp?.PostID || sp?.PostId || sp?.id;
                if (candidateId) {
                    // First try booking-posts endpoint (optimized view)
                    const resp = await bookingPostAPI.getById(candidateId).catch(() => null);
                    if (resp && resp.success && resp.data) {
                        console.debug('[PostCard] Fetched booking-post fallback data for shared_post (bookingPostAPI)', { postId: postId, bookingId: candidateId });
                        setEmbeddedPost(resp.data);
                        return;
                    }

                    // If booking-posts endpoint didn't find it (404) or isn't available,
                    // try the generic posts endpoint — PostDAL.getById attaches Booking info too.
                    try {
                        const postResp = await postAPI.getById(candidateId).catch(() => null);
                        if (postResp && postResp.success && postResp.data) {
                            console.debug('[PostCard] Fetched booking-post fallback data for shared_post (postAPI)', { postId: postId, bookingId: candidateId });
                            setEmbeddedPost(postResp.data);
                            return;
                        }
                    } catch (e) {
                        console.debug('postAPI.getById fallback failed', e);
                    }
                }
            } catch (err) {
                console.debug('Fallback booking post fetch failed', err);
            }

            // fallback to using shared_post as-is
            console.debug('[PostCard] ⚠️ No booking data in chain, using shared_post as-is', { postId: postId });
            setEmbeddedPost(sp);
        };

        if (isVisible) {
            attemptFetchBookingPost();
        } else {
            // defer fetching embedded post data until visible
            setEmbeddedPost(null);
        }
    }, [post.shared_post, post.shared_post?.booking, postId, isVisible]);


    const totalMediaCount = ((post.image_urls && post.image_urls.length) || 0) + ((post.media_urls && post.media_urls.length) || 0);

    const [facilityImgResolved, setFacilityImgResolved] = useState(null);

    useEffect(() => {
        let mounted = true;
        const booking = post.booking || post.Booking || post;

        const possibleImgs = [];
        if (booking.FacilityImageUrl) possibleImgs.push(booking.FacilityImageUrl);
        if (booking.FacilityImage) possibleImgs.push(booking.FacilityImage);
        if (booking.FacilityImages && Array.isArray(booking.FacilityImages)) possibleImgs.push(...booking.FacilityImages);
        if (booking.FacilityImageUrls && Array.isArray(booking.FacilityImageUrls)) possibleImgs.push(...booking.FacilityImageUrls);
        if (booking.facility) {
            const fac = booking.facility;
            if (Array.isArray(fac.image_urls) && fac.image_urls.length) possibleImgs.push(...fac.image_urls);
            if (Array.isArray(fac.images) && fac.images.length) possibleImgs.push(...fac.images);
            if (fac.ImageUrl) possibleImgs.push(fac.ImageUrl);
            if (fac.URL) possibleImgs.push(fac.URL);
            if (fac.imageUrls) possibleImgs.push(...(fac.imageUrls || []));
            if (fac.images && Array.isArray(fac.images)) possibleImgs.push(...fac.images);
        }
        if (booking.facilityImages && Array.isArray(booking.facilityImages)) possibleImgs.push(...booking.facilityImages);
        if (booking.facility_images && Array.isArray(booking.facility_images)) possibleImgs.push(...booking.facility_images);
        if (booking.Facility && booking.Facility.image_urls && Array.isArray(booking.Facility.image_urls)) possibleImgs.push(...booking.Facility.image_urls);
        if (post.image_urls && Array.isArray(post.image_urls)) possibleImgs.push(...post.image_urls);

    const mapped = possibleImgs.map(p => extractUrl(p)).filter(u => !!u);
    const found = mapped.length ? mapped[0] : null;
        if (found) {
            const backendBase = getBackendOrigin();
            const absolute = toAbsoluteUrl(backendBase, found, 'facilities');
            if (mounted) setFacilityImgResolved(absolute || found);
            return () => { mounted = false; };
        }

        // If no image in payload, try to fetch facility by id as a fallback
        (async () => {
            try {
                const facilityId = booking.FacilityID || booking.FacilityId || booking.facilityId || booking.SanID || booking.sanId || booking.facility?.id || booking.facility?._id || booking.Facility?.FacilityID || booking.Facility?.id;
                if (!facilityId) return;
                const resp = await facilityAPI.getById(Number(facilityId)).catch(() => null);
                if (!mounted) return;
                if (resp && resp.success && resp.data) {
                    const f = resp.data;
                    const imgs = [];
                    if (Array.isArray(f.image_urls) && f.image_urls.length) imgs.push(...f.image_urls);
                    if (Array.isArray(f.images) && f.images.length) imgs.push(...f.images);
                    if (f.ImageUrl) imgs.push(f.ImageUrl);
                    if (imgs.length) {
                        const first = extractUrl(imgs[0]);
                        const backendBase = getBackendOrigin();
                        const absolute = toAbsoluteUrl(backendBase, first, 'facilities');
                        if (mounted) setFacilityImgResolved(absolute || first);
                        return;
                    }
                }
            } catch (e) { void e; }
        })();

        return () => { mounted = false; };
    }, [post]);

    // Render helper for media items (images or videos)
    const renderMediaItem = (img, index) => {
        const backendBase = getBackendOrigin();
        let src = img;
        if (typeof img === 'string') {
            // ensure absolute URL (safety-net in case caller didn't normalize)
            src = toAbsoluteUrl(backendBase, img, 'posts') || img;
        }
        const isVideo = typeof src === 'string' && (src.startsWith('data:video') || src.match(/\.(mp4|webm|ogg|mov)(\?|$)/i));
        const single = totalMediaCount === 1;
        // For multi-item posts use a moderate thumbnail height; for single-image/video posts make it taller
        const className = single
            // For single-media posts use the shared facility image style so height matches BookingStatusCard
            ? `w-full facility-image rounded-lg cursor-pointer` // single media: use facility hero height
            : `w-full h-60 object-contain rounded-lg cursor-pointer`; // multiple items: moderate thumbnails
        return (
            <div key={index} className={`relative ${single ? 'col-span-2' : ''}`}>
                {isVideo ? (
                    <div className={`rounded-lg overflow-hidden`} style={{ backgroundColor: '#000' }}>
                        <video
                            src={src}
                            onClick={() => setModalOpen(true)}
                            className={`w-full h-full object-contain cursor-pointer`}
                            controls
                            preload="metadata"
                            playsInline
                            onError={(e) => { console.warn('Video load failed for', src, e); }}
                            style={single ? { width: '100%', height: '320px' } : {}}
                        />
                    </div>
                ) : (
                    <img
                        src={src}
                        loading="lazy"
                        onClick={() => setModalOpen(true)}
                        className={className}
                        alt=""
                        onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_AVATAR }}
                        // Use objectFit: 'contain' so the full image is visible (no cropping).
                        style={single ? { width: '100%', height: '320px', objectFit: 'contain', backgroundColor: '#f3f4f6' } : {}}
                    />
                )}
                <div className="absolute left-2 bottom-2 bg-black/60 text-white text-xs rounded-full px-2 py-1 flex items-center gap-1">
                    <MessageCircle className="w-3 h-3" />
                    <span className="ml-0">{commentsCount || 0}</span>
                </div>
            </div>
        );
    };

    const backendBase = getBackendOrigin();
    const avatarSrc = toAbsoluteUrl(backendBase, post.user?.profile_picture || post.user?.AvatarUrl || post.user?.ProfilePictureURL || post.user?.avatarUrl, 'avatars') || DEFAULT_AVATAR;

    return (
                <div className={`relative bg-white rounded-lg shadow-md p-4 space-y-2 w-full max-w-3xl ${shouldShowModeration ? 'border-l-4 border-red-500' : ''}`}>
      {/* User into */}
            <div onClick={(e) => { e.stopPropagation(); if (!disableUserNavigation) navigate(`/profile/${post.user._id}`); }} className={`inline-flex items-center gap-3 ${!disableUserNavigation ? 'cursor-pointer' : ''}`}>
        {/* User profile picture */}
        <img
            src={avatarSrc}
            loading="lazy"
            onError={(e)=>{ e.target.onerror = null; e.target.src = DEFAULT_AVATAR }}
            alt=""
            className="w-10 h-10 rounded-full shadow"
            />
        {/* User name and username */}
            <div>
                <div className="flex items-center space-x-1">
                <span>{post.user?.full_name || t('post.unknownUser')}</span>
                {/* Badge/Checkmark icon */}
                <BadgeCheck className="w-4 h-4 text-blue-500" />
                {shouldShowModeration && (
                    <span className="ml-2 inline-flex items-center gap-1 text-red-600 text-xs font-semibold">
                        <Flag className="w-4 h-4" />
                        {t('post.pendingReview', 'Pending review')}
                    </span>
                )}
                </div>
                <div className="text-gray-500 text-sm">
                @{post.user?.username || t('post.anonymous')} • {post.createdAt ? formatTimeAgo(post.createdAt) : ""}
                </div>
            </div>
        </div>
        {/* Owner three-dot menu positioned top-right */}
        {isOwner && (
            <div className="absolute right-3 top-3" ref={menuRef}>
                <button onClick={() => setMenuOpen(v => !v)} aria-haspopup="true" aria-expanded={menuOpen} className="p-1 rounded hover:bg-gray-100">
                    <MoreHorizontal className="w-5 h-5 text-gray-600" />
                </button>
                        {menuOpen && (
                    <div className="absolute right-0 mt-2 bg-white border rounded-md shadow z-20 w-44">
                        <button onClick={() => { setIsEditing(true); setMenuOpen(false); }} className="w-full text-left px-4 py-2 hover:bg-gray-100">{t('post.editPost')}</button>
                        <button onClick={async () => {
                            setMenuOpen(false);
                            if (!window.confirm(t('post.deleteConfirm'))) return;
                            try {
                                const resp = await postAPI.delete(postId);
                                if (resp && resp.success) {
                                                toast.success(t('post.deleteSuccess'));
                                                // Notify other views so they can remove this post without a full reload
                                                try {
                                                    window.dispatchEvent(new CustomEvent('post:deleted', { detail: { postId } }));
                                                } catch (e) { void e; }
                                    } else {
                                            toast.error(resp.message || t('post.deleteFailed'));
                                }
                            } catch (err) {
                                console.error('Delete error', err);
                                        toast.error(t('post.deleteError'));
                            }
                        }} className='w-full text-left px-4 py-2 text-red-600 hover:bg-gray-100'>{t('post.deletePost')}</button>
                    </div>
                )}
            </div>
        )}
        {/* Admin quick-review action */}
        {shouldShowModeration && (
            <div className="absolute right-16 top-3">
                <button onClick={(e) => { e.stopPropagation(); navigate(`/admin/moderation?postId=${postId}`); }} className="px-2 py-1 text-xs rounded bg-red-600 text-white">{t('post.review', 'Review')}</button>
            </div>
        )}
        {/* Report button for non-owners */}
        {!isOwner && (
            <div className="absolute right-3 top-3" ref={menuRef}>
                <button onClick={() => setMenuOpen(v => !v)} aria-haspopup="true" aria-expanded={menuOpen} className="p-1 rounded hover:bg-gray-100">
                    <MoreHorizontal className="w-5 h-5 text-gray-600" />
                </button>
                {menuOpen && (
                    <div className="absolute right-0 mt-2 bg-white border rounded-md shadow z-20 w-44">
                        <button 
                            onClick={() => { 
                                setReportModalOpen(true); 
                                setMenuOpen(false); 
                            }} 
                            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2"
                        >
                            <Flag className="w-4 h-4 text-red-500" />
                            {t('report.reportPost') || 'Báo cáo bài viết'}
                        </button>
                    </div>
                )}
            </div>
        )}
    {/* Post content */}
        {isEditing && (
            <div className="mt-2">
                <textarea value={editContent} onChange={(e)=>setEditContent(e.target.value)} className="w-full border rounded p-2 min-h-[80px]" />
                <div className="flex gap-2 mt-2">
                    <button onClick={async ()=>{
                        try {
                            const resp = await postAPI.update(postId, { content: editContent });
                            if (resp && resp.success) {
                                toast.success(t('post.saved') || t('common.save'));
                                window.location.reload();
                            } else {
                                toast.error(resp.message || t('post.updateFailed'));
                            }
                        } catch (err) {
                            console.error('Update error', err);
                            toast.error(t('post.updateError'));
                        }
                    }} className='px-3 py-1 bg-green-600 text-white rounded'>{t('common.save')}</button>
                    <button onClick={()=>{ setIsEditing(false); setEditContent(post.content || ''); }} className='px-3 py-1 border rounded'>{t('common.cancel')}</button>
                </div>
            </div>
        )}
    {/* If this is a shared post, show attribution and embedded original */}
        {post.is_shared ? (
            <div className="text-sm text-gray-700">
                <div className="text-xs text-gray-500 mb-2">{post.user.full_name} shared</div>
                {post.shared_note && <div className="mb-2 text-gray-800 whitespace-pre-line">{post.shared_note}</div>}
                {/* embedded original */}
                {post.shared_post ? (
                    // If the original (shared_post) contains booking data, delegate rendering to BookingStatusCard
                    (() => {
                        const sp = embeddedPost || post.shared_post;
                        // Check if this is a booking post - improved detection
                        const spIsBooking = !!(
                            sp?.booking?.BookingID || 
                            sp?.Booking?.BookingID || 
                            (sp?.BookingID && (sp?.booking || sp?.FacilityName)) || 
                            sp?.is_booking || 
                            (sp?.PostID && sp?.FieldName)
                        );
                        if (spIsBooking) {
                            // Pass the shared_post into BookingStatusCard so it renders full booking details
                            return (
                                <div className="border rounded-md p-2 bg-gray-50">
                                    <BookingStatusCard post={sp} />
                                </div>
                            );
                        }

                        // fallback: render a simple embedded post preview for non-booking shared posts
                        // Defensive rendering: shared_post may come in different shapes (backend may return raw DB row
                        // or frontend-shaped object). Normalize and provide fallbacks so content always appears.
                        const shared = sp || {};
                        const sharedUser = shared.user || {
                            _id: shared.AccountID || shared.AccountId || shared.AccountID || null,
                            username: shared.Username || shared.username || '',
                            full_name: shared.FullName || shared.full_name || '',
                            profile_picture: shared.AvatarUrl || shared.profile_picture || DEFAULT_AVATAR
                        };

                        const sharedContent = shared.content || shared.Content || '';
                        const sharedImages = shared.image_urls || shared.imageUrls || shared.Images || [];

                        return (
                            <div className="border rounded-md p-3 bg-gray-50">
                                <div className="flex items-center gap-2 mb-2">
                                    <img
                                        src={sharedUser.profile_picture || DEFAULT_AVATAR}
                                        className="w-7 h-7 rounded-full"
                                        alt=""
                                        onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_AVATAR; }}
                                    />
                                    <div className="text-sm">
                                        <div className="font-medium">{sharedUser.full_name || 'Người dùng'}</div>
                                        <div className="text-xs text-gray-400">@{sharedUser.username || (sharedUser._id ? sharedUser._id : '')}</div>
                                    </div>
                                </div>

                                {sharedContent ? (
                                    <div className="text-sm text-gray-800 whitespace-pre-line mb-2">{sharedContent}</div>
                                ) : (
                                    <div className="text-sm text-gray-500 mb-2">{t('post.originalNotAvailable', '(Nội dung gốc không có hoặc không thể hiển thị)')}</div>
                                )}

                                {sharedImages && sharedImages.length > 0 && (
                                    <img loading="lazy" src={sharedImages[0]} className="w-full h-48 object-cover rounded" alt="" />
                                )}
                            </div>
                        );
                    })()
                ) : (
                    <div className="text-sm text-gray-500">{t('post.originalMissing')}</div>
                )}
            </div>
                ) : (
                        // If booking post, render booking preview UI similar to BookingPostCard
                        isBookingPost ? (
                            <div className="booking-post-preview mt-2 border rounded p-3 bg-white">
                                <div className="flex items-start gap-3">
                                    <img
                                        src={post.user?.profile_picture || post.user?.AvatarUrl || DEFAULT_AVATAR}
                                        onError={(e)=>{ e.target.onerror = null; e.target.src = DEFAULT_AVATAR }}
                                        alt=""
                                        className="w-12 h-12 rounded-full"
                                    />
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="font-medium">{post.user?.full_name || post.user?.fullName || post.OwnerFullName}</div>
                                                <div className="text-xs text-gray-400">@{post.user?.username || post.OwnerUsername} • {post.createdAt ? formatTimeAgo(post.createdAt) : ''}</div>
                                            </div>
                                        </div>

                                        {post.content && <div className="mt-2 text-sm text-gray-800 whitespace-pre-line">{post.content}</div>}

                                        {/* Booking details copied from BookingPostCard */}
                                                        <div className="mt-3 p-3 border rounded bg-gray-50">
                                                            {/** Prefer nested booking object if available, else use top-level fields */}
                                                            {(() => {
                                                                // Prefer normalized `booking` (lowercase) which `Profile.transformPosts`
                                                                // and other transformers now set. Fall back to legacy `Booking` (capital)
                                                                // or the post object itself if neither exists.
                                                                const booking = post.booking || post.Booking || post;
                                                                const facility = booking.FacilityName || booking.facilityName || '';
                                                                const fieldName = booking.FieldName || booking.fieldName || '';
                                                                const start = booking.StartTime || booking.startTime || booking.Start || null;
                                                                const end = booking.EndTime || booking.endTime || booking.End || null;
                                                                const price = booking.TotalAmount || booking.RentalPrice || booking.rentalPrice || booking.Total || null;
                                                               

                                                                // Try several possible keys for facility image(s)
                                                                const possibleImgs = [];
                                                                if (booking.FacilityImageUrl) possibleImgs.push(booking.FacilityImageUrl);
                                                                if (booking.FacilityImage) possibleImgs.push(booking.FacilityImage);
                                                                if (booking.FacilityImages && Array.isArray(booking.FacilityImages)) possibleImgs.push(...booking.FacilityImages);
                                                                if (booking.FacilityImageUrls && Array.isArray(booking.FacilityImageUrls)) possibleImgs.push(...booking.FacilityImageUrls);
                                                                if (booking.facility) {
                                                                    const fac = booking.facility;
                                                                    if (Array.isArray(fac.image_urls) && fac.image_urls.length) possibleImgs.push(...fac.image_urls);
                                                                    if (Array.isArray(fac.images) && fac.images.length) possibleImgs.push(...fac.images);
                                                                    if (fac.ImageUrl) possibleImgs.push(fac.ImageUrl);
                                                                    if (fac.URL) possibleImgs.push(fac.URL);
                                                                }
                                                                // fallback: post-level images (user-uploaded) may include facility photo
                                                                if (post.image_urls && Array.isArray(post.image_urls)) possibleImgs.push(...post.image_urls);

                                                                const backendBase = getBackendOrigin();
                                                                const mapped = possibleImgs.map(p => extractUrl(p)).filter(u => !!u);
                                                                const facilityImgRaw = mapped.length ? mapped[0] : null;
                                                                const facilityImgFromPayload = facilityImgRaw ? toAbsoluteUrl(backendBase, facilityImgRaw, 'facilities') : null;
                                                                const facilityImg = facilityImgResolved || facilityImgFromPayload;

                                                                return (
                                                                    <div className="flex flex-col gap-3">
                                                                        <div>
                                                                            <div className="text-sm text-gray-700 mb-1">
                                                                                <strong>{facility}</strong> - {fieldName}
                                                                            </div>
                                                                            <div className="text-sm text-gray-600 mb-1">{start && end ? `${new Date(start).toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit'})} - ${new Date(end).toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit'})}` : ''}</div>
                                                                            <div className="text-sm text-gray-600 mb-2">{price ? `${Number(price).toLocaleString('vi-VN')}đ` : ''}</div>

                                                                            {/* Booking actions removed per request: players count and Join button deleted */}
                                                                        </div>

                                                                        <div className="facility-image-wrapper">
                                                                            {facilityImg ? (
                                                                                <img loading="lazy" src={facilityImg} alt="facility" className="facility-image" onError={(e)=>{ e.target.onerror = null; e.target.src = DEFAULT_AVATAR }} />
                                                                            ) : (
                                                                                <div className="facility-image" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280'}}>{t('post.noImage')}</div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            post.content && (
                                <div className="text-gray-800 text-sm whitespace-pre-line">
                                    <p dangerouslySetInnerHTML={{ __html: postWithHashtags }} />
                                </div>
                            )
                        )
                )}

        {/* Images */}
            <div className={`grid ${totalMediaCount === 1 ? 'grid-cols-1' : 'grid-cols-2'} gap-2`}>
                                        {([...(post.image_urls || []), ...(post.media_urls || [])]).map((m, i) => renderMediaItem(m, i))}
                </div>

            {/* {Actions} */}
        <div className='flex items-center gap-4 text-gray-600 text-sm pt-2 border-t border-gray-300'>
            {/* Owner actions handled via top-right three-dot menu (see above) */}
            {/* Like Button */}
            <div className='flex items-center gap-1 select-none'>
                <button
                    onClick={handleLike}
                    disabled={isLiking}
                    aria-pressed={liked}
                    className={`inline-flex items-center gap-1 focus:outline-none ${isLiking ? 'opacity-60' : ''}`}
                >
                    <Heart
                        className={`w-4 h-4 ${liked ? 'text-red-500 fill-red-500' : 'text-gray-600'}`}
                    />
                    <span className={`${liked ? 'text-red-600 font-medium' : 'text-gray-600'}`}>{likes || 0}</span>
                </button>
            </div>

            {/* Comments */}
            <div className='flex items-center gap-1 cursor-pointer' onClick={() => setModalOpen(true)}>
                <MessageCircle className="w-4 h-4" />
                <span>{commentsCount }</span>
            </div>

            {/* Share Button */}
            <div className='flex items-center gap-1'>
                <button
                    onClick={() => setShareModalOpen(true)}
                    className="inline-flex items-center gap-1 focus:outline-none"
                >
                    <Share2 className={`w-4 h-4 ${sharedByUser ? 'text-blue-600' : 'text-gray-600'}`} />
                    <span className={`${sharedByUser ? 'text-blue-600 font-medium' : ''}`}>{sharesCount || 0}</span>
                </button>
                <ShareModal
                    visible={shareModalOpen}
                    onClose={() => setShareModalOpen(false)}
                    postId={postId}
                    initiallyShared={sharedByUser}
                    onShared={async (ev) => {
                        try {
                            // After share/unshare, refresh counts for post + any shared_post chain
                            const collectIds = (p) => {
                                const ids = [];
                                if (!p) return ids;
                                const pushId = (x) => {
                                    const id = x?._id || x?.PostID || x?.PostId || x?.id;
                                    if (id) ids.push(id);
                                };
                                pushId(p);
                                let cur = p.shared_post;
                                while (cur) {
                                    pushId(cur);
                                    cur = cur.shared_post;
                                }
                                return Array.from(new Set(ids));
                            };
                            const ids = collectIds(post);
                            if (ids.length > 0) {
                                const counts = await Promise.all(ids.map((id) => shareAPI.getCount(id).catch(() => null)));
                                const total = counts.reduce((s, r) => s + ((r && r.success && r.data && Number(r.data.count)) ? Number(r.data.count) : 0), 0);
                                setSharesCount(total);
                            }
                            if (ev?.action === 'shared') setSharedByUser(true);
                            else if (ev?.action === 'unshared') setSharedByUser(false);
                        } catch (err) {
                            console.error('Error refreshing share chain count', err);
                        } finally {
                            setShareModalOpen(false);
                        }
                    }}
                />
            </div>
            {/* Visible Report Button for non-owners */}
            {!isOwner && (
                <div className='flex items-center gap-1'>
                    <button
                        onClick={(e) => { e.stopPropagation(); setReportModalOpen(true); }}
                        className="inline-flex items-center gap-1 focus:outline-none"
                        aria-label={t('report.reportPost') || 'Báo cáo'}
                    >
                        <Flag className="w-4 h-4 text-red-500" />
                        <span className="text-sm text-gray-600">{t('report.report') || 'Báo cáo'}</span>
                    </button>
                </div>
            )}
            {/* Comments area: list + form */}
            {/* Small inline preview: show first comment preview if available; click to open modal */}
            {commentPreview && (
                <div onClick={() => setModalOpen(true)} className="mt-2 cursor-pointer">
                    <div className="text-sm text-gray-600">
                        <span className="font-medium mr-2">{commentPreview.user?.full_name || commentPreview.FullName || commentPreview.Username}</span>
                        <span className="truncate block max-w-xl">{commentPreview.Content || commentPreview.content}</span>
                    </div>
                    <div className="text-xs text-gray-400">{t('post.viewAllComments').replace('{count}', String(commentsCount))}</div>
                </div>
            )}
            <PostModal post={post} visible={modalOpen} onClose={() => setModalOpen(false)} onCommentCreated={() => setCommentsCount((n) => (n || 0) + 1)} />
            {/* Report Modal */}
            <ReportModal 
                visible={reportModalOpen}
                onClose={() => setReportModalOpen(false)}
                contentType="post"
                contentId={postId}
                contentPreview={rawContent.substring(0, 100)}
            />
            {/* ShareModal removed: share handled inline via shareAPI calls */}
            </div>
    </div>
  );
};

export default React.memo(PostCard, (prevProps, nextProps) => {
    // shallow compare important props to avoid unnecessary rerenders
    if (prevProps.post === nextProps.post && prevProps.showModerationFlags === nextProps.showModerationFlags && prevProps.disableUserNavigation === nextProps.disableUserNavigation) return true;
    return false;
});
