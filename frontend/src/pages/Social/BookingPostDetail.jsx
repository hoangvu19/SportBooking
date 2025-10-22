/**
 * BookingPostDetail Page
 * Trang chi tiết bài đăng booking post với danh sách người chơi
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { bookingPostAPI } from '../../utils/bookingPostAPI';
import './BookingPostDetail.css';

const BookingPostDetail = () => {
  const { postId } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const currentUserId = parseInt(localStorage.getItem('userId') || '0');

  const fetchPostDetail = useCallback(async () => {
    try {
      const response = await bookingPostAPI.getById(postId);
      setPost(response.data || response);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching post:', err);
      setError(err.message || 'Không thể tải bài đăng');
      setLoading(false);
    }
  }, [postId]);

  const fetchPlayers = useCallback(async () => {
    try {
      const response = await bookingPostAPI.getPlayers(postId);
      setPlayers(response.data || response);
    } catch (err) {
      console.error('Error fetching players:', err);
    }
  }, [postId]);

  useEffect(() => {
    fetchPostDetail();
    fetchPlayers();
  }, [fetchPostDetail, fetchPlayers]);

  const handleAcceptInvitation = async () => {
    if (actionLoading) return;
    setActionLoading(true);

    try {
      await bookingPostAPI.acceptInvitation(postId);
      alert('✅ Đã chấp nhận lời mời!');
      fetchPostDetail();
      fetchPlayers();
    } catch (err) {
      alert(`❌ ${err.message || 'Không thể chấp nhận lời mời'}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectInvitation = async () => {
    if (actionLoading) return;
    if (!confirm('Bạn có chắc muốn từ chối lời mời?')) return;

    setActionLoading(true);

    try {
      await bookingPostAPI.rejectInvitation(postId);
      alert('✅ Đã từ chối lời mời!');
      fetchPostDetail();
      fetchPlayers();
    } catch (err) {
      alert(`❌ ${err.message || 'Không thể từ chối lời mời'}`);
    } finally {
      setActionLoading(false);
    }
  };

  const formatDateTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString('vi-VN', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="booking-post-detail-page loading">
        <div className="spinner"></div>
        <p>Đang tải...</p>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="booking-post-detail-page error">
        <div className="error-icon">⚠️</div>
        <h2>Không thể tải bài đăng</h2>
        <p>{error}</p>
        <button onClick={() => navigate(-1)}>Quay lại</button>
      </div>
    );
  }

  const {
    Content,
    CreatedDate,
    SportName,
    FieldName,
    FacilityName,
    StartTime,
    EndTime,
    MaxPlayers,
    CurrentPlayers,
    OwnerUsername,
    OwnerFullName,
    OwnerAvatar,
    RentalPrice,
    AccountID: ownerId,
  } = post;

  const isOwner = currentUserId === ownerId;
  const myPlayer = players.find((p) => p.AccountID === currentUserId);
  const isPending = myPlayer?.Status === 'Pending';
  const isAccepted = myPlayer?.Status === 'Accepted';
  const isRejected = myPlayer?.Status === 'Rejected';
  const isFull = CurrentPlayers >= MaxPlayers;

  const acceptedPlayers = players.filter((p) => p.Status === 'Accepted');
  const pendingPlayers = players.filter((p) => p.Status === 'Pending');

  return (
    <div className="booking-post-detail-page">
      {/* Back Button */}
      <button className="back-button" onClick={() => navigate(-1)}>
        ← Quay lại
      </button>

      {/* Post Card */}
      <div className="post-detail-card">
        {/* Owner Info */}
        <div className="owner-section">
          <img
            src={OwnerAvatar || '/default-avatar.png'}
            alt={OwnerFullName}
            className="owner-avatar-large"
          />
          <div className="owner-info">
            <h3>{OwnerFullName || OwnerUsername}</h3>
            <p className="post-time">{formatDateTime(CreatedDate)}</p>
          </div>
          <div className="sport-badge-large">{SportName}</div>
        </div>

        {/* Content */}
        <div className="post-content">
          <p>{Content}</p>
        </div>

        {/* Booking Info */}
        <div className="booking-info-detailed">
          <h4>📍 Thông tin sân</h4>
          <div className="info-grid">
            <div className="info-item">
              <span className="label">Cơ sở:</span>
              <span className="value">{FacilityName}</span>
            </div>
            <div className="info-item">
              <span className="label">Sân:</span>
              <span className="value">{FieldName}</span>
            </div>
            <div className="info-item">
              <span className="label">Thời gian:</span>
              <span className="value">
                {formatTime(StartTime)} - {formatTime(EndTime)}
              </span>
            </div>
            <div className="info-item">
              <span className="label">Giá thuê:</span>
              <span className="value price">
                {RentalPrice?.toLocaleString('vi-VN')}đ
              </span>
            </div>
          </div>
        </div>

        {/* Players Status */}
        <div className="players-status-detailed">
          <h4>👥 Tình trạng người chơi</h4>
          <div className="players-progress-section">
            <div className="progress-info">
              <span className="progress-text">
                {CurrentPlayers}/{MaxPlayers} người
              </span>
              <span className={`progress-status ${isFull ? 'full' : ''}`}>
                {isFull ? 'Đã đủ' : `Còn ${MaxPlayers - CurrentPlayers} chỗ`}
              </span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${(CurrentPlayers / MaxPlayers) * 100}%`,
                  backgroundColor: isFull ? '#e74c3c' : '#27ae60',
                }}
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {!isOwner && (
          <div className="action-buttons">
            {!myPlayer && !isFull && (
              <p className="info-text">
                Hãy bình luận để chủ bài đăng mời bạn tham gia!
              </p>
            )}

            {isPending && (
              <>
                <button
                  className="btn btn-accept"
                  onClick={handleAcceptInvitation}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Đang xử lý...' : '✓ Chấp nhận tham gia'}
                </button>
                <button
                  className="btn btn-reject"
                  onClick={handleRejectInvitation}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Đang xử lý...' : '✗ Từ chối'}
                </button>
              </>
            )}

            {isAccepted && (
              <div className="status-message accepted">
                ✅ Bạn đã chấp nhận tham gia
              </div>
            )}

            {isRejected && (
              <div className="status-message rejected">
                ❌ Bạn đã từ chối lời mời
              </div>
            )}
          </div>
        )}
      </div>

      {/* Players List */}
      <div className="players-list-section">
        <h3>👥 Danh sách người chơi</h3>

        {/* Accepted Players */}
        {acceptedPlayers.length > 0 && (
          <div className="players-group">
            <h4 className="group-title accepted">
              ✓ Đã chấp nhận ({acceptedPlayers.length})
            </h4>
            <div className="players-grid">
              {acceptedPlayers.map((player) => (
                <div key={player.AccountID} className="player-card accepted">
                  <img
                    src={player.AvatarUrl || '/default-avatar.png'}
                    alt={player.FullName}
                    className="player-avatar"
                  />
                  <div className="player-info">
                    <div className="player-name">{player.FullName || player.Username}</div>
                    <div className="player-time">
                      {new Date(player.RespondedAt).toLocaleDateString('vi-VN')}
                    </div>
                  </div>
                  {player.AccountID === ownerId && (
                    <span className="owner-badge">Chủ</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pending Players */}
        {pendingPlayers.length > 0 && (
          <div className="players-group">
            <h4 className="group-title pending">
              ⏳ Chờ phản hồi ({pendingPlayers.length})
            </h4>
            <div className="players-grid">
              {pendingPlayers.map((player) => (
                <div key={player.AccountID} className="player-card pending">
                  <img
                    src={player.AvatarUrl || '/default-avatar.png'}
                    alt={player.FullName}
                    className="player-avatar"
                  />
                  <div className="player-info">
                    <div className="player-name">{player.FullName || player.Username}</div>
                    <div className="player-time">
                      Mời: {new Date(player.InvitedAt).toLocaleDateString('vi-VN')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {players.length === 0 && (
          <div className="empty-players">
            <div className="empty-icon">👤</div>
            <p>Chưa có người chơi nào</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingPostDetail;
