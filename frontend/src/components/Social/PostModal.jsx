import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import CommentList from './CommentList';
import CommentForm from './CommentForm';
import DEFAULT_AVATAR from "../../utils/defaults";

const PostModal = ({ post, visible, onClose, onCommentCreated }) => {
  const [commentsReloadTrigger, setCommentsReloadTrigger] = useState(0);
  const [lastCreatedCommentId, setLastCreatedCommentId] = useState(null);
  const commentsContainerRef = useRef(null);
  const modalRef = useRef(null);

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

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (visible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [visible]);

  if (!visible) return null;

  const handleBackdropClick = (e) => {
    if (modalRef.current && !modalRef.current.contains(e.target)) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div 
        ref={modalRef}
        className="bg-white w-full max-w-5xl max-h-[90vh] rounded-lg shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header - Fixed với title và close button */}
        <div className="flex items-center justify-center px-4 py-3 border-b bg-white relative shrink-0">
          <h2 className="font-semibold text-gray-900 text-base">Bài viết của {post.user?.full_name}</h2>
          <button 
            onClick={onClose} 
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors focus:outline-none"
            aria-label="Đóng"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Image */}
          {post.image_urls && post.image_urls.length > 0 && (
            <div className="w-3/5 bg-black flex items-center justify-center">
              <img 
                src={post.image_urls[0]} 
                className="max-w-full max-h-full object-contain" 
                alt=""
              />
            </div>
          )}

          {/* Right: Comments Section */}
          <div className={`${post.image_urls && post.image_urls.length > 0 ? 'w-2/5' : 'w-full'} flex flex-col bg-white`}>
            {/* Post Header */}
            <div className="px-4 py-3 border-b shrink-0 max-h-[40vh] overflow-y-auto">
              <div className="flex items-center gap-3">
                <img 
                  src={post.user?.profile_picture || post.user?.AvatarUrl || post.user?.ProfilePictureURL || post.user?.avatarUrl || DEFAULT_AVATAR} 
                  className="w-10 h-10 rounded-full object-cover" 
                  alt=""
                  onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_AVATAR; }}
                />
                <div>
                  <div className="font-semibold text-gray-900 text-sm">
                    {post.user?.full_name || post.user?.username}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(post.createdAt).toLocaleString('vi-VN')}
                  </div>
                </div>
              </div>
              
              {/* Nếu là shared post, hiển thị note của người share */}
              {post.is_shared && post.shared_note && (
                <div className="mt-3 text-sm text-gray-800 whitespace-pre-line">
                  {post.shared_note}
                </div>
              )}

              {/* Nếu là shared post, hiển thị bài viết gốc */}
              {post.is_shared && post.shared_post ? (
                <div className="mt-3 border rounded-lg p-3 bg-gray-50">
                  <div className="flex items-center gap-2 mb-2">
                    <img 
                      src={post.shared_post.user?.profile_picture || post.shared_post.user?.AvatarUrl || post.shared_post.user?.ProfilePictureURL || post.shared_post.user?.avatarUrl || DEFAULT_AVATAR} 
                      className="w-8 h-8 rounded-full object-cover" 
                      alt=""
                      onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_AVATAR; }}
                    />
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">
                        {post.shared_post.user?.full_name || post.shared_post.user?.username}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(post.shared_post.createdAt).toLocaleString('vi-VN')}
                      </div>
                    </div>
                  </div>
                  {post.shared_post.content && (
                    <div className="text-sm text-gray-800 whitespace-pre-line mb-2">
                      {post.shared_post.content}
                    </div>
                  )}
                  {post.shared_post.image_urls && post.shared_post.image_urls.length > 0 && (
                    <img 
                      src={post.shared_post.image_urls[0]} 
                      className="w-full rounded-md object-cover max-h-48" 
                      alt=""
                    />
                  )}
                </div>
              ) : post.is_shared ? (
                <div className="mt-3 text-sm text-gray-500 italic">
                  Bài viết gốc không còn tồn tại
                </div>
              ) : (
                /* Nếu không phải shared post, hiển thị content bình thường */
                post.content && (
                  <div className="mt-3 text-sm text-gray-800 whitespace-pre-line">
                    {post.content}
                  </div>
                )
              )}
            </div>

            {/* Comments List - Scrollable */}
            <div
              ref={commentsContainerRef}
              className="flex-1 overflow-y-auto px-4 py-3"
            >
              <CommentList 
                postId={post._id} 
                reloadTrigger={commentsReloadTrigger} 
                scrollToCommentId={lastCreatedCommentId} 
              />
            </div>

            {/* Comment Input - Fixed at bottom */}
            <div className="border-t bg-white shrink-0">
              <div className="px-4 py-3">
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
