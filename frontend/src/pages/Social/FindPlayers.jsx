/**
 * FindPlayers Page
 * Trang tìm kiếm booking posts theo môn thể thao
 */

import React, { useState, useEffect, useCallback } from 'react';
import { bookingPostAPI } from '../../utils/bookingPostAPI';
import PostCard from '../../components/Social/PostCard';
import './FindPlayers.css';

const FindPlayers = () => {
  const [sportTypes, setSportTypes] = useState([]);
  const [selectedSport, setSelectedSport] = useState('all');
  const [bookingPosts, setBookingPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchSportTypes = async () => {
    try {
      // TODO: Thay bằng API thực tế để lấy danh sách môn thể thao
      // Tạm thời hardcode
      setSportTypes([
        { SportTypeID: 1, SportName: 'Bóng đá' },
        { SportTypeID: 2, SportName: 'Bóng rổ' },
        { SportTypeID: 3, SportName: 'Cầu lông' },
        { SportTypeID: 4, SportName: 'Tennis' },
        { SportTypeID: 5, SportName: 'Bóng chuyền' },
      ]);
    } catch (err) {
      console.error('Error fetching sport types:', err);
    }
  };

  const fetchBookingPosts = useCallback(async (reset = false) => {
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      let response;
      const params = { page, limit: 20 };

      if (selectedSport === 'all') {
        response = await bookingPostAPI.getAll(params);
      } else {
        response = await bookingPostAPI.getBySportType(selectedSport, params);
      }

      const newPosts = response.data?.posts || [];

      if (reset) {
        setBookingPosts(newPosts);
      } else {
        setBookingPosts((prev) => [...prev, ...newPosts]);
      }

      setHasMore(newPosts.length >= 20);
    } catch (err) {
      console.error('Error fetching booking posts:', err);
      setError(err.message || 'Không thể tải bài đăng');
    } finally {
      setLoading(false);
    }
  }, [selectedSport, page, loading]);

  // Fetch sport types on mount
  useEffect(() => {
    fetchSportTypes();
  }, []);

  // Fetch booking posts when dependencies change
  useEffect(() => {
    fetchBookingPosts(true);
  }, [fetchBookingPosts]);

  const handleSportChange = (sportId) => {
    setSelectedSport(sportId);
    setPage(1);
    setBookingPosts([]);
  };

  const handleLoadMore = () => {
    setPage((prev) => prev + 1);
  };

  return (
    <div className="find-players-page">
      {/* Header */}
      <div className="page-header">
        <h1>🔍 Tìm Người Chơi</h1>
        <p>Tìm kiếm và tham gia các trận đấu đã đặt sân</p>
      </div>

      {/* Sport Filter */}
      <div className="sport-filter">
        <button
          className={`sport-button ${selectedSport === 'all' ? 'active' : ''}`}
          onClick={() => handleSportChange('all')}
        >
          🏆 Tất cả
        </button>
        {sportTypes.map((sport) => (
          <button
            key={sport.SportTypeID}
            className={`sport-button ${
              selectedSport === sport.SportTypeID ? 'active' : ''
            }`}
            onClick={() => handleSportChange(sport.SportTypeID)}
          >
            {sport.SportName}
          </button>
        ))}
      </div>

      {/* Error Message */}
      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
          <button onClick={() => fetchBookingPosts(true)}>Thử lại</button>
        </div>
      )}

      {/* Booking Posts List */}
      <div className="booking-posts-list">
        {bookingPosts.length === 0 && !loading && (
          <div className="empty-state">
            <div className="empty-icon">🏟️</div>
            <h3>Chưa có bài đăng nào</h3>
            <p>
              {selectedSport === 'all'
                ? 'Hãy là người đầu tiên đặt sân và tìm người chơi!'
                : 'Không có bài đăng nào cho môn thể thao này'}
            </p>
          </div>
        )}

        {bookingPosts.map((post) => (
          <PostCard key={post.PostID || post._id || post.PostId} post={post} />
        ))}

        {/* Loading Skeleton */}
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

        {/* Load More Button */}
        {hasMore && !loading && bookingPosts.length > 0 && (
          <button className="load-more-button" onClick={handleLoadMore}>
            Xem thêm
          </button>
        )}
      </div>

      {/* Floating Action Button - Create Booking Post */}
      <button
        className="fab"
        onClick={() => (window.location.href = '/create-booking-post')}
        title="Tạo bài đăng tìm người chơi"
      >
        <span className="fab-icon">+</span>
      </button>
    </div>
  );
};

export default FindPlayers;
