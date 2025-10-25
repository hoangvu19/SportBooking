/**
 * MyInvitations Page
 * Trang xem danh sách lời mời tham gia booking posts
 */

import React, { useState, useEffect, useCallback } from 'react';
import { bookingPostAPI } from '../../utils/bookingPostAPI';
import toast from 'react-hot-toast';
import { useI18n } from '../../i18n/hooks';
import PostCard from '../../components/Social/PostCard';
import './MyInvitations.css';

const MyInvitations = () => {
  const [activeTab, setActiveTab] = useState('pending'); // pending, accepted, rejected
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchInvitations = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await bookingPostAPI.getMyInvitations();
      const raw = response.data || response;
      // Normalize to PostCard shape, preserving booking fields
      const normalized = (Array.isArray(raw) ? raw : (raw.items || raw.list || [])).map((inv) => ({
        _id: inv.PostID?.toString() || inv._id || inv.postId?.toString(),
        PostID: inv.PostID || inv._id || inv.postId,
        content: inv.Content || inv.content || '',
        createdAt: inv.CreatedDate || inv.createdAt || new Date().toISOString(),
        image_urls: inv.Images || inv.image_urls || inv.imageUrls || [],
        user: inv.user || inv.owner || (inv.AccountID ? { _id: inv.AccountID, full_name: inv.OwnerFullName || inv.OwnerName, profile_picture: inv.OwnerAvatar } : {}),
        likes_count: inv.likesCount || inv.reactionsCount || 0,
        liked_by_current_user: inv.likedByCurrentUser || inv.liked_by_current_user || false,
        comments_count: inv.commentsCount || inv.comments_count || 0,
        // booking-specific fields
        BookingID: inv.BookingID || inv.bookingId || inv.booking?.BookingID,
        FacilityName: inv.FacilityName || inv.facilityName || inv.booking?.FacilityName,
        FieldName: inv.FieldName || inv.fieldName || inv.booking?.FieldName,
        StartTime: inv.StartTime || inv.startTime || inv.booking?.StartTime,
        EndTime: inv.EndTime || inv.endTime || inv.booking?.EndTime,
        RentalPrice: inv.RentalPrice || inv.rentalPrice || inv.booking?.RentalPrice,
        CurrentPlayers: inv.CurrentPlayers || inv.currentPlayers || inv.booking?.CurrentPlayers,
        MaxPlayers: inv.MaxPlayers || inv.maxPlayers || inv.booking?.MaxPlayers,
        Status: inv.Status || inv.status || inv.InvitationStatus,
      }));

      setInvitations(normalized);
    } catch (err) {
      console.error('Error fetching invitations:', err);
      setError(err.message || 'Unable to load invitations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  const { t } = useI18n();

  const handleQuickAction = async (postId, action) => {
    try {
      if (action === 'accept') {
        await bookingPostAPI.acceptInvitation(postId);
  toast.success(t('post.invitationAccepted'));
      } else if (action === 'reject') {
  if (!window.confirm(t('post.declineInviteConfirm'))) return;
        await bookingPostAPI.rejectInvitation(postId);
  toast.success(t('post.invitationDeclined'));
      }
      
      // Refresh list
      fetchInvitations();
    } catch (err) {
  toast.error(t('post.invitationActionFailed').replace('{msg}', err.message || 'Unable to perform action'));
    }
  };

  // Filter invitations by status
  const filteredInvitations = invitations.filter((invitation) => {
    if (activeTab === 'pending') return invitation.Status === 'Pending';
    if (activeTab === 'accepted') return invitation.Status === 'Accepted';
    if (activeTab === 'rejected') return invitation.Status === 'Rejected';
    return true;
  });

  return (
    <div className="my-invitations-page">
      {/* Header */}
      <div className="page-header">
  <h1>📬 My Invitations</h1>
  <p>Manage invitations to join matches</p>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          ⏳ Pending
          {invitations.filter((i) => i.Status === 'Pending').length > 0 && (
            <span className="badge">
              {invitations.filter((i) => i.Status === 'Pending').length}
            </span>
          )}
        </button>
        <button
          className={`tab ${activeTab === 'accepted' ? 'active' : ''}`}
          onClick={() => setActiveTab('accepted')}
        >
          ✅ Accepted
          {invitations.filter((i) => i.Status === 'Accepted').length > 0 && (
            <span className="badge accepted">
              {invitations.filter((i) => i.Status === 'Accepted').length}
            </span>
          )}
        </button>
        <button
          className={`tab ${activeTab === 'rejected' ? 'active' : ''}`}
          onClick={() => setActiveTab('rejected')}
        >
          ❌ Rejected
          {invitations.filter((i) => i.Status === 'Rejected').length > 0 && (
            <span className="badge rejected">
              {invitations.filter((i) => i.Status === 'Rejected').length}
            </span>
          )}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
          <button onClick={fetchInvitations}>Retry</button>
        </div>
      )}

      {/* Invitations List */}
      <div className="invitations-list">
        {loading && (
          <div className="loading-container">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton-card">
                <div className="skeleton-header">
                  <div className="skeleton-avatar"></div>
                  <div className="skeleton-text"></div>
                </div>
                <div className="skeleton-content"></div>
                <div className="skeleton-footer"></div>
              </div>
            ))}
          </div>
        )}

        {!loading && filteredInvitations.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">
              {activeTab === 'pending' && '📭'}
              {activeTab === 'accepted' && '🎉'}
              {activeTab === 'rejected' && '🚫'}
            </div>
            <h3>
              {activeTab === 'pending' && 'No invitations yet'}
              {activeTab === 'accepted' && 'No accepted invitations'}
              {activeTab === 'rejected' && 'No rejected invitations'}
            </h3>
            <p>
              {activeTab === 'pending' &&
                'Invitations to join matches will appear here.'}
              {activeTab === 'accepted' &&
                'Accepted invitations will appear here.'}
              {activeTab === 'rejected' &&
                'Rejected invitations will appear here.'}
            </p>
          </div>
        )}

        {!loading &&
          filteredInvitations.map((invitation) => (
            <div key={invitation.PostID} className="invitation-item">
              <PostCard post={invitation} />

              {/* Quick Actions for Pending */}
              {activeTab === 'pending' && (
                <div className="quick-actions">
                  <button
                    className="btn-quick-accept"
                    onClick={() => handleQuickAction(invitation.PostID, 'accept')}
                  >
                    ✅ Chấp nhận
                  </button>
                  <button
                    className="btn-quick-reject"
                    onClick={() => handleQuickAction(invitation.PostID, 'reject')}
                  >
                    ❌ Từ chối
                  </button>
                </div>
              )}

              {/* Status Info */}
              {activeTab === 'accepted' && (
                <div className="status-info accepted">
                  <span className="status-icon">✅</span>
                  <span>You have accepted this invitation</span>
                </div>
              )}

              {activeTab === 'rejected' && (
                <div className="status-info rejected">
                  <span className="status-icon">❌</span>
                  <span>You have rejected this invitation</span>
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
};

export default MyInvitations;
