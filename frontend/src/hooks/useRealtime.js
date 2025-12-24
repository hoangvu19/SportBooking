import { useEffect, useRef } from 'react';
import { getSocket } from '../utils/socket';
import useAuth from './useAuth';
export default function useRealtime() {
  const { user } = useAuth();
  const socketRef = useRef(null);

  useEffect(() => {
    if (!user) return;

    try {
      const s = getSocket();
      if (!s) {
        console.debug('Realtime: socket not initialized (call initSocket at app start)');
        return;
      }
      socketRef.current = s;

      const forward = (eventName) => (payload) => {
        try {
          const socketId = s && s.id ? s.id : null;
          let safePayload;
          try { safePayload = JSON.parse(JSON.stringify(payload)); } catch { safePayload = payload; }
          console.debug(`🔔 Realtime: Received ${eventName} (socket:${socketId})`, safePayload);
        } catch (logErr) {
          console.debug('🔔 Realtime: logging error', logErr);
        }
        try {
          console.debug(`🔔 Realtime: Dispatching ${eventName} to window`);
          window.dispatchEvent(new CustomEvent(eventName, { detail: payload }));
        } catch (dispatchErr) {
          console.error('❌ Realtime: Failed to dispatch window event', eventName, dispatchErr);
        }
      };
      
      s.on('connect', () => { 
        console.log('✅ Realtime: Connected to server');
      });
      
      s.on('disconnect', (reason) => {
        console.log('❌ Realtime: Disconnected -', reason);
      });
      
      s.on('post:created', forward('post:created'));
      s.on('bookingpost:created', forward('bookingpost:created'));
      s.on('story:created', forward('story:created'));
      s.on('story:deleted', forward('story:deleted'));
      s.on('comment:created', forward('comment:created'));
      s.on('reaction:created', forward('reaction:created'));
      s.on('booking:created', forward('booking:created'));
      s.on('booking:cancelled', forward('booking:cancelled'));
      s.on('report:created', forward('report:created'));
  try { if (!s.connected) s.connect(); } catch { /* ignore connect errors */ }

      return () => {
        try {
          s.off('post:created');
          s.off('bookingpost:created');
          s.off('story:created');
          s.off('story:deleted');
          s.off('comment:created');
          s.off('reaction:created');
          s.off('booking:created');
          s.off('booking:cancelled');
          s.off('report:created');
  } catch { /* ignore */ }
      };
    } catch (err) {
      console.debug('Realtime init failed', err && err.message);
    }
  }, [user]);
}