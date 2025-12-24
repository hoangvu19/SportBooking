/**
 * BookingStatusCard Component
 * Hiển thị bài viết về booking trên Feed với trạng thái
 * (Chờ xác nhận, Đã xác nhận, Đã hủy)
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './BookingStatusCard.css';
import DEFAULT_AVATAR from '../../utils/defaults';
import { Heart, MessageCircle, Share2, MoreHorizontal } from 'lucide-react';
import { reactionAPI, commentAPI, shareAPI, postAPI } from '../../utils/api';
import useAuth from '../../hooks/useAuth';
import { normalizeUser } from '../../utils/normalize';
import toast from 'react-hot-toast';
import ShareModal from './ShareModal';
import PostModal from './PostModal';
import { useI18n } from '../../i18n/hooks';
import { formatVnDateTime, formatVnTime, parseServerDatetime } from '../../utils/vnTime';
import getBackendOrigin, { toAbsoluteUrl } from '../../utils/urlHelpers';
import { bookingPostAPI } from '../../utils/bookingPostAPI';

const BookingStatusCard = ({ post }) => {
    const navigate = useNavigate();

    // Extract booking data from post - handle multiple possible structures
    const bookingData = post.booking || post.Booking || post;
    const {
        BookingID = bookingData.BookingID || post.BookingID,
        BookingStatus = bookingData.BookingStatus || post.BookingStatus, // 'Pending', 'Confirmed', 'Cancelled'
        FacilityName = bookingData.FacilityName || post.FacilityName,
        FieldName = bookingData.FieldName || post.FieldName,
        SportName = bookingData.SportName || post.SportName,
        StartTime = bookingData.StartTime || post.StartTime,
        EndTime = bookingData.EndTime || post.EndTime,
        TotalAmount = bookingData.TotalAmount || post.TotalAmount,
        DepositPaid = bookingData.DepositPaid || post.DepositPaid,
        PaymentStatus = bookingData.PaymentStatus || post.PaymentStatus,
    } = bookingData;

    console.log('📦 BookingStatusCard received:', { 
        postId: post._id || post.PostID, 
        hasBookingObject: !!post.booking,
        hasBookingData: !!(BookingID || FacilityName)
    });

    // User info
    const user = post.user || {};
    const {
        profile_picture = DEFAULT_AVATAR,
        full_name = user.username || 'Unknown',
    } = user;

    // Format date/time
    const formatDateTime = (dateString) => {
        if (!dateString) return '';
        try {
            const d = parseServerDatetime(dateString) || new Date(dateString);
            return formatVnDateTime(d);
        } catch {
            return '';
        }
    };

    const formatTime = (dateString) => {
        if (!dateString) return '';
        try {
            const d = parseServerDatetime(dateString) || new Date(dateString);
            return formatVnTime(d);
        } catch {
            return '';
        }
    };

    const { t } = useI18n();

    // Get status config
    const getStatusConfig = (status) => {
        switch (status) {
            case 'Pending':
                return {
                    label: t('booking.status.Pending'),
                    icon: '⏳',
                    className: 'status-pending',
                    bgColor: '#fff3cd',
                    textColor: '#856404',
                };
            case 'Confirmed':
                return {
                    label: t('booking.status.Confirmed'),
                    icon: '✅',
                    className: 'status-confirmed',
                    bgColor: '#d4edda',
                    textColor: '#155724',
                };
            case 'Cancelled':
                return {
                    label: t('booking.status.Cancelled'),
                    icon: '❌',
                    className: 'status-cancelled',
                    bgColor: '#f8d7da',
                    textColor: '#721c24',
                };
            default:
                return {
                    label: t('booking.status.Unknown'),
                    icon: '❓',
                    className: 'status-unknown',
                    bgColor: '#e2e3e5',
                    textColor: '#383d41',
                };
        }
    };

    const statusConfig = getStatusConfig(BookingStatus);

    // Social action state
    const postId = post?._id || post?.PostID || post?.PostId || post?.id;

    const [likes, setLikes] = useState(typeof post.likes_count === 'number' ? post.likes_count : (post.likes_count && post.likes_count.length) || 0);
    const [liked, setLiked] = useState(!!post.liked_by_current_user);
    const [isLiking, setIsLiking] = useState(false);
    const [commentsCount, setCommentsCount] = useState(post.comments_count || 0);
    const [shareCount, setShareCount] = useState(post.shares_count || 0);
    const [sharedByUser, setSharedByUser] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(post.content || '');
    const menuRef = React.useRef(null);
    const { user: currentUser } = useAuth();
    
    // State mới để lưu trữ URL hình ảnh cuối cùng
    const [facilityImg, setFacilityImg] = useState(null); 

    // Determine ownership so we show edit/delete menu only to owner
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

    // close menu when clicking outside
    useEffect(() => {
        const onDocClick = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, []);

    useEffect(() => {
        let mounted = true;
        const loadReactionState = async () => {
            try {
                if (!postId) return;
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
            } catch (_err) {
                console.debug('Reaction init error', _err?.message || _err);
            }
        };
        loadReactionState();
        return () => { mounted = false; };
    }, [postId]);

    useEffect(() => {
        let mounted = true;
        const loadShareState = async () => {
            try {
                if (!postId) return;
                const chk = await shareAPI.checkUserShared(postId);
                if (!mounted) return;
                if (chk && chk.success) setSharedByUser(!!chk.data?.hasShared);
                const cnt = await shareAPI.getCount(postId);
                if (cnt && cnt.success) setShareCount(cnt.data?.count ?? 0);
            } catch (err) {
                console.debug('Share init error', err);
            }
        };
        loadShareState();
        return () => { mounted = false; };
    }, [postId]);

    useEffect(() => {
        let mounted = true;
        const loadPreview = async () => {
            try {
                if (!postId) return;
                const res = await commentAPI.getByPostId(postId);
                if (!mounted) return;
                const commentsArr = (res && res.data && Array.isArray(res.data.comments)) ? res.data.comments : (Array.isArray(res.data) ? res.data : []);
                setCommentsCount(commentsArr.length);
            } catch {
                // ignore
            }
        };
        loadPreview();
        return () => { mounted = false; };
    }, [postId, post.comments_count]);

    const handleLike = async () => {
        if (isLiking) return;
        try {
            setIsLiking(true);
            const newLiked = !liked;
            setLiked(newLiked);
            setLikes(prev => newLiked ? (prev || 0) + 1 : Math.max(0, (prev || 0) - 1));

            const response = await reactionAPI.toggleLike(postId);
            if (!response.success) {
                setLiked(!newLiked);
                setLikes(prev => !newLiked ? (prev || 0) + 1 : Math.max(0, (prev || 0) - 1));
                console.error('Like failed:', response.message);
            } else {
                const action = response.data?.action;
                if (action === 'created') {
                    if (!newLiked) {
                        setLiked(true);
                        setLikes(prev => (prev || 0) + 1);
                    }
                } else if (action === 'removed') {
                    if (newLiked) {
                        setLiked(false);
                        setLikes(prev => Math.max(0, (prev || 0) - 1));
                    }
                }
            }
        } catch (error) {
            setLiked(!liked);
            setLikes(prev => !liked ? Math.max(0, (prev || 0) - 1) : (prev || 0) + 1);
            console.error('Error toggling like:', error);
        } finally {
            setIsLiking(false);
        }
    };

    // Calculate duration (removed - not used in simplified UI)
    // const calculateDuration = (start, end) => {
    //     if (!start || !end) return '';
    //     const startDate = new Date(start);
    //     const endDate = new Date(end);
    //     const diff = (endDate - startDate) / (1000 * 60); // minutes
    //     const hours = Math.floor(diff / 60);
    //     const minutes = diff % 60;
    //     return hours > 0 ? `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}` : `${minutes}m`;
    // };

    // const duration = calculateDuration(StartTime, EndTime);

    // [BẮT ĐẦU SỬA LỖI HÌNH ẢNH]

    // Hàm đệ quy để trích xuất URL từ các cấu trúc lồng nhau
    const extractUrl = (candidate) => {
        if (!candidate) return null;
        if (typeof candidate === 'string') return candidate;
        if (Array.isArray(candidate)) {
            if (candidate.length === 0) return null;
            return extractUrl(candidate[0]);
        }

        const picks = [
            'ImageUrl','ImageURL','Image','URL','url','image_url','imageUrl',
            'Data','data','FileName','fileName','FilePath','path','File','Filepath',
            'imagePath','ImagePath','Url','ImageData','image','src','href'
        ];
        
        for (const k of picks) {
            if (candidate[k]) {
                const val = candidate[k];
                if (typeof val === 'object') {
                    const nested = extractUrl(val);
                    if (nested) return nested;
                } else if (typeof val === 'string') {
                    return val;
                }
            }
        }
        
        // try nested Data object
        if (candidate.Data && typeof candidate.Data === 'object') {
            for (const k of picks) {
                if (candidate.Data[k]) {
                    const val = candidate.Data[k];
                    if (typeof val === 'string') return val;
                    if (typeof val === 'object') {
                        const nested = extractUrl(val);
                        if (nested) return nested;
                    }
                }
            }
        }
        
        // Final broad check for any string that looks like a path/URL
        for (const v of Object.values(candidate)) {
            if (typeof v === 'string' && (v.includes('/') || v.includes('.'))) return v;
        }

        return null;
    };

    // Hàm tìm hình ảnh (hàm thuần, chỉ trả về URL)
    // helper to mask long data-URI strings in logs
    const maskUrl = (u) => {
        try {
            if (!u || typeof u !== 'string') return u;
            if (u.startsWith('data:')) {
                const mimeEnd = u.indexOf(';');
                const mime = mimeEnd > 5 ? u.slice(5, mimeEnd) : 'unknown';
                return `data:${mime};base64 (len=${u.length})`;
            }
            return u;
        } catch {
            return 'masked';
        }
    };

    const findFacilityImage = (currentPost, currentBookingData) => {
        try {
            const possible = [];
            
            // 1. Check top-level post fields FIRST (backend enrichment adds these)
            if (currentPost.FacilityImage) possible.push(currentPost.FacilityImage);
            if (Array.isArray(currentPost.FacilityImages) && currentPost.FacilityImages.length) possible.push(...currentPost.FacilityImages);
            if (currentPost.ImageUrls && Array.isArray(currentPost.ImageUrls) && currentPost.ImageUrls.length) possible.push(...currentPost.ImageUrls);
            
            // 2. Check bookingData fields
            if (currentBookingData.FacilityImageUrl) possible.push(currentBookingData.FacilityImageUrl);
            if (currentBookingData.FacilityImage) possible.push(currentBookingData.FacilityImage);
            if (Array.isArray(currentBookingData.FacilityImages)) possible.push(...currentBookingData.FacilityImages);
            if (Array.isArray(currentBookingData.FacilityImageUrls)) possible.push(...currentBookingData.FacilityImageUrls);
            if (Array.isArray(currentBookingData.ImageUrls)) possible.push(...currentBookingData.ImageUrls);
            
            // 3. Check nested facility object (if bookingData contains it)
            if (currentBookingData.facility) {
                const fac = currentBookingData.facility;
                if (Array.isArray(fac.image_urls) && fac.image_urls.length) possible.push(...fac.image_urls);
                if (Array.isArray(fac.images) && fac.images.length) possible.push(...fac.images);
                if (fac.ImageUrl) possible.push(fac.ImageUrl);
                if (fac.URL) possible.push(fac.URL);
            }
            
            // 4. Check general post media fields (fallback)
            if (currentPost.image_urls && Array.isArray(currentPost.image_urls)) possible.push(...currentPost.image_urls);
            if (currentPost.HinhAnh) possible.push(currentPost.HinhAnh);
            
            const mapped = possible.map(p => extractUrl(p)).filter(u => !!u);
            const raw = mapped.length ? mapped[0] : null;

            if (!raw) {
                // Avoid dumping candidate objects (may contain data URIs) — log counts and keys instead
                console.warn('[BookingStatusCard] ❌ No facility image candidates found for post', postId, {
                    candidateCount: Array.isArray(possible) ? possible.length : 0,
                    bookingDataKeys: Object.keys(currentBookingData || {}),
                    postKeys: Object.keys(currentPost || {})
                });
                return null;
            }
            
            const base = getBackendOrigin();
            const rawStr = typeof raw === 'string' ? raw.trim() : (raw && raw.toString ? raw.toString() : null);

            // Logic chuyển đổi URL tuyệt đối
            let finalUrl;
            if (/^https?:\/\//i.test(rawStr) || /^\/\//.test(rawStr)) {
                finalUrl = rawStr;
            } else if (rawStr.startsWith('/')) {
                finalUrl = `${base.replace(/\/+$/,'')}${rawStr}`;
            } else {
                // Use the utility to resolve relative paths
                finalUrl = toAbsoluteUrl(base, rawStr, 'facilities') || rawStr;
            }

            console.log('[BookingStatusCard] ✨ Final facility image URL:', maskUrl(finalUrl));
            return finalUrl;

        } catch (e) {
            console.error('findFacilityImage error', e);
            return null;
        }
    };


    // useEffect chính để tìm kiếm hình ảnh
    useEffect(() => {
        let mounted = true;
        let hasFetched = false;
        
        // 1. Thử tìm kiếm hình ảnh từ dữ liệu ban đầu
        const initialImg = findFacilityImage(post, bookingData);
        let foundLocal = false;
        if (initialImg) {
            setFacilityImg(initialImg);
            foundLocal = true;
            console.log('[BookingStatusCard] ✅ Found facility image locally:', maskUrl(initialImg));
        }

        // 2. Nếu không tìm thấy, thực hiện Fallback Fetch
        const tryFetchBookingPost = async () => {
            // Kiểm tra lại trạng thái local trước khi fetch
            if (foundLocal || hasFetched || !postId) return;

            try {
                hasFetched = true;
                
                // Fetch full booking-post data
                const resp = await bookingPostAPI.getById(postId).catch(err => {
                    console.error('[BookingStatusCard] ❌ Fetch error in fallback:', err);
                    return null;
                });
                
                if (!mounted) return;
                
                if (resp?.success && resp.data) {
                    const bp = resp.data.bookingPost || resp.data || null;
                    if (bp) {
                        // Tạo đối tượng bookingData tạm thời từ response API
                        const fallbackBookingData = bp.booking || bp.Booking || bp;
                        // Tìm ảnh từ dữ liệu fallback mới
                        const fallbackImg = findFacilityImage(bp, fallbackBookingData);

                        if (fallbackImg) {
                            console.log('[BookingStatusCard] ✅ Fallback setting image:', maskUrl(fallbackImg));
                            setFacilityImg(fallbackImg);
                        } else {
                            console.warn('[BookingStatusCard] ⚠️ Fallback fetch completed but no image found.');
                        }
                    }
                }
            } catch (err) {
                console.error('[BookingStatusCard] ❌ Exception in Fallback Fetch:', err);
            }
        };
        
        if (!foundLocal) {
            console.log('[BookingStatusCard] 📡 Attempting fallback fetch...');
            tryFetchBookingPost();
        }

        return () => { mounted = false; };
        // post.BookingID, post.FacilityName được thêm để đảm bảo effect chạy khi dữ liệu post thay đổi (ví dụ trong trường hợp feed update)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [postId, post.BookingID, post.FacilityName]);

    // [KẾT THÚC SỬA LỖI HÌNH ẢNH]
    
    return (
        <div className="booking-status-card relative bg-white rounded-lg shadow-md p-4 space-y-2 w-full max-w-3xl mx-auto">
            {/* Header - User Info */}
            <div className="booking-card-header">
                <div className="user-info">
                    <img
                        src={profile_picture}
                        alt={full_name}
                        className="user-avatar"
                        onClick={() => navigate(`/profile/${user._id}`)}
                    />
                    <div className="user-details">
                        <h4 className="user-name" onClick={() => navigate(`/profile/${user._id}`)}>
                            {full_name}
                        </h4>
                        <p className="post-time">{formatDateTime(post.createdAt)}</p>
                    </div>
                </div>

                {/* Right-side: status was moved to image; show owner menu (edit/delete) here */}
                <div className="owner-menu" ref={menuRef} style={{ position: 'relative' }}>
                    {isOwner && (
                        <>
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
                                                // notify app and reload to reflect deletion
                                                    window.dispatchEvent(new CustomEvent('post:deleted', { detail: { postId } }));
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
                        </>
                    )}
                </div>
            </div>

            {/* Content */}
            {post.content && (
                <div className="booking-card-content">
                    <p>{post.content}</p>
                </div>
            )}

            {/* Inline edit area for owner (simple textarea) */}
            {isEditing && (
                <div className="booking-card-content">
                    <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="w-full border rounded p-2 min-h-[80px]" />
                    <div className="flex gap-2 mt-2">
                        <button onClick={async () => {
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
                        <button onClick={() => { setIsEditing(false); setEditContent(post.content || ''); }} className='px-3 py-1 border rounded'>{t('common.cancel')}</button>
                    </div>
                </div>
            )}

            {/* Booking Details */}
            <div className="booking-details-container">
                {/* Simple Booking Info - Above Image */}
                <div className="booking-info-simple">
                    <div className="info-row">
                        <span className="info-text">📍 {FacilityName} - {FieldName}</span>
                        <span className="info-text">📅 {StartTime ? new Date(StartTime).toLocaleDateString('en-GB') : 'N/A'} • {formatTime(StartTime)} - {formatTime(EndTime)}</span>
                    </div>
                    <div className="info-row">
                        <span className="info-text">💰 {TotalAmount ? `${Number(TotalAmount).toLocaleString()} VND` : 'N/A'}</span>
                        {DepositPaid && DepositPaid > 0 ? (
                            <span className="deposit-badge paid">✓ {t('booking.paid')}</span>
                        ) : (
                            <span className="deposit-badge unpaid">⏳ {t('booking.unpaid')}</span>
                        )}
                    </div>
                </div>

                {/* Facility Image (badge overlaid top-left) */}
                <div className="facility-image-wrapper">
                    {/* Overlay status badge placed on top-left of the image */}
                    <div className={`status-badge status-overlay ${statusConfig.className}`}>
                        <span className="status-icon">{statusConfig.icon}</span>
                        <span className="status-label">{statusConfig.label}</span>
                    </div>
                    <img 
                        src={facilityImg || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" fill="%23E2E8F0"%3E%3Crect width="800" height="400" fill="%23E2E8F0"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="24" fill="%23718096"%3ENo Image%3C/text%3E%3C/svg%3E'} 
                        alt={FacilityName || "facility"} 
                        className="facility-image" 
                        data-uri={facilityImg && facilityImg.startsWith('data:') ? 'true' : 'false'}
                        onError={(e)=>{ 
                            // If the source is a data URI and still errors, fall back to placeholder
                            e.target.onerror = null; 
                            e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" fill="%23E2E8F0"%3E%3Crect width="800" height="400" fill="%23E2E8F0"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="24" fill="%23718096"%3ENo Image%3C/text%3E%3C/svg%3E';
                        }} 
                    />
                </div>
            </div>

            {/* Footer - Social Actions */}
            <div className="booking-card-footer">
                {/* Like button wired to reactionAPI */}
                <div className="flex items-center gap-1 select-none">
                    <button
                        onClick={handleLike}
                        disabled={isLiking}
                        aria-pressed={liked}
                        className={`inline-flex items-center gap-1 focus:outline-none ${isLiking ? 'opacity-60' : ''}`}
                    >
                        <Heart className={`w-4 h-4 ${liked ? 'text-red-500 fill-red-500' : 'text-gray-600'}`} />
                        <span className={`${liked ? 'text-red-600 font-medium' : 'text-gray-600'}`}>{likes || 0}</span>
                    </button>
                </div>

                {/* Comments open PostModal */}
                <div className='flex items-center gap-1 cursor-pointer' onClick={() => setModalOpen(true)}>
                    <MessageCircle className="w-4 h-4" />
                    <span>{commentsCount}</span>
                </div>

                {/* Share Button — open ShareModal */}
                <div className='flex items-center gap-1'>
                    <button
                        onClick={() => setShareModalOpen(true)}
                        className="inline-flex items-center gap-1 focus:outline-none"
                    >
                        <Share2 className={`w-4 h-4 ${sharedByUser ? 'text-blue-600' : 'text-gray-600'}`} />
                        <span className={`${sharedByUser ? 'text-blue-600 font-medium' : ''}`}>{shareCount || 0}</span>
                    </button>
                </div>
                <PostModal post={post} visible={modalOpen} onClose={() => setModalOpen(false)} onCommentCreated={() => setCommentsCount((n) => (n || 0) + 1)} />
                <ShareModal
                    visible={shareModalOpen}
                    onClose={() => setShareModalOpen(false)}
                    postId={postId}
                    initiallyShared={sharedByUser}
                    onShared={(ev) => {
                        if (ev?.action === 'shared') {
                            setSharedByUser(true);
                            setShareCount((s) => (s || 0) + 1);
                        } else if (ev?.action === 'unshared') {
                            setSharedByUser(false);
                            setShareCount((s) => Math.max(0, (s || 0) - 1));
                        }
                        setShareModalOpen(false);
                    }}
                />
            </div>
        </div>
    );
};

export default BookingStatusCard;