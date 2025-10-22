/**
 * CreateBookingPost Page
 * Form tạo bài đăng booking post sau khi đã thanh toán đặt sân
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { bookingPostAPI } from '../../utils/bookingPostAPI';
import './CreateBookingPost.css';

const CreateBookingPost = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Lấy booking info từ navigation state (nếu có)
  const bookingInfo = location.state?.booking || null;
  
  const [formData, setFormData] = useState({
    bookingId: bookingInfo?.BookingID || '',
    content: '',
    maxPlayers: bookingInfo?.suggestedPlayers || 10,
    image: null,
  });
  
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Kiểm tra xem booking có hợp lệ không (đã thanh toán)
    if (!bookingInfo && !formData.bookingId) {
      // TODO: Redirect to bookings page or show error
      console.warn('No booking info provided');
    }
  }, [bookingInfo, formData.bookingId]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Kích thước ảnh không được vượt quá 5MB');
        return;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Vui lòng chọn file ảnh');
        return;
      }

      setFormData((prev) => ({
        ...prev,
        image: file,
      }));

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setFormData((prev) => ({
      ...prev,
      image: null,
    }));
    setImagePreview(null);
  };

  const validateForm = () => {
    if (!formData.content.trim()) {
      setError('Vui lòng nhập nội dung bài đăng');
      return false;
    }

    if (formData.content.length > 1000) {
      setError('Nội dung không được vượt quá 1000 ký tự');
      return false;
    }

    const maxPlayers = parseInt(formData.maxPlayers);
    if (maxPlayers < 4 || maxPlayers > 22) {
      setError('Số người chơi phải từ 4 đến 22');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('bookingId', formData.bookingId);
      formDataToSend.append('content', formData.content);
      formDataToSend.append('maxPlayers', formData.maxPlayers);
      
      if (formData.image) {
        formDataToSend.append('image', formData.image);
      }

      const response = await bookingPostAPI.create(formDataToSend);
      
      alert('✅ Tạo bài đăng thành công!');
      navigate(`/booking-post/${response.data.PostID}`);
    } catch (err) {
      console.error('Error creating booking post:', err);
      setError(err.message || 'Không thể tạo bài đăng');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="create-booking-post-page loading">
        <div className="spinner"></div>
        <p>Đang tạo bài đăng...</p>
      </div>
    );
  }

  return (
    <div className="create-booking-post-page">
      {/* Header */}
      <div className="page-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          ← Quay lại
        </button>
        <h1>📝 Tạo Bài Đăng Tìm Người Chơi</h1>
        <p>Chia sẻ thông tin sân đã đặt và tìm đồng đội</p>
      </div>

      {/* Booking Info (if available) */}
      {bookingInfo && (
        <div className="booking-info-card">
          <h3>📍 Thông tin sân đã đặt</h3>
          <div className="info-row">
            <span className="label">Cơ sở:</span>
            <span className="value">{bookingInfo.FacilityName}</span>
          </div>
          <div className="info-row">
            <span className="label">Sân:</span>
            <span className="value">{bookingInfo.FieldName}</span>
          </div>
          <div className="info-row">
            <span className="label">Thời gian:</span>
            <span className="value">
              {new Date(bookingInfo.StartTime).toLocaleString('vi-VN')}
            </span>
          </div>
          <div className="info-row">
            <span className="label">Giá:</span>
            <span className="value price">
              {bookingInfo.TotalAmount?.toLocaleString('vi-VN')} VNĐ
            </span>
          </div>
        </div>
      )}

      {/* Form */}
      <form className="create-booking-post-form" onSubmit={handleSubmit}>
        {/* Content */}
        <div className="form-group">
          <label htmlFor="content">
            Nội dung bài đăng <span className="required">*</span>
          </label>
          <textarea
            id="content"
            name="content"
            value={formData.content}
            onChange={handleInputChange}
            placeholder="Ví dụ: Mình đã đặt sân bóng đá vào thứ 7 tuần sau, còn thiếu 5 người. Ai muốn tham gia liên hệ nhé! ⚽"
            rows={6}
            maxLength={1000}
            required
          />
          <div className="char-count">
            {formData.content.length}/1000 ký tự
          </div>
        </div>

        {/* Max Players */}
        <div className="form-group">
          <label htmlFor="maxPlayers">
            Số người chơi tối đa <span className="required">*</span>
          </label>
          <input
            type="number"
            id="maxPlayers"
            name="maxPlayers"
            value={formData.maxPlayers}
            onChange={handleInputChange}
            min={4}
            max={22}
            required
          />
          <small className="form-hint">
            Nhập số người chơi cần thiết cho trận đấu (4-22 người)
          </small>
        </div>

        {/* Image Upload */}
        <div className="form-group">
          <label>Ảnh minh họa (không bắt buộc)</label>
          
          {!imagePreview ? (
            <div className="image-upload-area">
              <input
                type="file"
                id="image"
                accept="image/*"
                onChange={handleImageChange}
                hidden
              />
              <label htmlFor="image" className="upload-button">
                <span className="upload-icon">📷</span>
                <span>Chọn ảnh</span>
              </label>
              <small className="form-hint">
                Kích thước tối đa: 5MB. Định dạng: JPG, PNG, GIF
              </small>
            </div>
          ) : (
            <div className="image-preview-container">
              <img src={imagePreview} alt="Preview" className="image-preview" />
              <button
                type="button"
                className="remove-image-button"
                onClick={handleRemoveImage}
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Submit Button */}
        <div className="form-actions">
          <button
            type="button"
            className="btn btn-cancel"
            onClick={() => navigate(-1)}
          >
            Hủy
          </button>
          <button type="submit" className="btn btn-submit" disabled={loading}>
            {loading ? 'Đang tạo...' : '🚀 Đăng bài'}
          </button>
        </div>
      </form>

      {/* Tips */}
      <div className="tips-card">
        <h3>💡 Mẹo viết bài đăng hiệu quả</h3>
        <ul>
          <li>Nêu rõ thời gian, địa điểm, và số người cần tìm</li>
          <li>Ghi chú trình độ mong muốn (nếu có)</li>
          <li>Thêm ảnh sân hoặc đội hình để thu hút</li>
          <li>Cập nhật tình trạng khi đủ người</li>
        </ul>
      </div>
    </div>
  );
};

export default CreateBookingPost;
