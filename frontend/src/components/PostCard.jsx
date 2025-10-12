import React, { useState, useEffect, useRef } from "react";
import DEFAULT_AVATAR from '../utils/defaults';
import { BadgeCheck, Heart, MessageCircle, Share2, MoreHorizontal } from 'lucide-react';
import moment from "moment";
import { useNavigate } from "react-router-dom";
import { reactionAPI, commentAPI, shareAPI, postAPI } from "../utils/api";
import { useAuth } from "../hooks/useAuth";
import PostModal from './PostModal';
import ShareModal from './ShareModal';


const PostCard = ({post}) => {

    const rawContent = post?.content || '';
    const postWithHashtags = rawContent.replace(/#(\w+)/g, '<span class="text-indigo-600 ">#$1</span>');

    // normalize likes: use number for count and boolean for whether current user liked
    const [likes, setLikes] = useState(typeof post.likes_count === 'number' ? post.likes_count : (post.likes_count && post.likes_count.length) || 0);
    const [liked, setLiked] = useState(!!post.liked_by_current_user);
    const [isLiking, setIsLiking] = useState(false);
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();
    const [modalOpen, setModalOpen] = useState(false);
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(post.content || '');
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);
    const [commentPreview, setCommentPreview] = useState(null);
    const [commentsCount, setCommentsCount] = useState(post.comments_count || 0);
    const [sharedByUser, setSharedByUser] = useState(false);
    const [sharesCount, setSharesCount] = useState(post.shares_count || 0);

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
            const response = await reactionAPI.toggleLike(post._id);

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
                if (!post._id) return;
                const [countsRes, userRes] = await Promise.all([
                    reactionAPI.getCounts(post._id),
                    reactionAPI.getUserReaction(post._id)
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
    }, [post._id]);

    useEffect(() => {
        let mounted = true;
        const loadPreview = async () => {
            try {
                if (!post._id) return;
                const res = await commentAPI.getByPostId(post._id);
                console.log('Comment preview API response for post', post._id, res);
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
    }, [post._id, post.comments_count]);

    // Determine if current user is owner to show edit/delete
    const currentAccountId = currentUser?.AccountID || currentUser?._id || currentUser?.userId;
    const isOwner = String(currentAccountId) === String(post.user?._id || post.user?.AccountID || post.AccountID);

    // on mount, check if current user has shared
    useEffect(() => {
        let mounted = true;
        const checkShared = async () => {
            try {
                if (!post._id) return;
                const res = await shareAPI.checkUserShared(post._id);
                if (!mounted) return;
                if (res && res.success) {
                    setSharedByUser(!!res.data?.hasShared);
                }
                const cnt = await shareAPI.getCount(post._id);
                if (cnt && cnt.success) setSharesCount(cnt.data?.count ?? 0);
            } catch {
                // ignore
            }
        };
        checkShared();
        return () => { mounted = false; };
    }, [post._id]);

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
                                const resp = await postAPI.delete(post._id);
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
                            const resp = await postAPI.update(post._id, { content: editContent });
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
                    <div className="border rounded-md p-3 bg-gray-50">
                        <div className="flex items-center gap-2 mb-2">
                            <img src={post.shared_post.user?.profile_picture} className="w-7 h-7 rounded-full" alt="" />
                            <div className="text-sm">
                                <div className="font-medium">{post.shared_post.user?.full_name}</div>
                                <div className="text-xs text-gray-400">@{post.shared_post.user?.username}</div>
                            </div>
                        </div>
                        {post.shared_post.content && <div className="text-sm text-gray-800 whitespace-pre-line mb-2">{post.shared_post.content}</div>}
                        {post.shared_post.image_urls && post.shared_post.image_urls.length > 0 && (
                            <img src={post.shared_post.image_urls[0]} className="w-full h-36 object-cover rounded" alt="" />
                        )}
                    </div>
                ) : (
                    <div className="text-sm text-gray-500">Bài viết gốc không còn tồn tại</div>
                )}
            </div>
        ) : (
            post.content && (
              <div className="text-gray-800 text-sm whitespace-pre-line">
                <p dangerouslySetInnerHTML={{ __html: postWithHashtags }} />
              </div>
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
                <button onClick={() => setShareModalOpen(true)} className="inline-flex items-center gap-1 focus:outline-none">
                    <Share2 className={`w-4 h-4 ${sharedByUser ? 'text-blue-600' : 'text-gray-600'}`} />
                    <span className={`${sharedByUser ? 'text-blue-600 font-medium' : ''}`}>{sharesCount || 0}</span>
                </button>
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
            <ShareModal
                visible={shareModalOpen}
                onClose={() => setShareModalOpen(false)}
                postId={post._id}
                initiallyShared={sharedByUser}
                onShared={(info) => {
                    if (info?.action === 'shared') {
                        setSharedByUser(true);
                        setSharesCount((s) => (s || 0) + 1);
                    } else if (info?.action === 'unshared') {
                        setSharedByUser(false);
                        setSharesCount((s) => Math.max(0, (s || 0) - 1));
                    }
                }}
            />
            </div>
    </div>
  );
};

export default PostCard;
