import React from 'react';
import DEFAULT_AVATAR from '../../utils/defaults';

export default function LiveRoomCard({ room, onClick, onView }) {
  const title = room.Title || room.title || `Live #${room.LivestreamID || room.id}`;
  const cover = room.CoverUrl || room.coverUrl || room.Thumbnail || '';
  const viewers = room.ViewerCount ?? room.viewerCount ?? 0;
  const host = room.Author || room.Host || {};

  return (
    <div className='live-room-card' onClick={onClick} style={{cursor:'pointer'}}>
      <div className='live-room-thumb' style={{backgroundImage: `url(${cover})`, backgroundSize:'cover', backgroundPosition:'center', borderRadius:10, height:160}}>
        <div style={{position:'absolute',left:12,top:12}}>
          <div style={{background:'#ff3b5c',color:'#fff',padding:'6px 8px',borderRadius:8,fontWeight:700}}>LIVE</div>
        </div>
        <div style={{position:'absolute',right:12,top:12,background:'rgba(0,0,0,0.4)',padding:'6px 8px',borderRadius:8,color:'#fff'}}>
          👁 {viewers}
        </div>
      </div>
      <div style={{marginTop:8,display:'flex',alignItems:'center',gap:10,justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <img src={host.AvatarUrl || DEFAULT_AVATAR} style={{width:40,height:40,borderRadius:'50%'}} />
          <div>
            <div style={{fontWeight:700}}>{host.FullName || host.Username || title}</div>
            <div style={{color:'#9aa3b2',fontSize:13}}>{title}</div>
          </div>
        </div>
        <div>
          {room.IsActive ? (
            <button onClick={(e) => { e.stopPropagation(); if (onView) onView(room); }} className='px-4 py-2 bg-pink-500 text-white rounded-lg'>View</button>
          ) : (
            <div style={{padding:'6px 10px',background:'#333',color:'#fff',borderRadius:8}}>Offline</div>
          )}
        </div>
      </div>
    </div>
  );
}
