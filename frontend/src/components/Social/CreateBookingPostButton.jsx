/**
 * CreateBookingPostButton Component
 * Button để tạo bài viết về booking status và share lên Feed
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { postAPI } from '../../utils/api';
import './CreateBookingPostButton.css';

const CreateBookingPostButton = ({ booking, onSuccess }) => {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getDefaultContent = () => {
    const { BookingStatus, FacilityName, FieldName, StartTime } = booking;
    const date = new Date(StartTime).toLocaleDateString('vi-VN');
    
    if (BookingStatus === 'Confirmed') {
      return `🎉 Mình vừa đặt sân thành công tại ${FacilityName} - ${FieldName} vào ngày ${date}! Ai muốn tham gia cùng không? ⚽`;
    } else if (BookingStatus === 'Pending') {
      return `⏳ Đang chờ xác nhận đặt sân tại ${FacilityName} - ${FieldName} vào ngày ${date}. Hy vọng sẽ được duyệt sớm! 🤞`;
    } else if (BookingStatus === 'Cancelled') {
      return `😢 Đã hủy đặt sân tại ${FacilityName} - ${FieldName}. Lần sau sẽ cố gắng sắp xếp tốt hơn!`;
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
      setError('Vui lòng nhập nội dung bài viết');
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
        alert('✅ Đã đăng bài thành công!');
        handleClose();
        if (onSuccess) onSuccess();
        // Optionally navigate to feed
        navigate('/feed');
      } else {
        setError(response.message || 'Không thể tạo bài viết');
      }
    } catch (err) {
      console.error('Error creating post:', err);
      setError(err.message || 'Không thể kết nối đến server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Button to open modal */}
      <button className="create-booking-post-btn" onClick={handleOpenModal}>
        📱 Đăng lên Feed
      </button>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={handleClose}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Tạo bài viết về đặt sân</h3>
              <button className="close-button" onClick={handleClose}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              {/* Booking Preview */}
              <div className="booking-preview">
                <div className="preview-status">
                  {booking.BookingStatus === 'Pending' && (
                    <span className="status pending">⏳ Chờ xác nhận</span>
                  )}
                  {booking.BookingStatus === 'Confirmed' && (
                    <span className="status confirmed">✅ Đã xác nhận</span>
                  )}
                  {booking.BookingStatus === 'Cancelled' && (
                    <span className="status cancelled">❌ Đã hủy</span>
                  )}
                </div>
                <p className="preview-info">
                  🏟️ {booking.FacilityName} - {booking.FieldName}
                </p>
                <p className="preview-info">
                  📅 {new Date(booking.StartTime).toLocaleString('vi-VN')}
                </p>
              </div>

              {/* Content Input */}
              <textarea
                className="post-content-input"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Bạn đang nghĩ gì về lần đặt sân này?"
                rows={6}
                maxLength={1000}
              />
              <div className="char-count">
                {content.length}/1000 ký tự
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
                Hủy
              </button>
              <button
                className="btn-post"
                onClick={handleCreatePost}
                disabled={loading || !content.trim()}
              >
                {loading ? 'Đang đăng...' : '📱 Đăng bài'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CreateBookingPostButton;
