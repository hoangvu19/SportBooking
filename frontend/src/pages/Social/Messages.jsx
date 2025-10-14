import React, { useState, useEffect, useCallback } from 'react'
import { Eye, MessageSquare, Clock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { userAPI, messageAPI, authAPI } from "../../utils/api"
import Loading from "../../components/Shared/Loading"
import DEFAULT_AVATAR from "../../utils/defaults";

const Messages = () => {
    const navigate = useNavigate();
    const [connections, setConnections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [followingList, setFollowingList] = useState([]);
    const [pinnedMap, setPinnedMap] = useState({});
    const [showPending, setShowPending] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [searchTimeout, setSearchTimeout] = useState(null);

    // loadConnections will be called after it's declared (see useEffect below)

    const loadConnections = useCallback(async () => {
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
            // Retry a few times in case of transient failures (e.g., after hard refresh / Ctrl+F5)
            let convRes = null;
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    convRes = await messageAPI.getConversations();
                    if (convRes && convRes.success) break;
                } catch (err) {
                    console.debug('Get conversations attempt', attempt + 1, 'failed', err && err.message ? err.message : err);
                }
                // small backoff
                await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
            }
            if (convRes && convRes.success) {
                const conversationList = Array.isArray(convRes.data) ? convRes.data : [];
                const parseDate = (value) => {
                    const time = value ? new Date(value).getTime() : NaN;
                    return Number.isFinite(time) ? time : 0;
                };
                // Map to the same UI shape but keep bio and add lastMessageSnippet separately
                    const transformed = conversationList.map(u => {
                    // Normalize id fields
                    const id = u.AccountID || u._id || u.Id || u.id;

                    // Normalize last message sender id from various possible shapes
                    let lastMessageSenderId = null;
                    if (u.LastMessageSenderID) lastMessageSenderId = u.LastMessageSenderID;
                    else if (u.LastMessageSenderId) lastMessageSenderId = u.LastMessageSenderId;
                    else if (u.lastMessageSenderId) lastMessageSenderId = u.lastMessageSenderId;
                    else if (u.LastSenderID) lastMessageSenderId = u.LastSenderID;
                    else if (u.SenderID) lastMessageSenderId = u.SenderID;
                    else if (u.senderId) lastMessageSenderId = u.senderId;
                    else if (u.LastMessage && (u.LastMessage.senderId || u.LastMessage.SenderID || (u.LastMessage.sender && (u.LastMessage.sender.AccountID || u.LastMessage.sender._id)))) {
                        lastMessageSenderId = u.LastMessage.senderId || u.LastMessage.SenderID || (u.LastMessage.sender && (u.LastMessage.sender.AccountID || u.LastMessage.sender._id));
                    } else if (u.lastMessage && (u.lastMessage.senderId || (u.lastMessage.sender && (u.lastMessage.sender.AccountID || u.lastMessage.sender._id)))) {
                        lastMessageSenderId = u.lastMessage.senderId || (u.lastMessage.sender && (u.lastMessage.sender.AccountID || u.lastMessage.sender._id));
                    }

                    // Normalize unread count
                    let unread = 0;
                    if (typeof u.UnreadCount !== 'undefined') unread = Number(u.UnreadCount || 0);
                    else if (typeof u.unreadCount !== 'undefined') unread = Number(u.unreadCount || 0);
                    else if (typeof u.Unread !== 'undefined') unread = Number(u.Unread || 0);
                    else if (typeof u.UnreadMessages !== 'undefined') unread = Number(u.UnreadMessages || 0);

                    // Normalize last message snippet
                    const lastMessageSnippet = u.LastMessageContent || u.lastMessageContent || (u.LastMessage && (u.LastMessage.content || u.LastMessage.text)) || (u.lastMessage && (u.lastMessage.content || u.lastMessage.text)) || '';

                    return {
                        _id: id,
                        full_name: u.FullName || u.full_name || u.Fullname || u.fullName,
                        username: u.Username || u.username,
                        profile_picture: u.profile_picture || u.AvatarUrl || u.ProfilePictureURL || u.avatarUrl || DEFAULT_AVATAR,
                        bio: u.Bio || u.bio || 'No bio yet',
                        lastMessageSnippet,
                        lastMessageSenderId,
                        lastMessageDate: u.LastMessageDate || u.lastMessageDate || (u.LastMessage && u.LastMessage.createdAt) || null,
                        unreadCount: unread
                    };
                });

                // Sort by lastMessageDate desc so most recent conversations show first
                transformed.sort((a, b) => parseDate(b.lastMessageDate) - parseDate(a.lastMessageDate));

                setConnections(transformed);
                // populate pinned map for the list (client-side pins stored in localStorage)
                try {
                    // try to derive current user id from the currentUser state; if not available yet, skip
                    const curIdLocal = currentUser ? (currentUser.AccountID || currentUser._id || currentUser.userId || currentUser.id) : null;
                    if (curIdLocal) {
                        const pm = {};
                                for (const c of transformed) {
                                    try {
                                        const key = `pinned_conv_${Number(curIdLocal)}_${c._id}`;
                                        const pinned = localStorage.getItem(key);
                                        if (pinned) pm[c._id] = pinned;
                                    } catch { /* ignore per-conversation errors */ }
                        }
                        setPinnedMap(pm);
                    }
                } catch (err) { console.debug('populate pinned map failed', err); }
                // Also fetch following for the right panel (best-effort)
                try {
                    const followResp = await userAPI.getFollowing();
                    if (followResp && followResp.success) {
                        const fl = (followResp.data || []).map(u => ({
                            _id: u.AccountID || u._id,
                            full_name: u.FullName || u.full_name,
                            username: u.Username || u.username,
                            profile_picture: u.profile_picture || u.AvatarUrl || u.ProfilePictureURL || u.avatarUrl || DEFAULT_AVATAR
                        }));
                        setFollowingList(fl);
                    }
                } catch (e) {
                    console.debug('Could not load following list for panel', e);
                }

                    // Check whether current user has ever sent messages to these conversation partners.
                    // We use this to classify "pending" as users who have NOT been replied to by the current user.
                    try {
                        const curIdLocal = currentUser ? (currentUser.AccountID || currentUser._id || currentUser.userId || currentUser.id) : (function(){try{const t=localStorage.getItem('authToken'); if(!t) return null; const p=JSON.parse(atob(t.split('.')[1])); return p&&(p.userId||p.AccountID||p._id)?(p.userId||p.AccountID||p._id):null}catch{return null;}})();
                        if (curIdLocal) {
                            const candidates = transformed.slice(0, 50); // limit to reduce calls
                            const updatedMap = {};
                            await Promise.all(candidates.map(async (c) => {
                                try {
                                    const conv = await messageAPI.getConversation(c._id);
                                    const msgs = (conv && conv.success && Array.isArray(conv.data)) ? conv.data : (Array.isArray(conv) ? conv : []);
                                    const youSent = msgs.some(m => {
                                        const sender = m.SenderID || m.senderId || m.sender?._id || m.sender?.AccountID;
                                        return String(sender) === String(curIdLocal);
                                    });
                                    updatedMap[c._id] = { youHaveSent: youSent };
                                } catch { /* ignore */ }
                            }));
                            if (Object.keys(updatedMap).length > 0) {
                                setConnections(prev => prev.map(c => ({ ...c, ...(updatedMap[c._id] || {}) })));
                            }
                        }
                    } catch (err) { console.debug('Could not determine youHaveSent flags', err); }

                // no additional checks
            } else {
                // Fallback: conversations API unavailable — don't substitute with following list.
                // Instead, try to populate the following panel only (best-effort) and show an error for conversations.
                const response = await userAPI.getFollowing();
                if (response && response.success) {
                    const fl = response.data.map(user => ({
                        _id: user.AccountID || user._id,
                        full_name: user.FullName || user.full_name,
                        username: user.Username || user.username,
                        profile_picture: user.profile_picture || user.ProfilePictureURL || user.ProfilePicture || user.ProfilePictureUrl || user.ProfilePictureURLSmall || user.ProfilePictureSmall || user.ProfilePictureThumb || user.ProfilePicture_URL || user.AvatarUrl || user.avatarUrl || DEFAULT_AVATAR
                    }));
                    setFollowingList(fl);
                }
                setError('Không thể tải cuộc trò chuyện (vui lòng thử tải lại)');
            }
        } catch (err) {
            console.error('Load connections error:', err);
            setError('Không thể kết nối đến server');
        } finally {
            setLoading(false);
        }
    }, [currentUser]);

    // call loadConnections once on mount
    useEffect(() => {
        loadConnections();
    }, [loadConnections]);

    const handleSearchChange = (query) => {
        if (searchTimeout) clearTimeout(searchTimeout);
        if (!query || query.trim().length === 0) {
            setSearchResults([]);
            return;
        }
        const t = setTimeout(async () => {
            try {
                const res = await userAPI.search(query, 10);
                if (res && res.success) {
                    const arr = Array.isArray(res.data) ? res.data : (res.data.users || res.data || []);
                    const mapped = arr.map(u => ({ _id: u.AccountID || u._id, full_name: u.FullName || u.full_name || u.username, username: u.Username || u.username, profile_picture: u.profile_picture || u.AvatarUrl || u.ProfilePictureURL || u.avatarUrl || DEFAULT_AVATAR }));
                    setSearchResults(mapped);
                }
            } catch (err) {
                console.error('Search error', err);
            }
        }, 300);
        setSearchTimeout(t);
    };

    const openConversation = async (userId) => {
        try {
            // Mark conversation as read on server
            await messageAPI.markConversationRead(userId);
        } catch (err) {
            console.error('Mark conversation read error', err);
            // Proceed to navigate even if marking read failed
        }

            // Do NOT modify local conversation flags when opening: pending status should be based on whether
            // the current user has replied (youHaveSent). Opening should not remove pending.
        // Clear search results if any
        setSearchResults([]);

        // Navigate to conversation
        navigate(`/messages/${userId}`);
    };

    // number of pending conversations: 1) other user sent the last message, 2) there are unreadCount > 0, 3) and you don't follow them
    // number of pending conversations: only include conversations where
    // 1) the other user sent the last message, 2) there are unreadCount > 0, and 3) you don't follow them
    // Requiring unreadCount > 0 ensures that once you open/mark-as-read, the conversation leaves the pending panel
    const currentUserId = currentUser ? (currentUser.AccountID || currentUser._id || currentUser.userId || currentUser.id) : null;
    const pendingConversations = connections.filter(c => {
        const isFollowing = !!followingList.find(f => String(f._id) === String(c._id));
        const lastFromOther = currentUserId ? String(c.lastMessageSenderId) !== String(currentUserId) : Boolean(c.lastMessageSenderId);
        const youHaveSent = !!c.youHaveSent;
        // Treat as pending if other user sent last message, you haven't replied (youHaveSent=false), and you don't follow them.
        return !isFollowing && lastFromOther && !youHaveSent;
    });
    const pendingCount = pendingConversations.length;

    // listen for a global "message:sent" custom event so that when ChatBox sends a message
    // we can update the conversations list (remove from pending or update lastMessageSenderId/unreadCount)
    useEffect(() => {
        const handler = (e) => {
            try {
                const { toUserId, fromUserId, message } = e.detail || {};
                const curId = currentUser?.AccountID || currentUser?._id || currentUser?.userId;
                if (!curId) return;

                // If current user is the sender (we replied), remove from pending and move conversation to top
                if (String(fromUserId) === String(curId)) {
                    setConnections(prev => {
                        // find existing conversation
                        const idx = prev.findIndex(c => String(c._id) === String(toUserId));
                        const updated = prev.map(c => String(c._id) === String(toUserId) ? { ...c, unreadCount: 0, lastMessageSenderId: fromUserId, lastMessageSnippet: message || c.lastMessageSnippet } : c);
                        if (idx === -1) {
                            // conversation not in list yet, create a minimal entry and put it on top
                            const newConv = { _id: toUserId, full_name: '', username: '', profile_picture: DEFAULT_AVATAR, bio: '', lastMessageSnippet: message || '', lastMessageSenderId: fromUserId, unreadCount: 0 };
                            return [newConv, ...updated];
                        }
                        // move the updated conversation to front
                        const conv = updated.splice(idx, 1)[0];
                        return [conv, ...updated];
                    });
                }
            } catch (err) { console.debug('message:sent handler error', err); }
        };
        window.addEventListener('message:sent', handler);
        const delHandler = () => {
            try {
                // reload conversations when a message is deleted to update last message snippets/unread counts
                loadConnections();
            } catch (err) { console.debug('message:deleted handler error', err); }
        };
        window.addEventListener('message:deleted', delHandler);
        return () => {
            window.removeEventListener('message:sent', handler);
            window.removeEventListener('message:deleted', delHandler);
        };
    }, [currentUser, setConnections, followingList, loadConnections]);

    // listen for pin/unpin events so the conversations list updates live
    useEffect(() => {
        const onPinned = (e) => {
            try {
                const { otherUserId, messageId } = e.detail || {};
                if (!otherUserId) return;
                setPinnedMap(prev => ({ ...prev, [otherUserId]: String(messageId || '') }));
            } catch (err) { console.debug('message:pinned handler error', err); }
        };
        const onUnpinned = (e) => {
            try {
                const { otherUserId } = e.detail || {};
                if (!otherUserId) return;
                setPinnedMap(prev => {
                    const copy = { ...prev };
                    delete copy[otherUserId];
                    return copy;
                });
            } catch (err) { console.debug('message:unpinned handler error', err); }
        };
        window.addEventListener('message:pinned', onPinned);
        window.addEventListener('message:unpinned', onUnpinned);
        return () => {
            window.removeEventListener('message:pinned', onPinned);
            window.removeEventListener('message:unpinned', onUnpinned);
        };
    }, []);

    // Exclude pending conversations from the main list so they only appear in the "pending" panel
    const visibleConnections = connections.filter(c => !pendingConversations.find(p => String(p._id) === String(c._id)));

    return (
        <div className='min-h-screen relative bg-slate-50'>
                <div className='max-w-6xl mx-auto p-6'>
                {/* Title */}
                <div className='mb-8'>
                <h1 className='text-3xl font-bold text-slate-900 mb-2'>
                    Messages
                </h1>
                <div className='w-full max-w-md'>
                    <label htmlFor='message-search' className='sr-only'>Tìm người dùng</label>
                    <div className='relative'>
                        <input
                            id='message-search'
                            placeholder='Tìm người dùng để nhắn tin...'
                            className='w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-200'
                            onChange={(e) => handleSearchChange(e.target.value)}
                        />
                        {searchResults.length > 0 && (
                            <div className='absolute left-0 right-0 bg-white border mt-1 rounded shadow max-h-64 overflow-y-auto z-40'>
                                {searchResults.map(u => (
                                    <div key={u._id} onClick={() => { openConversation(u._id); }} className='p-2 hover:bg-slate-50 cursor-pointer flex items-center gap-3'>
                                            <img src={u.profile_picture || DEFAULT_AVATAR} onError={(e)=>{ e.target.onerror = null; e.target.src = DEFAULT_AVATAR }} alt='' className='w-8 h-8 rounded-full object-cover' />
                                        <div>
                                            <div className='font-medium text-sm'>{u.full_name}</div>
                                            <div className='text-xs text-gray-500'>@{u.username}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
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
                {!loading && !error && visibleConnections.length === 0 && (
                    <div className="max-w-xl text-center py-8 text-gray-500">
                        Bạn chưa có cuộc trò chuyện nào (các tin nhắn chờ nằm ở panel bên phải)
                    </div>
                )}

                {/* {connected users} */}
                {!loading && !error && (
                <div className='flex gap-6'>
                    <div className='flex-1'>
                        {visibleConnections.length === 0 ? (
                            <div className="max-w-xl text-center py-8 text-gray-500">
                                Bạn chưa có cuộc trò chuyện nào
                            </div>
                        ) : (
                            <div className='flex flex-col gap-3'>
                                {visibleConnections.map((user) => (
                                    <div key={user._id} className='max-w-xl flex flex-wrap gap-5 p-6 bg-white shadow rounded-md'>
                                        <img
                                            src={user.profile_picture || DEFAULT_AVATAR}
                                            onError={(e)=>{ e.target.src = DEFAULT_AVATAR }}
                                            alt=""
                                            className='rounded-full w-12 h-12 mx-auto object-cover'
                                        />
                                        <div className='flex-1'>
                                            <p className='font-medium text-slate-700 flex items-center gap-2'>
                                                <span>{user.full_name}</span>
                                                {pinnedMap && pinnedMap[user._id] && (
                                                    <svg className='w-4 h-4 text-yellow-500' viewBox='0 0 24 24' fill='currentColor' aria-hidden>
                                                        <path d='M12 2l2 5 5 .5-3.5 3 1 5L12 14l-4.5 2.5 1-5L5 7.5 10 7 12 2z' />
                                                    </svg>
                                                )}
                                            </p>
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
                                                onClick={() => openConversation(user._id)}
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

                    {/* Right following panel */}
                    <aside className='w-80 shrink-0 self-start sticky top-24'>
                        <div className='bg-white p-4 rounded shadow flex flex-col'>
                            <div className='flex items-center justify-between mb-3'>
                                <h3 className='text-sm font-semibold'>Những người bạn đang theo dõi</h3>
                                <button title='Tin nhắn chờ' onClick={() => setShowPending(v => !v)} className={`relative p-2 rounded ${showPending ? 'bg-indigo-100' : 'hover:bg-slate-50'}`}>
                                    <Clock className='w-4 h-4 text-gray-700' />
                                    {pendingCount > 0 && (
                                        <span className='absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-semibold leading-none text-white bg-red-600 rounded-full'>
                                            {pendingCount > 99 ? '99+' : pendingCount}
                                        </span>
                                    )}
                                </button>
                            </div>
                            {(!showPending && followingList.length === 0) && (
                                <div className='text-sm text-gray-500'>Không có ai trong danh sách theo dõi</div>
                            )}
                            {showPending && (
                                <div className='flex-1 overflow-y-auto max-h-[calc(100vh-200px)] pr-2 space-y-2'>
                                    {pendingConversations.map(u => (
                                        <div key={u._id} className='flex items-center gap-3 p-2 rounded hover:bg-slate-50 cursor-pointer'>
                                            <img src={u.profile_picture || DEFAULT_AVATAR} onError={(e)=>{ e.target.onerror = null; e.target.src = DEFAULT_AVATAR }} alt='' className='w-10 h-10 rounded-full object-cover' />
                                            <div className='flex-1'>
                                                <div className='font-medium text-sm'>{u.full_name}</div>
                                                <div className='text-xs text-gray-500'>@{u.username}</div>
                                            </div>
                                            <button onClick={() => openConversation(u._id)} className='px-2 py-1 bg-indigo-600 text-white text-xs rounded'>Mở</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {!showPending && followingList.length > 0 && (
                                <div className='flex-1 overflow-y-auto max-h-[calc(100vh-200px)] pr-2 space-y-2'>
                                    {followingList.map(u => (
                                        <div key={u._id} className='flex items-center gap-3 p-2 rounded hover:bg-slate-50 cursor-pointer'>
                                            <img src={u.profile_picture || DEFAULT_AVATAR} onError={(e)=>{ e.target.onerror = null; e.target.src = DEFAULT_AVATAR }} alt='' className='w-10 h-10 rounded-full object-cover' />
                                            <div className='flex-1'>
                                                <div className='font-medium text-sm'>{u.full_name}</div>
                                                <div className='text-xs text-gray-500'>@{u.username}</div>
                                            </div>
                                            <button onClick={() => openConversation(u._id)} className='px-2 py-1 bg-indigo-600 text-white text-xs rounded'>Nhắn</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </aside>
                </div>
                )}
            </div>
        </div>
    )
}

export default Messages