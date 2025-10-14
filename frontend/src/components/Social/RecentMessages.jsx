import React from 'react'
import { Link } from 'react-router-dom';
import moment from 'moment';
import { messageAPI } from "../../utils/api";
import DEFAULT_AVATAR from "../../utils/defaults";

const RecentMessages = () => {

    const [messages, setMessages] = React.useState([]);

    const fetchRecentMessages = async () => {
        try {
            const res = await messageAPI.getConversations();
            if (res && res.success && Array.isArray(res.data)) {
                // Map backend conversation rows to UI items
                const mapped = res.data.map(c => ({
                    _id: c.AccountID,
                    profile_picture: c.profile_picture || c.AvatarUrl || c.ProfilePictureURL || c.avatarUrl || DEFAULT_AVATAR,
                    full_name: c.FullName,
                    username: c.Username,
                    text: c.LastMessageContent || '',
                    createdAt: c.LastMessageDate,
                    seen: c.UnreadCount === 0,
                }));
                setMessages(mapped);
            } else {
                setMessages([]);
            }
        } catch (err) {
            console.error('Failed to load recent messages', err);
            setMessages([]);
        }
    }

    React.useEffect(() => {
        fetchRecentMessages();
    }, []);

    return (
       <div className='bg-white max-w-xs mt-4 p-4 min-h-20 rounded-md shadow text-xs text-slate-800'>
        <h3 className='font-semibold text-slate-600 mb-4'>Recent Messages</h3>
        <div className='flex flex-col max-h-56 overflow-y-scroll no-scrollbar'>
        {messages.map((message, index) => (
            <Link to={`/messages/${message._id}`} key={index} className='flex items-start gap-2 py-2 hover:bg-slate-100'>
                <img
                src={message.profile_picture || DEFAULT_AVATAR}
                onError={(e)=>{ e.target.src = DEFAULT_AVATAR }}
                alt=""
                className='w-8 h-8 rounded-full'
            />
            
            <div className='w-full'>
                {/* Header with user name and timestamp */}
                <div className='flex justify-between'>
                    <p className='font-medium'>{message.full_name}</p>
                    <p className='text-[10px] text-slate-400'>
                    {message.createdAt ? moment(message.createdAt).fromNow() : ''}
                    </p>
                </div>

                {/* Content and unread indicator */}
                <div className='flex justify-between'>
                    <p className='text-gray-500'>
                    {message.text ? message.text : 'Media'}
                    </p>
                    {message.seen === false && (
                    <p className='bg-indigo-500 text-white w-4 h-4 flex items-center justify-center rounded-full text-[10px]'>
                        {message.unreadCount && message.unreadCount > 0 ? message.unreadCount : '•'}
                    </p>
                    )}
                </div>
                </div>

            </Link>
        ))}
        </div>
        </div>
        )
}

export default RecentMessages;