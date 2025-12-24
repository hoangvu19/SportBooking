import React, { useState } from 'react';
import { notificationAPI } from '../../utils/api';
import { toast } from 'react-hot-toast';
import SentNotifications from './SentNotifications';
import { useI18n } from '../../i18n/hooks';

export default function BroadcastNotification() {
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState('admin_broadcast');
  const [link, setLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [sentListKey, setSentListKey] = useState(0);

  const combinedContent = () => {
    const parts = [];
    if (title && title.trim()) parts.push(title.trim());
    if (content && content.trim()) parts.push(content.trim());
    if (link && link.trim()) parts.push(`Link: ${link.trim()}`);
    return parts.join('\n\n');
  };

  const doSend = async () => {
    const payloadContent = combinedContent();
    if (!payloadContent) {
      toast.error(t('admin.broadcast.emptyContent', 'Content cannot be empty'));
      return;
    }

    setLoading(true);
    try {
      const res = await notificationAPI.broadcast({ type, content: payloadContent });
      if (res && res.success) {
        toast.success(t('admin.broadcast.sentSuccess', `Sent to ${res.sent || 0} users`, { count: res.sent || 0 }));
        setTitle('');
        setContent('');
        setLink('');
        // refresh embedded sent list
        setSentListKey(k => k + 1);
      } else {
        toast.error(res && res.message ? res.message : t('admin.broadcast.sendError', 'Error sending broadcast'));
      }
    } catch (err) {
      console.error('Broadcast error', err);
      toast.error(err.message || t('admin.broadcast.sendError', 'Error sending broadcast'));
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  };

  return (
    <>
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">{t('admin.broadcast.title','Broadcast Notification')}</h2>
          <p className="text-sm text-gray-500">{t('admin.broadcast.subtitle', 'Send notification to all users (Admin)')}</p>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('admin.broadcast.titleLabel','Title (optional)')}</label>
              <input
                className="mt-1 block w-full rounded-md border-gray-200 shadow-sm focus:ring-blue-500 focus:border-blue-500"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={t('admin.broadcast.titlePlaceholder','Short headline (optional)')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">{t('admin.broadcast.contentLabel','Content')}</label>
              <textarea
                rows={6}
                className="mt-1 block w-full rounded-md border-gray-200 shadow-sm focus:ring-blue-500 focus:border-blue-500"
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder={t('admin.broadcast.contentPlaceholder','Write the message that will be sent to all users...')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">{t('admin.broadcast.linkLabel','Deep link / URL (optional)')}</label>
              <input
                className="mt-1 block w-full rounded-md border-gray-200 shadow-sm focus:ring-blue-500 focus:border-blue-500"
                value={link}
                onChange={e => setLink(e.target.value)}
                placeholder={t('admin.broadcast.linkPlaceholder','https://...')}
              />
            </div>

            <div className="flex items-center gap-3">
              <select
                value={type}
                onChange={e => setType(e.target.value)}
                className="rounded-md border-gray-200 p-2"
              >
                <option value="admin_broadcast">{t('admin.broadcast.typeAdminBroadcast','Admin Broadcast')}</option>
                <option value="system">{t('admin.broadcast.typeSystem','System')}</option>
              </select>

              <button
                onClick={() => setShowConfirm(true)}
                disabled={loading}
                className="ml-auto inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60"
              >
                {loading ? t('admin.broadcast.sending','Sending…') : t('admin.broadcast.sendButton','Send to All Users')}
              </button>
            </div>
          </div>

          <aside className="bg-gray-50 p-4 rounded-md border border-gray-100">
            <div className="text-sm font-medium text-gray-700 mb-2">{t('admin.broadcast.previewTitle','Preview')}</div>
            <div className="bg-white p-3 rounded border border-gray-100 shadow-sm">
              {title ? <div className="font-semibold mb-1">{title}</div> : null}
              <div className="text-sm text-gray-800 whitespace-pre-wrap">{combinedContent()}</div>
            </div>
            <div className="mt-3 text-xs text-gray-500">{t('admin.broadcast.previewHelp','Preview shows how message will appear to users.')}</div>
          </aside>
        </div>
      </div>

      {/* Confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black opacity-40" onClick={() => setShowConfirm(false)} />
          <div className="bg-white rounded-lg shadow-lg z-10 max-w-lg w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold">{t('admin.broadcast.confirmTitle','Confirm Broadcast')}</h3>
              <p className="mt-2 text-sm text-gray-600">{t('admin.broadcast.confirmMessage','This will send the notification to all active users. Are you sure?')}</p>

              <div className="mt-4 bg-gray-50 p-3 rounded">
                {title && <div className="font-medium">{title}</div>}
                <div className="text-sm text-gray-800 whitespace-pre-wrap">{combinedContent()}</div>
              </div>

              <div className="mt-4 flex justify-end gap-3">
                <button onClick={() => setShowConfirm(false)} className="px-4 py-2 rounded bg-gray-200">{t('admin.broadcast.cancel','Cancel')}</button>
                <button onClick={doSend} disabled={loading} className="px-4 py-2 rounded bg-blue-600 text-white">{loading ? t('admin.broadcast.sending','Sending…') : t('admin.broadcast.confirmSend','Confirm & Send')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    
    {/* Sent notifications list (embedded) */}
    <div className="max-w-4xl mx-auto p-6 mt-6">
      <SentNotifications key={sentListKey} />
    </div>
    </>
  );
}

// Embed SentNotifications below the broadcast UI so admins can manage sent items in the same view.
