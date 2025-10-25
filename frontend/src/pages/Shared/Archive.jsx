import React, { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/hooks';
import useAuth from '../../hooks/useAuth';
import { storyAPI } from '../../utils/api';
import StoryViewer from '../../components/Social/StoryViewer';
import moment from 'moment';
import DEFAULT_AVATAR from '../../utils/defaults';

const Archive = () => {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [stories, setStories] = useState([]);
  const [viewStory, setViewStory] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const { user } = useAuth();

  const getId = (obj) => obj && (obj._id || obj.id || obj.AccountID || obj.userId || obj.AccountId || null);

  const fetchArchived = async () => {
    try {
      setLoading(true);
      const res = await storyAPI.getArchived();
      const archivedAll = (res && res.success && res.data) ? (res.data.stories || []) : [];
      let userStories = [];
      if (user) {
        try {
          const myId = getId(user);
          const ures = await storyAPI.getUserStories(myId);
          if (ures && ures.success && ures.data) {
            userStories = ures.data.stories || ures.data || [];
          }
        } catch (ue) {
          console.error('Error fetching user stories', ue);
          userStories = [];
        }
      }

      // Filter archived stories to only those belonging to the current user (as requested)
      const myId = getId(user);
      const archivedMine = archivedAll.filter(s => myId && getId(s.user) === myId);

      // Merge userStories and archivedMine, dedupe by _id
      const mergedMap = new Map();
      // prefer the archived record when IDs clash
      [...userStories, ...archivedMine].forEach(s => {
        if (!s || !s._id) return;
        mergedMap.set(s._id, s);
      });

      const merged = Array.from(mergedMap.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setStories(merged);
    } catch (err) {
      console.error('Error fetching archived stories', err);
      setStories([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArchived();
  }, []);
  return (
    <div className="bg-white rounded-md p-6 shadow-sm">
      <h2 className="text-xl font-semibold mb-4">{t('menu.archive')}</h2>

      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          <div className="h-40 bg-gray-200 animate-pulse rounded" />
          <div className="h-40 bg-gray-200 animate-pulse rounded" />
          <div className="h-40 bg-gray-200 animate-pulse rounded" />
        </div>
      ) : stories.length === 0 ? (
        <p className="text-sm text-gray-700">{t('archive.empty', 'No archived stories')}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {stories.map((story, idx) => (
            <div
              key={story._id}
              className="relative rounded-lg shadow cursor-pointer overflow-hidden bg-gray-800"
              onClick={() => {
                setViewStory(story);
                setCurrentIndex(idx);
              }}
            >
              <img
                src={story.user?.profile_picture || story.user?.AvatarUrl || story.user?.ProfilePictureURL || story.user?.avatarUrl || DEFAULT_AVATAR}
                alt=""
                className="absolute top-3 left-3 z-10 rounded-full w-10 h-10 object-cover border border-white"
                onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_AVATAR; }}
              />

              <div className="h-40 w-full bg-black/40 flex items-end">
                {story.media_type !== 'text' ? (
                  story.media_type === 'image' ? (
                    <img src={story.media_url} alt="" className="w-full h-full object-cover opacity-80" />
                  ) : (
                    <video src={story.media_url} className="w-full h-full object-cover opacity-80" />
                  )
                ) : (
                  <div className="w-full h-full flex items-center justify-center p-4 text-white text-center">{story.content}</div>
                )}
              </div>
              <div className="absolute bottom-2 left-2 text-white text-xs">
                <div className="font-medium">{story.user?.full_name}</div>
                <div className="text-[11px] opacity-80">{moment(story.createdAt).fromNow()}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewStory && (
        <StoryViewer
          viewStory={viewStory}
          setViewStory={(v) => {
            setViewStory(v);
            if (!v) fetchArchived();
          }}
          stories={stories}
          currentIndex={currentIndex}
          setCurrentIndex={setCurrentIndex}
          onStoryDeleted={async (deletedId) => {
            // remove locally and refresh
            setStories(prev => prev.filter(s => s._id !== deletedId));
            await fetchArchived();
          }}
        />
      )}
    </div>
  );
};

export default Archive;
