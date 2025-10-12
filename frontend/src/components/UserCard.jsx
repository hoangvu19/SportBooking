import React, { useState } from 'react'
import { MapPin, MessageCircle, Plus, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { userAPI } from '../utils/api';
import DEFAULT_AVATAR from '../utils/defaults';

const UserCard = ({user}) => {
    const navigate = useNavigate();

    const [isFollowing, setIsFollowing] = useState(!!user.is_following);
    const [loading, setLoading] = useState(false);

    const handleFollow = async() => {
        if (loading) return;
        try {
            setLoading(true);
            if (isFollowing) {
                // unfollow
                await userAPI.unfollow(user._id);
                setIsFollowing(false);
            } else {
                // follow
                await userAPI.follow(user._id);
                setIsFollowing(true);
            }
        } catch (err) {
            console.error('Follow/unfollow error:', err);
            // Could show toast here
        } finally {
            setLoading(false);
        }
    }

    const handleConnectionRequest = async() => {
        // Navigate to the messages/conversation with this user
        try {
            navigate(`/messages/${user._id}`);
        } catch (err) {
            console.error('Navigation to messages failed', err);
        }
    }

    return (
    <div key={user._id} className='p-4 pt-6 flex flex-col justify-between w-72 shadow border border-gray-200 rounded-md'>
        <div className='text-center'>
            {(() => {
                const avatarSrc = user.profile_picture || user.AvatarUrl || user.ProfilePictureURL || user.avatarUrl || DEFAULT_AVATAR;
                return (
                    <img
                        src={avatarSrc}
                        alt=""
                        className='rounded-full w-16 shadow-md mx-auto cursor-pointer'
                        onClick={() => navigate(`/profile/${user._id}`)}
                        onError={(e)=>{ e.target.onerror = null; e.target.src = DEFAULT_AVATAR; }}
                    />
                );
            })()}
            <p className='mt-4 font-semibold cursor-pointer' onClick={() => navigate(`/profile/${user._id}`)}>
                {user.full_name}
                {isFollowing && <span className='ml-2 inline-block text-xs px-2 py-0.5 rounded bg-green-100 text-green-800 font-medium'>Following</span>}
            </p>
            {user.username && <p className='text-gray-500 font-light'>@{user.username}</p>}
            {user.bio && <p className='text-gray-600 mt-2 text-center text-sm px-4'>{user.bio}</p>}
        </div>

        <div className='flex items-center justify-center gap-2 mt-4 text-xs text-gray-600'>
            <div className='flex items-center gap-1 border border-gray-300 rounded-full px-3 py-1'>
                <MapPin className='w-4 h-4'/> {user.location || user.address || 'Unknown'}
            </div>
            <div className='flex items-center gap-1 border border-gray-300 rounded-full px-3 py-1'>
                <span>{user.followers_count || user.followers?.length || 0}</span> Followers
            </div>
        </div>

        <div className='mt-4 flex gap-2'>
            <button 
                onClick={handleFollow} 
                disabled={loading}
                className={`w-full py-2 rounded-md flex justify-center items-center gap-2 active:scale-95 transition text-white cursor-pointer ${isFollowing ? 'bg-gray-300 text-slate-700 hover:bg-gray-200' : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700'}`}
            >
                <UserPlus className='w-4 h-4' /> {isFollowing ? (loading ? 'Processing...' : 'Following') : (loading ? 'Processing...' : 'Follow')}
            </button>
            {/* Message Button */}
            <button 
                onClick={handleConnectionRequest} 
                className='flex items-center justify-center w-16 border text-slate-500 group rounded-md cursor-pointer active:scale-95 transition'
            >
                <MessageCircle className='w-5 h-5 group-hover:scale-105 transition'/>
            </button>
        </div>
    </div>
  )
}

export default UserCard;