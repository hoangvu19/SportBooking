/**
 * CreateBookingPostButton Component
 * Button để tạo bài viết về booking status và share lên Feed
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { postAPI } from '../../utils/api';
import './CreateBookingPostButton.css';
import { useI18n } from '../../i18n/hooks';
import toast from 'react-hot-toast';

const CreateBookingPostButton = ({ booking, onSuccess }) => {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { t, lang } = useI18n();

  const getDefaultContent = () => {
    const { BookingStatus, FacilityName, FieldName, StartTime } = booking;
    // Format date according to current language to produce localized strings
    const dt = StartTime ? new Date(StartTime) : new Date();
    const date = lang === 'vi' ? dt.toLocaleDateString('vi-VN') : dt.toLocaleDateString();

    if (BookingStatus === 'Confirmed') {
      return t('booking.autoPost.confirmed', '🎉 I just booked {facility} - {field} on {date}! Anyone wants to join? ⚽')
        .replace('{facility}', FacilityName || '')
        .replace('{field}', FieldName || '')
        .replace('{date}', date);
    } else if (BookingStatus === 'Pending') {
      return t('booking.autoPost.pending', '⏳ Booking pending at {facility} - {field} on {date}. Hope it gets confirmed soon! 🤞')
        .replace('{facility}', FacilityName || '')
        .replace('{field}', FieldName || '')
        .replace('{date}', date);
    } else if (BookingStatus === 'Cancelled') {
      return t('booking.autoPost.cancelled', '😢 Booking at {facility} - {field} was cancelled. Better luck next time!')
        .replace('{facility}', FacilityName || '')
        .replace('{field}', FieldName || '');
    }
    return '';
  };

  const handleOpenModal = () => {
    setContent(getDefaultContent());
    setShowModal(true);
  };

  const handleClose = () => {
    setShowModal(false);
    setContent('');
    setError(null);
  };

  const handleCreatePost = async () => {
    if (!content.trim()) {
      setError(t('booking.enterPostContent','Please enter post content'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create post with booking data
      const response = await postAPI.create({
        content,
        bookingId: booking.BookingID,
      });

      if (response.success) {
    toast.success(t('composer.posted'));
        handleClose();
        if (onSuccess) onSuccess();
        // Optionally navigate to feed
        navigate('/feed');
      } else {
  setError(response.message || t('booking.unableToCreatePost','Unable to create post'));
      }
    } catch (err) {
      console.error('Error creating post:', err);
  setError(err.message || t('booking.unableToConnect','Unable to connect to server'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Button to open modal */}
      <button className="create-booking-post-btn" onClick={handleOpenModal}>
        📱 {t('booking.postToFeed','Post to Feed')}
      </button>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={handleClose}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('booking.createBookingPostTitle','Create booking post')}</h3>
              <button className="close-button" onClick={handleClose}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              {/* Booking Preview */}
              <div className="booking-preview">
                <div className="preview-status">
                  {booking.BookingStatus === 'Pending' && (
                    <span className="status pending">⏳ {t('booking.status.Pending','Pending')}</span>
                  )}
                  {booking.BookingStatus === 'Confirmed' && (
                    <span className="status confirmed">✅ {t('booking.status.Confirmed','Confirmed')}</span>
                  )}
                  {booking.BookingStatus === 'Cancelled' && (
                    <span className="status cancelled">❌ {t('booking.status.Cancelled','Cancelled')}</span>
                  )}
                </div>
                <p className="preview-info">
                  🏟️ {booking.FacilityName} - {booking.FieldName}
                </p>
                <p className="preview-info">
                  📅 {new Date(booking.StartTime).toLocaleString()}
                </p>
              </div>

              {/* Content Input */}
              <textarea
                className="post-content-input"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={t('booking.postPlaceholder', "What's your thought about this booking?")}
                rows={6}
                maxLength={1000}
              />
              <div className="char-count">
                {content.length}/1000 characters
              </div>

              {/* Error Message */}
              {error && (
                <div className="error-message">
                  <span className="error-icon">⚠️</span>
                  <span>{error}</span>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={handleClose}>
                {t('common.cancel')}
              </button>
              <button
                className="btn-post"
                onClick={handleCreatePost}
                disabled={loading || !content.trim()}
              >
                {loading ? t('composer.posting') : t('composer.postButton')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CreateBookingPostButton;
