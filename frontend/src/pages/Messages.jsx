import React, { useState, useEffect } from 'react'
import { Eye, MessageSquare } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { userAPI, messageAPI, authAPI } from '../utils/api'
import Loading from '../components/Loading'

const Messages = () => {
    const navigate = useNavigate();
    const [connections, setConnections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        loadConnections();
    }, []);

    const loadConnections = async () => {
        try {
            setLoading(true);
            setError(null);
            // Load current user for 'Bạn:' prefix detection
            try {
                const me = await authAPI.getCurrentUser();
                if (me && me.success) setCurrentUser(me.data || null);
            } catch (e) {
                console.warn('Could not load current user for messages list', e);
            }
            // Prefer the conversations API which returns users you've chatted with plus last message
            const convRes = await messageAPI.getConversations();
            if (convRes && convRes.success) {
                const conversationList = Array.isArray(convRes.data) ? convRes.data : [];
                const parseDate = (value) => {
                    const time = value ? new Date(value).getTime() : NaN;
                    return Number.isFinite(time) ? time : 0;
                };
                // Map to the same UI shape but keep bio and add lastMessageSnippet separately
                const transformed = conversationList.map(u => ({
                    _id: u.AccountID || u._id,
                    full_name: u.FullName || u.full_name,
                    username: u.Username || u.username,
                    profile_picture: u.AvatarUrl || u.profile_picture || 'https://via.placeholder.com/48',
                    // Keep bio as-is (fall back to 'No bio yet')
                    bio: u.Bio || u.bio || 'No bio yet',
                    // Put last message snippet separately
                    lastMessageSnippet: u.LastMessageContent || '',
                    lastMessageSenderId: u.LastMessageSenderID || null,
                    lastMessageDate: u.LastMessageDate,
                    unreadCount: u.UnreadCount || 0
                }));

                // Sort by lastMessageDate desc so most recent conversations show first
                transformed.sort((a, b) => parseDate(b.lastMessageDate) - parseDate(a.lastMessageDate));

                setConnections(transformed);
            } else {
                // Fallback: load following users
                const response = await userAPI.getFollowing();
                if (response.success) {
                    const transformed = response.data.map(user => ({
                        _id: user.AccountID || user._id,
                        full_name: user.FullName || user.full_name,
                        username: user.Username || user.username,
                        profile_picture: user.ProfilePictureURL || user.ProfilePicture || user.ProfilePictureUrl || user.ProfilePictureURLSmall || user.ProfilePictureSmall || user.profile_picture || user.ProfilePictureThumb || user.ProfilePicture_URL || user.AvatarUrl || user.avatarUrl || user.ProfilePictureURL || 'https://via.placeholder.com/48',
                        bio: user.Bio || user.Address || user.bio || 'No bio yet'
                    }));
                    setConnections(transformed);
                } else {
                    setError(response.message || 'Không thể tải danh sách');
                }
            }
        } catch (err) {
            console.error('Load connections error:', err);
            setError('Không thể kết nối đến server');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className='min-h-screen relative bg-slate-50'>
            <div className='max-w-6xl mx-auto p-6'>
                {/* Title */}
                <div className='mb-8'>
                <h1 className='text-3xl font-bold text-slate-900 mb-2'>
                    Messages
                </h1>
                <p className='text-slate-600'>
                    Talk to your friends and family
                </p>
                </div>

                {/* Loading State */}
                {loading && <Loading />}

                {/* Error State */}
                {error && (
                    <div className="max-w-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                        {error}
                    </div>
                )}

                {/* Empty State */}
                {!loading && !error && connections.length === 0 && (
                    <div className="max-w-xl text-center py-8 text-gray-500">
                        Bạn chưa theo dõi ai. Hãy tìm kiếm và theo dõi người dùng để nhắn tin!
                    </div>
                )}

                {/* {connected users} */}
                {!loading && !error && connections.length > 0 && (
                <div className='flex flex-col gap-3'>
                    {connections.map((user) => (
                        <div key={user._id} className='max-w-xl flex flex-wrap gap-5 p-6 bg-white shadow rounded-md'>
                        <img
                            src={user.profile_picture || 'https://via.placeholder.com/48'}
                            alt=""
                            className='rounded-full w-12 h-12 mx-auto object-cover'
                        />
                        <div className='flex-1'>
                            <p className='font-medium text-slate-700'>{user.full_name}</p>
                            <p className='text-slate-500'>@{user.username}</p>
                            <p className='text-sm text-gray-600'>{user.bio}</p>
                            {user.lastMessageSnippet && (
                                <p className='text-sm text-gray-500 italic truncate mt-1'>
                                    {user.lastMessageSenderId && currentUser && Number(user.lastMessageSenderId) === Number(currentUser.AccountID) ? `Bạn: ${user.lastMessageSnippet}` : user.lastMessageSnippet}
                                </p>
                            )}
                        </div>
                        <div className='flex flex-col gap-2 mt-4'>
                            {/* Message Button */}
                            <button
                                onClick={() => navigate(`/messages/${user._id}`)}
                                className='size-10 flex items-center justify-center text-sm rounded bg-slate-100 hover:bg-slate-200 text-slate-800 active:scale-95 transition cursor-pointer gap-1'
                            >
                                <MessageSquare className="w-4 h-4" />
                            </button>

                            {/* View Profile Button */}
                            <button
                                onClick={() => navigate(`/profile/${user._id}`)}
                                className='size-10 flex items-center justify-center text-sm rounded bg-slate-100 hover:bg-slate-200 text-slate-800 active:scale-95 transition cursor-pointer'
                            >
                                <Eye className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    ))}
                </div>
                )}
            </div>
        </div>
    )
}

export default Messages