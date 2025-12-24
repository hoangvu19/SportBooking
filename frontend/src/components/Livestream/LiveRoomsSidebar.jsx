import React, { useEffect, useState } from 'react';
import livestreamApi from '../../utils/livestreamApi';
import DEFAULT_AVATAR from '../../utils/defaults';
import { useNavigate } from 'react-router-dom';

export default function LiveRoomsSidebar({ max = 4 }) {
  const [rooms, setRooms] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await livestreamApi.listActive(max);
        const data = res && res.data ? res.data : res;
        const list = Array.isArray(data) ? data : (data.data || []);
        if (!mounted) return;
        // dedupe by LivestreamID or id
        const seen = new Set();
        const unique = [];
        (list || []).forEach(r => {
          const key = String(r.LivestreamID || r.id || r.Title || JSON.stringify(r));
          if (!seen.has(key)) { seen.add(key); unique.push(r); }
        });
        setRooms(unique.slice(0, max));
      } catch (e) {
        console.debug('load sidebar live rooms failed', e);
      }
    })();
    return () => { mounted = false; };
  }, [max]);

  if (!rooms || rooms.length === 0) return null;

  return (
    <div className='px-6 py-4'>
      <div style={{fontSize:12,color:'#6b7280',fontWeight:700,marginBottom:8}}>Live rooms</div>
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {rooms.map((r, i) => (
          <div key={i} style={{display:'flex',gap:8,alignItems:'center',cursor:'pointer'}} onClick={() => navigate(`/livestreams?roomId=${r.LivestreamID || r.id}`)}>
            <div style={{width:44,height:36,borderRadius:8,overflow:'hidden',background:'#111',flexShrink:0}}>
              {r.Thumbnail ? <img src={r.Thumbnail} style={{width:'100%',height:'100%',objectFit:'cover'}}/> : <div style={{width:'100%',height:'100%',background:'#111'}} />}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:700,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{r.Title || r.Title || `Live ${r.LivestreamID || ''}`}</div>
              <div style={{fontSize:12,color:'#9aa3b2'}}>{r.Author?.FullName || r.Host?.FullName || 'Host'}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
