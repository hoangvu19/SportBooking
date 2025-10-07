import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { commentAPI } from '../utils/api';
import CommentForm from './CommentForm';
import { useAuth } from '../hooks/useAuth';
import { MoreHorizontal, Image as ImageIcon } from 'lucide-react';

const CommentList = ({ postId, reloadTrigger, scrollToCommentId = null }) => {
  const [comments, setComments] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user: currentUser } = useAuth();
  const [editingId, setEditingId] = useState(null);
  const [editingContent, setEditingContent] = useState('');
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [error, setError] = useState(null);

  const loadComments = useCallback(async () => {
    if (!postId) {
      setError('Post ID is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await commentAPI.getByPostId(postId);

      if (res?.success) {
        setComments(res.data?.comments || []);
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

  useEffect(() => {
    const onDocClick = (e) => {
      if (!menuOpenId) return;
      const el = document.querySelector(`[data-menu-id="${menuOpenId}"]`);
      if (el && !el.contains(e.target)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpenId]);

  // Dựng cây bình luận
  const { rootComments } = useMemo(() => {
    const byId = {};
    const roots = [];

    comments.forEach(comment => {
      const id = comment.CommentID || comment._id;
      byId[id] = { ...comment, children: [] };
    });

    comments.forEach(comment => {
      const id = comment.CommentID || comment._id;
      const parentId = comment.parentCommentId || comment.ParentCommentID;
      if (parentId && byId[parentId]) {
        byId[parentId].children.push(byId[id]);
      } else {
        roots.push(byId[id]);
      }
    });

    return { rootComments: roots };
  }, [comments]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4 text-gray-500">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mr-2"></div>
        <span>Đang tải bình luận...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-4 text-red-500">
        <div className="text-center">
          <p className="text-lg font-medium">Lỗi tải bình luận</p>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={loadComments}
            className="mt-4 px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-gray-500">
        <div className="text-lg mb-2">Chưa có bình luận nào</div>
        <div className="text-sm">Hãy là người đầu tiên bình luận!</div>
      </div>
    );
  }

  const timeAgo = (date) => {
    const now = new Date();
    const past = new Date(date);
    const diffInSeconds = Math.floor((now - past) / 1000);

    if (diffInSeconds < 60) return 'Vừa xong';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} phút trước`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} giờ trước`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} ngày trước`;
    return past.toLocaleDateString('vi-VN');
  };

  const renderComment = (c, depth = 0) => {
    const currentAccountId = currentUser?.AccountID || currentUser?._id || currentUser?.userId;
    const isOwner = String(currentAccountId) === String(c.user?._id || c.user?.AccountID || c.AccountID);
    const hasImages = (c.images && c.images.length > 0) || (c.Images && c.Images.length > 0);

    return (
      <div
        id={`comment-${c.CommentID || c._id}`}
        key={c.CommentID || c._id}
        className={`mt-4 ${depth > 0 ? 'ml-8' : ''} group transition-all duration-200`}
      >
        <div className="flex gap-3">
          <img
            src={c.user?.profile_picture || c.ProfilePictureURL || 'https://via.placeholder.com/36?text=User'}
            alt=""
            className={`${depth > 0 ? 'w-8 h-8' : 'w-9 h-9'} rounded-full shadow-sm object-cover border-2 border-white`}
            onError={(e) => {
              e.target.src = 'https://via.placeholder.com/36?text=User';
            }}
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
                    onClick={() => setReplyTo(c.CommentID || c._id)}
                  >
                    Trả lời
                  </button>
                  {isOwner && (
                    <div className="relative" data-menu-trigger-id={c.CommentID || c._id}>
                      <button
                        onClick={() => setMenuOpenId(menuOpenId === (c.CommentID || c._id) ? null : (c.CommentID || c._id))}
                        className="p-1.5 rounded-full hover:bg-gray-200 transition-colors"
                      >
                        <MoreHorizontal className="w-4 h-4 text-gray-600" />
                      </button>
                      {menuOpenId === (c.CommentID || c._id) && (
                        <div
                          data-menu-id={`${c.CommentID || c._id}`}
                          className="absolute right-0 mt-1 bg-white border rounded-lg shadow-lg z-20 w-36 py-1 text-sm"
                        >
                          <button
                            onClick={() => {
                              setEditingId(c.CommentID || c._id);
                              setEditingContent(c.Content || c.content || '');
                              setMenuOpenId(null);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700"
                          >
                            Chỉnh sửa
                          </button>
                          <button
                            onClick={async () => {
                              setMenuOpenId(null);
                              if (!window.confirm('Bạn có chắc muốn xóa bình luận này?')) return;
                              try {
                                const resp = await commentAPI.delete(c.CommentID || c._id);
                                if (resp && resp.success) {
                                  await loadComments();
                                } else {
                                  alert(resp.message || 'Xóa bình luận thất bại');
                                }
                              } catch (err) {
                                console.error('Delete comment error', err);
                                alert('Lỗi khi xóa bình luận');
                              }
                            }}
                            className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50"
                          >
                            Xóa
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="text-sm text-gray-700 mt-1">
                {editingId === (c.CommentID || c._id) ? (
                  <div className="mt-2">
                    <textarea
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      className="w-full border rounded-lg p-3 focus:outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all"
                      rows={3}
                      placeholder="Chỉnh sửa bình luận của bạn..."
                    />
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={async () => {
                          if (!editingContent.trim()) {
                            alert('Bình luận không được để trống');
                            return;
                          }
                          try {
                            const resp = await commentAPI.update(c.CommentID || c._id, { content: editingContent });
                            if (resp && resp.success) {
                              setEditingId(null);
                              setEditingContent('');
                              await loadComments();
                            } else {
                              alert(resp.message || 'Cập nhật thất bại');
                            }
                          } catch (err) {
                            console.error('Update comment error', err);
                            alert('Lỗi khi cập nhật bình luận');
                          }
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Lưu
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(null);
                          setEditingContent('');
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Hủy
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

            {hasImages && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(c.images || c.Images).map((imgUrl, idx) => {
                  const src = imgUrl.startsWith('/')
                    ? `${window.location.origin}${imgUrl}`
                    : imgUrl;
                  return (
                    <div key={idx} className="relative group rounded-lg overflow-hidden shadow-sm">
                      <img
                        src={src}
                        alt={`comment-img-${idx}`}
                        className="w-full h-48 object-cover transition-transform group-hover:scale-105 duration-300"
                        onClick={() => window.open(src, '_blank')}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'https://via.placeholder.com/300x200?text=Image+not+found';
                        }}
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          className="px-4 py-2 bg-white/90 rounded-lg text-sm font-medium hover:bg-white transition-colors flex items-center gap-2"
                          onClick={() => window.open(src, '_blank')}
                        >
                          <ImageIcon size={16} />
                          Xem ảnh
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {replyTo === (c.CommentID || c._id) && (
              <div className="mt-3 pl-4 border-l-2 border-gray-200">
                <CommentForm
                  postId={postId}
                  parentCommentId={c.CommentID || c._id}
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
