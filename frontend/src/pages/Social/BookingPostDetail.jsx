/**
 * BookingPostDetail Page
 * Trang chi tiết bài đăng booking post với danh sách người chơi
 */

import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useI18n } from '../../i18n/hooks';
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
  setError(err.message || 'Unable to load post');
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
  toast.success(t('post.invitationAccepted'));
      fetchPostDetail();
      fetchPlayers();
    } catch (err) {
  toast.error(t('post.invitationActionFailed').replace('{msg}', err.message || 'Unable to accept invitation'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectInvitation = async () => {
    if (actionLoading) return;
    if (!window.confirm(t('post.declineInviteConfirm'))) return;

    setActionLoading(true);

    try {
      await bookingPostAPI.rejectInvitation(postId);
      toast.success(t('post.invitationDeclined'));
      fetchPostDetail();
      fetchPlayers();
    } catch (err) {
  toast.error(t('post.invitationActionFailed').replace('{msg}', err.message || 'Unable to decline invitation'));
    } finally {
      setActionLoading(false);
    }
  };

  const formatDateTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString(undefined, {
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

  const { t } = useI18n();

  if (loading) {
    return (
      <div className="booking-post-detail-page loading">
        <div className="spinner"></div>
  <p>{t('common.loading')}</p>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="booking-post-detail-page error">
        <div className="error-icon">⚠️</div>
  <h2>Unable to load post</h2>
        <p>{error}</p>
        <button onClick={() => navigate(-1)}>Back</button>
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
        ← Back
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
          <h4>📍 Booking info</h4>
          <div className="info-grid">
            <div className="info-item">
              <span className="label">Facility:</span>
              <span className="value">{FacilityName}</span>
            </div>
            <div className="info-item">
              <span className="label">Field:</span>
              <span className="value">{FieldName}</span>
            </div>
            <div className="info-item">
              <span className="label">Time:</span>
              <span className="value">
                {formatTime(StartTime)} - {formatTime(EndTime)}
              </span>
            </div>
            <div className="info-item">
              <span className="label">Rental price:</span>
              <span className="value price">
                {RentalPrice?.toLocaleString('vi-VN')}đ
              </span>
            </div>
          </div>
        </div>

        {/* Players Status */}
        <div className="players-status-detailed">
          <h4>👥 Players status</h4>
          <div className="players-progress-section">
            <div className="progress-info">
              <span className="progress-text">
                {CurrentPlayers}/{MaxPlayers} người
              </span>
              <span className={`progress-status ${isFull ? 'full' : ''}`}>
                {isFull ? 'Full' : `${MaxPlayers - CurrentPlayers} spots left`}
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
                Comment to request to join!
              </p>
            )}

            {isPending && (
              <>
                <button
                  className="btn btn-accept"
                  onClick={handleAcceptInvitation}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Processing...' : '✓ Accept'}
                </button>
                <button
                  className="btn btn-reject"
                  onClick={handleRejectInvitation}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Processing...' : '✗ Decline'}
                </button>
              </>
            )}

            {isAccepted && (
              <div className="status-message accepted">
                ✅ You have accepted
              </div>
            )}

            {isRejected && (
              <div className="status-message rejected">
                ❌ You have declined the invitation
              </div>
            )}
          </div>
        )}
      </div>

      {/* Players List */}
      <div className="players-list-section">
  <h3>👥 Players list</h3>

        {/* Accepted Players */}
        {acceptedPlayers.length > 0 && (
          <div className="players-group">
            <h4 className="group-title accepted">
              ✓ Accepted ({acceptedPlayers.length})
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
              ⏳ Pending ({pendingPlayers.length})
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
            <p>No players yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingPostDetail;
