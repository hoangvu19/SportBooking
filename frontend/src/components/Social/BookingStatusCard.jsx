/**
 * BookingStatusCard Component
 * Hiển thị bài viết về booking trên Feed với trạng thái
 * (Chờ xác nhận, Đã xác nhận, Đã hủy)
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './BookingStatusCard.css';
import DEFAULT_AVATAR from '../../utils/defaults';
import { BadgeCheck, Heart, MessageCircle, Share2, MoreHorizontal } from 'lucide-react';
import { reactionAPI, commentAPI, shareAPI } from '../../utils/api';
import ShareModal from './ShareModal';
import PostModal from './PostModal';

const BookingStatusCard = ({ post }) => {
  const navigate = useNavigate();

  // Extract booking data from post
  const booking = post.booking || {};
  const {
    BookingID,
    BookingStatus, // 'Pending', 'Confirmed', 'Cancelled'
    FacilityName,
    FieldName,
    SportName,
    StartTime,
    EndTime,
    TotalAmount,
    DepositPaid,
    PaymentStatus,
  } = booking;

  // User info
  const user = post.user || {};
  const {
    profile_picture = DEFAULT_AVATAR,
    full_name = user.username || 'Unknown',
  } = user;

  // Format date/time
  const formatDateTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get status config
  const getStatusConfig = (status) => {
    switch (status) {
      case 'Pending':
        return {
          label: 'Chờ xác nhận',
          icon: '⏳',
          className: 'status-pending',
          bgColor: '#fff3cd',
          textColor: '#856404',
        };
      case 'Confirmed':
        return {
          label: 'Đã xác nhận',
          icon: '✅',
          className: 'status-confirmed',
          bgColor: '#d4edda',
          textColor: '#155724',
        };
      case 'Cancelled':
        return {
          label: 'Đã hủy',
          icon: '❌',
          className: 'status-cancelled',
          bgColor: '#f8d7da',
          textColor: '#721c24',
        };
      default:
        return {
          label: 'Không xác định',
          icon: '❓',
          className: 'status-unknown',
          bgColor: '#e2e3e5',
          textColor: '#383d41',
        };
    }
  };

  const statusConfig = getStatusConfig(BookingStatus);

  // Social action state (reuse logic from PostCard to keep parity)
  // canonical id for booking or normal posts
  const postId = post?._id || post?.PostID || post?.PostId || post?.id;

  const [likes, setLikes] = useState(typeof post.likes_count === 'number' ? post.likes_count : (post.likes_count && post.likes_count.length) || 0);
  const [liked, setLiked] = useState(!!post.liked_by_current_user);
  const [isLiking, setIsLiking] = useState(false);
  const [commentsCount, setCommentsCount] = useState(post.comments_count || 0);
  const [shareCount, setShareCount] = useState(post.shares_count || 0);
  const [sharedByUser, setSharedByUser] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  // currentUser and menuRef not required here; booking posts don't show owner menu

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

  // initialize share state (whether current user shared + authoritative count)
  useEffect(() => {
    let mounted = true;
    const loadShareState = async () => {
      try {
        if (!postId) return;
        // check if current user has shared
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
        // we only need counts for feed preview
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

  // Calculate duration
  const calculateDuration = (start, end) => {
    if (!start || !end) return '';
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diff = (endDate - startDate) / (1000 * 60); // minutes
    const hours = Math.floor(diff / 60);
    const minutes = diff % 60;
    return hours > 0 ? `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}` : `${minutes}m`;
  };

  const duration = calculateDuration(StartTime, EndTime);

  return (
    <div className="booking-status-card">
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

        {/* Status Badge */}
        <div className={`status-badge ${statusConfig.className}`}>
          <span className="status-icon">{statusConfig.icon}</span>
          <span className="status-label">{statusConfig.label}</span>
        </div>
      </div>

      {/* Content */}
      {post.content && (
        <div className="booking-card-content">
          <p>{post.content}</p>
        </div>
      )}

      {/* Booking Details */}
      <div className="booking-details-container">
        <div className="booking-header">
          <div className="sport-badge">{SportName || '⚽ Thể thao'}</div>
          <h3 className="booking-title">Chi tiết đặt sân</h3>
        </div>

        <div className="booking-info-grid">
          {/* Facility & Field */}
          <div className="info-item">
            <span className="info-icon">🏟️</span>
            <div className="info-content">
              <span className="info-label">Cơ sở</span>
              <span className="info-value">{FacilityName || 'N/A'}</span>
            </div>
          </div>

          <div className="info-item">
            <span className="info-icon">🥅</span>
            <div className="info-content">
              <span className="info-label">Sân</span>
              <span className="info-value">{FieldName || 'N/A'}</span>
            </div>
          </div>

          {/* Date & Time */}
          <div className="info-item">
            <span className="info-icon">📅</span>
            <div className="info-content">
              <span className="info-label">Ngày đặt</span>
              <span className="info-value">
                {StartTime ? new Date(StartTime).toLocaleDateString('vi-VN') : 'N/A'}
              </span>
            </div>
          </div>

          <div className="info-item">
            <span className="info-icon">🕐</span>
            <div className="info-content">
              <span className="info-label">Thời gian</span>
              <span className="info-value">
                {formatTime(StartTime)} - {formatTime(EndTime)} ({duration})
              </span>
            </div>
          </div>

          {/* Price */}
          <div className="info-item full-width">
            <span className="info-icon">💰</span>
            <div className="info-content">
              <span className="info-label">Tổng tiền</span>
              <span className="info-value price">
                {TotalAmount?.toLocaleString('vi-VN')} VNĐ
              </span>
            </div>
          </div>

          {/* Deposit Status - Always show if booking exists */}
          <div className={`info-item deposit-status ${DepositPaid && DepositPaid > 0 ? 'paid' : 'unpaid'}`}>
            <span className="info-icon">💳</span>
            <div className="info-content">
              <span className="info-label">Cọc</span>
              <span className={`info-value ${DepositPaid && DepositPaid > 0 ? 'paid' : 'unpaid'}`}>
                {DepositPaid && DepositPaid > 0 ? '✅ Đã thanh toán' : '⏳ Chưa thanh toán'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons removed: Xem chi tiết and Hủy đặt sân not shown on feed as per requirement */}
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

        {/* Share Button — open ShareModal (same UX as PostCard) */}
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
