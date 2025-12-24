
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Bell, X } from "lucide-react";
import { notificationAPI } from "../../utils/api";
import { useNavigate } from "react-router-dom";
import { getSocket } from "../../utils/socket";
import { DEFAULT_AVATAR } from "../../utils/defaults";
import { normalizeUser } from '../../utils/normalize';
import { userAPI } from '../../utils/api';
import { useI18n } from "../../i18n/hooks";

const NotificationBell = () => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(() => {
    // Load from localStorage on mount
    try {
      const cached = localStorage.getItem('notifications_cache');
      return cached ? JSON.parse(cached) : [];
    } catch  {
      return [];
    }
  });
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const bellRef = useRef();
  const navigate = useNavigate();

  // Helper function to translate notification content
  const translateNotificationContent = (notification) => {
    if (!notification) return '';

    const content = notification.Content || '';
    const senderName = (() => {
      // Prefer normalized fields
      const rawSender = notification.Sender || {};
      const norm = normalizeUser(rawSender || {});
      if (norm && norm.fullName) return norm.fullName;
      if (norm && norm.username) return norm.username;
      // legacy fallbacks
      return notification.Sender?.FullName || notification.Sender?.full_name || notification.Sender?.Username || notification.SenderName || notification.FromName || 'Someone';
    })();
    
    // AI Moderation messages
    if (content.includes('Content flagged for removal') || content.includes('Nội dung bị gắn cờ')) {
      return t('notifications.flagged');
    }
    
    // Follow notifications
    if (content.includes('đã theo dõi') || content.includes('followed you')) {
      return t('notifications.follow').replace('{name}', senderName);
    }
    
    // Like notifications
    if (content.includes('đã thích') || content.includes('liked your post')) {
      return t('notifications.like').replace('{name}', senderName);
    }
    
    // Comment notifications
    if (content.includes('đã bình luận') || content.includes('commented on')) {
      return t('notifications.comment').replace('{name}', senderName);
    }
    
    // Invitation notifications
    if (content.includes('đã mời') || content.includes('invited you')) {
      return t('notifications.invitation').replace('{name}', senderName);
    }
    
    // Default: return original content
    return content;
  };

  // Primary text to display for a notification: prefer Content, else show a friendly label inferred from Type
  const getNotificationPrimaryText = (notification) => {
    if (!notification) return '';
    // Prefer explicit Content field (raw text/admin message)
    if (notification.Content && String(notification.Content).trim() !== '') return String(notification.Content);

    // Fallback to smart translation based on Type or content heuristics
    const type = (notification.Type || '').toString().toLowerCase();
    const senderName = (() => {
      const rawSender = notification.Sender || {};
      const norm = normalizeUser(rawSender || {});
      if (norm && norm.fullName) return norm.fullName;
      if (norm && norm.username) return norm.username;
      return notification.Sender?.FullName || notification.Sender?.full_name || notification.SenderName || 'Someone';
    })();

    if (type === 'follow' || /follow/.test(type)) return t('notifications.follow').replace('{name}', senderName);
    if (type === 'like' || /like/.test(type)) return t('notifications.like').replace('{name}', senderName);
    if (type === 'comment' || /comment/.test(type)) return t('notifications.comment').replace('{name}', senderName);
    if (type === 'share' || /share/.test(type)) return t('notifications.share')?.replace('{name}', senderName) || t('notifications.share');
    // default: try to translate content heuristics
    const heur = translateNotificationContent(notification);
    if (heur && heur !== '') return heur;
    // Last fallback: show raw Type string (capitalized)
    return (notification.Type || '').toString();
  };


  // Try to enrich notification sender info when possible (fills Sender.FullName)
  const enrichSenderIfMissing = useCallback(async (notification) => {
    try {
      if (!notification) return notification;
      const hasName = !!(notification.Sender && (notification.Sender.FullName || notification.Sender.full_name || notification.Sender.Username));
      const senderAccountId = notification.SenderAccountID || notification.SenderAccountId || notification.SenderId || notification.Sender?.AccountID;
      if (!hasName && senderAccountId) {
        const resp = await userAPI.getProfile(senderAccountId).catch(() => null);
        if (resp && resp.data) {
          const profile = resp.data;
          // Attach a normalized Sender object
          notification.Sender = notification.Sender || {};
          notification.Sender.FullName = profile.fullName || profile.FullName || profile.name || profile.username || (profile.user && profile.user.fullName) || notification.Sender.FullName;
          notification.Sender.Username = notification.Sender.Username || profile.username || profile.UserName || (profile.user && profile.user.username);
          // Attach avatar fields from profile (several possible keys)
          notification.Sender.AvatarUrl = notification.Sender.AvatarUrl || profile.avatar || profile.avatarUrl || profile.AvatarUrl || profile.ProfilePictureURL || profile.profile_picture || profile.profilePicture || profile.profileImage || notification.Sender.AvatarUrl;
          notification.Sender.avatar = notification.Sender.avatar || notification.Sender.AvatarUrl;
          // update local cache and state
          setNotifications(prev => {
            try {
              return prev.map(n => n.NotificationID === notification.NotificationID ? { ...n, Sender: notification.Sender } : n);
            } catch { return prev; }
          });
          try { localStorage.setItem('notifications_cache', JSON.stringify(notifications)); } catch (err) { void err; }
        }
      }
    } catch (err) {
      console.debug('enrichSenderIfMissing failed', err);
    }
    return notification;
  }, [notifications]);

  

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (open) {
      fetchNotificationsInternal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    fetchUnreadCount();
    
    const socket = getSocket();
    console.log('🔌 Socket.io instance:', socket);
    console.log('🔌 Socket connected:', socket?.connected);
    
    if (socket) {
      socket.on('new_notification', (notification) => {
        console.log('🔔 Received new notification:', notification);
          enrichSenderIfMissing(notification).then(() => {
            setNotifications(prev => [notification, ...prev]);
            setUnreadCount(prev => prev + 1);
          }).catch(() => {
            setNotifications(prev => [notification, ...prev]);
            setUnreadCount(prev => prev + 1);
          });
        
        // Optional: Show browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(t('notifications.title'), {
            body: translateNotificationContent(notification),
            icon: notification.Sender?.AvatarUrl || DEFAULT_AVATAR
          });
        }
      });

      // Listen for notification read events
      socket.on('notification_read', ({ notificationId }) => {
        console.log('📖 Notification marked as read:', notificationId);
        setNotifications(prev =>
          prev.map(n =>
            n.NotificationID === notificationId ? { ...n, IsRead: 1 } : n
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      });

      // Listen for mark all as read
      socket.on('notifications_all_read', () => {
        console.log('📚 All notifications marked as read');
        setNotifications(prev => prev.map(n => ({ ...n, IsRead: 1 })));
        setUnreadCount(0);
      });
    } else {
      console.error('❌ Socket not available!');
    }

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      if (socket) {
        socket.off('new_notification');
        socket.off('notification_read');
        socket.off('notifications_all_read');
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrichSenderIfMissing]);

  const fetchNotificationsInternal = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationAPI.getAll(1, 20);
      if (res.success && Array.isArray(res.data)) {
        setNotifications(res.data);
        // attempt to enrich any notification sender names missing
        (res.data || []).forEach((n) => {
          enrichSenderIfMissing(n);
        });
        // Cache to localStorage
        try {
          localStorage.setItem('notifications_cache', JSON.stringify(res.data));
        } catch (err) {
          console.warn('Failed to cache notifications:', err);
        }
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [enrichSenderIfMissing]);

  const fetchUnreadCount = async () => {
    try {
      const res = await notificationAPI.getUnreadCount();
      if (res.success && typeof res.count === 'number') {
        setUnreadCount(res.count);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  // Close popup when clicking outside
  useEffect(() => {
    const handleClick = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleNotificationClick = async (notif) => {
    // Mark as read
    if (!notif.IsRead) {
      try {
        await notificationAPI.markAsRead(notif.NotificationID);
        setNotifications(prev =>
          prev.map(n =>
            n.NotificationID === notif.NotificationID ? { ...n, IsRead: 1 } : n
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    }

    // Navigate based on notification type (keep dropdown open)
    if (notif.Type === 'like') {
      // Like notification - ContentID is PostID
      navigate(`/post/${notif.ContentID}`);
    } else if (notif.Type === 'comment') {
      // Comment notification - ContentID could be PostID or CommentID
      // Try to navigate to post directly first
      navigate(`/post/${notif.ContentID}`);
    } else if (notif.Type === 'follow') {
      // Follow notification - navigate to sender profile
      navigate(`/profile/${notif.SenderAccountID}`);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationAPI.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, IsRead: 1 })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const formatTimeAgo = (dateString) => {
    if (!dateString) return t('notifications.timeUnknown');
    
    try {
      // SQL Server trả về datetime object hoặc ISO string
      let date;
      
      if (dateString instanceof Date) {
        date = dateString;
      } else {
        const dateStr = String(dateString).trim();
        
        // SQL Server trả về format: "2025-11-06T19:32:16.727Z"
        // NHƯNG datetime trong DB là VN local time, KHÔNG phải UTC!
        // VD: DB lưu "19:32" (7:32 PM VN time)
        // SQL tự thêm Z khi serialize JSON => "19:32Z" = 7:32 PM UTC
        // => Parse thành 2:32 AM ngày hôm sau VN (SAI!)
        // => Cần remove 'Z' và thêm '+07:00' để parse đúng
        
        if (dateStr.endsWith('Z')) {
          // Remove 'Z' và thêm '+07:00'
          const vnDateStr = dateStr.slice(0, -1) + '+07:00';
          date = new Date(vnDateStr);
        } else if (dateStr.includes('+')) {
          // Đã có timezone, parse trực tiếp
          date = new Date(dateStr);
        } else {
          // Không có timezone, thêm +07:00
          const isoStr = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
          date = new Date(isoStr + '+07:00');
        }
      }
      
      if (!date || isNaN(date.getTime())) {
        console.warn('Invalid date:', dateString);
        return 'Không rõ';
      }
      
      const now = new Date();
      const diffInMs = now - date;
      const diffInSeconds = Math.floor(diffInMs / 1000);

      // Xử lý thời gian âm (notification từ tương lai do clock skew)
      if (diffInSeconds < 0) return t('common.justNow');
      
      // Dưới 1 phút
      if (diffInSeconds < 60) return t('common.justNow');
      
      // Dưới 1 giờ - hiển thị theo phút
      if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60);
        return t('common.minutesAgo').replace('{n}', minutes);
      }
      
      // Dưới 1 ngày - hiển thị theo giờ
      if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600);
        return t('common.hoursAgo').replace('{n}', hours);
      }
      
      // Dưới 1 tuần - hiển thị theo ngày
      if (diffInSeconds < 604800) {
        const days = Math.floor(diffInSeconds / 86400);
        return t('common.daysAgo').replace('{n}', days);
      }
      
      // Trên 1 tuần - hiển thị ngày tháng năm đầy đủ
      return date.toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    } catch (error) {
      console.error('Error formatting time:', error, dateString);
      return t('notifications.timeUnknown');
    }
  };

  return (
    <div className="relative" ref={bellRef}>
      <button
        className="relative p-2 rounded-full hover:bg-gray-100 focus:outline-none transition-colors"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('notifications.title')}
      >
        <Bell className="w-6 h-6 text-gray-700" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 min-w-[20px] h-5 px-1 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      
      {open && (
        <div className="absolute right-0 mt-2 w-96 bg-white shadow-xl rounded-lg z-50 border border-gray-200">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 text-lg">{t('notifications.title')}</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                {t('notifications.markAllRead')}
              </button>
            )}
          </div>
          
          <div className="max-h-[500px] overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-gray-400">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-2">{t('notifications.loading')}</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <Bell className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>{t('notifications.noNew')}</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {notifications.map((n) => (
                  <li
                    key={n.NotificationID}
                    className={`px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors ${
                      !n.IsRead ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => handleNotificationClick(n)}
                  >
                    <div className="flex items-start gap-3">
                      <img 
                        src={normalizeUser(n.Sender || {}).avatar || n.Sender?.AvatarUrl || DEFAULT_AVATAR} 
                        alt={n.Sender?.FullName || 'User'} 
                        className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                        onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_AVATAR; }}
                      />
                      
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${!n.IsRead ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                          {getNotificationPrimaryText(n)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatTimeAgo(n.CreatedDate)}
                        </p>
                      </div>
                      
                      {!n.IsRead && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2"></div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
