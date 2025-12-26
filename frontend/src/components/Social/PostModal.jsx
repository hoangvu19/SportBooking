import React, { useState, useEffect, useRef } from 'react';
import { useI18n } from '../../i18n/hooks';
import { X, Flag } from 'lucide-react';
import CommentList from './CommentList';
import useAuth from "../../hooks/useAuth";
import ReportModal from '../Shared/ReportModal';
import CommentForm from './CommentForm';
import DEFAULT_AVATAR from "../../utils/defaults";
import {  formatVnTime, parseServerDatetime } from '../../utils/vnTime';
import getBackendOrigin, { toAbsoluteUrl } from '../../utils/urlHelpers';
import { formatTimeAgo } from '../../utils/timeFormat';

const PostModal = ({ post, visible, onClose, onCommentCreated }) => {
  const { t } = useI18n();
  const { user: currentUser } = useAuth();
  const [commentsReloadTrigger, setCommentsReloadTrigger] = useState(0);
  const [lastCreatedCommentId, setLastCreatedCommentId] = useState(null);
  const [facilityImg, setFacilityImg] = useState(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const commentsContainerRef = useRef(null);
  const modalRef = useRef(null);

  // Extract booking data
  const isBookingPost = !!(post.booking || post.Booking || post.is_booking);
  const bookingData = post.booking || post.Booking || post;
  const {
    FacilityName = bookingData.FacilityName || post.FacilityName,
    FieldName = bookingData.FieldName || post.FieldName,
    StartTime = bookingData.StartTime || post.StartTime,
    EndTime = bookingData.EndTime || post.EndTime,
    TotalAmount = bookingData.TotalAmount || post.TotalAmount,
    DepositPaid = bookingData.DepositPaid || post.DepositPaid,
    BookingStatus = bookingData.BookingStatus || post.BookingStatus,
  } = bookingData;

  const formatTime = (dateString) => {
    if (!dateString) return '';
    try {
      const d = parseServerDatetime(dateString) || new Date(dateString);
      return formatVnTime(d);
    } catch {
      return '';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const d = parseServerDatetime(dateString) || new Date(dateString);
      return d.toLocaleDateString('en-GB');
    } catch {
      return '';
    }
  };

  // Get status config
  const getStatusConfig = (status) => {
    switch (status) {
      case 'Pending':
        return { label: t('booking.status.Pending'), icon: '⏳', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
      case 'Confirmed':
        return { label: t('booking.status.Confirmed'), icon: '✅', className: 'bg-green-100 text-green-800 border-green-200' };
      case 'Cancelled':
        return { label: t('booking.status.Cancelled'), icon: '❌', className: 'bg-red-100 text-red-800 border-red-200' };
      default:
        return { label: t('booking.status.Unknown'), icon: '❓', className: 'bg-gray-100 text-gray-800 border-gray-200' };
    }
  };

  const statusConfig = getStatusConfig(BookingStatus);

  // Find facility image
  useEffect(() => {
    if (!isBookingPost) return;
    
    const findImage = () => {
      const possible = [];
      if (post.FacilityImage) possible.push(post.FacilityImage);
      if (Array.isArray(post.FacilityImages)) possible.push(...post.FacilityImages);
      if (Array.isArray(post.ImageUrls)) possible.push(...post.ImageUrls);
      if (bookingData.FacilityImageUrl) possible.push(bookingData.FacilityImageUrl);
      if (Array.isArray(bookingData.FacilityImages)) possible.push(...bookingData.FacilityImages);
      if (Array.isArray(post.image_urls)) possible.push(...post.image_urls);
      
      const raw = possible.find(p => p && typeof p === 'string');
      if (!raw) return null;
      
      const base = getBackendOrigin();
      if (/^https?:\/\//i.test(raw)) return raw;
      if (raw.startsWith('/')) return `${base.replace(/\/+$/,'')}${raw}`;
      return toAbsoluteUrl(base, raw, 'facilities') || raw;
    };

    const img = findImage();
    if (img) setFacilityImg(img);
  }, [isBookingPost, post, bookingData]);

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

  const resolvedPostId = post._id || post.PostID || post.postId || post.PostId || post.PostId;
  const currentAccountId = currentUser?.AccountID || currentUser?._id || currentUser?.userId;
  const isOwner = String(currentAccountId) === String(post.user?._id || post.user?.AccountID || post.AccountID);

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
        <div className="flex items-center justify-between px-6 py-4 border-b bg-white shrink-0">
          <h2 className="font-semibold text-gray-900 text-lg">{t('post.postBy', 'Post by')} {post.user?.full_name}</h2>
          <div className="flex items-center gap-2">
            {!isOwner && (
              <button
                onClick={(e) => { e.stopPropagation(); setReportModalOpen(true); }}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors focus:outline-none"
                aria-label="Report post"
              >
                <Flag className="w-5 h-5 text-red-500" />
              </button>
            )}
            <button 
              onClick={onClose} 
              className="p-2 rounded-full hover:bg-gray-100 transition-colors focus:outline-none"
              aria-label="Close"
            >
              <X className="w-6 h-6 text-gray-600" />
            </button>
          </div>
        </div>
        <div className="flex flex-1 overflow-hidden">
          {isBookingPost && (FacilityName || FieldName) ? (
            <div className="w-3/5 bg-gray-50 overflow-y-auto">
              {/* Bỏ padding top để thông tin booking cùng hàng với Post Header */}
              <div className="px-4 pt-3 pb-4">
                <div className="rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-xl">
                  {/* Booking Details */}
                  <div className="p-4 space-y-3">
                    {/* Header: Tên sân bên trái, Ngày giờ bên phải */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1">
                        <span className="text-xl mt-0.5">📍</span>
                        <div className="flex-1">
                          <div className="font-bold text-gray-900 text-lg leading-tight">
                            {FacilityName}
                          </div>
                          <div className="text-sm text-gray-600 mt-0.5 font-medium">
                            {FieldName}
                          </div>
                        </div>
                      </div>
                      
                      {/* Ngày giờ bên phải */}
                      <div className="flex items-center gap-2 text-gray-800 bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-lg">📅</span>
                        <div className="text-xs font-semibold whitespace-nowrap">
                          <div>{formatDate(StartTime)}</div>
                          <div className="mt-0.5">{formatTime(StartTime)} - {formatTime(EndTime)}</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Giá tiền và trạng thái thanh toán */}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">💰</span>
                        <span className="text-xl font-bold text-green-600">
                          {TotalAmount ? `${Number(TotalAmount).toLocaleString()} VND` : 'N/A'}
                        </span>
                      </div>
                      {/* Hiển thị trạng thái thanh toán dựa vào BookingStatus */}
                      {BookingStatus === 'Confirmed' ? (
                        <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border-2 border-green-200">
                          ✓ Paid
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-yellow-50 text-yellow-700 border-2 border-yellow-200">
                          ⏳ Unpaid
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Facility Image */}
                  {facilityImg && (
                    <div className="relative w-full h-64">
                      <img 
                        src={facilityImg}
                        alt={FacilityName || "facility"} 
                        className="w-full h-full object-cover" 
                        onError={(e) => { 
                          e.target.onerror = null; 
                          e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" fill="%23E2E8F0"%3E%3Crect width="800" height="400" fill="%23E2E8F0"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="24" fill="%23718096"%3ENo Image%3C/text%3E%3C/svg%3E';
                        }} 
                      />
                      <div className="absolute top-3 right-3 flex gap-2">
                        {BookingStatus && (
                          <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md bg-white/95 border shadow-lg ${statusConfig.className}`}>
                            <span className="mr-1">{statusConfig.icon}</span>
                            {statusConfig.label}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : post.image_urls && post.image_urls.length > 0 ? (
            <div className="w-3/5 bg-black flex items-center justify-center">
              <img 
                src={post.image_urls[0]} 
                className="max-w-full max-h-full object-contain" 
                alt=""
              />
            </div>
          ) : null}

          <div className={`${(isBookingPost && (FacilityName || FieldName)) || (post.image_urls && post.image_urls.length > 0) ? 'w-2/5' : 'w-full'} flex flex-col bg-white`}>
            <div className="shrink-0 border-b">
              <div className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <img 
                    src={post.user?.profile_picture || post.user?.AvatarUrl || post.user?.ProfilePictureURL || post.user?.avatarUrl || DEFAULT_AVATAR} 
                    className="w-10 h-10 rounded-full object-cover" 
                    alt=""
                    onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_AVATAR; }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 text-sm">
                      {post.user?.full_name || post.user?.username}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatTimeAgo(post.createdAt)}
                    </div>
                  </div>
                </div>
                {post.content && (
                  <div className="mt-3 text-sm text-gray-800 whitespace-pre-line">
                    {post.content}
                  </div>
                )}
                {!isBookingPost && post.is_shared && post.shared_note && (
                  <div className="mt-3 text-sm text-gray-800 whitespace-pre-line">
                    {post.shared_note}
                  </div>
                )}
                {!isBookingPost && post.is_shared && post.shared_post ? (
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
                          {formatTimeAgo(post.shared_post.createdAt)}
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
                ) : !isBookingPost && post.is_shared ? (
                  <div className="mt-3 text-sm text-gray-500 italic">
                    {t('post.originalMissing')}
                  </div>
                ) : null}
              </div>
            </div>

            <div
              ref={commentsContainerRef}
              className="flex-1 overflow-y-auto"
            >
              <div className="px-4 py-3">
                <CommentList 
                  postId={resolvedPostId} 
                  post={post}
                  reloadTrigger={commentsReloadTrigger} 
                  scrollToCommentId={lastCreatedCommentId} 
                />
              </div>
            </div>

            <div className="shrink-0 border-t bg-white">
              <div className="px-4 py-3">
                <CommentForm
                  postId={resolvedPostId}
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
        <ReportModal
          visible={reportModalOpen}
          onClose={() => setReportModalOpen(false)}
          contentType="post"
          contentId={resolvedPostId}
          contentPreview={post.content || ''}
        />
      </div>
    </div>
  );
};

export default PostModal;
