import React, { useState, useEffect, useCallback } from 'react';
import { useI18n } from '../../i18n/hooks';
import { ratingAPI, fieldCommentAPI } from '../../utils/api';
import toast from 'react-hot-toast';

// StarRating Component - Interactive star display
const StarRating = ({ rating, onRatingChange, readonly = false, size = 'md' }) => {
  const [hover, setHover] = useState(0);
  
  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-10 h-10'
  };
  
  return (
    <div className="flex items-center space-x-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => !readonly && onRatingChange(star)}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => !readonly && setHover(0)}
          className={`${sizeClasses[size]} transition-all ${!readonly && 'hover:scale-110 cursor-pointer'} ${readonly && 'cursor-default'}`}
        >
          <svg
            className={`w-full h-full ${
              star <= (hover || rating)
                ? 'text-yellow-400 fill-current'
                : 'text-gray-300 fill-current'
            }`}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </button>
      ))}
    </div>
  );
};

const FeedbackSection = ({ targetType = 'Field', targetId }) => {
  // Rating state (1 per user)
  const [myRating, setMyRating] = useState(0);
  const [ratingStats, setRatingStats] = useState(null);
  const [savingRating, setSavingRating] = useState(false);
  const [ratingSuccess, setRatingSuccess] = useState(false);
  
  // Comments state (multiple allowed)
  const [comments, setComments] = useState([]);
  const [commentContent, setCommentContent] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [loadingComments, setLoadingComments] = useState(true);
  const [commentPage, setCommentPage] = useState(1);
  const [hasMoreComments, setHasMoreComments] = useState(false);
  
  const [error, setError] = useState(null);

  // Fetch user's rating
  const fetchMyRating = useCallback(async () => {
  try {
  const result = await ratingAPI.getMyRating(targetType, targetId);
      if (result.success && result.data) {
        setMyRating(result.data.Rating);
      }
    } catch (err) {
      console.error('Error fetching my rating:', err);
    }
  }, [targetType, targetId]);

  // Fetch rating stats
  const fetchRatingStats = useCallback(async () => {
    try {
      const result = await ratingAPI.getStats(targetType, targetId);
      if (result.success) {
        setRatingStats(result.data);
      }
    } catch (err) {
      console.error('Error fetching rating stats:', err);
    }
  }, [targetType, targetId]);

  // Fetch comments
  const fetchComments = useCallback(async (page = 1) => {
    try {
      setLoadingComments(true);
      const result = await fieldCommentAPI.getComments(targetType, targetId, page, 20);
      if (result.success) {
        if (page === 1) {
          setComments(result.data);
        } else {
          setComments(prev => [...prev, ...result.data]);
        }
        setHasMoreComments(result.pagination.page < result.pagination.totalPages);
      }
    } catch (err) {
      console.error('Error fetching comments:', err);
      setError(t('feedback.loadError','Unable to load reviews'));
    } finally {
      setLoadingComments(false);
    }
  }, [targetType, targetId]);

  // Load data on mount
  useEffect(() => {
    if (targetId) {
      fetchMyRating();
      fetchRatingStats();
      fetchComments();
    }
  }, [targetId, fetchMyRating, fetchRatingStats, fetchComments]);

  // Handle rating click - Save immediately
  const handleRatingClick = async (rating) => {
    if (rating === myRating) return; // Same rating, no change

    try {
      setSavingRating(true);
      setError(null);
      setRatingSuccess(false);

      const result = await ratingAPI.setRating(targetType, targetId, rating);

      if (result.success) {
        setMyRating(rating);
        setRatingSuccess(true);
        
        // Refresh stats
        await fetchRatingStats();
        
        // Hide success message after 2 seconds
        setTimeout(() => setRatingSuccess(false), 2000);
      } else {
        toast.error(result.message || t('feedback.unableToSaveRating'));
      }
    } catch (err) {
      console.error('Error saving rating:', err);
      toast.error(t('feedback.errorSavingRating'));
    } finally {
      setSavingRating(false);
    }
  };

  // Handle comment submit
  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    
    if (!commentContent.trim()) {
      toast.error(t('feedback.pleaseEnterReview'));
      return;
    }

    try {
      setSubmittingComment(true);
      setError(null);

      const result = await fieldCommentAPI.createComment(targetType, targetId, commentContent);

      if (result.success) {
        setCommentContent('');
        // Reload comments to show new comment
        await fetchComments(1);
        setCommentPage(1);
        toast.success(t('feedback.reviewSubmitted'));
      } else {
        toast.error(result.message || t('feedback.unableToSubmitReview'));
      }
    } catch (err) {
      console.error('Error submitting comment:', err);
      toast.error(t('feedback.errorSubmittingReview'));
    } finally {
      setSubmittingComment(false);
    }
  };

  // Load more comments
  const handleLoadMore = () => {
    const nextPage = commentPage + 1;
    setCommentPage(nextPage);
    fetchComments(nextPage);
  };

  // Format date
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return t('common.justNow','Just now');
  if (diffMins < 60) return t('common.minutesAgo','{n} minutes ago').replace('{n}', diffMins);
  if (diffHours < 24) return t('common.hoursAgo','{n} hours ago').replace('{n}', diffHours);
  if (diffDays < 30) return t('common.daysAgo','{n} days ago').replace('{n}', diffDays);
  return date.toLocaleDateString();
  };

  const { t } = useI18n();

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">{t('feedback.title')}</h2>

      {/* Rating Stats */}
      {ratingStats && (
        <div className="mb-6 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl">
          <div className="flex items-center space-x-4">
            <div className="text-center">
              <div className="text-4xl font-bold text-gray-800">
                {ratingStats.averageRating.toFixed(1)}
              </div>
              <StarRating rating={Math.round(ratingStats.averageRating)} readonly size="sm" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-600">{ratingStats.totalCount} reviews</p>
              {ratingStats.distribution.map((dist) => (
                <div key={dist.star} className="flex items-center space-x-2 text-xs">
                  <span className="w-12">{dist.star} star</span>
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-400"
                      style={{ width: `${(dist.count / ratingStats.totalCount) * 100}%` }}
                    ></div>
                  </div>
                  <span className="w-8 text-gray-500">{dist.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Rating Section - User can click stars to rate */}
      <div className="mb-6 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl">
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          {t('feedback.yourRating','Your rating:')}
        </label>
        <div className="flex items-center space-x-3">
          <StarRating
            rating={myRating}
            onRatingChange={handleRatingClick}
          />
          {savingRating && (
            <span className="text-sm text-indigo-600 animate-pulse">{t('common.saving','Saving...')}</span>
          )}
          {ratingSuccess && !savingRating && (
            <span className="text-sm text-green-600">{t('feedback.savedRating','✓ Saved rating {count} stars').replace('{count}', String(myRating))}</span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {t('feedback.clickToRate','Click a star to rate instantly')}
        </p>
      </div>

      {/* Comment Form - Separate from rating, can submit multiple times */}
      <form onSubmit={handleCommentSubmit} className="mb-6 p-4 bg-gray-50 rounded-xl">
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            {t('feedback.writeYourReview','Write your review:')}
          </label>
          <textarea
            value={commentContent}
            onChange={(e) => setCommentContent(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none placeholder-gray-400 placeholder-opacity-70"
            rows="4"
            placeholder={t('feedback.placeholder','Write your review...')}
            disabled={submittingComment}
          />
        </div>

        <button
          type="submit"
          disabled={submittingComment || !commentContent.trim()}
          className="w-full px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
        >
          {submittingComment ? t('feedback.submitting') : t('feedback.submitButton')}
        </button>
      </form>

      {/* Comments List */}
      <div className="space-y-4">
  <h3 className="text-lg font-semibold text-gray-800">{t('feedback.reviews','Reviews ({count})').replace('{count}', String(comments.length))}</h3>
        
        {loadingComments && commentPage === 1 ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent mx-auto"></div>
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {t('feedback.noReviews','No reviews yet. Be the first!')}
          </div>
        ) : (
          <>
            {comments.map((comment) => (
              <div key={comment.CommentID} className="flex space-x-3 p-4 bg-gray-50 rounded-lg">
                <img
                  src={comment.AvatarUrl || '/default-avatar.png'}
                  alt={comment.FullName}
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="font-semibold text-gray-800">{comment.FullName}</span>
                    <span className="text-xs text-gray-500">{formatDate(comment.CreatedDate)}</span>
                  </div>
                  <p className="text-gray-700 text-sm">{comment.Content}</p>
                </div>
              </div>
            ))}
            
            {hasMoreComments && (
              <button
                onClick={handleLoadMore}
                disabled={loadingComments}
                className="w-full px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
              >
                {loadingComments ? t('common.loading') : t('feedback.loadMore')}
              </button>
            )}
          </>
        )}
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
          {error}
        </div>
      )}
    </div>
  );
};

export default FeedbackSection;
