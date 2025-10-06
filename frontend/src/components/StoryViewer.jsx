import { BadgeCheck, Eye, X } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { storyAPI } from '../utils/api';
import { useAuth } from '../hooks/useAuth';

const StoryViewer = ({ viewStory, setViewStory }) => {

   const [progress, setProgress] = useState(0);
   const [viewCount, setViewCount] = useState(0);
   const [viewers, setViewers] = useState([]);
   const [showViewers, setShowViewers] = useState(false);
   const { user } = useAuth();
   const isOwnStory = user && viewStory && user._id === viewStory.user?._id;

   useEffect(() => {
    let timer, progressInterval;

    if(viewStory && viewStory.media_type !== 'video') {
        setProgress(0);

        const duration = 10000;
        const setTime = 100;
        let elapsed = 0;

        progressInterval = setInterval(() => {
            elapsed += setTime;
            setProgress((elapsed / duration) * 100);
        }, setTime);
        
        timer = setTimeout(() => {
            setViewStory(null);
        }, duration);
    }

    // Track view when story is opened
    if (viewStory && user) {
        storyAPI.view(viewStory._id).catch(console.error);
        fetchViewCount();
    }

    return () => {
        clearTimeout(timer);
        clearInterval(progressInterval);
        setProgress(0);
    }
   }, [viewStory, setViewStory, user]);

   const fetchViewCount = async () => {
      if (!viewStory) return;
      try {
         const response = await storyAPI.getViewCount(viewStory._id);
         if (response.success) {
            setViewCount(response.data.view_count);
         }
      } catch (error) {
         console.error('Error fetching view count:', error);
      }
   };

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

   useEffect(() => {
    let timer, progressInterval;

    if(viewStory && viewStory.media_type !== 'video') {
        setProgress(0);

        const duration = 10000;
        const setTime = 100;
        let elapsed = 0;

        progressInterval = setInterval(() => {
            elapsed += setTime;
            setProgress((elapsed / duration) * 100);
        }, setTime);
        
        timer = setTimeout(() => {
            setViewStory(null);
        }, duration);
    }

    // Track view when story is opened
    if (viewStory && user) {
        storyAPI.view(viewStory._id).catch(console.error);
        fetchViewCount();
    }

    return () => {
        clearTimeout(timer);
        clearInterval(progressInterval);
        setProgress(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [viewStory, setViewStory, user]);
    
  const handleClose = () => {
    setViewStory(null);
  };

  if(!viewStory) return null;


  const renderContent = () => {
    console.log('Story data:', viewStory);
    console.log('Media URL:', viewStory.media_url);
    console.log('Media Type:', viewStory.media_type);
    
    switch(viewStory.media_type) {
      case 'image':
        return (
          <img 
            src={viewStory.media_url} 
            alt="Story image" 
            className="max-w-full max-h-screen object-contain"
            onError={(e) => {
              console.error('Image failed to load:', viewStory.media_url);
              e.target.src = '/vite.svg'; // Fallback image
            }}
          />
        );
      case 'video':
        return (
          <video 
            onEnded={() => setViewStory(null)} 
            src={viewStory.media_url}  
            className="max-w-full max-h-screen object-contain" 
            controls 
            autoPlay
            onError={() => {
              console.error('Video failed to load:', viewStory.media_url);
            }}
          />
        );
      case 'text':
        return(
            <div className='w-full h-full items-center justify-center p-8 text-white text-2xl text-center'  >
                {
                    viewStory.content
                }
            </div>
        )
      default:
        return null;
    }
  };

  return (
    <div
      className='fixed inset-0 h-screen bg-black bg-opacity-90 z-110 flex items-center justify-center'
      style={{ backgroundColor: viewStory.media_type === 'text' ? viewStory.background_color : '#000000' }}
    >
      {/* Progress Bar */}
      <div className='absolute top-0 left-0 w-full h-1 bg-gray-700'>
        <div className='h-full bg-white transition-all duration-100 linear' style={{ width: `${progress}%` }}></div>
      </div>
      
      {/* User Info - Top Left */}
      <div className='absolute top-4 left-4 flex items-center space-x-3 p-2 px-4 sm:px-8 backdrop-blur-2xl rounded bg-black/50'>
        <img src={viewStory.user?.profile_picture} alt="" className="size-7 sm:size-8 rounded-full object-cover border border-white"/>
        <div className='text-white font-medium flex items-center gap-1.5'>
          <span>{viewStory.user?.full_name}</span>
          <BadgeCheck size={18} />
        </div>
      </div>

      {/* View Count - Top Right */}
      {isOwnStory && (
        <div 
          className='absolute top-4 right-16 flex items-center gap-2 p-2 px-4 backdrop-blur-2xl rounded bg-black/50 text-white cursor-pointer hover:bg-black/70 transition'
          onClick={fetchViewers}
        >
          <Eye size={18} />
          <span>{viewCount}</span>
        </div>
      )}
      
      {/* Close Button */}
      <button onClick={handleClose} className="absolute top-4 right-4 text-white text-3xl font-bold focus:outline-none">
        <X className="w-8 h-8 hover:scale-110 transition cursor-pointer" />
      </button>

      {/* Story Content */}
      <div className='max-w-[90vw] max-h-[90vh] flex items-center justify-center'>
        {renderContent()}
      </div>

      {/* Viewers List Modal */}
      {showViewers && (
        <div className='absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-6 max-h-[60vh] overflow-y-auto'>
          <div className='flex justify-between items-center mb-4'>
            <h3 className='text-xl font-bold'>Người xem ({viewers.length})</h3>
            <button onClick={() => setShowViewers(false)} className='text-gray-500 hover:text-gray-700'>
              <X size={24} />
            </button>
          </div>
          <div className='space-y-3'>
            {viewers.map((viewer, index) => (
              <div key={index} className='flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg'>
                <img 
                  src={viewer.viewer.profile_picture} 
                  alt={viewer.viewer.full_name}
                  className='size-10 rounded-full object-cover'
                />
                <div className='flex-1'>
                  <p className='font-medium'>{viewer.viewer.full_name}</p>
                  <p className='text-sm text-gray-500'>@{viewer.viewer.username}</p>
                </div>
                <span className='text-xs text-gray-400'>
                  {new Date(viewer.viewed_at).toLocaleTimeString('vi-VN', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StoryViewer;