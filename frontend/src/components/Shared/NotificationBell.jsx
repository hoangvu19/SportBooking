
import React, { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { notificationAPI } from "../../utils/api";
import { useNavigate } from "react-router-dom";
import { useI18n } from '../../i18n/hooks';

const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const bellRef = useRef();

  useEffect(() => {
    if (open) {
      setLoading(true);
      notificationAPI.getAll().then(res => {
        if (res.success && Array.isArray(res.notifications)) {
          setNotifications(res.notifications);
        } else {
          setNotifications([]);
        }
      }).finally(() => setLoading(false));
    }
  }, [open]);

  // Đóng popup khi click ra ngoài
  useEffect(() => {
    const handleClick = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const navigate = useNavigate();
  const { t } = useI18n();

  const handleNotificationClick = (notif) => {
    if (notif.link) {
      setOpen(false);
      navigate(notif.link);
    }
  };

  return (
    <div className="relative" ref={bellRef}>
      <button
        className="relative p-2 rounded-full hover:bg-gray-100 focus:outline-none"
        onClick={() => setOpen((v) => !v)}
        aria-label="Thông báo"
      >
        <Bell className="w-6 h-6 text-gray-700" />
        {notifications.some(n => !n.read) && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full"></span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white shadow-lg rounded-lg z-50 border border-gray-200">
          <div className="p-4 border-b font-semibold text-gray-800">{t('notifications.title')}</div>
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-400">{t('common.loading')}</div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-400">{t('notifications.noNew')}</div>
            ) : (
              <ul className="divide-y">
                {notifications.slice(0, 20).map((n, idx) => (
                  <li
                    key={idx}
                    className={`px-4 py-3 flex flex-col gap-1 cursor-pointer ${n.read ? 'bg-gray-50' : 'bg-blue-50 font-semibold'}`}
                    onClick={() => handleNotificationClick(n)}
                  >
                    <div className="flex items-center gap-2">
                      {n.fromUser?.avatar && (
                        <img src={n.fromUser.avatar} alt="avatar" className="w-7 h-7 rounded-full object-cover" />
                      )}
                      <span>{n.message}</span>
                    </div>
                    <span className="text-xs text-gray-400">{new Date(n.createdAt).toLocaleString()}</span>
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
