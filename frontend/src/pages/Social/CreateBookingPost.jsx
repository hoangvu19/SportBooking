/**
 * CreateBookingPost Page
 * Form to create a booking post after booking/paying a deposit
 */

import React, { useState, useEffect } from 'react';
import { useI18n } from '../../i18n/hooks';
import toast from 'react-hot-toast';
import { useNavigate, useLocation } from 'react-router-dom';
import { bookingPostAPI } from '../../utils/bookingPostAPI';
import './CreateBookingPost.css';

const CreateBookingPost = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get booking info from navigation state (if provided)
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
    toast.error(t('createBooking.imageTooLarge'));
        return;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
  toast.error(t('createBooking.selectImage'));
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
      setError('Please enter post content');
      return false;
    }

    if (formData.content.length > 1000) {
      setError('Content must not exceed 1000 characters');
      return false;
    }

    const maxPlayers = parseInt(formData.maxPlayers);
    if (maxPlayers < 4 || maxPlayers > 22) {
      setError('Number of players must be between 4 and 22');
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

      // response shape may be { success: true, data: { bookingPost: {...}, PostID } }
        const createdId = response?.data?.PostID || response?.data?.bookingPost?.PostID || response?.data?.bookingPost?.PostID || null;
        toast.success(t('composer.posted'));
      if (createdId) {
        navigate(`/booking-post/${createdId}`);
      } else {
        navigate('/feed');
      }
    } catch (err) {
      console.error('Error creating booking post:', err);
      setError(err.message || 'Unable to create post');
    } finally {
      setLoading(false);
    }
  };

  const { t } = useI18n();

  if (loading) {
    return (
      <div className="create-booking-post-page loading">
        <div className="spinner"></div>
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="create-booking-post-page">
      {/* Header */}
      <div className="page-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <h1>📝 Create a 'Find Players' Post</h1>
  <p>Share your booking and find teammates</p>
      </div>

      {/* Booking Info (if available) */}
      {bookingInfo && (
        <div className="booking-info-card">
          <h3>📍 Booked field information</h3>
          <div className="info-row">
            <span className="label">Facility:</span>
            <span className="value">{bookingInfo.FacilityName}</span>
          </div>
          <div className="info-row">
            <span className="label">Field:</span>
            <span className="value">{bookingInfo.FieldName}</span>
          </div>
          <div className="info-row">
            <span className="label">Time:</span>
            <span className="value">
              {new Date(bookingInfo.StartTime).toLocaleString()}
            </span>
          </div>
          <div className="info-row">
            <span className="label">Price:</span>
            <span className="value price">
              {bookingInfo.TotalAmount?.toLocaleString()} VNĐ
            </span>
          </div>
        </div>
      )}

      {/* Form */}
      <form className="create-booking-post-form" onSubmit={handleSubmit}>
        {/* Content */}
        <div className="form-group">
          <label htmlFor="content">
            Post content <span className="required">*</span>
          </label>
          <textarea
            id="content"
            name="content"
            value={formData.content}
            onChange={handleInputChange}
            placeholder="Example: I booked a football field next Saturday, need 5 more players. DM to join! ⚽"
            rows={6}
            maxLength={1000}
            required
          />
          <div className="char-count">
            {formData.content.length}/1000 characters
          </div>
        </div>

        {/* Max Players */}
        <div className="form-group">
          <label htmlFor="maxPlayers">
            Max players <span className="required">*</span>
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
            Enter number of players needed for the match (4-22)
          </small>
        </div>

        {/* Image Upload */}
        <div className="form-group">
          <label>Illustration image (optional)</label>
          
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
                <span>Choose image</span>
              </label>
              <small className="form-hint">
                Max size: 5MB. Formats: JPG, PNG, GIF
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
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn-submit" disabled={loading}>
            {loading ? t('common.loading') : t('composer.postButton')}
          </button>
        </div>
      </form>

      {/* Tips */}
      <div className="tips-card">
        <h3>💡 Tips for an effective post</h3>
        <ul>
          <li>Be clear about time, location, and number of players needed</li>
          <li>Mention skill level if relevant</li>
          <li>Add field or team photos to attract players</li>
          <li>Update the post when you have enough players</li>
        </ul>
      </div>
    </div>
  );
};

export default CreateBookingPost;
