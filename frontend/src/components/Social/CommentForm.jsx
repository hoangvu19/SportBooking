import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Camera } from 'lucide-react';
import { commentAPI } from "../../utils/api";

const CommentForm = ({ postId, onCreated, parentCommentId = null, onCancelReply }) => {
  const [text, setText] = useState('');
  // track IME composition state so Enter isn't treated as send while composing (important for Vietnamese)
  const [isComposing, setIsComposing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [isAuthed, setIsAuthed] = useState(false);
  // files: array of { id, file }
  const [files, setFiles] = useState([]);
  // previews: array of { id, src }
  const [previews, setPreviews] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    setIsAuthed(!!token);
  }, []);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError(null);
    if (!isAuthed) {
      navigate('/login');
      return;
    }
    const content = text.trim();
    
    // Kiểm tra nội dung bình luận
    const hasValidContent = content.length > 0 && /[a-zA-Z0-9\u00C0-\u1EF9]+/.test(content); // Regex kiểm tra có ít nhất 1 ký tự chữ/số (bao gồm Unicode cho tiếng Việt)
    
    // Chỉ cho phép gửi khi có nội dung hợp lệ hoặc có file đính kèm
    if (!hasValidContent && files.length === 0) {
      if (content.length > 0) {
        setError('Bình luận phải có nội dung chữ hoặc số, không chỉ là dấu câu hoặc khoảng trắng.');
      }
      return;
    }

    try {
      setSubmitting(true);
      const payload = { 
        postId: postId, 
        content,
        parentCommentId,
        files: files.length > 0 ? files : undefined 
      };
      
      const res = await commentAPI.create(payload);
      if (res && res.success) {
        setText('');
        setFiles([]);
        setPreviews([]);
        if (typeof onCreated === 'function') onCreated(res.data);
        if (typeof onCancelReply === 'function') onCancelReply();
      } else {
        setError(res && res.message ? res.message : 'Không thể tạo bình luận');
      }
    } catch (err) {
      console.error('Create comment error:', err);
      setError(err.message || 'Lỗi khi gửi bình luận');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAuthed) {
    return (
      <div className="mt-2 flex items-center gap-2">
        <div className="text-sm text-gray-600">Vui lòng đăng nhập để bình luận</div>
        <button
          className="px-3 py-1 bg-indigo-600 text-white rounded"
          onClick={() => navigate('/login')}
        >
          Đăng nhập
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2">
      <div className="relative flex items-center group">
        {/* Input with improved styling */}
        <input
          aria-label="Viết bình luận"
          className={`
            w-full px-4 py-2.5 pr-24
            border border-gray-200 rounded-full
            bg-gray-50 
            placeholder-gray-400
            focus:outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100
            transition-all duration-200
            ${submitting ? 'opacity-50' : ''}
            ${previews.length > 0 ? 'pl-20' : ''}
            ${error ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''}
          `}
          placeholder="Viết bình luận..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={submitting}
          onKeyDown={(e) => {
            // Ignore Enter while IME composition is in progress
            if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
        />

        {/* inline previews inside input (left side) */}
        {previews.length > 0 && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex gap-1 z-10">
            {previews.map(({ id, src }) => (
              <div key={id} className="relative w-8 h-8">
                <img src={src} alt="preview" className="w-8 h-8 object-cover rounded" />
                <button
                  type="button"
                  className="absolute -top-2 -right-2 bg-white rounded-full p-0.5 text-xs"
                  onClick={() => {
                    setFiles(prev => prev.filter(f => f.id !== id));
                    setPreviews(prev => prev.filter(p => p.id !== id));
                  }}
                  disabled={submitting}
                  style={submitting ? { opacity: 0.5, pointerEvents: 'none' } : {}}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        {/* camera button (hidden input is below) placed left of send */}
        <button
          type="button"
          aria-label="Thêm ảnh"
          onClick={() => document.getElementById('comment-file-input')?.click()}
          className="absolute right-10 top-1/2 -translate-y-1/2 p-2 rounded-full text-gray-600 hover:text-gray-800"
          title="Thêm ảnh"
        >
          <Camera className="w-4 h-4" />
        </button>

        <button
          type="button"
          aria-label="Gửi bình luận"
          onClick={handleSubmit}
          disabled={submitting || (text.trim() === '' && files.length === 0)}
          className={`absolute right-1 top-1/2 -translate-y-1/2 p-2 rounded-full ${text.trim() === '' && files.length === 0 ? 'bg-gray-300' : 'bg-indigo-600 text-white'}`}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
      {/* hidden file input (triggered by camera button above) */}
      <input
        id="comment-file-input"
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const selected = Array.from(e.target.files || []);
          const max = 4;
          const remaining = Math.max(0, max - files.length);
          const toTake = selected.slice(0, remaining);
          if (toTake.length === 0) return;

          const withIds = toTake.map(f => ({ id: Date.now().toString(36) + Math.random().toString(36).slice(2,8), file: f }));
          setFiles(prev => [...prev, ...withIds]);

          // generate previews
          withIds.forEach(({ id, file }) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
              setPreviews(prev => [...prev, { id, src: ev.target.result }]);
            };
            reader.readAsDataURL(file);
          });
          e.target.value = '';
        }}
      />

      {/* previews are rendered inline above inside the input row */}
      {error && <div className="text-xs text-red-500 mt-1">{error}</div>}
    </form>
  );
};

export default CommentForm;
