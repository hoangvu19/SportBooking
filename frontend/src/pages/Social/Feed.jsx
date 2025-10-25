import React, { useEffect, useState } from "react";
import StoriesBar from "../../components/Social/StoriesBar";
import CreatePostCard from "../../components/Social/CreatePostCard";
import PostCard from "../../components/Social/PostCard";
import BookingStatusCard from "../../components/Social/BookingStatusCard";
import RecentMessages from "../../components/Social/RecentMessages";
import Loading from "../../components/Shared/Loading";
import { postAPI } from "../../utils/api";
import DEFAULT_AVATAR from "../../utils/defaults";


import { useI18n } from '../../i18n/hooks';

const Feed = () => {

  const [feeds, setFeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchFeeds = async (pageNum, isLoadMore = false) => {
    try {
      if (isLoadMore) {
        setLoading(true);
      } else {
        setLoading(true);
      }
      setError(null);
      
      console.log(`📥 Fetching page ${pageNum}, isLoadMore: ${isLoadMore}`);
      const response = await postAPI.getFeed(pageNum, 10);
      
      if (response.success) {
        const postsArray = response.data.posts || response.data || [];
        console.log(`✅ Received ${postsArray.length} posts for page ${pageNum}`);
        
        const transformedPosts = postsArray.map(post => ({
          _id: post.PostID || post._id || post.postId, 
          content: post.content || post.Content,
          createdAt: post.createdAt || post.CreatedDate,
          image_urls: post.image_urls || post.imageUrls || [],
          user: {
            _id: post.user?._id || post.user?.AccountID || post.AccountID,
            username: post.user?.username || post.Username,
            full_name: post.user?.full_name || post.user?.FullName || post.FullName,
            profile_picture: post.user?.profile_picture || post.user?.AvatarUrl || post.user?.ProfilePictureURL || post.user?.avatarUrl || DEFAULT_AVATAR,
          },
          likes_count: post.likesCount || post.reactionsCount || (Array.isArray(post.likes_count) ? post.likes_count.length : 0),
          liked_by_current_user: post.likedByCurrentUser || false,
          comments_count: post.commentsCount || post.comments_count || 0,
          is_shared: post.is_shared ?? post.IsShare ?? false,
          shared_note: post.shared_note || post.SharedNote || null,
          shared_post: post.shared_post || post.SharedPost || null,
          shares_count: post.sharesCount ?? post.shares_count ?? post.SharesCount ?? 0,
          booking: post.booking || post.Booking || null,
        }));
        
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
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    console.log('🚀 Initial load');
    fetchFeeds(1, false);
  }, []);

  const { t } = useI18n();

  // Refresh feed (for new posts)
  const refreshFeed = () => {
    console.log('🔄 Refreshing feed...');
    setPage(1);
    fetchFeeds(1, false);
  };

  // Handle load more button
  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchFeeds(nextPage, true);
  };


    return !loading ? (
    <div className='w-full h-full overflow-y-visible no-scrollbar py-6'>
      <div className='w-full grid grid-cols-1 lg:grid-cols-3 gap-8'>
        <div className='col-span-2'>
          <StoriesBar />
          {/* Create post card under stories (like in your screenshot) */}
          <CreatePostCard onPosted={refreshFeed} />
          
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
          
          {hasMore && !loading && (
            <div className='text-center py-4'>
              <button 
                  onClick={handleLoadMore}
                  className='px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700'
                >
                  {t('common.loadMore', 'Load more')}
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
  ) : <Loading />
}

export default Feed;
