import React, { useState, useEffect } from 'react';
import { shareAPI } from "../../utils/api";
import { useI18n } from '../../i18n/hooks';

const ShareModal = ({ visible, onClose, postId, onShared, initiallyShared }) => {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [shared, setShared] = useState(!!initiallyShared);

  const { t } = useI18n();

  useEffect(() => {
    setShared(!!initiallyShared);
  }, [initiallyShared]);

  if (!visible) return null;

  const handleShare = async () => {
    setLoading(true);
    try {
      // Only allow creating a share from this modal. Unsharing (delete) is removed.
      if (!shared) {
        const res = await shareAPI.create(postId, note);
        if (res && res.success) {
          setShared(true);
          onShared && onShared({ action: 'shared', data: res.data });
        }
      }
    } catch (err) {
      console.error('Share error', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow p-4 w-full max-w-md">
  <h3 className="font-semibold mb-2">{t('post.share', 'Share post')}</h3>
        {/* Always show textarea (image 1) */}
        <textarea
          className="w-full border p-2 rounded mb-3"
          placeholder={t('post.sharePlaceholder', 'Write something about this post... (optional)')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
        />

        <div className="flex justify-end gap-2">
          <button className="px-3 py-1 rounded bg-gray-200" onClick={onClose} disabled={loading}>{t('common.cancel')}</button>
          <button className="px-3 py-1 rounded bg-blue-600 text-white flex items-center gap-2" onClick={handleShare} disabled={loading || shared}>
                {loading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path></svg>
                <span>{t('post.sharing', 'Sharing...')}</span>
              </>
            ) : (
              (shared ? t('post.shared', 'Shared') : t('post.shareButton', 'Share'))
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
