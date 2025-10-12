import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Loading from "../components/Loading";
import { PenBox } from 'lucide-react';
import UserProfileInfo from "../components/UserProfileInfo";
import moment from "moment";
import PostCard from "../components/PostCard";
import ProfileModal from "../components/ProfileModal";
import { userAPI, postAPI } from "../utils/api";
import { useAuth } from "../hooks/useAuth";
import DEFAULT_AVATAR from "../utils/defaults";

const Profile = () => {
    const { profileId } = useParams();
    const { user: currentUser } = useAuth();
    const [user, setUser] = useState(null);
    const [posts, setPosts] = useState([]);
    const [activeTab, setActiveTab] = useState('posts');
    const [showEdit, setShowEdit] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // followLoading is handled inside UserProfileInfo (local optimistic state)

    // Determine which user ID to use - profileId from URL or current user's ID
    const targetUserId = profileId || currentUser?.AccountID;

    const fetchUser = async () => {
        try {
            setLoading(true);
            setError(null);

            if (!targetUserId) {
                setError('Không tìm thấy user ID');
                setLoading(false);
                return;
            }

            // Fetch user profile
            const userResponse = await userAPI.getProfile(targetUserId);

            if (!userResponse.success) {
                setError(userResponse.message || 'Không thể tải profile');
                return;
            }

            // Transform user data to frontend format
            // Normalize various backend shapes for follow flag (boolean or numeric)
            const rawIsFollowing = userResponse.data?.isFollowing ?? userResponse.data?.is_following ?? userResponse.data?.IsFollowing;
            const isFollowingFlag = rawIsFollowing === true || rawIsFollowing === 1 || rawIsFollowing === '1' || rawIsFollowing === 'true';

            // Determine if the current user already follows this profile.
            // We'll fetch the following list in parallel with the profile call to avoid extra latency.
            let followingSet = new Set();
            try {
                const followRes = await userAPI.getFollowing().catch(() => ({ success: false }));
                if (followRes && followRes.success && Array.isArray(followRes.data)) {
                    followRes.data.forEach(f => followingSet.add(f._id || f.AccountID));
                }
            } catch (err) {
                // ignore failures here, we'll fallback to server's isFollowing flag
                console.debug('Could not load following list while fetching profile', err);
            }

            const userData = {
                _id: userResponse.data.AccountID || userResponse.data._id,
                username: userResponse.data.username,
                full_name: userResponse.data.full_name,
                email: userResponse.data.email,
                bio: userResponse.data.bio || '',
                profile_picture: userResponse.data.profile_picture || userResponse.data.AvatarUrl || userResponse.data.ProfilePictureURL || userResponse.data.avatarUrl || DEFAULT_AVATAR,
                cover_photo: '',
                location: userResponse.data.address || '',
                website: '',
                followers_count: Number(userResponse.data.followersCount ?? userResponse.data.followers_count ?? 0) || 0,
                following_count: Number(userResponse.data.followingCount ?? userResponse.data.following_count ?? 0) || 0,
                // Prefer server-provided flag, but if it's missing or false,
                // fall back to checking the current user's following list we just loaded.
                is_following: Boolean(isFollowingFlag) || followingSet.has(userResponse.data.AccountID || userResponse.data._id),
            };

            console.log('📦 profile API raw response:', userResponse);
            console.log('🔁 normalized userData:', userData);
            setUser(userData);

            // Fetch user posts
            const postsResponse = await postAPI.getUserPosts(targetUserId, 1, 20);
            if (postsResponse.success) {
                const postsArray = Array.isArray(postsResponse.data) ? postsResponse.data : (postsResponse.data.posts || postsResponse.data || []);
                setPosts(transformPosts(postsArray, userData));
            }

        } catch (err) {
            console.error('Error fetching profile:', err);
            setError('Không thể kết nối đến server');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Re-fetch profile when targetUserId or currentUser changes.
        // This handles the case where the auth context (currentUser) becomes
        // available after the page mounted — without this, the profile
        // would be fetched unauthenticated and `isFollowing` would be false.
        if (targetUserId) {
            fetchUser();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetUserId, currentUser?.AccountID]);

    // Helper to normalize backend post objects into frontend PostCard shape
    const transformPosts = (postsArray = [], userDataLocal = user) => {
        return postsArray.map(post => ({
            _id: post.PostID?.toString() || post._id || post.postId?.toString(),
            content: post.content || post.Content || '',
            createdAt: post.createdAt || post.CreatedDate || post.createdDate || new Date().toISOString(),
            image_urls: post.image_urls || post.imageUrls || post.Images || [],
                user: post.user ? {
                _id: post.user._id || post.user?.AccountID || userDataLocal?._id,
                username: post.user.username || post.user?.Username || userDataLocal?.username,
                full_name: post.user.full_name || post.user?.FullName || userDataLocal?.full_name,
                profile_picture: post.user.profile_picture || post.user?.AvatarUrl || post.user?.ProfilePictureURL || post.user?.avatarUrl || DEFAULT_AVATAR,
            } : (userDataLocal || {}),
            likes_count: Array.isArray(post.likes_count) ? post.likes_count.length : (post.likesCount || post.reactionsCount || 0),
            liked_by_current_user: post.likedByCurrentUser || post.liked_by_current_user || false,
            comments_count: post.commentsCount || post.comments_count || 0,
            // Share-specific fields (preserve whatever backend returned)
            is_shared: post.is_shared ?? post.IsShare ?? false,
            shared_note: post.shared_note || post.SharedNote || null,
            shared_post: post.shared_post || post.SharedPost || null,
            shares_count: post.sharesCount ?? post.shares_count ?? post.SharesCount ?? 0,
        }));
    };

    // Load data for the active tab (posts / likes)
    useEffect(() => {
        const loadTab = async () => {
            if (!targetUserId) return;
            // don't override the initial profile-level loading indicator too aggressively
            setLoading(true);
            setError(null);
            try {
                if (activeTab === 'likes') {
                    const resp = await userAPI.getLikedPosts(targetUserId, 1, 20);
                    if (resp.success) {
                        const arr = Array.isArray(resp.data) ? resp.data : (resp.data.posts || resp.data || []);
                        setPosts(transformPosts(arr));
                    } else {
                        setError(resp.message || 'Không thể tải mục Likes');
                    }
                } else if (activeTab === 'posts') {
                    const resp = await postAPI.getUserPosts(targetUserId, 1, 20);
                    if (resp.success) {
                        const arr = Array.isArray(resp.data) ? resp.data : (resp.data.posts || resp.data || []);
                        setPosts(transformPosts(arr));
                    } else {
                        setError(resp.message || 'Không thể tải bài viết');
                    }
                }
            } catch (err) {
                console.error('Error loading tab data:', err);
                setError('Không thể kết nối đến server');
            } finally {
                setLoading(false);
            }
        };

        loadTab();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, targetUserId]);

    // Follow/unfollow handled in child (UserProfileInfo) via onChildFollowChange

    // currentUser stored by auth may contain AccountID or _id
    const currentUserId = currentUser?.AccountID || currentUser?._id || currentUser?.userId;
    const isOwnProfile = profileId ? (parseInt(profileId) === parseInt(currentUserId)) : Boolean(currentUserId);
    

    return loading ? (
        <Loading />
    ) : error ? (
        <div className='h-full flex items-center justify-center'>
            <div className='bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded'>
                {error}
            </div>
        </div>
    ) : user ? (
        <div className='relative h-full overflow-y-scroll bg-gray-50 p-6'>
            <div className='max-w-3xl mx-auto'>
                {/* Profile Card */}
                <div className='bg-white rounded-2xl shadow overflow-hidden'>
                {/* Cover Photo */}
                <div
                    className={`h-40 md:h-56 bg-gradient-to-r from-indigo-200 via-purple-200 to-pink-200 ${isOwnProfile ? 'cursor-pointer' : ''}`}
                    onClick={() => { if (isOwnProfile) setShowEdit(true); }}
                    role={isOwnProfile ? 'button' : undefined}
                    aria-label={isOwnProfile ? 'Edit cover photo' : undefined}
                >
                    {user.cover_photo ? (
                        <div className="relative w-full h-full">
                            <img src={user.cover_photo} alt='' className='w-full h-full object-cover' />
                            {isOwnProfile && (
                                <div className='absolute right-3 bottom-3 bg-black/50 p-2 rounded-full text-white flex items-center gap-2'>
                                    <PenBox className='w-4 h-4' />
                                </div>
                            )}
                        </div>
                    ) : (
                        // Show gradient cover with edit hint
                        isOwnProfile && (
                            <div className='w-full h-full flex items-end justify-end p-3'>
                                {/* <div className='bg-black/40 text-white px-3 py-2 rounded flex items-center gap-2'>
                                    <PenBox className='w-4 h-4' />
                                    Edit cover
                                </div> */}
                            </div>
                        )
                    )}
                </div>
                                    <UserProfileInfo  
                                        user={user} 
                                        posts={posts} 
                                        showEdit={showEdit} 
                                        setShowEdit={setShowEdit} 
                                        activeTab={activeTab} 
                                        setActiveTab={setActiveTab}
                                        isOwnProfile={isOwnProfile}
                    
                                        onChildFollowChange={(delta) => {
                                            // delta: { is_following: boolean, followers_count: number }
                                            setUser(prev => prev ? { ...prev, ...delta } : prev);
                                        }}
                                    />
                </div>

                {/* Tabs */}
                <div className='mt-6'>
                    <div className='bg-white rounded-xl shadow p-1 flex max-w-md mx-auto'>
                        {["posts", "media", "likes"].map((tab) => (
                        <button onClick={() => setActiveTab(tab)} key={tab} className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer
                            ${activeTab === tab  ? "bg-indigo-600 text-white" : "text-gray-600 hover:text-gray-900" }`} >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                        ))}
                    </div>
                    {/* Posts */}
                    {activeTab === "posts" && (
                        <div className="mt-6 flex flex-col items-center gap-6">
                            {posts.length === 0 ? (
                                <div className='text-center text-gray-500 py-8'>
                                    Chưa có bài viết nào
                                </div>
                            ) : (
                                posts.map((post) => (
                                    <PostCard 
                                        key={post._id} 
                                        post={post} 
                                    />
                                ))
                            )}
                        </div>
                    )}
                    {/* Likes - render liked posts the same as posts */}
                    {activeTab === "likes" && (
                        <div className="mt-6 flex flex-col items-center gap-6">
                            <div className="w-full max-w-3xl text-right text-sm text-gray-500 mb-2">
                                {posts.length === 0 ? '' : `Có ${posts.length} bài viết đã thích`}
                            </div>
                            {posts.length === 0 ? (
                                <div className='text-center text-gray-500 py-8'>
                                    Chưa có bài viết nào trong Likes
                                </div>
                            ) : (
                                posts.map((post) => (
                                    <PostCard 
                                        key={post._id} 
                                        post={post} 
                                    />
                                ))
                            )}
                        </div>
                    )}
                    {/* Media */}
                        {activeTab === "media" && (
                        <div className="flex flex-wrap mt-6 max-w-6xl">
                            {posts.filter((post) => post.image_urls.length > 0).map((post) => post.image_urls.map((image, index) => (
                                <Link
                                    key={`${post._id}-${index}`}
                                    target="_blank"
                                    to={image}
                                    className="relative group"
                                >
                                    <img
                                    src={image}
                                    alt="media"
                                    className="w-64 aspect-video object-cover"
                                    />
                                    <p className="absolute bottom-0 right-0 text-xs p-1 px-3 backdrop-blur-xl text-white opacity-0 group-hover:opacity-100 transition duration-300">
                                    Posted {moment(post.createdAt).fromNow()}
                                    </p>
                                </Link>
                                ))
                            )}
                        </div>
                        )}

                </div>
            </div>
            {showEdit && <ProfileModal setShowEdit={setShowEdit} user={user} onSaved={fetchUser} />}
        </div>
    ) : null;
}

export default Profile;