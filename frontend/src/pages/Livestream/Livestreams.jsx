import React, { useEffect, useState, useRef } from 'react';
import livestreamApi from "../../utils/livestreamApi";
import useAuth from "../../hooks/useAuth";
import { useSearchParams } from 'react-router-dom';
import './livestreams.css';
import DEFAULT_AVATAR from '../../utils/defaults';

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

  // Load existing stream or create new
  useEffect(() => {
    if (roomId) {
      loadStream(roomId);
    } else if (user) {
      // Check if user has active stream
      checkUserStream();
    }
    setLoading(false);
  }, [roomId, user]);

  async function loadStream(id) {
    try {
      const result = await livestreamApi.getById(id);
      const streamData = result.success ? result.data : result;
      setStream(streamData);
      setTitle(streamData.Title || '');
      // Mock viewers
      setViewers([
        { id: 1, name: 'Người xem 1', avatar: DEFAULT_AVATAR },
        { id: 2, name: 'Người xem 2', avatar: DEFAULT_AVATAR }
      ]);
    } catch (err) {
      console.error('Load stream error:', err);
    }
  }

  async function checkUserStream() {
    try {
      const result = await livestreamApi.listActive();
      const streams = result.success ? result.data : result;
      const myStream = Array.isArray(streams) ? streams.find(s => s.AccountID === user.AccountID) : null;
      if (myStream) {
        setStream(myStream);
        setIsStreaming(true);
      }
    } catch (err) {
      console.error('Check user stream error:', err);
    }
  }

  async function handleStartStream() {
    if (!title.trim()) {
      alert('Vui lòng nhập tiêu đề livestream');
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
      alert('❌ Không thể bắt đầu livestream: ' + (err?.message || 'Vui lòng cho phép truy cập camera/mic'));
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
      author: user?.FullName || user?.Username || 'Ẩn danh',
      avatar: user?.AvatarUrl || DEFAULT_AVATAR,
      content: newComment,
      time: new Date().toLocaleTimeString('vi-VN')
    };
    
    setComments(prev => [...prev, comment]);
    setNewComment('');
  }

  if (loading) {
    return <div className="p-6">Đang tải...</div>;
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
              <div className='live-badge'>LIVE</div>
              <span className='streamer-name'>{stream?.Title || title || 'Chưa có tiêu đề'}</span>
            </div>
            <div className='viewer-pill'>
              <span>👁</span>
              <span>{viewers.length} đang xem</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right sidebar - Comments and viewers */}
      <div className='ls-right'>
        <div className='right-header'>
          <h3 className='font-bold'>Bình luận</h3>
          <span className='text-sm text-gray-400'>{viewers.length} đang xem</span>
        </div>

        {/* Comments list */}
        <div className='comments-list'>
          {comments.length === 0 ? (
            <div className='text-center text-gray-500 py-8'>Không có bình luận</div>
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
            placeholder='Nhập bình luận...'
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleSendComment()}
          />
          <button 
            onClick={handleSendComment}
            className='bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700'
          >
            Gửi
          </button>
        </div>

        {/* Control buttons */}
        {user && (
          <div className='mt-4 space-y-2'>
            {!isStreaming ? (
              <>
                <input
                  type='text'
                  placeholder='Nhập tiêu đề livestream...'
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className='w-full px-3 py-2 border rounded-lg'
                />
                <button
                  onClick={handleStartStream}
                  className='w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 font-bold'
                >
                  🔴 Bắt đầu phát trực tiếp
                </button>
              </>
            ) : (
              <button
                onClick={handleStopStream}
                className='w-full bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700'
              >
                ⏹ Dừng phát
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
