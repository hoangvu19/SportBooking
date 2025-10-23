import React, { useState, useEffect, useRef } from "react";
import DEFAULT_AVATAR from "../../utils/defaults";
import { BadgeCheck, Heart, MessageCircle, Share2, MoreHorizontal } from 'lucide-react';
import moment from "moment";
import { useNavigate } from "react-router-dom";
import { reactionAPI, commentAPI, shareAPI, postAPI } from "../../utils/api";
import useAuth from "../../hooks/useAuth";
import PostModal from './PostModal';
import ShareModal from './ShareModal';
import BookingStatusCard from './BookingStatusCard';
import { bookingPostAPI } from '../../utils/bookingPostAPI';


const PostCard = ({post}) => {

    const rawContent = post?.content || '';
    const postWithHashtags = rawContent.replace(/#(\w+)/g, '<span class="text-indigo-600 ">#$1</span>');

    // Booking post detection: some booking posts come with Booking-specific fields
    // Also treat posts that have a nested `Booking` object as booking posts
    const isBookingPost = !!(post?.Booking || post?.BookingID || post?.is_booking || (post?.PostID && post?.FieldName));

    // normalize likes: use number for count and boolean for whether current user liked
    // canonical postId to support both booking-origin posts and normal posts
    const postId = post?._id || post?.PostID || post?.PostId || post?.id;
    const [likes, setLikes] = useState(typeof post.likes_count === 'number' ? post.likes_count : (post.likes_count && post.likes_count.length) || 0);
    const [liked, setLiked] = useState(!!post.liked_by_current_user);
    const [isLiking, setIsLiking] = useState(false);
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();
    const [modalOpen, setModalOpen] = useState(false);
    // shareModal removed: share will be immediate
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
                    // sum counts
                    const total = countsRes.data.reduce((s, c) => s + (c.Count || c.count || 0), 0);
                    setLikes(total);
                }

                if (userRes && userRes.success) {
                    setLiked(!!userRes.data);
                }
            } catch (_err) {
                // ignore init errors
                console.debug('Reaction init error', _err?.message || _err);
            }
        };
        loadReactionState();
        return () => { mounted = false; };
    }, [postId, post]);

    useEffect(() => {
        let mounted = true;
        const loadPreview = async () => {
            try {
                if (!postId) return;
                const res = await commentAPI.getByPostId(postId);
                console.log('Comment preview API response for post', postId, res);
                if (!mounted) return;
                // Sửa: lấy đúng mảng comments từ res.data.comments nếu có
                const commentsArr = (res && res.data && Array.isArray(res.data.comments)) ? res.data.comments : (Array.isArray(res.data) ? res.data : []);
                if (commentsArr.length > 0) setCommentPreview(commentsArr[0]);
                setCommentsCount(commentsArr.length);
            } catch {
                // ignore
            }
        };
        loadPreview();
        return () => { mounted = false; };
    }, [postId, post.comments_count]);

    // Determine if current user is owner to show edit/delete
    const currentAccountId = currentUser?.AccountID || currentUser?._id || currentUser?.userId;
    const isOwner = String(currentAccountId) === String(post.user?._id || post.user?.AccountID || post.AccountID);

    // on mount, check if current user has shared
    useEffect(() => {
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

                const ids = collectIds(post);
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
    }, [postId, post]);

    // If the post is a share, attempt to render the embedded original.
    // For re-shares (A <- B <- C) we try to find the booking-origin post by traversing
    // the shared_post chain. Backend PostDAL.getById now attaches Booking data when BookingID present,
    // so we should see booking fields in shared_post if they exist.
    useEffect(() => {
        const sp = post?.shared_post;
        if (!sp) { setEmbeddedPost(null); return; }

        // Check if shared_post already has booking data (from backend enhancement)
        const hasBooking = (obj) => !!(
            obj?.Booking ||
            obj?.booking ||
            obj?.FacilityName ||
            obj?.FieldName ||
            obj?.TotalAmount ||
            (obj?.BookingID && (obj?.FacilityName || obj?.FieldName))
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
            console.debug('[PostCard] ✅ Found booking data in shared_post chain', { postId: postId });
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

        attemptFetchBookingPost();
    }, [post.shared_post, postId]);

    return (
                <div className="relative bg-white rounded-lg shadow-md p-4 space-y-2 w-full">
      {/* User into */}
            <div onClick={() => navigate(`/profile/${post.user._id}`)} className="inline-flex items-center gap-3 cursor-pointer">
        {/* User profile picture */}
        <img
            src={post.user?.profile_picture || post.user?.AvatarUrl || post.user?.ProfilePictureURL || post.user?.avatarUrl || DEFAULT_AVATAR}
            onError={(e)=>{ e.target.onerror = null; e.target.src = DEFAULT_AVATAR }}
            alt=""
            className="w-10 h-10 rounded-full shadow"
            />
        {/* User name and username */}
            <div>
                <div className="flex items-center space-x-1">
                <span>{post.user?.full_name || "Người dùng"}</span>
                {/* Badge/Checkmark icon */}
                <BadgeCheck className="w-4 h-4 text-blue-500" />
                </div>
                <div className="text-gray-500 text-sm">
                @{post.user?.username || "Ẩn danh"} • {post.createdAt ? moment(post.createdAt).fromNow() : ""}
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
                        <button onClick={() => { setIsEditing(true); setMenuOpen(false); }} className="w-full text-left px-4 py-2 hover:bg-gray-100">Chỉnh sửa bài viết</button>
                        <button onClick={async () => {
                            setMenuOpen(false);
                            if (!window.confirm('Bạn có chắc muốn xóa bài viết này?')) return;
                            try {
                                const resp = await postAPI.delete(postId);
                                if (resp && resp.success) {
                                    window.location.reload();
                                } else {
                                    alert(resp.message || 'Xóa thất bại');
                                }
                            } catch (err) {
                                console.error('Delete error', err);
                                alert('Lỗi khi xóa bài viết');
                            }
                        }} className='w-full text-left px-4 py-2 text-red-600 hover:bg-gray-100'>Xóa bài viết</button>
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
                                window.location.reload();
                            } else {
                                alert(resp.message || 'Cập nhật thất bại');
                            }
                        } catch (err) {
                            console.error('Update error', err);
                            alert('Lỗi khi cập nhật bài viết');
                        }
                    }} className='px-3 py-1 bg-green-600 text-white rounded'>Lưu</button>
                    <button onClick={()=>{ setIsEditing(false); setEditContent(post.content || ''); }} className='px-3 py-1 border rounded'>Hủy</button>
                </div>
            </div>
        )}
    {/* If this is a shared post, show attribution and embedded original */}
        {post.is_shared ? (
            <div className="text-sm text-gray-700">
                <div className="text-xs text-gray-500 mb-2">{post.user.full_name} đã chia sẻ</div>
                {post.shared_note && <div className="mb-2 text-gray-800 whitespace-pre-line">{post.shared_note}</div>}
                {/* embedded original */}
                {post.shared_post ? (
                    // If the original (shared_post) contains booking data, delegate rendering to BookingStatusCard
                    (() => {
                        const sp = embeddedPost || post.shared_post;
                        const spIsBooking = !!(sp?.booking || sp?.BookingID || sp?.is_booking || (sp?.PostID && sp?.FieldName));
                        if (spIsBooking) {
                            // Pass the shared_post into BookingStatusCard so it renders full booking details
                            return (
                                <div className="border rounded-md p-2 bg-gray-50">
                                    <BookingStatusCard post={sp} />
                                </div>
                            );
                        }

                        // fallback: render a simple embedded post preview for non-booking shared posts
                        return (
                            <div className="border rounded-md p-3 bg-gray-50">
                                <div className="flex items-center gap-2 mb-2">
                                    <img src={sp.user?.profile_picture || DEFAULT_AVATAR} className="w-7 h-7 rounded-full" alt="" onError={(e)=>{ e.target.onerror = null; e.target.src = DEFAULT_AVATAR }} />
                                    <div className="text-sm">
                                        <div className="font-medium">{sp.user?.full_name}</div>
                                        <div className="text-xs text-gray-400">@{sp.user?.username}</div>
                                    </div>
                                </div>
                                {sp.content && <div className="text-sm text-gray-800 whitespace-pre-line mb-2">{sp.content}</div>}
                                {sp.image_urls && sp.image_urls.length > 0 && (
                                    <img src={sp.image_urls[0]} className="w-full h-36 object-cover rounded" alt="" />
                                )}
                            </div>
                        );
                    })()
                ) : (
                    <div className="text-sm text-gray-500">Bài viết gốc không còn tồn tại</div>
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
                                                <div className="text-xs text-gray-400">@{post.user?.username || post.OwnerUsername} • {post.createdAt ? moment(post.createdAt).fromNow() : ''}</div>
                                            </div>
                                        </div>

                                        {post.content && <div className="mt-2 text-sm text-gray-800 whitespace-pre-line">{post.content}</div>}

                                        {/* Booking details copied from BookingPostCard */}
                                                        <div className="mt-3 p-3 border rounded bg-gray-50">
                                                            {/** Prefer nested booking object if available, else use top-level fields */}
                                                            {(() => {
                                                                const booking = post.Booking || post;
                                                                const facility = booking.FacilityName || booking.facilityName || '';
                                                                const fieldName = booking.FieldName || booking.fieldName || '';
                                                                const start = booking.StartTime || booking.startTime || booking.Start || null;
                                                                const end = booking.EndTime || booking.endTime || booking.End || null;
                                                                const price = booking.TotalAmount || booking.RentalPrice || booking.rentalPrice || booking.Total || null;
                                                                const currentPlayers = booking.CurrentPlayers || booking.currentPlayers || 0;
                                                                const maxPlayers = booking.MaxPlayers || booking.maxPlayers || booking.Max || 0;

                                                                return (
                                                                    <>
                                                                        <div className="text-sm text-gray-700 mb-2">
                                                                            <strong>{facility}</strong> - {fieldName}
                                                                        </div>
                                                                        <div className="text-sm text-gray-600 mb-2">{start && end ? `${new Date(start).toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit'})} - ${new Date(end).toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit'})}` : ''}</div>
                                                                        <div className="text-sm text-gray-600">{price ? `${Number(price).toLocaleString('vi-VN')}đ` : ''}</div>

                                                                        <div className="mt-3 flex items-center justify-between">
                                                                            <div className="players-status flex items-center gap-3">
                                                                                <div className="text-sm">👥 {currentPlayers}/{maxPlayers} người chơi</div>
                                                                            </div>
                                                                            <div>
                                                                                <button
                                                                                    onClick={(e) => { e.stopPropagation(); /* navigate to booking detail */ navigate(`/booking-post/${post.PostID || postId || post.PostId}`); }}
                                                                                    className={`px-3 py-1 rounded border ${((maxPlayers && currentPlayers) && (currentPlayers >= maxPlayers)) ? 'opacity-60 cursor-not-allowed' : 'bg-green-600 text-white'}`}
                                                                                    disabled={maxPlayers && currentPlayers && (currentPlayers >= maxPlayers)}
                                                                                >
                                                                                    { (maxPlayers && currentPlayers && (currentPlayers >= maxPlayers)) ? 'Đã đủ người' : 'Tham gia'}
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    </>
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
            <div className='grid grid-cols-2 gap-2'>
                {(post.image_urls || []).map((img, index) => (
            <div key={index} className={`relative ${post.image_urls.length === 1 ? 'col-span-2' : ''}`}>
            <img
            src={img}
            onClick={() => setModalOpen(true)}
            className={`w-full h-48 object-cover rounded-lg cursor-pointer ${post.image_urls.length === 1 ? 'h-auto' : ''}`}
            alt=""
            />
            {/* overlay badge bottom-left */}
            <div className="absolute left-2 bottom-2 bg-black/60 text-white text-xs rounded-full px-2 py-1 flex items-center gap-1">
                <MessageCircle className="w-3 h-3" />
                <span className="ml-0">{commentsCount || 0}</span>
            </div>
            </div>
        ))}
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
            {/* Comments area: list + form */}
            {/* Small inline preview: show first comment preview if available; click to open modal */}
            {commentPreview && (
                <div onClick={() => setModalOpen(true)} className="mt-2 cursor-pointer">
                    <div className="text-sm text-gray-600">
                        <span className="font-medium mr-2">{commentPreview.user?.full_name || commentPreview.FullName || commentPreview.Username}</span>
                        <span className="truncate block max-w-xl">{commentPreview.Content || commentPreview.content}</span>
                    </div>
                    <div className="text-xs text-gray-400">Xem tất cả {commentsCount} bình luận</div>
                </div>
            )}
            <PostModal post={post} visible={modalOpen} onClose={() => setModalOpen(false)} onCommentCreated={() => setCommentsCount((n) => (n || 0) + 1)} />
            {/* ShareModal removed: share handled inline via shareAPI calls */}
            </div>
    </div>
  );
};

export default PostCard;
