import React, { useEffect, useState } from 'react';
import livestreamApi from "../../utils/livestreamApi";
import Loading from "../../components/Shared/Loading";
import { useNavigate } from 'react-router-dom';
import DEFAULT_AVATAR from '../../utils/defaults';
import '../Livestream/livestreams.css';

export default function LiveRooms() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const res = await livestreamApi.listActive(36);
        const data = res && res.data ? res.data : res;
        const list = Array.isArray(data) ? data : (data.data || []);
        if (!mounted) return;
        // dedupe by id
        const seen = new Set();
        const unique = [];
        (list || []).forEach(r => {
          const key = String(r.LivestreamID || r.id || r.Title || JSON.stringify(r));
          if (!seen.has(key)) { seen.add(key); unique.push(r); }
        });
        setRooms(unique || []);
      } catch (e) { console.debug('load rooms failed', e); setRooms([]); }
      finally { setLoading(false); }
    })();
    return () => { mounted = false; };
  }, []);

  if (loading) return <Loading />;

  return (
    <div className='livestream-container p-6'>
      <div className='max-w-7xl mx-auto'>
        <h2 className='text-3xl font-bold mb-6 bg-gradient-to-r from-pink-500 to-red-500 bg-clip-text text-transparent'>
          🔴 Live Now
        </h2>
        
        {rooms.length === 0 ? (
          <div className='no-streams'>
            <p className='text-xl font-semibold mb-2'>Không có livestream nào</p>
            <p className='text-sm'>Hãy là người đầu tiên bắt đầu phát sóng!</p>
          </div>
        ) : (
          <div className='streams-grid grid grid-cols-1 gap-5'>
            {rooms.map(r => {
              const title = r.Title || r.title || `Live ${r.LivestreamID || r.id}`;
              const cover = r.Thumbnail || r.CoverUrl || '';
              const host = r.Author || r.Host || {};
              return (
                <div key={r.LivestreamID || r.id} className='stream-card'>
                  <div className='stream-thumbnail'>
                    {cover && (
                      <img 
                        src={cover} 
                        alt={title}
                        className='stream-thumbnail-image'
                      />
                    )}
                    <div className='absolute top-3 left-3'>
                      <span className='live-badge'>LIVE</span>
                    </div>
                    <div className='viewer-count'>
                      <span>👁</span>
                      <span>{r.ViewerCount ?? r.viewerCount ?? 0}</span>
                    </div>
                  </div>
                  <div className='stream-info'>
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center gap-3 flex-1'>
                        <img 
                          src={host.AvatarUrl || DEFAULT_AVATAR} 
                          alt={host.FullName || host.Username}
                          className='stream-avatar'
                        />
                        <div className='flex-1 min-w-0'>
                          <div className='stream-title'>{title}</div>
                          <div className='stream-host'>{host.FullName || host.Username || 'Unknown'}</div>
                        </div>
                      </div>
                      <button 
                        onClick={() => navigate(`/livestreams?roomId=${r.LivestreamID || r.id}`)} 
                        className='view-btn'
                      >
                        Xem
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
