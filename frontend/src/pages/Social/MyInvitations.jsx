/**
 * MyInvitations Page
 * Trang xem danh sách lời mời tham gia booking posts
 */

import React, { useState, useEffect, useCallback } from 'react';
import { bookingPostAPI } from '../../utils/bookingPostAPI';
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
      setInvitations(response.data || response);
    } catch (err) {
      console.error('Error fetching invitations:', err);
      setError(err.message || 'Không thể tải danh sách lời mời');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  const handleQuickAction = async (postId, action) => {
    try {
      if (action === 'accept') {
        await bookingPostAPI.acceptInvitation(postId);
        alert('✅ Đã chấp nhận lời mời!');
      } else if (action === 'reject') {
        if (!confirm('Bạn có chắc muốn từ chối lời mời?')) return;
        await bookingPostAPI.rejectInvitation(postId);
        alert('✅ Đã từ chối lời mời!');
      }
      
      // Refresh list
      fetchInvitations();
    } catch (err) {
      alert(`❌ ${err.message || 'Không thể thực hiện hành động'}`);
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
        <h1>📬 Lời Mời Của Tôi</h1>
        <p>Quản lý các lời mời tham gia trận đấu</p>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          ⏳ Chờ xác nhận
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
          ✅ Đã chấp nhận
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
          ❌ Đã từ chối
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
          <button onClick={fetchInvitations}>Thử lại</button>
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
              {activeTab === 'pending' && 'Chưa có lời mời nào'}
              {activeTab === 'accepted' && 'Chưa chấp nhận lời mời nào'}
              {activeTab === 'rejected' && 'Chưa từ chối lời mời nào'}
            </h3>
            <p>
              {activeTab === 'pending' &&
                'Các lời mời tham gia sẽ hiển thị ở đây'}
              {activeTab === 'accepted' &&
                'Các lời mời đã chấp nhận sẽ hiển thị ở đây'}
              {activeTab === 'rejected' &&
                'Các lời mời đã từ chối sẽ hiển thị ở đây'}
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
                  <span>Bạn đã chấp nhận lời mời này</span>
                </div>
              )}

              {activeTab === 'rejected' && (
                <div className="status-info rejected">
                  <span className="status-icon">❌</span>
                  <span>Bạn đã từ chối lời mời này</span>
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
};

export default MyInvitations;
