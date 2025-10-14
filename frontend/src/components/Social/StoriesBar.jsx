import React ,{useEffect,useState}from 'react'
import DEFAULT_AVATAR from "../../utils/defaults";
import { Plus } from 'lucide-react';
import moment from 'moment';
import StoryModel from './StoryModel';
import StoryViewer from './StoryViewer';
import { storyAPI } from "../../utils/api";

const StoriesBar =() => {

    const [stories, setStories] = useState([])
    const [showModal, setShowModal] = useState(false)
    const [viewStory, setViewStory] = useState(null)
    const [currentIndex, setCurrentIndex] = useState(0)
    const [loading, setLoading] = useState(true)

    const fetchStories = async () => {
        try {
            setLoading(true);
            const response = await storyAPI.getActive();
            if (response.success && response.data) {
                setStories(response.data.stories || []);
            }
        } catch (error) {
            console.error('Error fetching stories:', error);
            setStories([]);
        } finally {
            setLoading(false);
        }
    }
    
    useEffect(() => {
        fetchStories();
    }, []);
    
    if (loading) {
        return (
            <div className='w-full no-scrollbar overflow-x-auto px-4'>
                <div className='flex gap-4 pb-5'>
                    <div className='rounded-lg shadow-sm min-w-30 max-w-30 max-h-40 aspect-[3/4] bg-gray-200 animate-pulse'></div>
                    <div className='rounded-lg shadow-sm min-w-30 max-w-30 max-h-40 aspect-[3/4] bg-gray-200 animate-pulse'></div>
                    <div className='rounded-lg shadow-sm min-w-30 max-w-30 max-h-40 aspect-[3/4] bg-gray-200 animate-pulse'></div>
                </div>
            </div>
        );
    }
    
    return (
        // Use full width within the parent container instead of viewport width to avoid horizontal overflow
        <div className='w-full no-scrollbar overflow-x-auto px-4'>
            <div className='flex gap-4 pb-5'>
                {/* Add Story Card */}
                <div data-testid="create-story-card" onClick={() => setShowModal(true)} className='rounded-lg shadow-sm min-w-30 max-w-30 max-h-40 aspect-[3/4] cursor-pointer hover:shadow-lg transition-all duration-200 border-2 border-dashed border-indigo-300 bg-gradient-to-b from-indigo-50 to-white'>
                    <div className='h-full flex flex-col items-center justify-center p-4'>
                        <div className='size-10 bg-indigo-500 rounded-full flex items-center justify-center mb-3'>
                            <Plus className='w-5 h-5 text-white' />
                        </div>
                        <p className='text-sm font-medium text-gray-700 text-center'>Create Story</p>
                    </div>
                </div>
                {/* Story Cards */}
                {
                    stories.map((story, index) => (
                        <div 
                            onClick={() => {
                                setViewStory(story);
                                setCurrentIndex(index);
                            }} 
                            key={story._id} 
                            className={`relative rounded-lg shadow min-w-30 max-w-30 max-h-40 cursor-pointer hover:shadow-lg transition-all duration-200 bg-gradient-to-b from-indigo-500 to-purple-600 hover:from-indigo-700 hover:to-purple-800 active:scale-95`}
                        >
                            <img src={story.user?.profile_picture || story.user?.AvatarUrl || story.user?.ProfilePictureURL || story.user?.avatarUrl || DEFAULT_AVATAR} onError={(e)=>{ e.target.onerror = null; e.target.src = DEFAULT_AVATAR }} alt="" className='absolute size-8 top-3 left-3 z-10 rounded-full ring ring-gray-100 shadow' />
                            <p className='absolute top-18 left-3 text-white/60 text-sm truncate max-w-24'>{story.content}</p>
                            <p className='text-white absolute bottom-1 right-2 z-10 text-xs'>{moment(story.createdAt).fromNow()}</p>
                            {story.media_type !== "text" && (
                                <div className='absolute inset-0 z-1 rounded-lg bg-black overflow-hidden'>
                                    {
                                        story.media_type === "image" ? (
                                            <img
                                                src={story.media_url}
                                                alt=""
                                                className="h-full w-full object-cover hover:scale-110 transition duration-500 opacity-70 hover:opacity-80"
                                            />
                                        ) : (
                                            <video
                                                src={story.media_url}
                                                className="h-full w-full object-cover hover:scale-110 transition duration-500 opacity-70 hover:opacity-80"
                                            />
                                        )
                                    }
                                </div>
                            )}
                        </div>
                    ))
                }
            </div>
            {
                showModal && <StoryModel setShowModal={setShowModal} fetchStories={fetchStories} />
            }
            {
                viewStory && (
                    <StoryViewer 
                        viewStory={viewStory} 
                        setViewStory={setViewStory}
                        stories={stories}
                        currentIndex={currentIndex}
                        setCurrentIndex={setCurrentIndex}
                        onStoryDeleted={async (deletedStoryId) => {
                            // Remove the deleted story from local state
                            setStories(prevStories => prevStories.filter(story => story._id !== deletedStoryId));
                            
                            // Fetch fresh stories to ensure sync
                            await fetchStories();
                        }}
                    />
                )
            }
        </div>
    )
}
export default StoriesBar