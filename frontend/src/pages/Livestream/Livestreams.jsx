import React, { useEffect, useState, useRef, useCallback } from 'react';
import livestreamApi from "../../utils/livestreamApi";
import useAuth from "../../hooks/useAuth";
import { useSearchParams } from 'react-router-dom';
import './livestreams.css';
import DEFAULT_AVATAR from '../../utils/defaults';
import { useI18n } from '../../i18n/hooks';
import toast from 'react-hot-toast';

export default function Livestreams() {
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get('roomId');
  
  const [stream, setStream] = useState(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [viewers, setViewers] = useState([]);
  const { user } = useAuth();
  const videoRef = useRef(null);
  const localStreamRef = useRef(null);

  const checkUserStream = useCallback(async () => {
    try {
      const result = await livestreamApi.listActive();
      const streams = result.success ? result.data : result;
      const myStream = Array.isArray(streams) ? streams.find(s => s.AccountID === user?.AccountID) : null;
      if (myStream) {
        setStream(myStream);
        setIsStreaming(true);
      }
    } catch (err) {
      console.error('Check user stream error:', err);
    }
  }, [user]);

  // Load existing stream or create new
  useEffect(() => {
    if (roomId) {
      loadStream(roomId);
    } else if (user) {
      // Check if user has active stream
      checkUserStream();
    }
    setLoading(false);
  }, [roomId, user, checkUserStream]);

  const { t } = useI18n();

  async function loadStream(id) {
    try {
  const result = await livestreamApi.getById(id);
      const streamData = result.success ? result.data : result;
      setStream(streamData);
  setTitle(streamData.Title || '');
      // Mock viewers
      setViewers([
          { id: 1, name: 'Viewer 1', avatar: DEFAULT_AVATAR },
          { id: 2, name: 'Viewer 2', avatar: DEFAULT_AVATAR }
        ]);
    } catch (err) {
      console.error('Load stream error:', err);
    }
  }

  async function handleStartStream() {
    if (!title.trim()) {
      toast.error(t('livestream.enterTitle'));
      return;
    }

    try {
      // Get user media
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      localStreamRef.current = mediaStream;

      // Create livestream record
      const payload = { 
        title: title.trim(),
        embedUrl: '' // Can add stream URL later
      };
      const result = await livestreamApi.create(payload);
      const created = result.success ? result.data : result;
      
      setStream(created);
      setIsStreaming(true);
      setViewers([]);
    } catch (err) {
      console.error('Start stream error:', err);
      toast.error(t('livestream.startError').replace('{msg}', err?.message || 'Please allow camera/microphone access'));
    }
  }

  async function handleStopStream() {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    // End livestream
    if (stream) {
      try {
        await livestreamApi.end(stream.LivestreamID);
      } catch (err) {
        console.error('End stream error:', err);
      }
    }
    
    setIsStreaming(false);
    setStream(null);
    setTitle('');
  }

  async function handleSendComment() {
    if (!newComment.trim()) return;
    
    const comment = {
      id: Date.now(),
      author: user?.FullName || user?.Username || 'Anonymous',
      avatar: user?.AvatarUrl || DEFAULT_AVATAR,
      content: newComment,
      time: new Date().toLocaleTimeString()
    };
    
    setComments(prev => [...prev, comment]);
    setNewComment('');
  }

  if (loading) {
    return <div className="p-6">{t('common.loading')}</div>;
  }

  return (
    <div className='livestream-wrap'>
      {/* Main video area */}
      <div className='ls-center'>
        <div className='ls-video-panel'>
          {/* Video player */}
          <video 
            ref={videoRef}
            className='ls-video' 
            autoPlay 
            playsInline 
            muted={isStreaming} // Mute own stream to prevent feedback
          />
          
          {/* Top overlay */}
            <div className='ls-overlay-top'>
            <div className='flex items-center gap-2'>
              <div className='live-badge'>{t('livestream.liveBadge')}</div>
              <span className='streamer-name'>{stream?.Title || title || t('livestream.noTitle')}</span>
            </div>
            <div className='viewer-pill'>
              <span>👁</span>
              <span>{t('livestream.viewers').replace('{count}', String(viewers.length))}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right sidebar - Comments and viewers */}
      <div className='ls-right'>
        <div className='right-header'>
          <h3 className='font-bold'>{t('livestream.comments')}</h3>
          <span className='text-sm text-gray-400'>{t('livestream.viewers').replace('{count}', String(viewers.length))}</span>
        </div>

        {/* Comments list */}
        <div className='comments-list'>
          {comments.length === 0 ? (
            <div className='text-center text-gray-500 py-8'>{t('chat.noComments')}</div>
          ) : (
            comments.map(comment => (
              <div key={comment.id} className='comment-item'>
                <img src={comment.avatar} alt={comment.author} className='comment-avatar' />
                <div className='flex-1'>
                  <div className='comment-author'>{comment.author}</div>
                  <div className='comment-bubble'>{comment.content}</div>
                  <div className='text-xs text-gray-500 mt-1'>{comment.time}</div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Comment input */}
        <div className='comment-input'>
            <input
                type='text'
                placeholder={t('chat.placeholder')}
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleSendComment()}
              />
          <button 
            onClick={handleSendComment}
            className='bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700'
          >
            {t('livestream.send')}
          </button>
        </div>

        {/* Control buttons */}
        {user && (
          <div className='mt-4 space-y-2'>
            {!isStreaming ? (
              <>
                <input
                  type='text'
                  placeholder={t('livestream.enterTitle')}
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className='w-full px-3 py-2 border rounded-lg'
                />
                <button
                  onClick={handleStartStream}
                  className='w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 font-bold'
                >
                  {t('livestream.startButton')}
                </button>
              </>
            ) : (
              <button
                onClick={handleStopStream}
                className='w-full bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700'
              >
                {t('livestream.stopButton')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
