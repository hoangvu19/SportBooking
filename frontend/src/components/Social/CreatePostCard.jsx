import React, { useState, useEffect } from 'react';
import { Image, Video } from 'lucide-react';
import toast from 'react-hot-toast';
import { postAPI, imageToBase64 } from "../../utils/api";
import useAuth from "../../hooks/useAuth";
import { emitEvent } from '../../utils/socket';
import { useNavigate } from "react-router-dom";
import DEFAULT_AVATAR from "../../utils/defaults";
import { useI18n } from '../../i18n/hooks';

const CreatePostCard = ({ onPosted }) => {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
  }, [currentUser]);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      let shouldPending = false;
      if (!content && images.length === 0) {
        throw new Error(t('composer.emptyError', 'Please enter content or choose an image or video'));
      }

      // 1) Call AI sentiment endpoint before posting
      try {
        const aiRes = await fetch('http://localhost:8000/sentiment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: content || '' })
        });
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          if (aiData.action === 'delete') {
            const blockedMsg = t('composer.aiBlocked');
            try { toast.error(blockedMsg); } catch {''}
            const err = new Error(blockedMsg);
            err.code = 'AI_BLOCKED';
            return Promise.reject(err);
          }
          if (aiData.action === 'review') {
            shouldPending = true;
            toast(t('composer.aiPending', 'Your post will be submitted for review'));
          }
        }
      } catch (err) {
        const warnMsg = t('composer.aiFailed', 'AI check failed, allowing post but marking pending');
        console.warn(warnMsg, err);
        shouldPending = true;
      }

      let response;
      // If user attached files (File objects), send multipart/form-data with files under 'media'
      const hasFiles = Array.from(images).some(f => f instanceof File);
      if (hasFiles) {
        const form = new FormData();
        form.append('content', content || '');
        if (typeof shouldPending !== 'undefined' && shouldPending) form.append('status','PENDING');
        // append each file as 'media' (backend accepts 'media' or 'images')
        Array.from(images).forEach((f) => form.append('media', f));
        response = await postAPI.create(form);
      } else {
        const imageUrls = await Promise.all(
          Array.from(images).map(img => imageToBase64(img))
        );
        const payload = { content, imageUrls };
        if (typeof shouldPending !== 'undefined' && shouldPending) payload.status = 'PENDING';
        response = await postAPI.create(payload);
      }
      if (response.success) {
        setContent('');
        setImages([]);
        const created = response.data;
        // If post is pending review, call onPosted with the created post so callers can prepend it locally.
        if (onPosted) onPosted(created);
        // Notify feed listeners to refresh only for visible posts (not pending review)
        const isPending = !!(created && (created.Status === 'PendingReview' || created.status === 'PendingReview' || created.__moderation));
        if (!isPending) {
          try { window.dispatchEvent(new CustomEvent('feed:refresh')); } catch { console.debug('Could not dispatch feed:refresh'); }
        }
        try { emitEvent('post:created', created || response); } catch { /* ignore */ }
        return response.data;
      } else {
        throw new Error(response.message || 'Unable to create post');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClickWithToast = () => {
    toast.promise(
      handleSubmit(),
      {
        loading: t('composer.posting', 'Posting...'),
        success: (res) => {
          try {
            if (res && (res.Status === 'PendingReview' || res.__moderation)) {
              return t('composer.pendingReview', 'Your post was submitted and is pending review');
            }
          } catch { /* ignore */ }
          return t('composer.posted', 'Posted');
        },
        error: (err) => {
          if (err && err.code === 'AI_BLOCKED') return null;
          return (err && err.message) ? err.message : t('composer.error', 'Error');
        }
      }
    );
  };

  return (
    <div className='bg-white rounded-xl shadow p-4 mb-4 max-w-4xl mx-auto'>
      <div className='flex items-center gap-3'>
  <img src={currentUser?.profile_picture || currentUser?.AvatarUrl || currentUser?.ProfilePictureURL || currentUser?.avatarUrl || DEFAULT_AVATAR} onError={(e)=>{ e.target.src = DEFAULT_AVATAR }} alt='' className='w-10 h-10 rounded-full' />
        <textarea
          className='flex-1 resize-none h-12 text-sm outline-none placeholder-gray-400'
          placeholder={t('composer.placeholder', 'What are you thinking?')}
          value={content}
          onChange={e => setContent(e.target.value)}
        />
      </div>

      {images.length > 0 && (
        <div className='flex gap-2 mt-3'>
          {images.map((img, idx) => (
            img && img.type && img.type.startsWith('video/') ? (
              <video key={idx} src={URL.createObjectURL(img)} className='h-20 rounded-md' controls />
            ) : (
              <img key={idx} src={URL.createObjectURL(img)} className='h-20 rounded-md' alt='' />
            )
          ))}
        </div>
      )}

      <div className='flex items-center justify-between mt-3'>
        <div className='flex items-center gap-4'>
          <label htmlFor='feed-images' className='flex items-center gap-2 text-sm text-gray-500 cursor-pointer hover:text-indigo-600'>
            <Image className='size-5' /> {t('composer.image', 'Image/Video')}
          </label>
          <button 
            onClick={() => navigate('/livestreams')}
            className='flex items-center gap-2 text-sm text-gray-500 cursor-pointer hover:text-red-600'
          >
            <Video className='size-5' /> {t('composer.livestream', 'Livestream')}
          </button>
        </div>
  <input id='feed-images' type='file' hidden multiple accept='image/*,video/*' onChange={e => setImages(prev => [...prev, ...Array.from(e.target.files)])} />

  <button disabled={loading || (!content && images.length === 0)} onClick={handleClickWithToast} className='bg-indigo-600 text-white px-4 py-1 rounded-md text-sm hover:bg-indigo-700'>{t('composer.postButton', 'Post')}</button>
      </div>
    </div>
  );
};

export default CreatePostCard;
