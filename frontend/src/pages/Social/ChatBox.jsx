import React, { useRef, useState, useEffect } from "react";
import { ImageIcon, SendHorizonal } from "lucide-react";
import { useParams } from "react-router-dom";
import { messageAPI, userAPI, imageToBase64 } from "../../utils/api";
import { API_BASE_URL } from "../../config/apiConfig";
import getBackendOrigin, { toAbsoluteUrl } from '../../utils/urlHelpers';
import { useMemo, useCallback } from 'react';
import { parseServerDatetime, formatVnTime } from '../../utils/vnTime';
import useAuth from "../../hooks/useAuth";
import { useI18n } from '../../i18n/hooks';
import Loading from "../../components/Shared/Loading";
import DEFAULT_AVATAR from "../../utils/defaults";


const ChatBox = () => {
    const { userId } = useParams();
    const { user: currentUser } = useAuth();
    const currentUserIdNum = currentUser ? Number(currentUser.id ?? currentUser.userId ?? currentUser.AccountID ?? currentUser._id) : null;
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState("");
    const [images, setImages] = useState([]);
    const [otherUser, setOtherUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const messageEndRef = useRef(null);
    const messageRefs = useRef({});
    const highlightTimeoutRef = useRef(null);
    const [highlightMessageId, setHighlightMessageId] = useState(null);
    const [pinnedMessageIds, setPinnedMessageIds] = useState([]);
    const pinnedMessage = (pinnedMessageIds && pinnedMessageIds.length) ? messages.find(m => String(m._id) === String(pinnedMessageIds[0])) : null;
    const imageExistenceCache = useMemo(() => new Map(), []);
    const [validatedMedia, setValidatedMedia] = useState({}); 
    const validateUrl = useCallback(async (url) => {
        if (!url) return false;
        if (imageExistenceCache.has(url)) return imageExistenceCache.get(url);
        try {
            const backend = getBackendOrigin();
            const uploadsPrefix = (backend || '').replace(/\/$/, '') + '/uploads/';
            if (typeof url === 'string' && url.startsWith(uploadsPrefix)) {
                const rel = url.substring(uploadsPrefix.length);
                try {
                    const r = await fetch(`${backend}/api/internal/file-exists?path=${encodeURIComponent(rel)}`, { method: 'GET', cache: 'no-store' });
                    const j = await r.json();
                    const ok = j && j.success && !!j.exists;
                    imageExistenceCache.set(url, ok);
                    return ok;
                } catch {
                    imageExistenceCache.set(url, false);
                    return false;
                }
            }

            const resp = await fetch(url, { method: 'HEAD', cache: 'no-store' });
            const ok = resp && resp.ok;
            imageExistenceCache.set(url, ok);
            return ok;
        } catch {
            imageExistenceCache.set(url, false);
            return false;
        }
    }, [imageExistenceCache]);

    useEffect(() => {
        if (userId && currentUser) {
            loadConversation();
        }
    }, [userId, currentUser]);

    const { t } = useI18n();

    useEffect(() => {
        let mounted = true;
        const run = async () => {
            const backendBase = getBackendOrigin();
            const next = {};
            for (const m of messages) {
                const id = m._id;
                const raw = Array.isArray(m.media_urls) ? m.media_urls : [];
                const promises = raw.map(async (u) => {
                    const src = toAbsoluteUrl(backendBase, u, 'comments');
                    const ok = await validateUrl(src);
                    return ok ? src : null;
                });
                try {
                    const results = await Promise.all(promises);
                    next[id] = results.filter(Boolean);
                } catch {
                    next[id] = [];
                }
            }
            if (mounted) setValidatedMedia(next);
        };
        if (messages && messages.length > 0) run();
        return () => { mounted = false; };
    }, [messages, validateUrl]);

    const loadConversation = async () => {
        try {
            setLoading(true);
            
            const userResponse = await userAPI.getProfile(userId);
            if (userResponse.success) {
                const ud = userResponse.data;
                setOtherUser({
                    _id: ud.userId || ud.AccountID || ud._id,
                    username: ud.username || ud.Username,
                    full_name: ud.fullName || ud.FullName || ud.full_name,
                    profile_picture: ud.profile_picture || ud.AvatarUrl || ud.ProfilePictureURL || ud.avatarUrl || DEFAULT_AVATAR,
                });
            }
            
            const messagesResponse = await messageAPI.getConversation(userId);
            if (messagesResponse.success) {
                const backendBase = getBackendOrigin();
                setMessages(messagesResponse.data.map(m => {
                        const rawUrls = m.image_urls || (m.image_url ? [m.image_url] : []);
                        const image_urls = Array.isArray(rawUrls) ? rawUrls.map(u => toAbsoluteUrl(backendBase, u, 'comments')).filter(Boolean) : [];
                    return {
                        _id: m._id || m.MessageID || m.messageId,
                        from_user_id: Number(m.sender?._id ?? m.SenderID ?? m.senderId),
                        to_user_id: Number(m.receiver?._id ?? m.ReceiverID ?? m.receiverId),
                        text: (m.content && String(m.content).toUpperCase() !== 'NULL') ? m.content : 
                              (m.text && String(m.text).toUpperCase() !== 'NULL') ? m.text : '',
                        message_type: (image_urls && image_urls.length > 0) ? 'image' : (m.message_type || m.messageType || 'text'),
                        media_url: (image_urls && image_urls.length > 0) ? image_urls[0] : (m.image_url || m.mediaUrl || null),
                        media_urls: image_urls,
                        createdAt: parseServerDatetime(m.sent_date || m.createdAt || m.SentDate) || new Date(),
                    };
                }));
                try {
                    const key = `pinned_conv_${currentUserIdNum}_${userId}`;
                    const pinnedRaw = localStorage.getItem(key);
                    if (pinnedRaw) {
                        try {
                            const parsed = JSON.parse(pinnedRaw);
                            if (Array.isArray(parsed) && parsed.length > 0) setPinnedMessageIds([String(parsed[0])]);
                            else setPinnedMessageIds([String(parsed)]);
                        } catch {
                            setPinnedMessageIds([String(pinnedRaw)]);
                        }
                    }
                } catch (err) { console.debug('load pinned failed', err); }
            }
        } catch (err) {
            console.error('Error loading conversation:', err);
        } finally {
            setLoading(false);
        }
    };

    const sendMessage = async () => {
    if (!text.trim() && images.length === 0) return;
        if (sending) return;
        
        try {
            setSending(true);
            
            const hasVideoFile = images.some(f => f && f.type && String(f.type).startsWith('video/'));
            let response;
            if (hasVideoFile) {
                response = await messageAPI.send(
                    parseInt(userId),
                    text.trim(),
                    null,
                    images.slice(0,5)
                );
            } else {
                const imageDataUris = [];
                for (let i = 0; i < Math.min(5, images.length); i++) {
                    const file = images[i];
                    try {
                        const b64 = await imageToBase64(file);
                        imageDataUris.push(b64);
                    } catch (err) {
                        console.error('Error converting image to base64', err);
                    }
                }

                response = await messageAPI.send(
                    parseInt(userId),
                    text.trim(),
                    null,
                    imageDataUris
                );
            }

            if (response.success) {
                // Backend returns created message via data
                const m = response.data;
                const backendBase = getBackendOrigin();
                const rawUrls = m.image_urls || (m.image_url ? [m.image_url] : []);
                const image_urls = Array.isArray(rawUrls) ? rawUrls.map(u => toAbsoluteUrl(backendBase, u, 'comments')).filter(Boolean) : [];
                const newMessage = {
                    _id: m._id || m.MessageID || (m.messageId && m.messageId.toString()),
                    from_user_id: Number(m.sender?._id ?? m.SenderID ?? currentUserIdNum),
                    to_user_id: parseInt(m.receiver?._id || m.ReceiverID || parseInt(userId)),
                    text: (m.content && String(m.content).toUpperCase() !== 'NULL') ? m.content : 
                          (m.Content && String(m.Content).toUpperCase() !== 'NULL') ? m.Content : 
                          (text.trim() && text.trim().toUpperCase() !== 'NULL') ? text.trim() : '',
                    message_type: (image_urls && image_urls.length > 0) ? 'image' : (m.message_type || 'text'),
                    media_url: (image_urls && image_urls.length > 0) ? image_urls[0] : (m.image_url || m.mediaUrl || null),
                    media_urls: image_urls,
                    createdAt: parseServerDatetime(m.sent_date || m.SentDate) || new Date(),
                };

               
                if (newMessage._id) {
                    setMessages(prev => [...prev, newMessage]);
                } else {
                    console.debug('sendMessage: server did not return message id, waiting for realtime event to append message');
                }
                setText("");
                setImages([]);

                // messageAPI.send already dispatches a global 'message:sent' event;
                // no need to dispatch here to avoid duplicate events.
            }
        } catch (err) {
            console.error('Error sending message:', err);
        } finally {
            setSending(false);
        }
    };

    const recallMessage = async (messageId) => {
        if (!messageId) return;
        try {
            const res = await messageAPI.delete(messageId);
            if (res && res.success) {
                // remove from local messages
                setMessages(prev => prev.filter(m => String(m._id) !== String(messageId)));
                // notify other parts (Messages list) to refresh
                try { window.dispatchEvent(new CustomEvent('message:deleted', { detail: { messageId: messageId, otherUserId: parseInt(userId) } })); } catch (e) { console.debug('dispatch delete event failed', e); }
            }
        } catch (err) {
            console.error('Recall message error:', err);
        }
    };

    const [editingMessageId, setEditingMessageId] = useState(null);
    const [editingText, setEditingText] = useState('');
    const [openMenuMessageId, setOpenMenuMessageId] = useState(null);
    const [menuCoords, setMenuCoords] = useState({ x: 0, y: 0 });
    const [menuPlacement, setMenuPlacement] = useState('above');
    // legacy single pinnedMessageId removed; using pinnedMessageIds array

    const startEdit = (message) => {
        setEditingMessageId(message._id);
        setEditingText(message.text || '');
        setOpenMenuMessageId(null);
    };

    const cancelEdit = () => {
        setEditingMessageId(null);
        setEditingText('');
    };

    const saveEdit = async (messageId) => {
        try {
            const res = await messageAPI.update(messageId, { content: editingText });
            if (res && res.success) {
                // update local message
                setMessages(prev => prev.map(m => String(m._id) === String(messageId) ? ({ ...m, text: res.data.content || res.data.Content || editingText }) : m));
                // notify other parts
                try { window.dispatchEvent(new CustomEvent('message:updated', { detail: { messageId, otherUserId: parseInt(userId), message: res.data } })); } catch (e) { console.debug('dispatch update event failed', e); }
                cancelEdit();
            }
        } catch (err) {
            console.error('Save edit error:', err);
        }
    };

    const togglePin = (message) => {
        try {
            const key = `pinned_conv_${currentUserIdNum}_${userId}`;
            const id = String(message._id);
            const exists = pinnedMessageIds && pinnedMessageIds.includes(id);
            let next = [];
            if (exists) {
                next = (pinnedMessageIds || []).filter(x => String(x) !== id);
                setPinnedMessageIds(next);
                try { window.dispatchEvent(new CustomEvent('message:unpinned', { detail: { messageId: id, otherUserId: parseInt(userId), pinnedIds: next } })); } catch { /* ignore */ }
            } else {
                next = [...(pinnedMessageIds || []), id];
                setPinnedMessageIds(next);
                try { window.dispatchEvent(new CustomEvent('message:pinned', { detail: { messageId: id, otherUserId: parseInt(userId), pinnedIds: next } })); } catch { /* ignore */ }
                // scroll to and highlight the pinned message for better visibility
                try {
                    const el = messageRefs.current && messageRefs.current[id];
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // set temporary highlight
                    setHighlightMessageId(id);
                    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
                    highlightTimeoutRef.current = setTimeout(() => setHighlightMessageId(null), 2200);
                } catch (err) { console.debug('scroll to pinned failed', err); }
            }

            // persist as JSON array (backwards compatible parsing on load)
            try {
                if (!next || next.length === 0) localStorage.removeItem(key);
                else localStorage.setItem(key, JSON.stringify(next));
            } catch { /* ignore storage errors */ }
        } catch (err) {
            console.error('Pin toggle error', err);
        }
    };
    useEffect(() => {
        try { messageEndRef.current?.scrollIntoView({ behavior: "smooth" }); } catch (err) { console.debug('scroll error', err); }
    }, [messages]);

    // Close menu when clicking outside or pressing Escape
    useEffect(() => {
        const onDocClick = (e) => {
            // if click inside a menu or a menu button, do nothing
            if (e.target.closest && e.target.closest('[data-message-menu]')) return;
            setOpenMenuMessageId(null);
        };
        const onKey = (e) => { if (e.key === 'Escape') setOpenMenuMessageId(null); };
        document.addEventListener('click', onDocClick);
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('click', onDocClick); document.removeEventListener('keydown', onKey); };
    }, []);

    // cleanup highlight timeout on unmount
    useEffect(() => {
        return () => {
            if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
        };
    }, []);

    // Listen for realtime incoming messages forwarded from useRealtime
    useEffect(() => {
        const handler = (e) => {
            try {
                const payload = e && e.detail ? e.detail : e;
                const m = payload && payload.message ? payload.message : null;
                if (!m) return;

                // Determine sender/receiver ids from server message format
                const senderId = Number(m.sender?._id ?? m.SenderID ?? m.senderId ?? m.from_user_id ?? m.from);
                const receiverId = Number(m.receiver?._id ?? m.ReceiverID ?? m.receiverId ?? m.to_user_id ?? m.to);

                const convOtherId = parseInt(userId, 10);
                const myId = currentUserIdNum;

                // If the message belongs to this conversation (either from other -> me or me -> other), append
                const isRelevant = (senderId && receiverId && ((senderId === convOtherId && receiverId === myId) || (senderId === myId && receiverId === convOtherId)));
                if (!isRelevant) return;

                // map server message to the local format used by this component
                const backendBase = getBackendOrigin();
                const rawUrls = m.image_urls || (m.image_url ? [m.image_url] : []);
                const image_urls = Array.isArray(rawUrls) ? rawUrls.map(u => toAbsoluteUrl(backendBase, u, 'comments')).filter(Boolean) : [];
                const newMessage = {
                    _id: m._id || m.MessageID || (m.messageId && m.messageId.toString()) || (m._id && String(m._id)),
                    from_user_id: Number(senderId),
                    to_user_id: Number(receiverId),
                    // FIXED: Filter out "NULL" string from realtime messages
                    text: (m.content && String(m.content).toUpperCase() !== 'NULL') ? m.content : 
                          (m.Content && String(m.Content).toUpperCase() !== 'NULL') ? m.Content : 
                          (m.text && String(m.text).toUpperCase() !== 'NULL') ? m.text : '',
                    message_type: (image_urls && image_urls.length > 0) ? 'image' : (m.message_type || 'text'),
                    media_url: (image_urls && image_urls.length > 0) ? image_urls[0] : (m.image_url || m.mediaUrl || null),
                    media_urls: image_urls,
                    createdAt: parseServerDatetime(m.sent_date || m.createdAt || m.SentDate) || new Date(),
                };

                setMessages(prev => {
                    if (prev.some(x => String(x._id) === String(newMessage._id))) return prev;
                    try {
                        const parsedNewTime = new Date(newMessage.createdAt || Date.now()).getTime();
                            const matchIdx = prev.findIndex(x => {
                            try {
                                const sameSender = String(x.from_user_id) === String(newMessage.from_user_id);
                                const sameReceiver = String(x.to_user_id) === String(newMessage.to_user_id);
                                const sameText = (x.text || '') === (newMessage.text || '');
                                const xTime = new Date(x.createdAt || x.sentAt || Date.now()).getTime();
                                const timeDiff = Math.abs(parsedNewTime - xTime);
                                // match within 8 seconds
                                return sameSender && sameReceiver && sameText && timeDiff <= 8000;
                            } catch { return false; }
                        });
                        if (matchIdx !== -1) {
                            const copy = prev.slice();
                            copy[matchIdx] = newMessage;
                            return copy;
                        }
                    } catch (err) {
                        console.debug('message reconciliation error', err);
                    }

                    return [...prev, newMessage];
                });
            } catch (err) {
                console.debug('realtime message handler error', err);
            }
        };

        window.addEventListener('message:received', handler);
        return () => window.removeEventListener('message:received', handler);
    }, [userId, currentUserIdNum]);

    if (loading) {
        return <Loading />;
    }

    if (!otherUser || !currentUser) {
        return <div className='flex items-center justify-center h-screen'>
            <p className='text-gray-500'>{t('chat.conversationNotFound')}</p>
        </div>;
    }

    // pinnedMessageIds holds pinned message ids for this convo (rendered as sticky banner)

    return (
        <div className="flex flex-col h-screen">
            {/* Inline CSS for chat styling and highlight animation (scoped here) */}
            <style>{`
                :root { --chat-bg: #f8fafc; --bubble-mine: linear-gradient(90deg,#6366f1,#8b5cf6); --bubble-other: #ffffff; }
                .chat-container { height: 100vh; display: flex; flex-direction: column; background: var(--chat-bg); }
                @keyframes pinnedHighlight { 0% { box-shadow: 0 0 0 0 rgba(250,204,21,0.0);} 20% { box-shadow: 0 0 16px 6px rgba(250,204,21,0.18);} 100% { box-shadow: 0 0 0 0 rgba(250,204,21,0.0);} }
                .animate-pinned-highlight { animation: pinnedHighlight 2s ease-in-out; }
                .chat-header { display:flex; align-items:center; gap:12px; padding:12px 16px; background: linear-gradient(90deg,#eef2ff,#f5f3ff); border-bottom:1px solid #e6e6ea; }
                .chat-header .avatar { width:48px; height:48px; border-radius:9999px; object-fit:cover; }
                .chat-list-wrap { flex:1 1 auto; overflow:auto; padding:20px; }
                .chat-list { display:flex; flex-direction:column; gap:10px; max-width:900px; margin:0 auto; }
                .time-separator { text-align:center; color:#9ca3af; font-size:12px; margin:6px 0; }
                .message-group { display:flex; gap:12px; align-items:flex-end; }
                .message-group.left { justify-content:flex-start; }
                .message-group.right { justify-content:flex-end; }
                .chat-bubble-mine { color:white; background: var(--bubble-mine); box-shadow:0 6px 18px rgba(99,102,241,0.12); border-radius:16px 16px 8px 16px; padding:10px 14px; max-width:68vw; display:inline-block; }
                .chat-bubble-other { background: var(--bubble-other); color:#0f172a; border-radius:16px 16px 16px 8px; padding:10px 14px; max-width:68vw; box-shadow:0 2px 8px rgba(2,6,23,0.04); display:inline-block; }
                .chat-bubble-meta { font-size:11px; color:#94a3b8; margin-top:6px; }
                .chat-input-bar { padding:12px 16px; border-top:1px solid #e6e6ea; background:white; display:flex; justify-content:center; }
                .chat-input { display:flex; align-items:center; gap:8px; width:100%; max-width:960px; background:#fff; border-radius:9999px; padding:8px 12px; box-shadow:0 6px 18px rgba(2,6,23,0.04); }
                .chat-input input { border:none; outline:none; flex:1 1 auto; padding:8px 6px; font-size:14px; }
                .chat-input .send-btn { background: linear-gradient(90deg,#6366f1,#8b5cf6); color:white; padding:8px; border-radius:9999px; display:flex; align-items:center; justify-content:center; }
                .chat-media-thumb { height:40px; width:40px; object-fit:cover; border-radius:9999px; border:1px solid rgba(0,0,0,0.06); display:block; }
                .chat-msg-actions button { background:transparent; border:none; padding:6px; border-radius:6px; cursor:pointer; }
                .chat-msg-actions button:hover { background:#f3f4f6; }
                /* small responsive tweak */
                @media (min-width:768px) { .chat-list { padding: 0 12px; } }
                /* hide unexpected image pseudo-elements if any */
                img::before, img::after { display:none !important; }
            `}</style>
            <div className="chat-header">
                <img src={otherUser.profile_picture || DEFAULT_AVATAR} onError={(e)=>{ e.target.onerror = null; e.target.src = DEFAULT_AVATAR }} alt="" className="avatar" />
                <div>
                    <p className="font-medium">{otherUser.full_name}</p>
                    <p className="text-sm text-gray-500 -mt-1.5">@{otherUser.username}</p>
                </div>
            </div>
            <div className="chat-list-wrap">
                <div className="chat-list">
                    {/* NOTE: Pinned marker will be rendered as a sticky banner above the message list when present */}
                    {pinnedMessage && (
                        <div className="max-w-4xl mx-auto mb-3 relative">
                            <div className="sticky top-0 z-30 bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-sm text-yellow-800 flex items-center justify-between">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <svg className="w-4 h-4 text-yellow-600 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                                        <path d="M12 2l2 5 5 .5-3.5 3 1 5L12 14l-4.5 2.5 1-5L5 7.5 10 7 12 2z" />
                                    </svg>
                                    <div className="truncate">{pinnedMessage.text || (pinnedMessage.media_urls && pinnedMessage.media_urls[0]) || t('chat.pinnedMessage')}</div>
                                </div>
                                    <div className="flex items-center gap-2">
                                    <button onClick={() => { togglePin(pinnedMessage); }} className="text-xs text-blue-600">{t('chat.unpin')}</button>
                                    <button onClick={() => {
                                        const el = messageRefs.current && messageRefs.current[String(pinnedMessage._id)];
                                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        setHighlightMessageId(String(pinnedMessage._id));
                                        if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
                                        highlightTimeoutRef.current = setTimeout(() => setHighlightMessageId(null), 2200);
                                    }} className="text-xs text-gray-600">{t('chat.goTo')}</button>
                                    {/* FB-style single pinned message: no multi-pin dropdown */}
                                </div>
                            </div>
                        </div>
                    )}
                    {
                        // Group consecutive messages by sender (and small time gap)
                        (() => {
                            // Sort messages by time, then deduplicate transient duplicates that can appear
                            // due to optimistic updates + realtime server pushes. We collapse messages if
                            // they have the same _id or when they have same sender/receiver/text within 8s.
                            const sortedByTime = messages.slice().sort((a, b) => {
                                const ta = parseServerDatetime(a.createdAt) || new Date(0);
                                const tb = parseServerDatetime(b.createdAt) || new Date(0);
                                return ta - tb;
                            });

                            const deduped = [];
                            for (const msg of sortedByTime) {
                                if (deduped.length === 0) {
                                    deduped.push(msg);
                                    continue;
                                }
                                const last = deduped[deduped.length - 1];
                                try {
                                    const sameId = last._id && msg._id && String(last._id) === String(msg._id);
                                    const sameSender = String(last.from_user_id) === String(msg.from_user_id);
                                    const sameReceiver = String(last.to_user_id) === String(msg.to_user_id);
                                    const sameText = (last.text || '') === (msg.text || '');
                                    const lastTime = new Date(last.createdAt || last.sentAt || Date.now()).getTime();
                                    const msgTime = new Date(msg.createdAt || msg.sentAt || Date.now()).getTime();
                                    const timeDiff = Math.abs(msgTime - lastTime);

                                    if (sameId || (sameSender && sameReceiver && sameText && timeDiff <= 8000)) {
                                        // prefer authoritative server message (with _id) and newer timestamps
                                        if (last._id && !msg._id) {
                                            // keep last (server message) and ignore current
                                            continue;
                                        }
                                        if (!last._id && msg._id) {
                                            // replace placeholder with authoritative message
                                            deduped[deduped.length - 1] = msg;
                                            continue;
                                        }
                                        // otherwise keep the newest one
                                        if (msgTime >= lastTime) {
                                            deduped[deduped.length - 1] = msg;
                                            continue;
                                        } else {
                                            continue;
                                        }
                                    }
                                } catch {
                                    // fallback: don't dedupe on error
                                }

                                deduped.push(msg);
                            }

                            const groups = [];
                            for (const msg of deduped) {
                                const isMine = currentUserIdNum !== null ? Number(msg.from_user_id) === currentUserIdNum : false;
                                const time = new Date(msg.createdAt || msg.sentAt || msg.SentDate || Date.now());

                                if (groups.length === 0) {
                                    groups.push({ isMine, time, messages: [msg] });
                                    continue;
                                }

                                const last = groups[groups.length - 1];
                                const lastTime = last.time;
                                const timeDiff = Math.abs(time - lastTime);

                                // Group if same sender and within 10 minutes
                                if (last.isMine === isMine && timeDiff <= 10 * 60 * 1000) {
                                    last.messages.push(msg);
                                    // update group's time to last message's time for display (or keep first)
                                    // keep first message time for group header
                                } else {
                                    groups.push({ isMine, time, messages: [msg] });
                                }
                            }

                            const formatTime = (d) => {
                                try {
                                    const dt = parseServerDatetime(d) || new Date();
                                    return formatVnTime(dt);
                                } catch (err) { console.debug('formatTime error', err); return ''; }
                            };

                            return groups.map((group, gi) => {
                                return (
                                    <div key={gi} className="pt-2">
                                        {/* time label centered */}
                                        <div className="text-center text-xs text-gray-400 mb-2">{formatTime(group.time)}</div>

                                        <div className={`message-group ${group.isMine ? 'right' : 'left'}`}> 
                                                {!group.isMine && (
                                                    // show avatar of other user once per group (circular, with fallback)
                                                    <img src={otherUser?.profile_picture || DEFAULT_AVATAR} onError={(e)=>{ e.target.onerror = null; e.target.src = DEFAULT_AVATAR }} alt="" className="chat-media-thumb" />
                                                )}

                                                <div className={`${group.isMine ? 'items-end' : 'items-start'} flex flex-col`}> 
                                                {group.messages.map((message, mi) => {
                                                    // note: inline pinned marker removed; sticky banner used instead
                                                    const isFirst = mi === 0;
                                                    const isLast = mi === group.messages.length - 1;
                                                    const bubbleBase = 'px-4 py-2 text-sm break-words shadow';

                                                    if (group.isMine) {
                                                        // mine: blue gradient, aligned right
                                                        const classes = `${bubbleBase} chat-bubble-mine ${isFirst ? 'rounded-tl-lg' : ''} ${isLast ? 'rounded-bl-lg' : ''} rounded-br-lg`;
                                                        
                                                        const mediaToShow = (validatedMedia && validatedMedia[message._id] && validatedMedia[message._id].length > 0)
                                                            ? validatedMedia[message._id]
                                                            : (message.media_urls || []);
                                                        const hasMedia = mediaToShow && mediaToShow.length > 0;
                                                        const hasText = message.text && message.text.trim() && message.text.trim().toUpperCase() !== 'NULL';
                                                        const isVideoUrl = (s) => typeof s === 'string' && (s.startsWith('data:video/') || /\.(mp4|webm|ogg|mov)(\?|$)/i.test(s) || /video\//i.test(s));
                                                        
                                                        return (
                                                            <div key={mi} data-message-id={message._id} ref={el => { if (el) messageRefs.current[String(message._id)] = el; }} className="mb-1 flex items-end gap-2 justify-end">
                                                                <div className="flex flex-col items-end gap-1">
                                                                    {editingMessageId && String(editingMessageId) === String(message._id) ? (
                                                                        <div className="flex items-center gap-2">
                                                                            <input value={editingText} onChange={(e) => setEditingText(e.target.value)} className="px-3 py-2 rounded-md border" />
                                                                            <button onClick={() => saveEdit(message._id)} className="text-sm text-white bg-green-600 px-3 py-1 rounded">{t('common.save')}</button>
                                                                            <button onClick={cancelEdit} className="text-sm text-gray-600 px-3 py-1 rounded border">{t('common.cancel')}</button>
                                                                        </div>
                                                                    ) : (
                                                                        <>
                                                                            {/* Media - display outside bubble */}
                                                                            {hasMedia && (
                                                                                <div className="mb-1">
                                                                                    {mediaToShow.map((u, idx) => (
                                                                                        isVideoUrl(u) ? (
                                                                                            <video key={idx} src={u} controls className="max-w-[40vw] max-h-[40vh] object-contain rounded-md" />
                                                                                        ) : (
                                                                                            <img key={idx} src={u} className="max-w-[40vw] max-h-[40vh] object-contain rounded-md" alt="" />
                                                                                        )
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                            
                                                                            {/* Text bubble - only if has text */}
                                                                            {hasText && (
                                                                                <div className={`${classes} ${(pinnedMessageIds && pinnedMessageIds.includes(String(message._id))) ? 'ring-2 ring-yellow-300 bg-yellow-600/10' : ''} ${String(highlightMessageId) === String(message._id) ? 'animate-pinned-highlight' : ''}`}>
                                                                                    <div className="flex items-center gap-2">
                                                                                        <div>{message.text}</div>
                                                                                        {(pinnedMessageIds && pinnedMessageIds.includes(String(message._id))) && (
                                                                                            <svg className="w-4 h-4 text-yellow-500" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                                                                                                <path d="M12 2l2 5 5 .5-3.5 3 1 5L12 14l-4.5 2.5 1-5L5 7.5 10 7 12 2z" />
                                                                                            </svg>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </>
                                                                    )}
                                                                </div>
                                                                {/* Kebab button and popover menu */}
                                                                <div className="relative" data-message-menu>
                                                                    <button onClick={(ev) => {
                                                                        ev.stopPropagation();
                                                                        const btnRect = ev.currentTarget.getBoundingClientRect();
                                                                        const popW = 176; // approximate width of menu
                                                                        const margin = 8;
                                                                        const preferAbove = btnRect.top > 220;
                                                                        const left = Math.min(Math.max(btnRect.right - popW, margin), window.innerWidth - popW - margin);
                                                                        const y = preferAbove ? Math.max(margin, btnRect.top - 220) : Math.min(window.innerHeight - margin - 48, btnRect.bottom + margin);
                                                                        setMenuCoords({ x: left, y });
                                                                        setMenuPlacement(preferAbove ? 'above' : 'below');
                                                                        setOpenMenuMessageId(openMenuMessageId === message._id ? null : message._id);
                                                                    }} className="w-8 h-8 rounded-full bg-white shadow flex items-center justify-center text-gray-600"> 
                                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                                                                            <circle cx="5" cy="12" r="1.5" />
                                                                            <circle cx="12" cy="12" r="1.5" />
                                                                            <circle cx="19" cy="12" r="1.5" />
                                                                        </svg>
                                                                    </button>

                                                                    {openMenuMessageId && String(openMenuMessageId) === String(message._id) && (
                                                                        <div data-message-menu-root style={{ position: 'fixed', left: menuCoords.x, top: menuCoords.y, width: 176, zIndex: 9999 }} onClick={(e) => e.stopPropagation()}>
                                                                            <div className="relative w-full">
                                                                                {menuPlacement === 'above' ? (
                                                                                    <div className="absolute right-3 -bottom-2 w-3 h-3 bg-white transform rotate-45 shadow-xl" aria-hidden></div>
                                                                                ) : (
                                                                                    <div className="absolute right-3 -top-2 w-3 h-3 bg-white transform rotate-45 shadow-xl" aria-hidden></div>
                                                                                )}
                                                                                <div className="bg-white rounded-xl shadow-xl p-2 text-sm">
                                                                                    <button className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded" onClick={() => { if (window.confirm(t('chat.recallConfirm'))) { recallMessage(message._id); setOpenMenuMessageId(null); } }}>{t('chat.recall')}</button>
                                                                                    <button className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded" onClick={() => { startEdit(message); setOpenMenuMessageId(null); }}>{t('common.edit')}</button>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    }

                                                    // other: white bubble, left
                                                    const classes = `${bubbleBase} chat-bubble-other ${isFirst ? 'rounded-tr-lg' : ''} ${isLast ? 'rounded-br-lg' : ''} rounded-bl-lg`;
                                                    const mediaToShow = (validatedMedia && validatedMedia[message._id] && validatedMedia[message._id].length > 0)
                                                        ? validatedMedia[message._id]
                                                        : (message.media_urls || []);
                                                    const hasMedia = mediaToShow && mediaToShow.length > 0;
                                                    const hasText = message.text && message.text.trim() && message.text.trim().toUpperCase() !== 'NULL';
                                                    const isVideoUrl = (s) => typeof s === 'string' && (s.startsWith('data:video/') || /\.(mp4|webm|ogg|mov)(\?|$)/i.test(s) || /video\//i.test(s));
                                                    
                                                    return (
                                                        <div key={mi} data-message-id={message._id} ref={el => { if (el) messageRefs.current[String(message._id)] = el; }} className="mb-1">
                                                            {/* Media - display outside bubble */}
                                                            {hasMedia && (
                                                                <div className="mb-1">
                                                                    {mediaToShow.map((u, idx) => (
                                                                        isVideoUrl(u) ? (
                                                                            <video key={idx} src={u} controls className="max-w-[40vw] max-h-[40vh] object-contain rounded-md" />
                                                                        ) : (
                                                                            <img key={idx} src={u} className="max-w-[40vw] max-h-[40vh] object-contain rounded-md" alt="" />
                                                                        )
                                                                    ))}
                                                                </div>
                                                            )}
                                                            
                                                            {/* Text bubble - only if has text */}
                                                            {hasText && (
                                                                <div className={`${classes} ${(pinnedMessageIds && pinnedMessageIds.includes(String(message._id))) ? 'ring-2 ring-yellow-300 bg-yellow-50' : ''} ${String(highlightMessageId) === String(message._id) ? 'animate-pinned-highlight' : ''}`}>
                                                                    <div>{message.text}</div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            });
                        })()
                    }
                    <div ref={messageEndRef} ></div>
                </div>
            </div>
            <div className="px-4">
                <div className="flex items-center gap-3 pl-5 p-1.5 bg-white w-full max-w-xl mx-auto border border-gray-200 shadow rounded-full mb-5">
                                    <input 
                                        type="text" 
                                        className="flex-1 outline-none text-slate-700" 
                                        placeholder={t('chat.placeholder')}
                                        onKeyDown={(e) => {
                                            // prevent sending while composing (IME) to allow Vietnamese diacritics
                                            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                                                e.preventDefault();
                                                sendMessage();
                                            }
                                        }} 
                                        onChange={(e) => setText(e.target.value)} 
                                        value={text} 
                                    />

                    <label htmlFor="image">
                        {
                            images.length > 0 ? (
                                <div className="flex -space-x-2 items-center">
                                    {images.slice(0,3).map((f, idx) => (
                                        f && f.type && String(f.type).startsWith('video/') ? (
                                            <video key={idx} src={URL.createObjectURL(f)} className="h-8 w-8 rounded-md border object-cover" muted />
                                        ) : (
                                            <img key={idx} src={URL.createObjectURL(f)} alt="" className="h-8 w-8 rounded-full border object-cover" />
                                        )
                                    ))}
                                    {images.length > 3 && <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-xs">+{images.length-3}</div>}
                                </div>
                            ) : (
                                <ImageIcon className="size-7 text-gray-400 cursor-pointer"/>
                            )
                        }

                        <input type="file" id="image" accept="image/*,video/*" hidden multiple onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            // limit to 5
                            setImages(prev => {
                                const combined = [...prev, ...files].slice(0,5);
                                return combined;
                            });
                        }} />
                    </label>
                    <button onClick={sendMessage} className="bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-700 hover:to-purple-800 active:scale-95 cursor-pointer text-white p-2 rounded-full">
                        <SendHorizonal />
                    </button>
                </div>
            </div>
        </div>
    );
}
export default ChatBox;