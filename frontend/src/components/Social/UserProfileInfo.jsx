import { Calendar, MapPin, PenBox, Verified, UserPlus, UserMinus } from 'lucide-react'
import moment from 'moment'
import React, { useState, useEffect } from 'react'
import DEFAULT_AVATAR from "../../utils/defaults";
import { userAPI } from "../../utils/api";


const UserProfileInfo = ({ user, setShowEdit, posts, isOwnProfile, followLoading, onChildFollowChange }) => {
  // local optimistic follow state for snappy UX (mirrors UserCard)
  const [isFollowing, setIsFollowing] = useState(Boolean(user?.is_following));
  const [localFollowers, setLocalFollowers] = useState(user?.followers_count || 0);
  const [localLoading, setLocalLoading] = useState(false);

  // Keep local copies in sync when parent prop changes
  useEffect(() => {
    setIsFollowing(Boolean(user?.is_following));
    setLocalFollowers(user?.followers_count || 0);
  }, [user]);

  // Debug: show user prop when component renders
  React.useEffect(() => {
    console.log('UserProfileInfo user prop:', user);
  }, [user]);

  const handleLocalFollow = async () => {
    if (localLoading || !user) return;
    setLocalLoading(true);
    const wasFollowing = Boolean(isFollowing);
    // optimistic update
    setIsFollowing(!wasFollowing);
    setLocalFollowers(prev => wasFollowing ? Math.max(0, prev - 1) : prev + 1);

    try {
      const res = wasFollowing ? await userAPI.unfollow(user._id) : await userAPI.follow(user._id);
      if (res && res.success) {
        // notify parent to refresh or sync
        if (typeof onChildFollowChange === 'function') {
          onChildFollowChange({ is_following: !wasFollowing, followers_count: wasFollowing ? Math.max(0, (user.followers_count || 0) - 1) : ((user.followers_count || 0) + 1) });
        }
      } else {
        // server rejected — revert optimistic unless message indicates already-followed
        const msg = String(res?.message || '').toLowerCase();
        if (msg.includes('đã follow') || msg.includes('already follow') || msg.includes('already followed') || msg.includes('đã theo dõi')) {
          setIsFollowing(true);
        } else {
          // revert
          setIsFollowing(wasFollowing);
          setLocalFollowers(user.followers_count || 0);
          console.error('Follow/unfollow failed:', res?.message);
        }
      }
    } catch (err) {
      // revert on error
      setIsFollowing(wasFollowing);
      setLocalFollowers(user.followers_count || 0);
      console.error('Follow/unfollow error:', err);
    } finally {
      setLocalLoading(false);
    }
  };

  return (
    <div className="relative py-4 px-6 md:px-8 bg-white rounded-2xl shadow">
      <div className="flex flex-col md:flex-row items-start gap-6">

        {/* Avatar */}
        <div className="w-32 h-32 border-4 border-white shadow-lg absolute -top-16 rounded-full overflow-hidden">
          <img
            src={user.profile_picture || user.AvatarUrl || user.ProfilePictureURL || user.avatarUrl || DEFAULT_AVATAR}
            onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_AVATAR; }}
            alt="Profile"
            className="w-full h-full object-cover"
          />
        </div>

        {/* User Info */}
        <div className="w-full pt-16 md:pt-0 md:pl-36">
          <div className="flex flex-col items-start w-full">
            
            {/* Name + Verified + Edit */}
            <div className="flex w-full items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold">{user.full_name}</h1>
                  <Verified className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-gray-500">@{user.username || 'Add a username'}</p>
              </div>

              {/* Edit button (own profile) */}
              {isOwnProfile && (
                <button
                  onClick={() => setShowEdit(true)}
                  className="flex items-center gap-2 border border-gray-300 hover:bg-gray-50 px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  <PenBox className="w-4 h-4" />
                  Edit
                </button>
              )}

              {/* Follow/Unfollow button (other's profile) */}
              {!isOwnProfile && (
                <button
                  onClick={handleLocalFollow}
                  disabled={localLoading || followLoading}
                  aria-pressed={isFollowing}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    isFollowing
                      ? 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  } ${localLoading || followLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isFollowing ? (
                    <>
                      <UserMinus className="w-4 h-4" />
                      {localLoading || followLoading ? 'Processing...' : 'Following'}
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      {localLoading || followLoading ? 'Processing...' : 'Follow'}
                    </>
                  )}
                </button>
              )}
              {/* Debug badge: show is_following when ?profile_debug=1 is present */}
              {typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('profile_debug') === '1' && (
                <div className="ml-4 text-xs text-gray-500 mt-2">
                  Debug is_following: <span className="font-medium">{String(user.is_following)}</span>
                </div>
              )}
            </div>

            {/* Bio */}
            {user.bio && (
              <p className="text-gray-700 text-sm max-w-xl mt-4">{user.bio}</p>
            )}

            {/* Location + Joined */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-500 mt-4">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                {user.location || 'Add location'}
              </span>
              
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                Joined{' '}
                <span className="font-medium">
                  {moment(user.createdAt).fromNow()}
                </span>
              </span>
            </div>

            <div className='flex items-center gap-6 mt-6 border-t border-gray-200 pt-4'>
                <div>
                    <span className='sm:text-xl font-bold text-gray-900'>
                    {posts.length}
                    </span>
                    <span className='text-xs sm:text-sm text-gray-500 ml-1.5'>
                    Posts
                    </span>
                </div>
        <div>
          <span className='sm:text-xl font-bold text-gray-900'>
          {localFollowers || 0}
          </span>
                    <span className='text-xs sm:text-sm text-gray-500 ml-1.5'>
                    Followers
                    </span>
                </div>
                <div>
                    <span className='sm:text-xl font-bold text-gray-900'>
                    {user.following_count || 0}
                    </span>
                    <span className='text-xs sm:text-sm text-gray-500 ml-1.5'>
                    Following
                    </span>
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UserProfileInfo
