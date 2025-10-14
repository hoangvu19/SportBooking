import React from 'react';
import * as Icons from 'lucide-react';

export default function LiveVideo({ localVideoRef, remoteVideoRef, user, isBroadcasting, isStarting, socketConnected, onGoLive, onStop, forceBroadcaster, setForceBroadcaster, children }) {
  return (
    <div className="ls-video-panel">
      {/* render both video elements so refs exist; show/hide via inline style to avoid mount timing issues */}
      <video
        ref={localVideoRef}
        autoPlay
        muted
        playsInline
        className="ls-video"
        style={{ display: isBroadcasting ? 'block' : 'none' }}
      />
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className="ls-video"
        style={{ display: isBroadcasting ? 'none' : 'block' }}
      />
      <div className="ls-overlay-top">
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <div className="live-badge">LIVE</div>
          <div className='streamer-name'>{user?.FullName || user?.Username || 'Bạn'}</div>
        </div>
        <div style={{marginTop:6,fontSize:12,color: socketConnected ? '#b7ffd2' : '#ffd2d2'}}>{socketConnected ? 'Signaling: connected' : 'Signaling: disconnected'}</div>
        <div style={{marginTop:6,fontSize:12,display:'flex',gap:8}}>
          <button onClick={() => {}} style={{background:'transparent',border:'1px solid rgba(255,255,255,0.06)',color:'#cbd5e1',padding:'6px 8px',borderRadius:8}}>Debug</button>
          {!isBroadcasting ? (
            <>
              <button onClick={onGoLive} style={{background:'#10b981',borderRadius:8,padding:'6px 8px',color:'#fff'}}>{isStarting ? 'Starting...' : 'Go Live'}</button>
              <button onClick={() => setForceBroadcaster(s => !s)} style={{background: forceBroadcaster ? '#f97316' : 'transparent', borderRadius:8,padding:'6px 8px',color:'#fff',border:'1px solid rgba(255,255,255,0.06)'}}>{forceBroadcaster ? 'Broadcaster (forced)' : 'Force Broadcaster'}</button>
            </>
          ) : (
            <button onClick={onStop} style={{background:'#ef4444',borderRadius:8,padding:'6px 8px',color:'#fff'}}>Stop Live</button>
          )}
        </div>
      </div>

      {/* bottom overlay to contain gifts and other controls passed as children */}
      <div className="ls-overlay-bottom">
        <div className="controls-left">
          {children}
        </div>
        <div className="controls-right">
          {/* future right-side controls */}
        </div>
      </div>
    </div>
  );
}
