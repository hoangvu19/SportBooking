import React, { useState } from 'react';
import { shareAPI } from '../utils/api';

const ShareModal = ({ visible, onClose, postId, onShared, initiallyShared }) => {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [shared, setShared] = useState(!!initiallyShared);
  const [toast, setToast] = useState(null);

  React.useEffect(() => {
    setShared(!!initiallyShared);
  }, [initiallyShared]);

  if (!visible) return null;

  const handleShare = async () => {
    setLoading(true);
    setToast(null);
    try {
      if (!shared) {
        const res = await shareAPI.create(postId, note);
        if (res && res.success) {
          setShared(true);
          setToast({ type: 'success', message: 'Đã chia sẻ bài viết' });
          onShared && onShared({ action: 'shared', data: res.data });
        }
      } else {
        const res = await shareAPI.delete(postId);
        if (res && res.success) {
          setShared(false);
          setToast({ type: 'success', message: 'Đã hủy chia sẻ' });
          onShared && onShared({ action: 'unshared' });
        }
      }
    } catch (err) {
      console.error('Share error', err);
      setToast({ type: 'error', message: 'Xảy ra lỗi khi chia sẻ' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow p-4 w-full max-w-md">
        <h3 className="font-semibold mb-2">{shared ? 'Bỏ chia sẻ' : 'Chia sẻ bài viết'}</h3>
        {toast && (
          <div className={`mb-2 p-2 rounded text-sm ${toast.type === 'error' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
            {toast.message}
          </div>
        )}
        {!shared && (
          <textarea
            className="w-full border p-2 rounded mb-3"
            placeholder="Viết gì đó về bài viết này... (tùy chọn)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
          />
        )}

        <div className="flex justify-end gap-2">
          <button className="px-3 py-1 rounded bg-gray-200" onClick={onClose} disabled={loading}>Hủy</button>
          <button className="px-3 py-1 rounded bg-blue-600 text-white flex items-center gap-2" onClick={handleShare} disabled={loading}>
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path></svg>
                <span>Đang...</span>
              </>
            ) : (
              (shared ? 'Hủy chia sẻ' : 'Chia sẻ')
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
