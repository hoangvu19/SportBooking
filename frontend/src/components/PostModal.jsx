import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import CommentList from './CommentList';
import CommentForm from './CommentForm';

const PostModal = ({ post, visible, onClose, onCommentCreated }) => {
  const [commentsReloadTrigger, setCommentsReloadTrigger] = useState(0);
  const [lastCreatedCommentId, setLastCreatedCommentId] = useState(null);
  const commentsContainerRef = useRef(null);

  // Auto-scroll to bottom when modal opens or comments change
  useEffect(() => {
    if (!visible) return;
    const el = commentsContainerRef.current;
    if (el) {
      // small timeout to wait for children to render
      setTimeout(() => {
        el.scrollTop = el.scrollHeight;
      }, 50);
    }
  }, [visible, commentsReloadTrigger]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white w-full max-w-4xl h-[80vh] rounded-lg shadow-lg overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="text-lg font-semibold">Bài viết của {post.user?.full_name || post.user?.username}</div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X />
          </button>
        </div>
        <div className="flex h-full">
          {/* Left: post content */}
          <div className="w-1/2 p-4 overflow-auto border-r">
            <div className="flex items-center gap-3 mb-3">
              <img src={post.user?.profile_picture} alt="" className="w-10 h-10 rounded-full" />
              <div>
                <div className="font-medium">{post.user?.full_name}</div>
                <div className="text-xs text-gray-500">@{post.user?.username}</div>
              </div>
            </div>
            <div className="prose max-w-none text-sm whitespace-pre-line mb-3">
              {post.content}
            </div>
            <div className="grid grid-cols-1 gap-2">
              {post.image_urls && post.image_urls.map((img, i) => (
                <img key={i} src={img} className="w-full object-cover rounded" alt="" />
              ))}
            </div>
          </div>

          {/* Right: comments */}
          <div className="w-1/2 p-4 flex flex-col h-full">
            {/* Scrollable comments area */}
            <div
              ref={commentsContainerRef}
              className="flex-1 overflow-auto pr-2"
              style={{ maxHeight: '100%', paddingBottom: '140px' }}
            >
                <CommentList postId={post._id} reloadTrigger={commentsReloadTrigger} scrollToCommentId={lastCreatedCommentId} />
            </div>

            {/* Sticky comment input box (always visible) */}
            <div className="sticky bottom-0 bg-white pt-3 border-t">
              <div className="max-w-full px-0 py-2">
                <div className="text-sm text-gray-600 mb-2">Viết bình luận</div>
                <CommentForm
                  postId={post._id}
                  onCreated={(data) => {
                    const createdId = data && (data._id || data.CommentID);
                    setLastCreatedCommentId(createdId);
                    setCommentsReloadTrigger((n) => n + 1);
                    if (typeof onCommentCreated === 'function') onCommentCreated(data);
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostModal;
