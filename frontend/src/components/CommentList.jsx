import React, { useEffect, useState, useCallback } from 'react';
import { commentAPI } from '../utils/api';
import CommentForm from './CommentForm';
import { useAuth } from '../hooks/useAuth';
import { MoreHorizontal } from 'lucide-react';

const CommentList = ({ postId, reloadTrigger, scrollToCommentId = null }) => {
  const [comments, setComments] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user: currentUser } = useAuth();
  const [editingId, setEditingId] = useState(null);
  const [editingContent, setEditingContent] = useState('');
  const [menuOpenId, setMenuOpenId] = useState(null);

  const loadComments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await commentAPI.getByPostId(postId);
      if (res && res.success) {
        setComments(res.data || []);
      }
    } catch (err) {
      console.error('Load comments error:', err);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    loadComments();
  }, [postId, reloadTrigger, loadComments]);

  // After comments load, if scrollToCommentId is provided, scroll to it
  useEffect(() => {
    if (!scrollToCommentId) return;
    // small timeout to ensure DOM rendered
    setTimeout(() => {
      const el = document.getElementById(`comment-${scrollToCommentId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        // fallback: scroll to bottom
        const container = document.querySelector('.comments-container');
        if (container) container.scrollTop = container.scrollHeight;
      }
    }, 100);
  }, [comments, scrollToCommentId]);

  // close comment menu on outside click
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

  if (loading) return <div className="text-sm text-gray-500">Loading comments...</div>;

  if (comments.length === 0) return <div className="text-sm text-gray-500">No comments yet</div>;

  // Build a map for quick lookup and children arrays
  const byId = {};
  comments.forEach(c => {
    const id = c.CommentID || c._id;
    byId[id] = { ...c, children: [] };
  });

  const roots = [];
  comments.forEach(c => {
    const id = c.CommentID || c._id;
    const parent = c.parentCommentId || c.ParentCommentID || null;
    if (parent && byId[parent]) {
      byId[parent].children.push(byId[id]);
    } else {
      roots.push(byId[id]);
    }
  });

  const renderComment = (c, depth = 0) => {
    const currentAccountId = currentUser?.AccountID || currentUser?._id || currentUser?.userId;
    const isOwner = String(currentAccountId) === String(c.user?._id || c.user?.AccountID || c.AccountID);
    return (
    <div id={`comment-${c.CommentID || c._id}`} key={c.CommentID || c._id} className="mt-2">
      <div className="flex gap-3 items-start">
        <img src={c.user?.profile_picture || c.ProfilePictureURL} alt="" className={`w-${depth > 0 ? '7' : '8'} h-${depth > 0 ? '7' : '8'} rounded-full`} />
        <div className={`${depth > 0 ? 'bg-gray-50' : 'bg-gray-100'} p-2 rounded-lg w-full`}>
          <div className="flex justify-between items-center">
            <div className="text-sm font-medium">{c.user?.full_name || c.FullName || c.Username}</div>
            <div className="flex items-center gap-2">
              <button className="text-xs text-gray-500" onClick={() => setReplyTo(c.CommentID || c._id)}>Trả lời</button>
              {isOwner && (
                <div className="relative" data-menu-trigger-id={c.CommentID || c._id}>
                  <button onClick={() => setMenuOpenId(menuOpenId === (c.CommentID || c._id) ? null : (c.CommentID || c._id))} className="p-1 rounded hover:bg-gray-100">
                    <MoreHorizontal className="w-4 h-4 text-gray-600" />
                  </button>
                  {menuOpenId === (c.CommentID || c._id) && (
                    <div data-menu-id={`${c.CommentID || c._id}`} className="absolute right-0 mt-2 bg-white border rounded-md shadow z-20 w-36">
                      <button onClick={() => { setEditingId(c.CommentID || c._id); setEditingContent(c.Content || c.content || ''); setMenuOpenId(null); }} className="w-full text-left px-3 py-2 hover:bg-gray-100">Chỉnh sửa</button>
                      <button onClick={async () => {
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
                      }} className="w-full text-left px-3 py-2 text-red-600 hover:bg-gray-100">Xóa</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="text-sm text-gray-700">
            {editingId === (c.CommentID || c._id) ? (
              <div>
                <textarea value={editingContent} onChange={(e) => setEditingContent(e.target.value)} className="w-full border rounded p-2" />
                <div className="flex gap-2 mt-2">
                  <button onClick={async () => {
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
                  }} className="px-3 py-1 bg-green-600 text-white rounded">Lưu</button>
                  <button onClick={() => { setEditingId(null); setEditingContent(''); }} className="px-3 py-1 border rounded">Hủy</button>
                </div>
              </div>
            ) : (
              <>{c.Content || c.content}</>
            )}
          </div>
          {/* images */}
          {(c.images && c.images.length > 0) || (c.Images && c.Images.length > 0) ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {(c.images || c.Images).map((imgUrl, idx) => {
                const src = imgUrl && imgUrl.startsWith('/') ? `${window.location.origin}${imgUrl}` : imgUrl;
                return (
                  <img
                    key={idx}
                    src={src}
                    alt={`comment-img-${idx}`}
                    className="w-40 max-h-64 object-cover rounded"
                    onError={(e) => { e.target.onerror = null; e.target.src = '/favicon.svg'; }}
                  />
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      {/* children */}
      <div className="pl-10 mt-2 space-y-2">
        {c.children && c.children.map(child => renderComment(child, depth + 1))}

        {/* inline reply form for this comment */}
        {replyTo === (c.CommentID || c._id) && (
          <div className="mt-2">
            <CommentForm postId={postId} parentCommentId={replyTo} onCreated={() => { setReplyTo(null); loadComments(); }} onCancelReply={() => setReplyTo(null)} />
          </div>
        )}
      </div>
    </div>
  );
  };

  return (
    <div className="space-y-3">
      {roots.map(r => renderComment(r))}
    </div>
  );
};

export default CommentList;
