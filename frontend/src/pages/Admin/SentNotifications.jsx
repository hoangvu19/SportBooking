import React, { useEffect, useState } from 'react';
import { notificationAPI } from '../../utils/api';
import { toast } from 'react-hot-toast';
import { useI18n } from '../../i18n/hooks';

export default function SentNotifications() {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState({ show: false, type: null, content: null });

  const load = async () => {
    setLoading(true);
    try {
      const res = await notificationAPI.getSent(page, limit);
      if (res && res.success) {
        setItems(res.data || []);
      } else {
        toast.error(res && res.message ? res.message : t('admin.sent.loadError', 'Error loading sent notifications'));
      }
    } catch (err) {
      console.error('Load sent notifications error', err);
      toast.error(err.message || t('admin.sent.loadError', 'Error loading sent notifications'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, refreshKey]);

  const handleDeleteGroup = async () => {
    if (!confirm.content) return;
    setDeleting(true);
    try {
      const payload = { type: confirm.type, content: confirm.content };
      const res = await notificationAPI.deleteSentGroup(payload);
      if (res && res.success) {
        toast.success(t('admin.sentNotifications.deleteSuccess', 'Notification group deleted'));
        setConfirm({ show: false, type: null, content: null });
        setRefreshKey(k => k + 1);
      } else {
        toast.error(res && res.message ? res.message : t('admin.sentNotifications.deleteError', 'Error deleting notification group'));
      }
    } catch (err) {
      console.error('Delete sent group error', err);
      toast.error(err.message || t('admin.sentNotifications.deleteError', 'Error deleting notification group'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b">
        <h3 className="text-lg font-semibold">{t('admin.sentNotifications.title', 'Sent Notifications')}</h3>
        <p className="text-sm text-gray-500">{t('admin.sentNotifications.subtitle', 'List of sent notifications (grouped by content + type)')}</p>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="text-center py-8">{t('admin.sentNotifications.loading', 'Loading…')}</div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-gray-500">{t('admin.sentNotifications.noNotifications', 'No sent notifications')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left divide-y">
              <thead className="text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-3 py-2">{t('admin.sentNotifications.type', 'Type')}</th>
                  <th className="px-3 py-2">{t('admin.sentNotifications.content', 'Content (sample)')}</th>
                  <th className="px-3 py-2">{t('admin.sentNotifications.recipients', 'Recipients')}</th>
                  <th className="px-3 py-2">{t('admin.sentNotifications.sentDate', 'Sent Date')}</th>
                  <th className="px-3 py-2">{t('admin.sentNotifications.actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y">
                {items.map((it) => (
                  <tr key={`${it.Type}_${(it.CreatedDate||'')}_${it.ExampleNotificationID}`}>
                    <td className="px-3 py-2 align-top">{it.Type}</td>
                    <td className="px-3 py-2 align-top break-words max-w-xl whitespace-pre-wrap">{String(it.Content || '').slice(0, 400)}</td>
                    <td className="px-3 py-2 align-top">{it.RecipientCount}</td>
                    <td className="px-3 py-2 align-top">{new Date(it.CreatedDate).toLocaleString()}</td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setConfirm({ show: true, type: it.Type, content: it.Content })}
                          className="px-2 py-1 rounded bg-red-600 text-white text-sm hover:bg-red-700"
                        >
                          {t('admin.sentNotifications.deleteGroup', 'Delete Group')}
                        </button>
                        {/* Optional: provide view link to example notification */}
                        <a
                          href={`#/admin/sent-notifications/${it.ExampleNotificationID}`}
                          className="px-2 py-1 rounded bg-gray-100 text-gray-700 text-sm border"
                        >
                          {t('admin.sentNotifications.view', 'View')}
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Simple pagination controls */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">{t('admin.sentNotifications.showing', 'Showing')} {items.length} {t('admin.sentNotifications.items', 'items')}</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded bg-gray-100 disabled:opacity-50"
            >{t('admin.sentNotifications.prev', 'Prev')}</button>
            <div className="text-sm">{t('admin.sentNotifications.page', 'Page')} {page}</div>
            <button
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1 rounded bg-gray-100"
            >{t('admin.sentNotifications.next', 'Next')}</button>
          </div>
        </div>
      </div>

      {/* Confirmation modal */}
      {confirm.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black opacity-40" onClick={() => setConfirm({ show: false, type: null, content: null })} />
          <div className="bg-white rounded-lg shadow-lg z-10 max-w-lg w-full">
            <div className="p-6">
              <h4 className="text-lg font-semibold">{t('admin.sentNotifications.confirmDeleteTitle', 'Confirm Delete Notification Group')}</h4>
              <p className="mt-2 text-sm text-gray-600">{t('admin.sentNotifications.confirmDeleteMessage', 'You are about to delete all notifications with the same content and type. This action will remove notifications from recipient accounts and cannot be undone.')}</p>
              <div className="mt-4 bg-gray-50 p-3 rounded text-sm whitespace-pre-wrap">{String(confirm.content)}</div>
              <div className="mt-4 flex justify-end gap-3">
                <button onClick={() => setConfirm({ show: false, type: null, content: null })} className="px-4 py-2 rounded bg-gray-200">{t('admin.sentNotifications.cancel', 'Cancel')}</button>
                <button onClick={handleDeleteGroup} disabled={deleting} className="px-4 py-2 rounded bg-red-600 text-white">{deleting ? t('admin.sentNotifications.deleting', 'Deleting…') : t('admin.sentNotifications.delete', 'Delete Group')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
