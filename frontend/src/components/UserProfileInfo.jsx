import { Calendar, MapPin, PenBox, Verified, UserPlus, UserMinus } from 'lucide-react'
import moment from 'moment'
import React from 'react'


const UserProfileInfo = ({ user, setShowEdit, posts, isOwnProfile, onFollowToggle, followLoading }) => {
  // Debug: show user prop when component renders
  React.useEffect(() => {
    console.log('UserProfileInfo user prop:', user);
  }, [user]);

  return (
    <div className="relative py-4 px-6 md:px-8 bg-white rounded-2xl shadow">
      <div className="flex flex-col md:flex-row items-start gap-6">

        {/* Avatar */}
        <div className="w-32 h-32 border-4 border-white shadow-lg absolute -top-16 rounded-full overflow-hidden">
          <img
            src={user.profile_picture}
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
                  onClick={onFollowToggle}
                  disabled={followLoading}
                  aria-pressed={user.is_following}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    user.is_following
                      ? 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  } ${followLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {user.is_following ? (
                    <>
                      <UserMinus className="w-4 h-4" />
                      {followLoading ? 'Đang xử lý...' : 'Đang theo dõi'}
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      {followLoading ? 'Đang xử lý...' : 'Theo dõi'}
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
                    {user.followers_count || 0}
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
