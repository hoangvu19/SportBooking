import React, { useRef, useState, useEffect } from "react";
import { ImageIcon, SendHorizonal } from "lucide-react";
import { useParams } from "react-router-dom";
import { messageAPI, userAPI, imageToBase64 } from "../utils/api";
import { useAuth } from "../hooks/useAuth";
import Loading from "../components/Loading";


const ChatBox = () => {
    const { userId } = useParams(); // ID của user đang chat
    const { user: currentUser } = useAuth();
    const currentUserIdNum = currentUser ? Number(currentUser.userId ?? currentUser.AccountID ?? currentUser._id) : null;
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState("");
    const [images, setImages] = useState([]); // supports multiple images (max 5)
    const [otherUser, setOtherUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const messageEndRef = useRef(null);

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
                    profile_picture: ud.profilePicture || ud.ProfilePicture || ud.profile_picture || ud.AvatarUrl || ud.avatarUrl || ud.SenderAvatar || ud.ReceiverAvatar || 'https://via.placeholder.com/40',
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
            }
        } catch (err) {
            console.error('Error sending message:', err);
        } finally {
            setSending(false);
        }
    };

    useEffect(() => {
        try { messageEndRef.current?.scrollIntoView({ behavior: "smooth" }); } catch (err) { console.debug('scroll error', err); }
    }, [messages]);

    if (loading) {
        return <Loading />;
    }

    if (!otherUser || !currentUser) {
        return <div className='flex items-center justify-center h-screen'>
            <p className='text-gray-500'>Không tìm thấy cuộc hội thoại</p>
        </div>;
    }

    return (
        <div className="flex flex-col h-screen">
            <div className="flex items-center gap-2 p-2 md:px-10 xl:pl-42 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-300">
                <img src={otherUser.profile_picture} alt="" className="size-8 rounded-full" />
                <div>
                <p className="font-medium">{otherUser.full_name}</p>
                <p className="text-sm text-gray-500 -mt-1.5">@{otherUser.username}</p>
                </div>
            </div>
            <div className="p-5 md:px-10 h-full overflow-y-scroll">
                <div className="space-y-4 max-w-4xl mx-auto">
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

                            return groups.map((group, gi) => (
                                <div key={gi} className="pt-2">
                                    {/* time label centered */}
                                    <div className="text-center text-xs text-gray-400 mb-2">{formatTime(group.time)}</div>

                                    <div className={`flex ${group.isMine ? 'justify-end' : 'justify-start'} items-end gap-3`}> 
                                        {!group.isMine && (
                                            // show avatar of other user once per group
                                            <img src={otherUser?.profile_picture || 'https://via.placeholder.com/32'} alt="" className="w-8 h-8 rounded-full" />
                                        )}

                                        <div className={`${group.isMine ? 'items-end' : 'items-start'} flex flex-col`}> 
                                                                    {group.messages.map((message, mi) => {
                                                const isFirst = mi === 0;
                                                const isLast = mi === group.messages.length -1;
                                                const bubbleBase = 'px-4 py-2 text-sm max-w-xs break-words shadow';
                                                if (group.isMine) {
                                                    // mine: blue gradient, aligned right
                                                    const classes = `${bubbleBase} text-white bg-gradient-to-br from-indigo-500 to-purple-600 ${isFirst ? 'rounded-tl-lg' : ''} ${isLast ? 'rounded-bl-lg' : ''} rounded-br-lg`;
                                                    return (
                                                        <div key={mi} className={`mb-1 ${isLast ? '' : ''}`}>
                                                            { (message.media_urls && message.media_urls.length > 0) && (
                                                                <div className="flex flex-wrap gap-2 mb-1">
                                                                    {message.media_urls.map((u, idx) => (
                                                                        <img key={idx} src={u} className="w-32 h-32 object-cover rounded-md" alt="" />
                                                                    ))}
                                                                </div>
                                                            )}
                                                            <div className={classes}>{message.text}</div>
                                                        </div>
                                                    );
                                                } else {
                                                    // other: white bubble, left
                                                    const classes = `${bubbleBase} bg-white text-slate-700 ${isFirst ? 'rounded-tr-lg' : ''} ${isLast ? 'rounded-br-lg' : ''} rounded-bl-lg`;
                                                    return (
                                                        <div key={mi} className="mb-1 flex items-start">
                                                            <div className={classes}>
                                                                { (message.media_urls && message.media_urls.length > 0) && (
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
                                                }
                                            })}
                                        </div>
                                    </div>
                                </div>
                            ));
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