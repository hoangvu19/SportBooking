import React from 'react';

export default function ConfirmModalClean({ title, message, onCancel, onConfirm, cancelLabel = 'Hủy', confirmLabel = 'Đồng ý' }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg p-6 shadow-lg max-w-md w-full mx-4">
        {title && <h3 className="text-lg font-semibold mb-2">{title}</h3>}
        {message && <p className="text-sm text-gray-700 mb-4">{message}</p>}
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 border rounded bg-white text-gray-700">{cancelLabel}</button>
          <button onClick={onConfirm} className="px-4 py-2 bg-indigo-600 text-white rounded">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
