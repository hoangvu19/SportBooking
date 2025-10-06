import React, { useEffect, useState } from "react";
import { assets } from "../assets/assets";
import StoriesBar from "../components/StoriesBar";
import PostCard from "../components/PostCard";
import RecentMessages from "../components/RecentMessages";
import Loading from "../components/Loading";
import { postAPI } from "../utils/api";


const Feed = () => {

    const [feeds, setFeeds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    const fetchFeeds = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await postAPI.getFeed(page, 10);
            
            if (response.success) {
                // Backend returns { posts: [...], pagination: {...} }
                const postsArray = response.data.posts || response.data || [];
                
                // Transform backend data to frontend format
        const transformedPosts = postsArray.map(post => ({
          _id: post.PostID || post._id || post.postId,  // Try all possible field names
          content: post.content || post.Content,
          createdAt: post.createdAt || post.CreatedDate,
          image_urls: post.image_urls || post.imageUrls || [],
          user: {
            _id: post.user?._id || post.user?.AccountID || post.AccountID,
            username: post.user?.username || post.Username,
            full_name: post.user?.full_name || post.user?.FullName || post.FullName,
            profile_picture: post.user?.profile_picture || post.user?.AvatarUrl || post.AvatarUrl || 'https://via.placeholder.com/40',
          },
          likes_count: post.likesCount || post.reactionsCount || (Array.isArray(post.likes_count) ? post.likes_count.length : 0),
          liked_by_current_user: post.likedByCurrentUser || false,
          comments_count: post.commentsCount || post.comments_count || 0,
          // Share-specific fields (preserve whatever backend returned)
          is_shared: post.is_shared ?? post.IsShare ?? false,
          shared_note: post.shared_note || post.SharedNote || null,
          shared_post: post.shared_post || post.SharedPost || null,
          shares_count: post.sharesCount ?? post.shares_count ?? post.SharesCount ?? 0,
        }));
                
                setFeeds(transformedPosts);
                setHasMore(response.data.pagination?.hasMore || false);
            } else {
                setError(response.message || 'Không thể tải bài viết');
            }
        } catch (err) {
            console.error('Error fetching feeds:', err);
            setError('Không thể kết nối đến server');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFeeds();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page]);

    return !loading ? (
    <div className='w-full h-full overflow-y-visible no-scrollbar py-6'>
      <div className='w-full grid grid-cols-1 lg:grid-cols-3 gap-8'>
        <div className='col-span-2'>
          <StoriesBar />
          
          {error && (
            <div className='bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4'>
              {error}
            </div>
          )}
          
          <div className='p-4 space-y-6'>
            {feeds.length === 0 ? (
              <div className='text-center text-gray-500 py-8'>
                Chưa có bài viết nào
              </div>
            ) : (
              feeds.map((post) => (
                <PostCard key={post._id} post={post} />
              ))
            )}
          </div>
          
          {hasMore && (
            <div className='text-center py-4'>
              <button 
                onClick={() => setPage(p => p + 1)}
                className='px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700'
              >
                Xem thêm
              </button>
            </div>
          )}
        </div>
        {/* Right Sidebar */}
        <aside className='hidden lg:block'>
          <div className='sticky top-8 space-y-6'>
            <div className='max-w-xs bg-white text-xs p-4 rounded-md inline-flex flex-col gap-2 shadow'>
              <h3 className='text-slate-800 font-semibold'>Sponsored</h3>
              <img
                src={assets.sponsored_img}
                className='w-full h-40 object-cover rounded-md'
                alt=""
              />
              <p className='text-slate-600'>Email marketing</p>
              <p>Supercharge your marketing with a powerful, easy-to-use platform built for results.</p>
            </div>
            <RecentMessages />
          </div>
        </aside>
      </div>
    </div>
  ) : <Loading />
}

export default Feed;
