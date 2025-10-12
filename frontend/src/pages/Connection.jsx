import React, { useState, useEffect } from "react";
import {User, UserPlus, UserCheck,UserRoundPen,MessageSquare} from 'lucide-react'
import { useNavigate } from "react-router-dom";
import { userAPI } from "../utils/api";
import Loading from "../components/Loading";
import DEFAULT_AVATAR from '../utils/defaults';

const Connections = () => {
    const navigate = useNavigate();

    const [currentTab, setCurrentTab] = useState('Followers');
    const [followers, setFollowers] = useState([]);
    const [following, setFollowing] = useState([]);
    const [connections, setConnections] = useState([]);
    const [pendingConnections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const [followersRes, followingRes] = await Promise.all([
                userAPI.getFollowers(),
                userAPI.getFollowing(),
            ]);

            let followersList = [];
            let followingList = [];

            if (followersRes.success) {
                followersList = followersRes.data.map(f => ({
                    _id: f.AccountID || f._id,
                    username: f.Username || f.username,
                    full_name: f.FullName || f.full_name,
                   profile_picture: f.profile_picture || f.AvatarUrl || f.ProfilePictureURL || f.avatarUrl || DEFAULT_AVATAR,
                    bio: f.Bio || f.Address || f.bio || '',
                    followed_date: f.FollowedDate,
                }));
                setFollowers(followersList);
            }

            if (followingRes.success) {
                followingList = followingRes.data.map(f => ({
                    _id: f.AccountID || f._id,
                    username: f.Username || f.username,
                    full_name: f.FullName || f.full_name,
                    profile_picture: f.profile_picture || f.ProfilePicture || f.ProfilePictureURL || f.AvatarUrl || f.avatarUrl || DEFAULT_AVATAR,
                    bio: f.Bio || f.Address || f.bio || '',
                    followed_date: f.FollowedDate,
                }));
                setFollowing(followingList);
            }

            // Compute mutual connections: users who are both in followers and following
            try {
                const followingIds = new Set(followingList.map(u => String(u._id)));
                const mutuals = followersList.filter(u => followingIds.has(String(u._id)));
                setConnections(mutuals);
            } catch (e) {
                console.error('Error computing mutual connections:', e);
                setConnections([]);
            }
        } catch (err) {
            console.error('Error fetching connections:', err);
            setError('Không thể tải danh sách kết nối');
        } finally {
            setLoading(false);
        }
    };

    const handleUnfollow = async (userId) => {
        try {
            const response = await userAPI.unfollow(userId);
            if (response.success) {
                // Remove from following list
                setFollowing(prev => prev.filter(u => u._id !== userId));
            }
        } catch (err) {
            console.error('Error unfollowing:', err);
        }
    };

    // connections and pendingConnections are managed via state

    const dataArray = [
        {label :'Followers',value: followers, icon: User},
        {label :'Following',value: following, icon: UserPlus},
        {label :'Pending',value: pendingConnections, icon: UserRoundPen},
        {label :'Connections',value: connections, icon: UserCheck},
    ];

    if (loading) {
        return <Loading />;
    }

    return (
        <div className='min-h-screen bg-slate-50'>
            <div className='max-w-6xl mx-auto p-6'>
                <div className='mb-8'>
                    <h1 className='text-3xl font-bold text-slate-900 mb-2'>Connections</h1>
                    <p className='text-slate-600'>Manage your network and discover new connections</p>
                </div>
                
                {error && (
                    <div className='bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4'>
                        {error}
                    </div>
                )}

                {/* Counts - Adjusted margin bottom */}
                <div className='flex flex-wrap gap-6 mb-6'>
                    {dataArray.map((item, index) => (
                        <div key={index} className='flex flex-col items-center justify-center gap-1 border h-20 w-40 border-gray-200 bg-white shadow rounded-md'>
                        <b>{item.value.length}</b>
                        <p className='text-slate-600'>{item.label}</p>
                        </div>
                    ))}
                </div>

                {/* Tabs */}
                <div className='inline-flex flex-wrap items-center border border-gray-200 rounded-md p-1 bg-white shadow-sm'>
                    {dataArray.map((tab) => (
                    <button 
                        onClick={() => setCurrentTab(tab.label)} 
                        key={tab.label}
                        className={`cursor-pointer flex items-center px-3 py-1 text-sm rounded-md transition-colors ${currentTab === tab.label ? 'bg-white font-medium text-black' : 'text-gray-500 hover:text-black'}`}
                    > 
                        <tab.icon className='w-4 h-4' />
                        <span className='ml-1'>{tab.label}</span>
                        {/* Display count for tabs based on value.length */}
                        <span className='ml-2 text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full'>
                            {tab.value.length}
                        </span>
                    </button>
                    ))}
                </div>

                {/* List of users - Changed to a responsive grid layout */}
                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6'> 
                    {dataArray.find(item => item.label === currentTab)?.value.map((user) => (
                        <div key={user._id} className='flex gap-5 p-6 bg-white shadow rounded-md'> {/* Removed w-full max-w-88 here */}
                            <img src={user.profile_picture || DEFAULT_AVATAR} onError={(e)=>{ e.target.onerror = null; e.target.src = DEFAULT_AVATAR }} alt="" className='rounded-full w-12 h-12 shadow-md mx-auto'/>
                            <div className='flex-1'>
                                <p className='font-medium text-slate-700'>{user.full_name}</p>
                                <p className='text-slate-500'>@{user.username}</p>
                                <p className='text-sm text-gray-600'>{user.bio.slice(0, 30)}</p>
                                {/* Added for skills/roles, assuming these are present in user data */}
                                <div className="flex flex-wrap gap-2 mt-2 text-xs">
                                    {/* Example: Replace with actual user skills/roles if available */}
                                    <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">Dreamer</span>
                                    <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full">Learner</span>
                                    <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">D...</span> 
                                </div>
                                 <div className='flex max-sm:flex-col gap-2 mt-4'>
                                <button onClick={() => navigate(`/profile/${user._id}`)}
                                    className='w-full p-2 text-sm rounded bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 active:scale-95 transition text-white cursor-pointer'
                                >
                                    View Profile
                                </button>
                                {currentTab === 'Following' && (
                                    <button 
                                        onClick={() => handleUnfollow(user._id)}
                                        className='w-full p-2 text-sm rounded bg-slate-100 hover:bg-slate-200 text-black active:scale-95 transition cursor-pointer'>
                                        Unfollow
                                    </button>
                                )}
                                {currentTab === 'Pending' && (
                                    <button className='w-full p-2 text-sm rounded bg-slate-100 hover:bg-slate-200 text-black active:scale-95 transition cursor-pointer'>
                                        Accept
                                    </button>
                                )}
                                {currentTab === 'Connections' && (
                                    <button onClick={() => navigate(`/messages/${user._id}`)} className='w-full p-2 text-sm rounded bg-slate-100 hover:bg-slate-200 text-black active:scale-95 transition cursor-pointer'>
                                        <MessageSquare className="w-4 h-4 inline-block mr-1" />
                                        Message
                                    </button>
                                )}
                            </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default Connections;