import React, { useEffect, useState, useCallback } from "react";
import StoriesBar from "../../components/Social/StoriesBar";
import CreatePostCard from "../../components/Social/CreatePostCard";
import PostCard from "../../components/Social/PostCard";
import BookingStatusCard from "../../components/Social/BookingStatusCard";
import RecentMessages from "../../components/Social/RecentMessages";
import Loading from "../../components/Shared/Loading";
import { postAPI } from "../../utils/api";
import DEFAULT_AVATAR from "../../utils/defaults";
import getBackendOrigin, { toAbsoluteUrl } from '../../utils/urlHelpers';
import { useI18n } from '../../i18n/hooks';
import { parseServerDatetime } from '../../utils/vnTime';
import { normalizeUser } from '../../utils/normalize';

const Feed = () => {

  const [feeds, setFeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchFeeds = useCallback(async (pageNum, isLoadMore = false, bypassCache = false) => {
    try {
      setError(null);
      if (isLoadMore) setLoadingMore(true);
      else setLoading(true);

      console.log(`📥 Fetching page ${pageNum}, isLoadMore: ${isLoadMore}, bypassCache: ${bypassCache}`);
      const response = await postAPI.getFeed(pageNum, 10, bypassCache);

      if (response.success) {
        const postsArray = response.data.posts || response.data || [];
        console.log(`✅ Received ${postsArray.length} posts for page ${pageNum}`);
        
        const backendBase = getBackendOrigin();
        const transformedPosts = postsArray.map(post => {
          // Transform shared_post recursively if it exists
          let transformedSharedPost = null;
              const rawSharedPost = post.shared_post || post.SharedPost;
              if (rawSharedPost) {
            const sharedUserNorm = normalizeUser(rawSharedPost.user || rawSharedPost || {});
            transformedSharedPost = {
              _id: rawSharedPost.PostID || rawSharedPost._id || rawSharedPost.postId,
              PostID: rawSharedPost.PostID || rawSharedPost._id || rawSharedPost.postId,
              content: rawSharedPost.content || rawSharedPost.Content || '',
                  createdAt: parseServerDatetime(rawSharedPost.createdAt || rawSharedPost.CreatedDate || rawSharedPost.createdDate) || new Date(),
              image_urls: (rawSharedPost.image_urls || rawSharedPost.imageUrls || rawSharedPost.Images || []).map(u => toAbsoluteUrl(backendBase, u, 'posts')).filter(Boolean),
              media_urls: (rawSharedPost.media_urls || rawSharedPost.mediaUrls || []).map(u => toAbsoluteUrl(backendBase, u, 'posts')).filter(Boolean),
              user: {
                _id: sharedUserNorm.id || rawSharedPost.user?._id || rawSharedPost.user?.AccountID || rawSharedPost.AccountID,
                username: sharedUserNorm.username || rawSharedPost.user?.username || rawSharedPost.Username,
                full_name: sharedUserNorm.fullName || rawSharedPost.user?.full_name || rawSharedPost.user?.FullName || rawSharedPost.FullName,
                profile_picture: toAbsoluteUrl(backendBase, sharedUserNorm.avatar || rawSharedPost.user?.profile_picture, 'avatars') || DEFAULT_AVATAR,
              },
              booking: rawSharedPost.booking || rawSharedPost.Booking || null,
              Booking: rawSharedPost.booking || rawSharedPost.Booking || null,
              BookingID: rawSharedPost.BookingID,
              FacilityName: rawSharedPost.FacilityName,
              FieldName: rawSharedPost.FieldName,
              SportName: rawSharedPost.SportName,
              StartTime: rawSharedPost.StartTime,
              EndTime: rawSharedPost.EndTime,
              TotalAmount: rawSharedPost.TotalAmount,
              DepositPaid: rawSharedPost.DepositPaid,
              BookingStatus: rawSharedPost.BookingStatus,
              FacilityImage: rawSharedPost.FacilityImage,
              FacilityImages: rawSharedPost.FacilityImages,
              ImageUrls: rawSharedPost.ImageUrls,
              FacilityID: rawSharedPost.FacilityID,
              FieldID: rawSharedPost.FieldID,
              is_booking: rawSharedPost.is_booking,
            };
          }

            const postUserNorm = normalizeUser(post.user || post || {});
            return {
            _id: post.PostID || post._id || post.postId, 
            content: post.content || post.Content,
            createdAt: parseServerDatetime(post.createdAt || post.CreatedDate) || new Date(),
            image_urls: (post.image_urls || post.imageUrls || []).map(u => toAbsoluteUrl(backendBase, u, 'posts')).filter(Boolean),
            media_urls: (post.media_urls || post.mediaUrls || []).map(u => toAbsoluteUrl(backendBase, u, 'posts')).filter(Boolean),
            user: {
              _id: postUserNorm.id || post.user?._id || post.user?.AccountID || post.AccountID,
              username: postUserNorm.username || post.user?.username || post.Username,
              full_name: postUserNorm.fullName || post.user?.full_name || post.user?.FullName || post.FullName,
              profile_picture: toAbsoluteUrl(backendBase, postUserNorm.avatar || post.user?.profile_picture, 'avatars') || DEFAULT_AVATAR,
            },
            likes_count: post.likesCount || post.reactionsCount || (Array.isArray(post.likes_count) ? post.likes_count.length : 0),
            liked_by_current_user: post.likedByCurrentUser || false,
            comments_count: post.commentsCount || post.comments_count || 0,
            is_shared: post.is_shared ?? post.IsShare ?? false,
            shared_note: post.shared_note || post.SharedNote || null,
            shared_post: transformedSharedPost,
            shares_count: post.sharesCount ?? post.shares_count ?? post.SharesCount ?? 0,
            booking: post.booking || post.Booking || null,
            BookingID: post.BookingID,
            FacilityName: post.FacilityName,
            FieldName: post.FieldName,
            SportName: post.SportName,
            StartTime: post.StartTime,
            EndTime: post.EndTime,
            TotalAmount: post.TotalAmount,
            DepositPaid: post.DepositPaid,
            BookingStatus: post.BookingStatus,
            FacilityImage: post.FacilityImage,
            FacilityImages: post.FacilityImages,
            ImageUrls: post.ImageUrls,
            FacilityID: post.FacilityID,
            FieldID: post.FieldID,
          };
        });
        
        if (isLoadMore) {
          // Append new posts to existing ones
          setFeeds(prev => {
            console.log(`📝 Appending ${transformedPosts.length} posts to ${prev.length} existing posts`);
            return [...prev, ...transformedPosts];
          });
        } else {
          // Replace feeds for initial load
          setFeeds(transformedPosts);
        }

        const hasMorePosts = response.data.pagination?.hasMore || false;
        console.log(`📊 hasMore: ${hasMorePosts}`);
        setHasMore(hasMorePosts);
      } else {
        setError(response.message || 'Unable to load posts');
      }
    } catch (err) {
      console.error('❌ Error fetching feeds:', err);
      setError('Unable to connect to server');
    } finally {
      // Use the isLoadMore parameter to decide which loading flag to clear.
      // Relying on the state variable here could read the stale value (setState is async)
      // and leave loadingMore stuck true. Clearing by the function param is reliable.
      if (isLoadMore) setLoadingMore(false);
      else setLoading(false);
    }
  }, []);

  // Initial load - ALWAYS bypass cache to get fresh data
  useEffect(() => {
    console.log('🚀 Initial load - bypassing cache to ensure fresh data');
    fetchFeeds(1, false, true); // bypassCache = true
  }, [fetchFeeds]);

  // onPosted handler: when CreatePostCard calls onPosted, it may pass the created post
  // If a post object is provided, prepend it locally (useful for PendingReview posts)
  const handleOnPosted = (maybePost) => {
    if (maybePost && maybePost._id) {
      // Normalize minimal shape similar to fetchFeeds mapping
      const backendBase = getBackendOrigin();
      const normalized = {
        _id: maybePost.PostID || maybePost._id || maybePost.postId,
        content: maybePost.content || maybePost.Content,
        createdAt: parseServerDatetime(maybePost.createdAt || maybePost.CreatedDate) || new Date(),
        image_urls: (maybePost.image_urls || maybePost.imageUrls || []).map(u => toAbsoluteUrl(backendBase, u, 'posts')).filter(Boolean),
        media_urls: (maybePost.media_urls || maybePost.mediaUrls || []).map(u => toAbsoluteUrl(backendBase, u, 'posts')).filter(Boolean),
        user: maybePost.user || maybePost.User || {},
        likes_count: maybePost.likesCount || maybePost.reactionsCount || 0,
        liked_by_current_user: false,
        comments_count: maybePost.commentsCount || maybePost.comments_count || 0,
        is_shared: maybePost.is_shared ?? maybePost.IsShare ?? false,
        shared_note: maybePost.shared_note || maybePost.SharedNote || null,
        shared_post: null,
        shares_count: maybePost.sharesCount ?? maybePost.shares_count ?? 0,
        booking: maybePost.booking || maybePost.Booking || null,
        BookingID: maybePost.BookingID,
        // preserve moderation/status flags so PostCard can render pending UI
        Status: maybePost.Status || maybePost.status || null,
        __moderation: maybePost.__moderation || null,
      };
      setFeeds(prev => {
        if (prev.some(p => String(p._id) === String(normalized._id))) return prev;
        return [normalized, ...prev];
      });
      return;
    }
    // Fallback: if no post provided, do a full refresh
    setPage(1);
    fetchFeeds(1, false, true);
  };

  // Listen for global feed refresh events (dispatched after create/share actions)
  useEffect(() => {
    const onFeedRefresh = () => {
      console.log('🔔 Received feed:refresh event — reloading feed');
      setPage(1);
      fetchFeeds(1, false, true);
    };

    window.addEventListener('feed:refresh', onFeedRefresh);
    return () => window.removeEventListener('feed:refresh', onFeedRefresh);
  }, [fetchFeeds]);

  // Listen for realtime events forwarded from useRealtime and update feed in-place
  useEffect(() => {
    const onPostCreated = (e) => {
      try {
        const payload = e && e.detail ? e.detail : e;
        const post = payload && payload.post ? payload.post : null;
        if (!post || !post._id) return;
        // normalize createdAt
        const normalized = { ...post, createdAt: parseServerDatetime(post.createdAt || post.CreatedDate) || new Date() };
        setFeeds(prev => {
          // avoid duplicates
          if (prev.some(p => String(p._id) === String(normalized._id))) return prev;
          return [normalized, ...prev];
        });
      } catch (err) { console.debug('onPostCreated error', err); }
    };

    const onPostShared = (e) => {
      try {
        const payload = e && e.detail ? e.detail : e;
        const post = payload && payload.post ? payload.post : null;
        if (!post || !post._id) return;
        const normalized = { ...post, createdAt: parseServerDatetime(post.createdAt || post.CreatedDate) || new Date() };
        setFeeds(prev => {
          if (prev.some(p => String(p._id) === String(normalized._id))) return prev;
          return [normalized, ...prev];
        });
      } catch (err) { console.debug('onPostShared error', err); }
    };

    const onCommentCreated = (e) => {
      try {
        const payload = e && e.detail ? e.detail : e;
        const comment = payload && payload.comment ? payload.comment : null;
        if (!comment) return;
        const postId = comment.PostID || comment.postId || comment.PostId || (comment.post && (comment.post.PostID || comment.post._id));
        if (!postId) return;
        setFeeds(prev => prev.map(p => {
          if (String(p._id) === String(postId)) {
            return { ...p, comments_count: (Number(p.comments_count || 0) + 1) };
          }
          return p;
        }));
      } catch (err) { console.debug('onCommentCreated error', err); }
    };

    const onPostDeleted = (e) => {
      try {
        const payload = e && e.detail ? e.detail : e;
        const postId = payload && (payload.postId || payload.PostID || payload.id || payload._id);
        if (!postId) return;
        setFeeds(prev => prev.filter(p => String(p._id) !== String(postId)));
      } catch (err) { console.debug('onPostDeleted error', err); }
    };

    const onBookingPostCreated = (e) => {
      try {
        const payload = e && e.detail ? e.detail : e;
        const bp = payload && (payload.bookingPost || payload.post || payload.data) ? (payload.bookingPost || payload.post || payload.data) : null;
        const postId = payload && (payload.PostID || bp && (bp.PostID || bp._id || bp.postId)) ? (payload.PostID || bp.PostID || bp._id || bp.postId) : null;
        if (!bp && !postId) return;

        const backendBase = getBackendOrigin();
        const normalized = {
          _id: postId || (bp && (bp.PostID || bp._id || bp.postId)),
          content: bp && (bp.content || bp.Content) || '',
          createdAt: parseServerDatetime(bp && (bp.createdAt || bp.CreatedDate)) || new Date(),
          image_urls: ((bp && (bp.image_urls || bp.imageUrls || bp.ImageUrls || bp.ImageUrls)) || []).map(u => toAbsoluteUrl(backendBase, u, 'posts')).filter(Boolean),
          media_urls: ((bp && (bp.media_urls || bp.mediaUrls)) || []).map(u => toAbsoluteUrl(backendBase, u, 'posts')).filter(Boolean),
          user: bp && bp.user ? {
            _id: bp.user._id || bp.user.AccountID || bp.AccountID,
            username: bp.user.username || bp.Username,
            full_name: bp.user.full_name || bp.user.FullName || bp.FullName,
            profile_picture: bp.user.profile_picture || bp.user.AvatarUrl || DEFAULT_AVATAR,
          } : { _id: null, username: null, full_name: null, profile_picture: DEFAULT_AVATAR },
          likes_count: bp && (bp.likesCount || bp.reactionsCount) || 0,
          liked_by_current_user: false,
          comments_count: bp && (bp.commentsCount || bp.comments_count) || 0,
          is_shared: false,
          booking: bp || null,
          BookingID: bp && (bp.BookingID || bp.bookingId || bp.BookingId) || null,
          FacilityName: bp && (bp.FacilityName || bp.facilityName) || null,
          FieldName: bp && (bp.FieldName || bp.fieldName) || null,
          SportName: bp && (bp.SportName || bp.sportName) || null,
          StartTime: bp && bp.StartTime,
          EndTime: bp && bp.EndTime,
          TotalAmount: bp && bp.TotalAmount,
          DepositPaid: bp && bp.DepositPaid,
          BookingStatus: bp && bp.BookingStatus,
          FacilityImage: bp && bp.FacilityImage,
          FacilityImages: bp && bp.FacilityImages,
          ImageUrls: bp && bp.ImageUrls,
          FacilityID: bp && bp.FacilityID,
          FieldID: bp && bp.FieldID,
        };

        setFeeds(prev => {
          if (prev.some(p => String(p._id) === String(normalized._id))) return prev;
          return [normalized, ...prev];
        });
      } catch (err) { console.debug('onBookingPostCreated error', err); }
    };

    window.addEventListener('post:created', onPostCreated);
    window.addEventListener('post:shared', onPostShared);
    window.addEventListener('comment:created', onCommentCreated);
    window.addEventListener('post:deleted', onPostDeleted);
    window.addEventListener('bookingpost:created', onBookingPostCreated);

    return () => {
      window.removeEventListener('post:created', onPostCreated);
      window.removeEventListener('post:shared', onPostShared);
      window.removeEventListener('comment:created', onCommentCreated);
      window.removeEventListener('post:deleted', onPostDeleted);
      window.removeEventListener('bookingpost:created', onBookingPostCreated);
    };
  }, []);

  const { t } = useI18n();

  // Refresh feed (for new posts) - bypass cache to show new content immediately
  const refreshFeed = () => {
    console.log('🔄 Refreshing feed...');
    setPage(1);
    fetchFeeds(1, false, true);
  };

  // Handle load more button
  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchFeeds(nextPage, true);
  };


  // If we're on the initial load and still loading, show the global loader.
  if (loading && feeds.length === 0) return <Loading />;

  return (
    <div className='w-full h-full overflow-y-visible no-scrollbar py-6'>
      <div className='w-full grid grid-cols-1 lg:grid-cols-3 gap-8'>
        <div className='col-span-2'>
          <StoriesBar />
          {/* Create post card under stories (like in your screenshot) */}
          <CreatePostCard onPosted={handleOnPosted} />
          
          {error && (
            <div className='bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4'>
              {error}
            </div>
          )}
          
          <div className='p-4 space-y-6'>
            {feeds.length === 0 ? (
              <div className='text-center text-gray-500 py-8'>
                {t('feed.noPosts', 'No posts yet')}
              </div>
            ) : (
              feeds.map((post) => (
                post.booking ? (
                  <BookingStatusCard key={post._id} post={post} />
                ) : (
                  <PostCard key={post._id} post={post} />
                )
              ))
            )}
          </div>
          
          {hasMore && (
            <div className='text-center py-4'>
              <button 
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className='px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60'
                >
                  {loadingMore ? t('common.loading', 'Loading...') : t('common.loadMore', 'Load more')}
                </button>
            </div>
          )}
          
          {!hasMore && feeds.length > 0 && (
            <div className='text-center py-4 text-gray-500'>
              <p>{t('feed.endMessage', "🎉 You've reached the end of the feed")}</p>
            </div>
          )}
        </div>
        <aside className='hidden lg:block'>
          <div className='sticky top-8'>
            <RecentMessages />
          </div>
        </aside>
      </div>
    </div>
  );
}

export default Feed;
