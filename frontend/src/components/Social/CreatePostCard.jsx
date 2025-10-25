import React, { useState, useEffect } from 'react';
import { Image, Video } from 'lucide-react';
import toast from 'react-hot-toast';
import { postAPI, imageToBase64 } from "../../utils/api";
import useAuth from "../../hooks/useAuth";
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
    // noop
  }, [currentUser]);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      if (!content && images.length === 0) {
        throw new Error(t('composer.emptyError', 'Please enter content or choose an image'));
      }

      const imageUrls = await Promise.all(
        Array.from(images).map(img => imageToBase64(img))
      );

      const response = await postAPI.create({ content, imageUrls });
      if (response.success) {
        setContent('');
        setImages([]);
        if (onPosted) onPosted(response.data);
        return response.data;
      } else {
        throw new Error(response.message || 'Unable to create post');
      }
    } finally {
      setLoading(false);
    }
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
            <img key={idx} src={URL.createObjectURL(img)} className='h-20 rounded-md' alt='' />
          ))}
        </div>
      )}

      <div className='flex items-center justify-between mt-3'>
        <div className='flex items-center gap-4'>
          <label htmlFor='feed-images' className='flex items-center gap-2 text-sm text-gray-500 cursor-pointer hover:text-indigo-600'>
            <Image className='size-5' /> {t('composer.image', 'Image')}
          </label>
          <button 
            onClick={() => navigate('/livestreams')}
            className='flex items-center gap-2 text-sm text-gray-500 cursor-pointer hover:text-red-600'
          >
            <Video className='size-5' /> {t('composer.livestream', 'Livestream')}
          </button>
        </div>
        <input id='feed-images' type='file' hidden multiple accept='image/*' onChange={e => setImages(prev => [...prev, ...Array.from(e.target.files)])} />
  <button disabled={loading || (!content && images.length === 0)} onClick={() => toast.promise(handleSubmit(), { loading: t('composer.posting', 'Posting...'), success: t('composer.posted', 'Posted'), error: (err) => err?.message || t('composer.error', 'Error') })} className='bg-indigo-600 text-white px-4 py-1 rounded-md text-sm hover:bg-indigo-700'>{t('composer.postButton', 'Post')}</button>
      </div>
    </div>
  );
};

export default CreatePostCard;
