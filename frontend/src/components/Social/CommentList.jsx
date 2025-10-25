import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useI18n } from '../../i18n/hooks';
import { commentAPI } from "../../utils/api";
import CommentForm from './CommentForm';
import useAuth from "../../hooks/useAuth";
import DEFAULT_AVATAR from "../../utils/defaults";
import { MoreHorizontal, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
// import { API_BASE_URL } from "../../config/apiConfig"; // Not used
import getBackendOrigin, { toAbsoluteUrl } from '../../utils/urlHelpers';

const CommentList = ({ postId, reloadTrigger, scrollToCommentId = null }) => {
  const [comments, setComments] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user: currentUser } = useAuth();
  const { t } = useI18n();
  const [editingId, setEditingId] = useState(null);
  const [editingContent, setEditingContent] = useState('');
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [error, setError] = useState(null);
  
  // cache of validated URLs to avoid repeated HEAD requests across renders
  const [validatedImages, setValidatedImages] = useState({}); // { [commentId]: [validUrl, ...] }

  // simple in-memory cache shared across component instances (module-level would persist across mounts)
  const imageExistenceCache = useMemo(() => new Map(), []);

  // ⭐️ FIX: Cải thiện logic validateUrl để handle lỗi fetch gọn gàng hơn
  const validateUrl = useCallback(async (url) => {
    if (!url) return false;
    if (imageExistenceCache.has(url)) return imageExistenceCache.get(url);
    
    let ok = false;
    try {
      const backend = getBackendOrigin();
      const uploadsPrefix = (backend || '').replace(/\/$/, '') + '/uploads/';
      
      if (typeof url === 'string' && url.startsWith(uploadsPrefix)) {
        // Local URL: use backend endpoint for existence check
        const rel = url.substring(uploadsPrefix.length);
        const r = await fetch(`${backend}/api/internal/file-exists?path=${encodeURIComponent(rel)}`, { method: 'GET', cache: 'no-store' });
        const j = await r.json();
        ok = j && j.success && !!j.exists;
      } else {
        // External URL: perform HEAD 
        const resp = await fetch(url, { method: 'HEAD', cache: 'no-store' });
        ok = resp && resp.ok;
      }
    } catch {
      ok = false;
    }
    
    imageExistenceCache.set(url, ok);
    return ok;
  }, [imageExistenceCache]);

  const loadComments = useCallback(async () => {
    if (!postId) {
      setError('Post ID is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      // SỬA: Đảm bảo payload của API luôn là { success: true, data: { comments: [...] } }
      const res = await commentAPI.getByPostId(postId);

      if (res?.success) {
        setComments(res.data?.comments || res.data || []); // Fallback cho res.data nếu API trả về mảng trực tiếp
      } else {
        setError(res?.message || 'Failed to load comments');
        setComments([]);
      }
    } catch (err) {
      console.error('Load comments error:', err);
      setError('Error loading comments');
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    loadComments();
  }, [postId, reloadTrigger, loadComments]);

  // when comments load/update, validate image URLs in background
  useEffect(() => {
    let mounted = true;
    const validateAll = async () => {
      const backendBase = getBackendOrigin();
      const next = {};
      
      for (const c of comments) {
        const id = c.CommentID || c._id;
        if (!id) continue; // Skip comments without ID
        
        const rawImgs = c.images || c.Images || [];
        const promises = rawImgs
          .filter(img => typeof img === 'string' && !img.startsWith('data:image/')) // Chỉ validate URLs, bỏ qua Base64
          .map(async (imgUrl) => {
            const src = toAbsoluteUrl(backendBase, imgUrl, 'comments');
            const ok = await validateUrl(src);
            return ok ? src : null;
          });
          
        try {
          const results = await Promise.all(promises);
          // Only store validated URLs
          next[id] = Array.from(new Set(results.filter(Boolean)));
        } catch {
          next[id] = [];
        }
      }
      
      if (mounted) setValidatedImages(prev => ({ ...prev, ...next }));
    };
    
    // Validate only if there are comments to process
    if (comments && comments.length > 0) validateAll();
    
    return () => { mounted = false; };
  }, [comments, validateUrl]);

  // Scroll to comment logic remains the same
  useEffect(() => {
    if (!scrollToCommentId) return;
    setTimeout(() => {
      const el = document.getElementById(`comment-${scrollToCommentId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('bg-yellow-50');
        setTimeout(() => el.classList.remove('bg-yellow-50'), 2000);
      }
    }, 100);
  }, [comments, scrollToCommentId]);

  // Click outside menu logic remains the same
  useEffect(() => {
    const onDocClick = (e) => {
      if (!menuOpenId) return;
      const el = document.querySelector(`[data-menu-id="${menuOpenId}"]`);
      // Check if the click is outside the menu AND outside the trigger button
      const trigger = document.querySelector(`[data-menu-trigger-id="${menuOpenId}"]`);
      if ((el && !el.contains(e.target)) && (trigger && !trigger.contains(e.target))) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpenId]);

  // Dựng cây bình luận (logic remains the same)
  const { rootComments } = useMemo(() => {
    const byId = {};
    const roots = [];

    comments.forEach(comment => {
      const id = comment.CommentID || comment._id;
      if (id) byId[id] = { ...comment, children: [] };
    });

    comments.forEach(comment => {
      const id = comment.CommentID || comment._id;
      const parentId = comment.parentCommentId || comment.ParentCommentID;
      if (id && parentId && byId[parentId]) { // Only process if IDs are valid
        byId[parentId].children.push(byId[id]);
      } else if (id) {
        roots.push(byId[id]);
      }
    });

    return { rootComments: roots };
  }, [comments]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4 text-gray-500">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mr-2"></div>
        <span>{t('common.loading')}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-4 text-red-500">
        <div className="text-center">
            <p className="text-lg font-medium">{t('comment.loadErrorTitle')}</p>
            <p className="text-sm mt-1">{error || t('comment.loadErrorMessage')}</p>
          <button
            onClick={loadComments}
            className="mt-4 px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
          >
              {t('common.retry')}
          </button>
        </div>
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-gray-500">
        <div className="text-lg mb-2">{t('comment.noCommentsYet')}</div>
          <div className="text-sm">{t('comment.beFirst')}</div>
      </div>
    );
  }

  const timeAgo = (date) => {
    try {
      const now = new Date();
      const past = new Date(date);
      if (isNaN(past.getTime())) return 'Just now';
      const diffInSeconds = Math.floor((now - past) / 1000);

      if (diffInSeconds < 60) return 'Just now';
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
      if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
      if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
      return past.toLocaleDateString('en-US');
    } catch {
      return 'Just now';
    }
  };

  const renderComment = (c, depth = 0) => {
    const commentId = c.CommentID || c._id;
    if (!commentId) return null; // Safety check
    
    const currentAccountId = currentUser?.AccountID || currentUser?._id || currentUser?.userId;
    const isOwner = String(currentAccountId) === String(c.user?._id || c.user?.AccountID || c.AccountID);
    
    // ⭐️ LOGIC XỬ LÝ IMAGE ĐÃ ĐƯỢC ĐƠN GIẢN HÓA VÀ HỢP NHẤT
    const rawImgs = c.images || c.Images || [];
    const base64Images = rawImgs.filter(img => typeof img === 'string' && img.startsWith('data:image/'));
    const urlImages = rawImgs.filter(img => typeof img === 'string' && !img.startsWith('data:image/'));

    const validatedUrls = validatedImages[commentId] || [];
    const allSrcs = urlImages.map(imgUrl => toAbsoluteUrl(getBackendOrigin(), imgUrl, 'comments')).filter(Boolean);
    
    // Chỉ hiển thị ảnh đã được xác thực (async) HOẶC ảnh base64 (sync) HOẶC ảnh đã được cache (sync)
    let toShow = [];
    if (validatedUrls.length > 0) {
      toShow = validatedUrls;
    } else {
      const syncValid = allSrcs.filter(s => imageExistenceCache.has(s) && imageExistenceCache.get(s));
      // Kết hợp Base64 và các URL đã được cache xác thực
      toShow = Array.from(new Set([...base64Images, ...syncValid]));
    }
    
    const hasImagesToShow = toShow.length > 0;
    
    const openImage = (src) => {
        window.open(src, '_blank');
    };

    return (
      <div
        id={`comment-${commentId}`}
        key={commentId}
        className={`mt-4 ${depth > 0 ? 'ml-8' : ''} group transition-all duration-200`}
      >
        <div className="flex gap-3">
          <img
            src={c.user?.profile_picture || c.user?.AvatarUrl || c.ProfilePictureURL || c.user?.avatarUrl || DEFAULT_AVATAR}
            alt=""
            className={`${depth > 0 ? 'w-8 h-8' : 'w-9 h-9'} rounded-full shadow-sm object-cover border-2 border-white`}
            onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_AVATAR; }}
          />
          <div className="flex-1 space-y-1">
            <div className={`p-3 rounded-2xl ${depth > 0 ? 'bg-gray-50' : 'bg-gray-100'} shadow-sm`}>
              <div className="flex justify-between items-start gap-4">
                <div>
                  <div className="font-medium text-gray-900">
                    {c.user?.full_name || c.FullName || c.Username}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {timeAgo(c.createdAt || c.CreatedAt)}
                  </div>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    className="text-sm text-gray-500 hover:text-gray-700 transition-colors px-3 py-1 rounded-full hover:bg-gray-200"
                    onClick={() => setReplyTo(commentId)}
                  >
                    {t('comment.reply')}
                  </button>
                  {isOwner && (
                    <div className="relative" data-menu-trigger-id={commentId}>
                      <button
                        onClick={() => setMenuOpenId(menuOpenId === commentId ? null : commentId)}
                        className="p-1.5 rounded-full hover:bg-gray-200 transition-colors"
                      >
                        <MoreHorizontal className="w-4 h-4 text-gray-600" />
                      </button>
                      {menuOpenId === commentId && (
                        <div
                          data-menu-id={`${commentId}`}
                          className="absolute right-0 mt-1 bg-white border rounded-lg shadow-lg z-20 w-36 py-1 text-sm"
                        >
                          <button
                            onClick={() => {
                              setEditingId(commentId);
                              setEditingContent(c.Content || c.content || '');
                              setMenuOpenId(null);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700"
                          >
                            {t('common.edit')}
                          </button>
                          <button
                            onClick={async () => {
                              setMenuOpenId(null);
                              if (!window.confirm(t('post.deleteCommentConfirm'))) return;
                              try {
                                const resp = await commentAPI.delete(commentId);
                                if (resp && resp.success) {
                                  await loadComments();
                                  toast.success(t('comment.saved'));
                                } else {
                                  toast.error(resp?.message || t('comment.deleteFailed'));
                                }
                              } catch (err) {
                                console.error('Delete comment error', err);
                                toast.error(t('comment.deleteError'));
                              }
                            }}
                            className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50"
                          >
                            {t('common.delete') || t('comment.delete')}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="text-sm text-gray-700 mt-1">
                {editingId === commentId ? (
                  <div className="mt-2">
                    <textarea
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      className="w-full border rounded-lg p-3 focus:outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all"
                      rows={3}
                      placeholder={t('comment.editPlaceholder')}
                    />
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={async () => {
                          if (!editingContent.trim()) {
                            toast.error(t('comment.empty'));
                            return;
                          }
                          try {
                            const resp = await commentAPI.update(commentId, { content: editingContent });
                            if (resp && resp.success) {
                              setEditingId(null);
                              setEditingContent('');
                              await loadComments();
                              toast.success(t('comment.saved'));
                            } else {
                              toast.error(resp?.message || t('comment.updateFailed'));
                            }
                          } catch (err) {
                            console.error('Update comment error', err);
                            toast.error(t('comment.updateError'));
                          }
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        {t('common.save')}
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(null);
                          setEditingContent('');
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        {t('common.cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                    <div className="text-gray-800 whitespace-pre-wrap break-words">
                    {c.Content || c.content}
                  </div>
                )}
              </div>
            </div>
              
            {hasImagesToShow && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {toShow.map((src, idx) => (
                  <div key={idx} className="relative group rounded-lg overflow-hidden shadow-sm">
                    <img
                      src={src}
                      alt={`comment-img-${idx}`}
                      className="w-full max-h-[60vh] object-contain transition-transform group-hover:scale-105 duration-300 cursor-pointer"
                      onClick={() => openImage(src)}
                      onError={(e) => {
                        e.target.onerror = null;
                        // Placeholder for image not found
                        e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" fill="%23E2E8F0"%3E%3Crect width="300" height="200" fill="%23E2E8F0"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="%23718096"%3EImage not found%3C/text%3E%3C/svg%3E';
                      }}
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        className="px-4 py-2 bg-white/90 rounded-lg text-sm font-medium hover:bg-white transition-colors flex items-center gap-2"
                        onClick={(e) => { e.stopPropagation(); openImage(src); }} // Stop propagation to prevent duplicate clicks
                      >
                        <ImageIcon size={16} />
                        {t('comment.viewImage')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {replyTo === commentId && (
              <div className="mt-3 pl-4 border-l-2 border-gray-200">
                <CommentForm
                  postId={postId}
                  parentCommentId={commentId}
                  onCreated={() => {
                    setReplyTo(null);
                    loadComments();
                  }}
                  onCancelReply={() => setReplyTo(null)}
                />
              </div>
            )}

            {c.children && c.children.length > 0 && (
              <div className="mt-2">
                {c.children.map(child => renderComment(child, depth + 1))}
              </div>
            )}

          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="comments-container space-y-4">
      {rootComments.map(comment => renderComment(comment))}
    </div>
  );
};

export default CommentList;