import React, { useRef, useState, useEffect } from "react";
import { ImageIcon, SendHorizonal } from "lucide-react";
import { useParams } from "react-router-dom";
import { messageAPI, userAPI, imageToBase64 } from "../../utils/api";
import useAuth from "../../hooks/useAuth";
import Loading from "../../components/Shared/Loading";
import DEFAULT_AVATAR from "../../utils/defaults";


const ChatBox = () => {
    const { userId } = useParams(); // ID của user đang chat
    const { user: currentUser } = useAuth();
    const currentUserIdNum = currentUser ? Number(currentUser.userId ?? currentUser.AccountID ?? currentUser._id) : null;
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

    useEffect(() => {
        if (userId && currentUser) {
            loadConversation();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, currentUser]);

    const loadConversation = async () => {
        try {
            setLoading(true);
            
            // Load other user info
            const userResponse = await userAPI.getProfile(userId);
            if (userResponse.success) {
                const ud = userResponse.data;
                setOtherUser({
                    _id: ud.userId || ud.AccountID || ud._id,
                    username: ud.username || ud.Username,
                    full_name: ud.fullName || ud.FullName || ud.full_name,
                    // accept multiple avatar keys that backend might return
                    profile_picture: ud.profile_picture || ud.AvatarUrl || ud.ProfilePictureURL || ud.avatarUrl || DEFAULT_AVATAR,
                });
            }
            
            // Load messages
            const messagesResponse = await messageAPI.getConversation(userId);
            if (messagesResponse.success) {
                // Backend returns messages as objects from Message.toFrontendFormat()
                setMessages(messagesResponse.data.map(m => ({
                    _id: m._id || m.MessageID || m.messageId,
                    from_user_id: Number(m.sender?._id ?? m.SenderID ?? m.senderId),
                    to_user_id: Number(m.receiver?._id ?? m.ReceiverID ?? m.receiverId),
                    text: m.content || m.text || '',
                    // message_type: prefer backend-provided image_urls array
                    message_type: (m.image_urls && m.image_urls.length > 0) ? 'image' : (m.message_type || m.messageType || 'text'),
                    // media_url is the first image if present
                    media_url: (m.image_urls && m.image_urls.length > 0) ? m.image_urls[0] : (m.image_url || m.mediaUrl || null),
                    media_urls: m.image_urls || (m.image_url ? [m.image_url] : []),
                    createdAt: m.sent_date || m.createdAt || m.SentDate || new Date().toISOString(),
                })));
                try {
                    const key = `pinned_conv_${currentUserIdNum}_${userId}`;
                    const pinnedRaw = localStorage.getItem(key);
                    if (pinnedRaw) {
                        try {
                            const parsed = JSON.parse(pinnedRaw);
                            if (Array.isArray(parsed) && parsed.length > 0) setPinnedMessageIds([String(parsed[0])]);
                            else setPinnedMessageIds([String(parsed)]);
                        } catch {
                            // legacy single id string
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
            
            // convert selected files to base64 data URIs (if any)
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

            const response = await messageAPI.send(
                parseInt(userId),
                text.trim(),
                null,
                imageDataUris
            );

            if (response.success) {
                // Backend returns created message via data
                const m = response.data;
                const newMessage = {
                    _id: m._id || m.MessageID || (m.messageId && m.messageId.toString()),
                    from_user_id: Number(m.sender?._id ?? m.SenderID ?? currentUserIdNum),
                    to_user_id: parseInt(m.receiver?._id || m.ReceiverID || parseInt(userId)),
                    text: m.content || m.Content || text.trim(),
                    message_type: (m.image_urls && m.image_urls.length > 0) ? 'image' : (m.message_type || 'text'),
                    media_url: (m.image_urls && m.image_urls.length > 0) ? m.image_urls[0] : (m.image_url || m.mediaUrl || null),
                    media_urls: m.image_urls || (m.image_url ? [m.image_url] : []),
                    createdAt: m.sent_date || m.SentDate || new Date().toISOString(),
                };

                setMessages(prev => [...prev, newMessage]);
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

    if (loading) {
        return <Loading />;
    }

    if (!otherUser || !currentUser) {
        return <div className='flex items-center justify-center h-screen'>
            <p className='text-gray-500'>Không tìm thấy cuộc hội thoại</p>
        </div>;
    }

    // pinnedMessageIds holds pinned message ids for this convo (rendered as sticky banner)

    return (
        <div className="flex flex-col h-screen">
            {/* Inline CSS for highlight animation (scoped here) */}
            <style>{`
                @keyframes pinnedHighlight {
                    0% { box-shadow: 0 0 0 0 rgba(250, 204, 21, 0.0); }
                    20% { box-shadow: 0 0 12px 4px rgba(250, 204, 21, 0.18); }
                    100% { box-shadow: 0 0 0 0 rgba(250, 204, 21, 0.0); }
                }
                .animate-pinned-highlight {
                    animation: pinnedHighlight 2s ease-in-out;
                }
            `}</style>
            <div className="flex items-center gap-2 p-2 md:px-10 xl:pl-42 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-300">
                <img src={otherUser.profile_picture || DEFAULT_AVATAR} onError={(e)=>{ e.target.onerror = null; e.target.src = DEFAULT_AVATAR }} alt="" className="size-8 rounded-full" />
                <div>
                <p className="font-medium">{otherUser.full_name}</p>
                <p className="text-sm text-gray-500 -mt-1.5">@{otherUser.username}</p>
                </div>
            </div>
            <div className="p-5 md:px-10 h-full overflow-y-scroll">
                <div className="space-y-4 max-w-4xl mx-auto">
                    {/* NOTE: Pinned marker will be rendered as a sticky banner above the message list when present */}
                    {pinnedMessage && (
                        <div className="max-w-4xl mx-auto mb-3 relative">
                            <div className="sticky top-0 z-30 bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-sm text-yellow-800 flex items-center justify-between">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <svg className="w-4 h-4 text-yellow-600 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                                        <path d="M12 2l2 5 5 .5-3.5 3 1 5L12 14l-4.5 2.5 1-5L5 7.5 10 7 12 2z" />
                                    </svg>
                                    <div className="truncate">{pinnedMessage.text || (pinnedMessage.media_urls && pinnedMessage.media_urls[0]) || 'Tin đã ghim'}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => { togglePin(pinnedMessage); }} className="text-xs text-blue-600">Bỏ ghim</button>
                                    <button onClick={() => {
                                        const el = messageRefs.current && messageRefs.current[String(pinnedMessage._id)];
                                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        setHighlightMessageId(String(pinnedMessage._id));
                                        if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
                                        highlightTimeoutRef.current = setTimeout(() => setHighlightMessageId(null), 2200);
                                    }} className="text-xs text-gray-600">Đi đến</button>
                                    {/* FB-style single pinned message: no multi-pin dropdown */}
                                </div>
                            </div>
                        </div>
                    )}
                    {
                        // Group consecutive messages by sender (and small time gap)
                        (() => {
                            const sorted = messages.slice().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                            const groups = [];
                            for (const msg of sorted) {
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
                                    const dt = new Date(d);
                                    return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                } catch (err) { console.debug('formatTime error', err); return ''; }
                            };

                            return groups.map((group, gi) => {
                                return (
                                    <div key={gi} className="pt-2">
                                        {/* time label centered */}
                                        <div className="text-center text-xs text-gray-400 mb-2">{formatTime(group.time)}</div>

                                        <div className={`flex ${group.isMine ? 'justify-end' : 'justify-start'} items-end gap-3`}> 
                                            {!group.isMine && (
                                                // show avatar of other user once per group
                                                <img src={otherUser?.profile_picture || DEFAULT_AVATAR} alt="" className="w-8 h-8 rounded-full" />
                                            )}

                                            <div className={`${group.isMine ? 'items-end' : 'items-start'} flex flex-col`}> 
                                                {group.messages.map((message, mi) => {
                                                    // note: inline pinned marker removed; sticky banner used instead
                                                    const isFirst = mi === 0;
                                                    const isLast = mi === group.messages.length - 1;
                                                    const bubbleBase = 'px-4 py-2 text-sm max-w-xs break-words shadow';

                                                    if (group.isMine) {
                                                        // mine: blue gradient, aligned right
                                                        const classes = `${bubbleBase} text-white bg-gradient-to-br from-indigo-500 to-purple-600 ${isFirst ? 'rounded-tl-lg' : ''} ${isLast ? 'rounded-bl-lg' : ''} rounded-br-lg`;
                                                        return (
                                                            <div key={mi} className='w-full'>
                                                                {/* inline pinned marker removed: using sticky pinned banner at top */}
                                                                <div data-message-id={message._id} ref={el => { if (el) messageRefs.current[String(message._id)] = el; }} className={`mb-1 flex items-end gap-2 ${isLast ? '' : ''}`}>
                                                                    <div className="flex flex-col items-end">
                                                                        {editingMessageId && String(editingMessageId) === String(message._id) ? (
                                                                            <div className="flex items-center gap-2">
                                                                                <input value={editingText} onChange={(e) => setEditingText(e.target.value)} className="px-3 py-2 rounded-md border" />
                                                                                <button onClick={() => saveEdit(message._id)} className="text-sm text-white bg-green-600 px-3 py-1 rounded">Lưu</button>
                                                                                <button onClick={cancelEdit} className="text-sm text-gray-600 px-3 py-1 rounded border">Hủy</button>
                                                                            </div>
                                                                        ) : (
                                                                            <>
                                                                                {message.media_urls && message.media_urls.length > 0 && (
                                                                                    <div className="flex flex-wrap gap-2 mb-1">
                                                                                        {message.media_urls.map((u, idx) => (
                                                                                            <img key={idx} src={u} className="w-32 h-32 object-cover rounded-md" alt="" />
                                                                                        ))}
                                                                                    </div>
                                                                                )}
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
                                                                                        <button className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded" onClick={() => { if (confirm('Bạn có chắc muốn thu hồi tin nhắn này?')) { recallMessage(message._id); setOpenMenuMessageId(null); } }}>Thu hồi</button>
                                                                                        <button className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded" onClick={() => { startEdit(message); setOpenMenuMessageId(null); }}>Sửa</button>
                                                                                        {/* <button className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded" onClick={() => { forwardMessage(message); setOpenMenuMessageId(null); }}>Chuyển tiếp</button>
                                                                                        <button className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded" onClick={() => { togglePin(message); setOpenMenuMessageId(null); }}>{(pinnedMessageIds && pinnedMessageIds.includes(String(message._id))) ? 'Bỏ ghim' : 'Ghim'}</button> */}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    }

                                                    // other: white bubble, left
                                                    const classes = `${bubbleBase} bg-white text-slate-700 ${isFirst ? 'rounded-tr-lg' : ''} ${isLast ? 'rounded-br-lg' : ''} rounded-bl-lg`;
                                                    return (
                                                        <div key={mi} data-message-id={message._id} ref={el => { if (el) messageRefs.current[String(message._id)] = el; }} className="mb-1 flex items-start">
                                                            <div className={`${classes} ${(pinnedMessageIds && pinnedMessageIds.includes(String(message._id))) ? 'ring-2 ring-yellow-300 bg-yellow-50' : ''} ${String(highlightMessageId) === String(message._id) ? 'animate-pinned-highlight' : ''}`}>
                                                                {message.media_urls && message.media_urls.length > 0 && (
                                                                    <div className="flex flex-wrap gap-2 mb-1">
                                                                        {message.media_urls.map((u, idx) => (
                                                                            <img key={idx} src={u} className="w-32 h-32 object-cover rounded-md" alt="" />
                                                                        ))}
                                                                    </div>
                                                                )}
                                                                <div>{message.text}</div>
                                                            </div>
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
                                        placeholder="Type a message..." 
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
                                <div className="flex -space-x-2">
                                    {images.slice(0,3).map((f, idx) => (
                                        <img key={idx} src={URL.createObjectURL(f)} alt="" className="h-8 w-8 rounded-full border" />
                                    ))}
                                    {images.length > 3 && <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-xs">+{images.length-3}</div>}
                                </div>
                            ) : (
                                <ImageIcon className="size-7 text-gray-400 cursor-pointer"/>
                            )
                        }

                        <input type="file" id="image" accept="image/*" hidden multiple onChange={(e) => {
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