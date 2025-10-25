/**
 * FindPlayers Page
 * Search booking posts by sport
 */

import React, { useState, useEffect, useCallback } from 'react';
import { bookingPostAPI } from '../../utils/bookingPostAPI';
import PostCard from '../../components/Social/PostCard';
import './FindPlayers.css';
import { useI18n } from '../../i18n/hooks';

const FindPlayers = () => {
  const [sportTypes, setSportTypes] = useState([]);
  const [selectedSport, setSelectedSport] = useState('all');
  const [bookingPosts, setBookingPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const { t } = useI18n();

  const fetchSportTypes = async () => {
    try {
      // TODO: Replace with real API to fetch sports list
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

  // Fetch booking posts for a specific page. If `reset` is true it replaces the list,
  // otherwise it appends the page results to the existing list.
  const fetchBookingPosts = useCallback(async (pageParam = 1, reset = false) => {
    if (loading || loadingMore) return;

    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      let response;
      const params = { page: pageParam, limit: 20 };

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
      setError(err.message || 'Unable to load posts');
    } finally {
      if (reset) setLoading(false);
      else setLoadingMore(false);
    }
  }, [selectedSport, loading]);

  // Fetch sport types on mount
  useEffect(() => {
    fetchSportTypes();
  }, []);

  // Initial load and reload when selected sport changes
  useEffect(() => {
    setPage(1);
    fetchBookingPosts(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSport]);

  const handleSportChange = (sportId) => {
    setSelectedSport(sportId);
    setPage(1);
    setBookingPosts([]);
  };

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchBookingPosts(next, false);
  };

  return (
    <div className="find-players-page">
      {/* Header */}
    <div className="page-header">
  <h1>🔍 {t('findPlayers.title', 'Find Players')}</h1>
  <p>{t('findPlayers.subtitle', 'Search and join booked matches')}</p>
    </div>

      {/* Sport Filter */}
      <div className="sport-filter">
        <button
          className={`sport-button ${selectedSport === 'all' ? 'active' : ''}`}
          onClick={() => handleSportChange('all')}
        >
          🏆 All
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
          <button onClick={() => fetchBookingPosts(1, true)}>{t('common.retry', 'Retry')}</button>
        </div>
      )}

      {/* Booking Posts List */}
      <div className="booking-posts-list">
        {bookingPosts.length === 0 && !loading && (
          <div className="empty-state">
            <div className="empty-icon">🏟️</div>
            <h3>{t('feed.noPosts', 'No posts yet')}</h3>
            <p>
              {selectedSport === 'all'
                ? t('findPlayers.emptyAll', 'Be the first to book a field and find players!')
                : t('findPlayers.emptySport', 'No posts for this sport')}
            </p>
          </div>
        )}

        {bookingPosts.map((post) => (
          <PostCard key={post.PostID || post._id || post.PostId} post={post} />
        ))}

        {/* Loading Skeleton */}
        {loading && bookingPosts.length === 0 && (
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
        {hasMore && bookingPosts.length > 0 && (
          <button className="load-more-button" onClick={handleLoadMore} disabled={loadingMore}>
            {loadingMore ? t('common.loading', 'Loading...') : t('common.loadMore', 'Load more')}
          </button>
        )}
      </div>

      {/* Floating Action Button - Create Booking Post */}
      <button
        className="fab"
        onClick={() => (window.location.href = '/create-booking-post')}
        title="Create a booking post"
      >
        <span className="fab-icon">+</span>
      </button>
    </div>
  );
};

export default FindPlayers;
