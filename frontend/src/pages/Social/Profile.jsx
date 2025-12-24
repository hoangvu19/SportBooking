import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Loading from "../../components/Shared/Loading";
import { useI18n } from '../../i18n/hooks';
import { PenBox } from 'lucide-react';
import UserProfileInfo from "../../components/Social/UserProfileInfo";
import moment from "moment";
import { parseServerDatetime } from '../../utils/vnTime';
import PostCard from "../../components/Social/PostCard";
import BookingStatusCard from "../../components/Social/BookingStatusCard";
import ProfileModal from "../../components/Social/ProfileModal";
import { userAPI, postAPI } from "../../utils/api";
import getBackendOrigin, { toAbsoluteUrl } from '../../utils/urlHelpers';
import { normalizeUser, getAvatar } from '../../utils/normalize';
import bookingPostAPI from "../../utils/bookingPostAPI";
import useAuth from "../../hooks/useAuth";
import DEFAULT_AVATAR from "../../utils/defaults";

const Profile = () => {
    const { profileId } = useParams();
    const { user: currentUser } = useAuth();
    const { t } = useI18n();
    const [user, setUser] = useState(null);
    const [posts, setPosts] = useState([]);
    const [activeTab, setActiveTab] = useState('posts');
    const [showEdit, setShowEdit] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // FIXED: normalized currentUser has .id field first
    const targetUserId = profileId || currentUser?.id || currentUser?.AccountID || currentUser?._id || currentUser?.userId;

    const fetchUser = async (bypassCache = false) => {
        try {
            setLoading(true);
            setError(null);

            if (!targetUserId) {
                setError(t('profile.userIdNotFound', 'User ID not found'));
                setLoading(false);
                return;
            }

            // Fetch user profile (allow bypassing client GET cache when needed)
            const userResponse = await userAPI.getProfile(targetUserId, bypassCache);

            if (!userResponse.success) {
                setError(userResponse.message || t('profile.unableToLoadProfile', 'Unable to load profile'));
                return;
            }

            // Transform user data to frontend format
            // Normalize various backend shapes for follow flag (boolean or numeric)
            const rawIsFollowing = userResponse.data?.isFollowing ?? userResponse.data?.is_following ?? userResponse.data?.IsFollowing;
            const isFollowingFlag = rawIsFollowing === true || rawIsFollowing === 1 || rawIsFollowing === '1' || rawIsFollowing === 'true';

            console.log('🔍 DEBUG Follow Status:');
            console.log('   rawIsFollowing:', rawIsFollowing);
            console.log('   isFollowingFlag:', isFollowingFlag);
            console.log('   targetUserId:', targetUserId);

            // Determine if the current user already follows this profile.
            // We'll fetch the following list in parallel with the profile call to avoid extra latency.
            let followingSet = new Set();
            try {
                // Always bypass cache to get fresh following list
                const followRes = await userAPI.getFollowing(true).catch(() => ({ success: false }));
                if (followRes && followRes.success && Array.isArray(followRes.data)) {
                    // FIXED: Normalize IDs to Number to ensure consistent type comparison
                    followRes.data.forEach(f => {
                        const id = f._id || f.AccountID;
                        if (id != null) followingSet.add(Number(id));
                    });
                }
                console.log('🔍 DEBUG Following Set:', Array.from(followingSet));
                console.log('   Does following set contain targetUserId?', followingSet.has(Number(targetUserId)));
            } catch (err) {
                // ignore failures here, we'll fallback to server's isFollowing flag
                console.debug('Could not load following list while fetching profile', err);
            }

            const backendBase = getBackendOrigin();
            // Use shared normalizeUser to canonicalize fields
            const normalized = normalizeUser(userResponse.data || {});
            const avatarRaw = getAvatar(userResponse.data || {});
            const profile_picture = toAbsoluteUrl(backendBase, avatarRaw || normalized.avatar || userResponse.data?.profile_picture, 'avatars') || DEFAULT_AVATAR;

            const userData = {
                _id: normalized.id || userResponse.data.AccountID || userResponse.data._id,
                username: normalized.username || userResponse.data.username,
                full_name: normalized.fullName || userResponse.data.full_name,
                email: normalized.email || userResponse.data.email,
                bio: userResponse.data.bio || '',
                profile_picture,
                cover_photo: '',
                location: normalized.address || userResponse.data.address || '',
                gender: normalized.gender || userResponse.data.gender || null,
                // Prefer Account table timestamp when available (various backends nest created timestamp under Account)
                // Check a variety of common variants returned by different backends.
                createdAt: normalized.createdAt ||
                          userResponse.data?.Account?.CreatedAt ||
                          userResponse.data?.Account?.createdAt ||
                          userResponse.data?.Account?.CreatedDate ||
                          userResponse.data?.Account?.Created_at ||
                          userResponse.data?.AccountCreatedAt ||
                          userResponse.data?.AccountCreatedAt ||
                          userResponse.data?.CreatedAt ||
                          userResponse.data?.CreatedDate ||
                          userResponse.data?.createdDate ||
                          userResponse.data?.created_at ||
                          userResponse.data.createdAt ||
                          '',
                website: '',
                followers_count: Number(userResponse.data.followersCount ?? userResponse.data.followers_count ?? 0) || 0,
                following_count: Number(userResponse.data.followingCount ?? userResponse.data.following_count ?? 0) || 0,
                // FIXED: Normalize IDs to Number for consistent comparison
                is_following: Boolean(isFollowingFlag) || followingSet.has(Number(normalized.id || userResponse.data.AccountID || userResponse.data._id)),
                areaId: normalized.areaId || userResponse.data.AreaID || userResponse.data.areaId || null,
            };

            console.log('📦 profile API raw response:', userResponse);
            console.log('🔍 Final is_following check:');
            console.log('   isFollowingFlag:', isFollowingFlag);
            console.log('   normalized.id:', normalized.id, 'type:', typeof normalized.id);
            console.log('   Number(normalized.id):', Number(normalized.id));
            console.log('   followingSet.has(Number(normalized.id)):', followingSet.has(Number(normalized.id)));
            console.log('   userResponse.data.AccountID:', userResponse.data.AccountID);
            console.log('   userResponse.data._id:', userResponse.data._id);
            console.log('   >>> FINAL is_following:', userData.is_following);
            console.log('� normalized userData:', userData);
            setUser(userData);

            // Fetch user posts
            const postsResponse = await postAPI.getUserPosts(targetUserId, 1, 20, bypassCache);
            if (postsResponse.success) {
                const postsArray = Array.isArray(postsResponse.data) ? postsResponse.data : (postsResponse.data.posts || postsResponse.data || []);
                const transformed = transformPosts(postsArray, userData);
                console.log('🔍 transformed posts sample:', transformed.slice(0,3).map(p => ({ id: p._id, images: p.image_urls?.length, videos: p.media_urls?.length, sampleImages: (p.image_urls||[]).slice(0,2), sampleVideos: (p.media_urls||[]).slice(0,2) })));
                setPosts(transformed);
            }

        } catch (err) {
            console.error('Error fetching profile:', err);
            setError(t('profile.unableToConnect', 'Unable to connect to server'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Re-fetch profile when targetUserId or currentUser changes.
        // This handles the case where the auth context (currentUser) becomes
        // available after the page mounted — without this, the profile
        // would be fetched unauthenticated and `isFollowing` would be false.
        // ALWAYS bypass cache to ensure fresh follow status
        if (targetUserId) {
            console.log('🔄 Profile: Fetching user with bypassCache=true for fresh follow status');
            fetchUser(true); // ✅ Always bypass cache to get fresh isFollowing status
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetUserId, currentUser?.AccountID]);

    // Listen for global user updates (emitted after ProfileModal saves) so
    // the page can refetch immediately without requiring a full reload.
    useEffect(() => {
        const onUserUpdated = (e) => {
            try {
                console.debug('Profile detected user:updated event', e && e.detail);
            } catch { void 0; }
            // Re-fetch profile data
            if (targetUserId) fetchUser(true);
        };
    try { window.addEventListener('user:updated', onUserUpdated); } catch { void 0; }
    return () => { try { window.removeEventListener('user:updated', onUserUpdated); } catch { void 0; } };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetUserId]);

    // Mirror Feed.jsx mapping so profile posts use the exact same shape as feed posts
    // Recursively transform shared_post to ensure nested posts are also properly formatted
    const transformPosts = (postsArray = [], userDataLocal = user) => {
        const backendBase = getBackendOrigin();
        return postsArray.map(post => {
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
                            likes_count: rawSharedPost.likesCount || rawSharedPost.reactionsCount || 0,
                            liked_by_current_user: rawSharedPost.likedByCurrentUser || rawSharedPost.liked_by_current_user || false,
                            comments_count: rawSharedPost.commentsCount || rawSharedPost.comments_count || 0,
                            booking: rawSharedPost.booking || rawSharedPost.Booking || null,
                            BookingID: rawSharedPost.BookingID || rawSharedPost.booking?.BookingID || null,
                            // Include booking-related fields if present
                            FacilityName: rawSharedPost.FacilityName || rawSharedPost.booking?.FacilityName,
                            FieldName: rawSharedPost.FieldName || rawSharedPost.booking?.FieldName,
                            SportName: rawSharedPost.SportName || rawSharedPost.booking?.SportName,
                        };
                    }

            const image_urls = (post.image_urls || post.imageUrls || post.Images || []).map(u => toAbsoluteUrl(backendBase, u, 'posts')).filter(Boolean);
            const media_urls = (post.media_urls || post.mediaUrls || []).map(u => toAbsoluteUrl(backendBase, u, 'posts')).filter(Boolean);

            console.debug('[Profile.transformPosts] post', post.PostID || post._id || post.postId, { image_urls, media_urls });

            const postUserNorm = normalizeUser(post.user || post || {});
            return {
                _id: post.PostID || post._id || post.postId,
                PostID: post.PostID || post._id || post.postId,
                content: post.content || post.Content || '',
                createdAt: parseServerDatetime(post.createdAt || post.CreatedDate || post.createdDate) || new Date(),
                image_urls,
                media_urls,
                user: {
                    _id: postUserNorm.id || post.user?._id || post.user?.AccountID || post.AccountID || userDataLocal?._id,
                    username: postUserNorm.username || post.user?.username || post.Username || userDataLocal?.username,
                    full_name: postUserNorm.fullName || post.user?.full_name || post.user?.FullName || post.FullName || userDataLocal?.full_name,
                    profile_picture: toAbsoluteUrl(backendBase, postUserNorm.avatar || post.user?.profile_picture, 'avatars') || userDataLocal?.profile_picture || DEFAULT_AVATAR,
                },
                likes_count: post.likesCount || post.reactionsCount || (Array.isArray(post.likes_count) ? post.likes_count.length : 0),
                liked_by_current_user: post.likedByCurrentUser || post.liked_by_current_user || false,
                comments_count: post.commentsCount || post.comments_count || 0,
                is_shared: post.is_shared ?? post.IsShare ?? false,
                shared_note: post.shared_note || post.SharedNote || null,
                shared_post: transformedSharedPost,
                shares_count: post.sharesCount ?? post.shares_count ?? post.SharesCount ?? 0,
                booking: post.booking || post.Booking || null,
                BookingID: post.BookingID || post.booking?.BookingID || null,
            };
        });
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
                        console.log('📋 Likes tab loaded:', arr.length, 'posts');
                        console.log('📋 Sample post:', arr[0]);
                        setPosts(transformPosts(arr));
                    } else {
                        setError(resp.message || t('profile.unableToLoadLikes', 'Unable to load Likes'));
                    }
                } else if (activeTab === 'posts') {
                    const resp = await postAPI.getUserPosts(targetUserId, 1, 20);
                    if (resp.success) {
                        const arr = Array.isArray(resp.data) ? resp.data : (resp.data.posts || resp.data || []);
                        setPosts(transformPosts(arr));
                    } else {
                        setError(resp.message || t('profile.unableToLoadPosts', 'Unable to load posts'));
                    }
                }
            } catch (err) {
                console.error('Error loading tab data:', err);
                setError('Unable to connect to server');
            } finally {
                setLoading(false);
            }
        };

        loadTab();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, targetUserId]);

    // Enrich posts that reference a BookingID but don't have nested `booking` data
    // Also enrich shared_post if it has BookingID
    useEffect(() => {
        let mounted = true;
        const enrichBookingPosts = async () => {
            try {
                // Find posts that need booking data (top level)
                const topLevelNeeds = posts
                    .map((p, idx) => ({ p, idx, isShared: false }))
                    .filter(item => {
                        const hasBookingId = item.p && (item.p.BookingID || item.p.BookingID === 0);
                        const missingBooking = !item.p.booking || !item.p.booking.BookingID;
                        return hasBookingId && missingBooking;
                    });

                // Find shared posts that need booking data
                const sharedNeeds = posts
                    .map((p, idx) => ({ p, idx, isShared: true }))
                    .filter(item => {
                        const sp = item.p?.shared_post;
                        if (!sp) return false;
                        const hasBookingId = sp.BookingID || sp.BookingID === 0;
                        const missingBooking = !sp.booking || !sp.booking.BookingID;
                        return hasBookingId && missingBooking;
                    });

                const allNeeds = [...topLevelNeeds, ...sharedNeeds];

                if (allNeeds.length === 0) return;

                console.log('🔄 Enriching booking posts:', { topLevel: topLevelNeeds.length, shared: sharedNeeds.length });

                const results = await Promise.all(allNeeds.map(n => {
                    // For shared posts, fetch the shared post's ID
                    const postId = n.isShared 
                        ? (n.p.shared_post?.PostID || n.p.shared_post?._id)
                        : (n.p.PostID || n.p.PostId || n.p._id);
                    
                    console.log('📡 Fetching booking data for', n.isShared ? 'shared post' : 'post', ':', postId);
                    return bookingPostAPI.getById(postId).catch(err => {
                        console.warn('Failed to fetch booking for post', postId, err);
                        return null;
                    });
                }));

                if (!mounted) return;

                // Apply updates
                setPosts(prev => {
                    const next = Array.isArray(prev) ? [...prev] : [];
                    allNeeds.forEach((need, i) => {
                        const resp = results[i];
                        if (resp && resp.success && resp.data) {
                            // Extract booking data from response
                            const bookingData = resp.data.booking || resp.data.Booking || resp.data;
                            if (bookingData && (bookingData.BookingID || bookingData.FacilityName)) {
                                const targetIdx = need.idx;
                                const existing = next[targetIdx] || {};
                                
                                if (need.isShared) {
                                    // Update shared_post's booking
                                    console.log('✅ Enriched shared post with booking:', bookingData);
                                    next[targetIdx] = {
                                        ...existing,
                                        shared_post: {
                                            ...existing.shared_post,
                                            booking: bookingData
                                        }
                                    };
                                } else {
                                    // Update top-level post's booking
                                    console.log('✅ Enriched post with booking:', bookingData);
                                    next[targetIdx] = { ...existing, booking: bookingData };
                                }
                            }
                        }
                    });
                    return next;
                });
            } catch (err) {
                console.debug('Profile.enrichBookingPosts failed', err?.message || err);
            }
        };

        enrichBookingPosts();
        return () => { mounted = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [posts.length]); // Only run when posts array length changes to avoid infinite loops

    // Follow/unfollow handled in child (UserProfileInfo) via onChildFollowChange



    // Resolve current user identifiers (backend uses different field names)
    const currentUserId = currentUser?.AccountID || currentUser?._id || currentUser?.id || currentUser?.userId || null;
    const currentUsername = (currentUser && (currentUser.username || currentUser.userName || currentUser.UserName)) || null;
    // If route uses numeric id, compare numerically; if it uses username (string), compare username; also accept exact id string matches
    let isOwnProfile = false;
    if (!profileId) {
        isOwnProfile = Boolean(currentUserId || currentUsername);
    } else {
        // numeric compare if both are numbers
        const pidNum = Number(profileId);
        const uidNum = Number(currentUserId);
        if (!Number.isNaN(pidNum) && !Number.isNaN(uidNum) && pidNum === uidNum) {
            isOwnProfile = true;
        } else if (String(profileId) === String(currentUserId)) {
            isOwnProfile = true;
        } else if (currentUsername && String(profileId).toLowerCase() === String(currentUsername).toLowerCase()) {
            isOwnProfile = true;
        }
    }
    

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
                    aria-label={isOwnProfile ? t('profile.editCover','Edit cover photo') : undefined}
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
                        {[
                            { id: 'posts', label: t('profile.tabs.posts','Posts') },
                            { id: 'media', label: t('profile.tabs.media','Media') },
                            { id: 'likes', label: t('profile.tabs.likes','Likes') }
                        ].map((tab) => (
                            <button onClick={() => setActiveTab(tab.id)} key={tab.id} className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer
                                ${activeTab === tab.id  ? "bg-indigo-600 text-white" : "text-gray-600 hover:text-gray-900" }`} >
                                {tab.label}
                            </button>
                            ))}
                    </div>
                    {/* Posts */}
                    {activeTab === "posts" && (
                        <div className="mt-6 flex flex-col items-center gap-6">
                             {posts.length === 0 ? (
                                <div className='text-center text-gray-500 py-8'>
                                    {t('feed.noPosts', 'No posts yet')}
                                </div>
                                ) : (
                                posts.map((post) => (
                                    post.booking ? (
                                    <BookingStatusCard key={post._id} post={post} />
                                    ) : (
                                    <PostCard key={post._id} post={post} />
                                    )
                                ))
                                )}
                        </div>
                        
                    )}
                    {/* Likes - render liked posts the same as posts */}
                    {activeTab === "likes" && (
                        <div className="mt-6 flex flex-col items-center gap-6">
                            <div className="w-full max-w-3xl text-right text-sm text-gray-500 mb-2">
                                {posts.length === 0 ? '' : t('profile.likedPostsCount','{count} liked posts').replace('{count}', posts.length)}
                            </div>
                            {posts.length === 0 ? (
                                <div className='text-center text-gray-500 py-8'>
                                    {t('profile.emptyLikes','No liked posts')}
                                </div>
                            ) : (
                                posts.map((post) => (
                                    // Treat any post that already includes a `booking` object as a booking post.
                                    // Some endpoints return booking without BookingID, so don't require BookingID here.
                                    post.booking ? (
                                        <BookingStatusCard key={post._id} post={post} />
                                    ) : (
                                        <PostCard key={post._id} post={post} />
                                    )
                                ))
                            )}
                        </div>
                    )}
                    {/* Media */}
                        {activeTab === "media" && (
                        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 w-full">
                            {posts.filter((post) => (post.image_urls && post.image_urls.length > 0) || (post.media_urls && post.media_urls.length > 0)).flatMap((post) => {
                                // render images first, then videos; return flat array
                                return (post.image_urls || []).map((image, index) => {
                                    const isExternal = /^https?:\/\//i.test(image) || /^\/\//.test(image);
                                    const Wrapper = isExternal ? 'a' : 'div';
                                    const wrapperProps = isExternal ? { href: image, target: '_blank', rel: 'noreferrer' } : {};
                                    return (
                                        <Wrapper key={`img-${post._id}-${index}`} {...wrapperProps} className="relative group">
                                            <div className="w-64 h-40 bg-white overflow-hidden flex items-center justify-center border rounded mx-auto">
                                                <img src={image} alt="media" className="max-w-full max-h-full object-contain" />
                                            </div>
                                            <p className="absolute bottom-0 right-0 text-xs p-1 px-3 backdrop-blur-xl text-white opacity-0 group-hover:opacity-100 transition duration-300">Posted {moment(parseServerDatetime(post.createdAt)).fromNow()}</p>
                                        </Wrapper>
                                    );
                                }).concat((post.media_urls || []).map((m, idx) => {
                                    const isExternal = /^https?:\/\//i.test(m) || /^\/\//.test(m);
                                    // If media is data:... we won't open in new tab to avoid browser blocking; render inline only.
                                    const Wrapper = isExternal ? 'a' : 'div';
                                    const wrapperProps = isExternal ? { href: m, target: '_blank', rel: 'noreferrer' } : {};
                                    return (
                                        <Wrapper key={`vid-${post._id}-${idx}`} {...wrapperProps} className="relative group">
                                            <div className="w-64 h-40 bg-black overflow-hidden flex items-center justify-center rounded mx-auto">
                                                <video src={m} className="max-w-full max-h-full object-contain" controls preload="metadata" playsInline />
                                            </div>
                                            <p className="absolute bottom-0 right-0 text-xs p-1 px-3 backdrop-blur-xl text-white opacity-0 group-hover:opacity-100 transition duration-300">Posted {moment(parseServerDatetime(post.createdAt)).fromNow()}</p>
                                        </Wrapper>
                                    );
                                }));
                            })}
                        </div>
                        )}

                </div>
            </div>
            {showEdit && <ProfileModal setShowEdit={setShowEdit} user={user} />}
        </div>
    ) : null;
}

export default Profile;