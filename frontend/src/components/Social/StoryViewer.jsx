import { BadgeCheck, Eye, X, Trash2, ChevronLeft, ChevronRight, MoreHorizontal, Flag } from 'lucide-react'
import React, { useEffect, useState, useRef, useCallback } from 'react'
import { storyAPI } from "../../utils/api";
import useAuth from "../../hooks/useAuth";
import { toast } from 'react-hot-toast';
import { useI18n } from '../../i18n/hooks';
import { emitEvent } from '../../utils/socket';
import ReportModal from '../Shared/ReportModal';

const STORY_DURATION = 5000; // 5 seconds for image/text stories
const PROGRESS_INTERVAL = 100; // Update progress every 100ms
const MIN_SWIPE_DISTANCE = 50; // Minimum distance for swipe detection

const StoryViewer = ({ viewStory, setViewStory, stories = [], currentIndex = 0, setCurrentIndex, onStoryDeleted }) => {
  const { user } = useAuth();
  const { t } = useI18n();

  // Robust owner check: account for user id fields being named differently
  const getEntityId = (ent) => {
    if (!ent) return null;
    if (typeof ent === 'string') return ent;
    return ent._id ?? ent.id ?? ent.userId ?? null;
  };

  const currentUserId = getEntityId(user);
  const storyOwnerId = getEntityId(viewStory?.user ?? viewStory?.user_id ?? viewStory?.userId);
  const isOwnStory = Boolean(currentUserId && storyOwnerId && String(currentUserId) === String(storyOwnerId));

  // State
  const [progress, setProgress] = useState(0);
  const [viewCount, setViewCount] = useState(0);
  const [viewers, setViewers] = useState([]);
  const [showViewers, setShowViewers] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(currentIndex);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  // Refs
  const touchStart = useRef(null);
  const touchEnd = useRef(null);
  const progressTimer = useRef(null);
  const progressInterval = useRef(null);
  const menuRef = useRef(null);

  // Core functions
  const handleClose = useCallback(() => {
    console.debug('StoryViewer: handleClose called');
    setViewStory(null);
    if (setCurrentIndex) {
      setCurrentIndex(0);
    }
    setCurrentStoryIndex(0);
  }, [setViewStory, setCurrentIndex]);

  const handlePrevStory = useCallback(() => {
    if (!stories || stories.length <= 1) return;
    
    const newIndex = currentStoryIndex > 0 ? currentStoryIndex - 1 : stories.length - 1;
    setCurrentStoryIndex(newIndex);
    setViewStory(stories[newIndex]);
    if (setCurrentIndex) setCurrentIndex(newIndex);
    setProgress(0);
  }, [stories, currentStoryIndex, setCurrentIndex, setViewStory]);

  const handleNextStory = useCallback(() => {
    if (!stories || stories.length <= 1) return;
    
    const newIndex = currentStoryIndex < stories.length - 1 ? currentStoryIndex + 1 : 0;
    setCurrentStoryIndex(newIndex);
    setViewStory(stories[newIndex]);
    if (setCurrentIndex) setCurrentIndex(newIndex);
    setProgress(0);
  }, [stories, currentStoryIndex, setCurrentIndex, setViewStory]);

  const handleDelete = useCallback(async () => {
    if (!isOwnStory || !viewStory) return;

    try {
      const deletedId = viewStory._id;
      console.log('🗑️ StoryViewer: Deleting story:', deletedId);
      
      const response = await storyAPI.delete(deletedId);
      if (response.success) {
        toast.success(t('story.deleted'));
        console.log('✅ StoryViewer: Story deleted successfully');
        
        // PRIORITY 1: Update parent component immediately
        if (typeof onStoryDeleted === 'function') {
          console.log('✅ StoryViewer: Calling onStoryDeleted');
          onStoryDeleted(deletedId);
        }
        
        // PRIORITY 2: Dispatch local event for StoriesBar
        try {
          window.dispatchEvent(new CustomEvent('story:deleted', { 
            detail: { 
              story_id: deletedId,
              _id: deletedId 
            } 
          }));
          console.log('✅ StoryViewer: Dispatched story:deleted event');
        } catch (e) {
          console.error('Failed to dispatch story:deleted event', e);
        }
        
        // PRIORITY 3: Emit to server for other clients
        try {
          emitEvent('story:deleted', { 
            story_id: deletedId,
            _id: deletedId 
          });
          console.log('✅ StoryViewer: Emitted story:deleted to server');
        } catch (e) {
          console.debug('Could not emit story:deleted', e);
        }

        // Handle navigation after deletion
        const updatedStories = stories.filter(story => story._id !== deletedId);
        if (updatedStories.length === 0) {
          // If no stories left, close the viewer
          handleClose();
        } else {
          // If we're deleting the last story, go to the previous one
          const nextIndex = currentStoryIndex >= updatedStories.length ? updatedStories.length - 1 : currentStoryIndex;
          if (typeof setCurrentIndex === 'function') {
            setCurrentIndex(nextIndex);
          }
          setViewStory(updatedStories[nextIndex]);
          setCurrentStoryIndex(nextIndex);
          setProgress(0);
        }
      }
    } catch (error) {
      console.error('Error deleting story:', error);
      toast.error(t('story.deleteFailed'));
    }
  }, [isOwnStory, viewStory, stories, currentStoryIndex, setCurrentIndex, setViewStory, handleClose, onStoryDeleted, t]);

  // Progress management
  const startProgress = useCallback(() => {
    // Clear existing timers
    if (progressInterval.current) clearInterval(progressInterval.current);
    if (progressTimer.current) clearTimeout(progressTimer.current);

    // Don't start progress for videos
    if (!viewStory || viewStory.media_type === 'video') return;

    setProgress(0);
    let elapsed = 0;

    progressInterval.current = setInterval(() => {
      elapsed += PROGRESS_INTERVAL;
      setProgress((elapsed / STORY_DURATION) * 100);
    }, PROGRESS_INTERVAL);

    progressTimer.current = setTimeout(() => {
      handleNextStory();
    }, STORY_DURATION);
  }, [viewStory, handleNextStory]);

  // Touch gesture handlers
  const handleTouchStart = (e) => {
    if (!stories || stories.length <= 1) return;
    touchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
  };

  const handleTouchMove = (e) => {
    if (!touchStart.current) return;
    touchEnd.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };

    // Prevent vertical scroll when swiping horizontally
    if (touchStart.current && touchEnd.current) {
      const xDiff = Math.abs(touchStart.current.x - touchEnd.current.x);
      const yDiff = Math.abs(touchStart.current.y - touchEnd.current.y);
      if (xDiff > yDiff) e.preventDefault();
    }
  };

  const handleTouchEnd = () => {
    if (!touchStart.current || !touchEnd.current) return;

    const xDistance = touchStart.current.x - touchEnd.current.x;
    const yDistance = touchStart.current.y - touchEnd.current.y;
    
    // Only handle horizontal swipes (angle < 45 degrees)
    if (Math.abs(xDistance) > Math.abs(yDistance)) {
      const isLeftSwipe = xDistance > MIN_SWIPE_DISTANCE;
      const isRightSwipe = xDistance < -MIN_SWIPE_DISTANCE;

      if (isLeftSwipe && currentIndex < stories.length - 1) {
        handleNextStory();
      } else if (isRightSwipe && currentIndex > 0) {
        handlePrevStory();
      }
    }

    touchStart.current = null;
    touchEnd.current = null;
  };

  // API calls
  const fetchViewCount = useCallback(async () => {
    if (!viewStory) return;
    try {
      const response = await storyAPI.getViewCount(viewStory._id);
      if (response.success) {
        setViewCount(response.data.view_count);
      }
    } catch (error) {
      console.error('Error fetching view count:', error);
    }
  }, [viewStory]);

  const fetchViewers = async () => {
    if (!viewStory || !isOwnStory) return;
    try {
      const response = await storyAPI.getViewers(viewStory._id);
      if (response.success) {
        setViewers(response.data.viewers);
        setShowViewers(true);
      }
    } catch (error) {
      console.error('Error fetching viewers:', error);
    }
  };

  // Effects
  useEffect(() => {
    if (viewStory && user) {
      storyAPI.view(viewStory._id).catch(console.error);
      fetchViewCount();
      startProgress();
    }

    return () => {
      if (progressTimer.current) clearTimeout(progressTimer.current);
      if (progressInterval.current) clearInterval(progressInterval.current);
      setProgress(0);
    };
  }, [viewStory, user, fetchViewCount, startProgress]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!stories || stories.length <= 1) return;
      
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        handleNextStory();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevStory();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [stories, handleNextStory, handlePrevStory, handleClose]);

  // Close menu on outside click or Escape
  useEffect(() => {
    const onWindowDown = (ev) => {
      if (!showMenu) return;
      if (ev.key === 'Escape') { setShowMenu(false); return; }
      try {
        if (menuRef.current && !menuRef.current.contains(ev.target)) {
          setShowMenu(false);
        }
      } catch { setShowMenu(false); }
    };
    window.addEventListener('mousedown', onWindowDown);
    window.addEventListener('keydown', onWindowDown);
    return () => {
      window.removeEventListener('mousedown', onWindowDown);
      window.removeEventListener('keydown', onWindowDown);
    };
  }, [showMenu]);

  // Close the menu when switching to a different story
  useEffect(() => {
    setShowMenu(false);
  }, [viewStory]);

  if (!viewStory) return null;

  // (renderContent removed - content now rendered inline below to control pointer-events/z-index)

  return (
    <div
      className='fixed inset-0 h-screen bg-black bg-opacity-90 z-110 flex items-center justify-center'
      style={{ backgroundColor: viewStory.media_type === 'text' ? viewStory.background_color : '#000000' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={(e) => {
        // If user clicks on the backdrop (not on content or controls), close the viewer.
        if (e.target === e.currentTarget) {
          console.debug('Backdrop clicked - closing story');
          handleClose();
        }
      }}
    >
      {/* Story Navigation Indicators */}
      <div className="absolute top-2 w-full px-4 flex justify-center items-center gap-1">
        {stories.map((_, idx) => (
          <div
            key={idx}
            className={`h-0.5 flex-1 rounded-full transition-all duration-200 ${
              idx === currentStoryIndex ? 'bg-white' : 'bg-gray-600'
            } cursor-pointer`}
            onClick={() => {
              setCurrentStoryIndex(idx);
              setViewStory(stories[idx]);
              if (setCurrentIndex) setCurrentIndex(idx);
              setProgress(0);
            }}
          />
        ))}
      </div>

      {/* Progress Bar */}
      <div className='absolute top-4 left-0 w-full h-1 bg-gray-700'>
        <div 
          className='h-full bg-white transition-all duration-100 linear' 
          style={{ width: `${progress}%` }}
        />
      </div>
      
  {/* User Info - Top Left */}
  <div className='absolute top-4 left-4 flex items-center space-x-3 p-2 px-4 sm:px-8 backdrop-blur-2xl rounded bg-black/50' style={{ zIndex: 9999, pointerEvents: 'auto' }}>
        <img 
          src={viewStory.user?.profile_picture || viewStory.user?.AvatarUrl || viewStory.user?.ProfilePictureURL || viewStory.user?.avatarUrl || '/vite.svg'} 
          onError={(e) => { e.target.src = '/vite.svg'; }}
          alt="" 
          className="size-7 sm:size-8 rounded-full object-cover border border-white"
  />
        <div className='text-white font-medium flex items-center gap-1.5'>
          <span>{viewStory.user?.full_name}</span>
          <BadgeCheck size={18} />
        </div>
      </div>
      {stories && stories.length > 1 && (
        <>
          <div className="absolute inset-y-0 left-4 flex items-center" style={{ zIndex: 9999 }}>
            <button 
              onClick={handlePrevStory}
              className="p-2 backdrop-blur-2xl rounded-full bg-black/50 text-white cursor-pointer hover:bg-black/70 transition"
            >
              <ChevronLeft size={24} />
            </button>
          </div>
          <div className="absolute inset-y-0 right-4 flex items-center" style={{ zIndex: 9999 }}>
            <button 
              onClick={handleNextStory}
              className="p-2 backdrop-blur-2xl rounded-full bg-black/50 text-white cursor-pointer hover:bg-black/70 transition"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        </>
      )}

      {/* Story Content */}
      <div className='max-w-[90vw] max-h-[90vh] flex items-center justify-center' style={{ position: 'relative', zIndex: 1 }}>
        {/* Ensure media does not block top controls: images/text set pointerEvents none so controls above receive clicks. Videos keep pointerEvents auto to allow native controls, but controls still have higher z-index. */}
        {viewStory && viewStory.media_type === 'image' && (
          <img
            src={viewStory.media_url}
            alt="Story image"
            className="max-w-full max-h-screen object-contain"
            style={{ pointerEvents: 'none' }}
            onError={(e) => {
              console.error('Image failed to load:', viewStory.media_url);
              e.target.src = '/vite.svg';
            }}
          />
        )}
        {viewStory && viewStory.media_type === 'video' && (
          <video
            onEnded={handleNextStory}
            src={viewStory.media_url}
            className="max-w-full max-h-screen object-contain"
            controls
            autoPlay
            style={{ zIndex: 1, pointerEvents: 'auto' }}
            onError={() => {
              console.error('Video failed to load:', viewStory.media_url);
            }}
          />
        )}
        {viewStory && viewStory.media_type === 'text' && (
          <div className='w-full h-full items-center justify-center p-8 text-white text-2xl text-center' style={{ pointerEvents: 'none' }}>
            {viewStory.content}
          </div>
        )}
      </div>

        {/* Controls - Top Right (rendered after content so they sit above media and receive pointer events) */}
        <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 20000, pointerEvents: 'auto' }} className="flex items-center gap-2">
            {isOwnStory && (
            <div className='relative' ref={menuRef}>
              <button
                onClick={() => { console.debug('More button clicked'); setShowMenu(v => !v); }}
                aria-label="More actions"
                className="p-2 backdrop-blur-2xl rounded bg-black/50 text-white cursor-pointer hover:bg-black/70 transition"
                style={{ zIndex: 20001 }}
              >
                <MoreHorizontal size={18} />
              </button>
              {showMenu && (
                <div className='absolute right-0 mt-2 w-40 bg-white rounded shadow-lg overflow-hidden' style={{ zIndex: 20002 }}>
                  <button
                    onClick={async () => {
                      setShowMenu(false);
                      // Edit - currently backend has no update endpoint; inform user
                      if (viewStory && viewStory.media_type === 'text') {
                        try {
                          const newContent = window.prompt('Edit story content', viewStory.content || '');
                          if (newContent === null) return; // cancelled
                          // No backend update endpoint available; show informative message
                          toast(t('story.editNotSupported', 'Sửa story chưa được hỗ trợ trên server.'), { icon: 'ℹ️' });
                        } catch (e) { console.debug('Edit action failed', e); }
                      } else {
                        toast(t('story.editTextOnly', 'Chỉ hỗ trợ sửa story dạng text (hiện chưa hỗ trợ).'), { icon: 'ℹ️' });
                      }
                    }}
                    className='w-full text-left px-4 py-2 hover:bg-gray-100'
                  >{t('story.edit', 'Sửa')}</button>
                  <button
                    onClick={async () => {
                      setShowMenu(false);
                      // Confirm before delete
                      const ok = window.confirm(t('story.deleteConfirm'));
                      if (!ok) return;
                      try {
                        await handleDelete();
                      } catch (e) { console.error('Delete from menu failed', e); }
                    }}
                    className='w-full text-left px-4 py-2 text-red-600 hover:bg-gray-100'
                  >{t('story.delete', 'Xóa')}</button>
                </div>
              )}
            </div>
          )}
          {/* Report button for non-owners */}
          {!isOwnStory && (
            <button
              onClick={(e) => { e.stopPropagation(); setReportModalOpen(true); }}
              aria-label="Report story"
              className="p-2 backdrop-blur-2xl rounded bg-black/50 text-white cursor-pointer hover:bg-black/70 transition"
              style={{ zIndex: 20001 }}
            >
              <Flag size={18} />
            </button>
          )}
          {isOwnStory && (
            <>
              <div 
                className='flex items-center gap-2 p-2 px-4 backdrop-blur-2xl rounded bg-black/50 text-white cursor-pointer hover:bg-black/70 transition'
                onClick={fetchViewers}
              >
                <Eye size={18} />
                <span>{viewCount}</span>
              </div>
              <button 
                onClick={handleDelete}
                aria-label="Delete story"
                className="p-2 backdrop-blur-2xl rounded bg-black/50 text-white cursor-pointer hover:bg-black/70 transition"
                style={{ zIndex: 19999 }}
              >
                <Trash2 size={18} />
              </button>
            </>
          )}
          <button 
            onClick={handleClose}
            onMouseDown={() => { console.debug('Close button onMouseDown'); }}
            onTouchStart={() => { console.debug('Close button onTouchStart'); }}
            aria-label="Close story viewer"
            className="p-2 backdrop-blur-2xl rounded bg-black/50 text-white cursor-pointer hover:bg-black/70 transition"
            style={{ zIndex: 20000, pointerEvents: 'auto' }}
          >
            <X size={20} />
          </button>
        </div>

      {/* Viewers List Modal */}
      {showViewers && (
        <div className='absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-6 max-h-[60vh] overflow-y-auto' style={{ zIndex: 30000, pointerEvents: 'auto' }}>
          <div className='flex justify-between items-center mb-4'>
            <h3 className='text-xl font-bold'>{t('story.viewersTitle', 'Viewers')} ({viewers.length})</h3>
            <button 
              onClick={() => setShowViewers(false)} 
              className='text-gray-500 hover:text-gray-700'
            >
              <X size={24} />
            </button>
          </div>
          <div className='space-y-3'>
            {viewers.map((viewer, index) => (
              <div key={index} className='flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg'>
                <img 
                  src={viewer.viewer.profile_picture || viewer.viewer.AvatarUrl || viewer.viewer.ProfilePictureURL || viewer.viewer.avatarUrl || '/vite.svg'} 
                  onError={(e) => { e.target.src = '/vite.svg'; }}
                  alt={viewer.viewer.full_name}
                  className='size-10 rounded-full object-cover'
                />
                <div className='flex-1'>
                  <p className='font-medium'>{viewer.viewer.full_name}</p>
                  <p className='text-sm text-gray-500'>@{viewer.viewer.username}</p>
                </div>
                <span className='text-xs text-gray-400'>
                  {new Date(viewer.viewed_at).toLocaleTimeString('default', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Report modal for story */}
      <ReportModal
        visible={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        contentType="story"
        contentId={viewStory?._id}
        contentPreview={viewStory?.content || ''}
      />
    </div>
  );
};

export default StoryViewer;