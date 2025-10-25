import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useI18n } from '../i18n/hooks';
import { io } from 'socket.io-client';
import livestreamApi from '../utils/livestreamApi';

const ICE_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

export default function useLivestream(user) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peersRef = useRef({});
  const pcRef = useRef(null);
  const socketRef = useRef(null);

  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const isBroadcastingRef = useRef(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [chosenSignalBase, setChosenSignalBase] = useState(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugEvents, setDebugEvents] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [liveError, setLiveError] = useState(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const commentsRef = useRef(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [flyingGift, setFlyingGift] = useState(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const isNearBottomRef = useRef(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [likes, setLikes] = useState(0);
  const [forceBroadcaster, setForceBroadcaster] = useState(false);
  const { t } = useI18n();
  const [isSelectedRoomEphemeral, setIsSelectedRoomEphemeral] = useState(false);
  const persistedBroadcastRef = useRef(null);
  const startBroadcastRef = useRef(null);

  // expose refs + state
  const api = {
    refs: { localVideoRef, remoteVideoRef, commentsRef },
    state: {
      isBroadcasting, socketConnected, chosenSignalBase, debugOpen, debugEvents,
      selectedRoomId, liveError, isStarting, isEnding, comments, commentText,
      showEmoji, flyingGift, isNearBottom, unreadCount, likes, forceBroadcaster,
      isSelectedRoomEphemeral
    },
    setters: {
      setDebugOpen, setCommentText, setShowEmoji, setForceBroadcaster,
      setIsNearBottom, setUnreadCount, setFlyingGift
    }
  };

  // WebRTC + signaling setup moved here (kept similar to original)
  useEffect(() => {
    let mounted = true;
    function checkLocalStream() {
      try {
        const local = window.__localStream || (localVideoRef.current && localVideoRef.current.srcObject);
        if (!mounted) return;
        if (local) {
          setIsBroadcasting(true);
          isBroadcastingRef.current = true;
        } else {
          setIsBroadcasting(false);
          isBroadcastingRef.current = false;
        }
    } catch (e) { console.debug('checkLocalStream error', e); }
    }
    checkLocalStream();
    const id = setInterval(checkLocalStream, 800);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  useEffect(() => {
    const envUrl = (import.meta.env && import.meta.env.VITE_SIGNALING_URL) ? import.meta.env.VITE_SIGNALING_URL.replace(/\/$/, '') : null;
    const defaultBase = envUrl || `${window.location.protocol}//${window.location.hostname}${window.location.port ? `:${window.location.port}` : ''}`;
    let mounted = true;

    async function tryConnectOnce(base) {
      if (!mounted) return false;
      try {
        const socket = io(`${base}/webrtc`, { path: '/socket.io', autoConnect: false });
        socket.on('connect', () => {
          setSocketConnected(true);
          setDebugEvents(d => [{ ts: Date.now(), event: 'connect', id: socket.id }, ...d].slice(0, 50));
        });
        socket.on('disconnect', () => { setSocketConnected(false); setDebugEvents(d => [{ ts: Date.now(), event: 'disconnect' }, ...d].slice(0, 50)); });

        socket.on('offer', async ({ from, sdp }) => {
          try {
            // ensure any existing pc for this peer is closed before creating a new one
            if (peersRef.current[from]) { try { peersRef.current[from].close(); } catch { /* ignore */ } }
            const pc = new RTCPeerConnection(ICE_CONFIG);
            peersRef.current[from] = pc;
            pc.ontrack = (ev) => {
              try {
                if (remoteVideoRef.current) remoteVideoRef.current.srcObject = ev.streams[0];
                // try to start playback when tracks arrive
                tryPlayVideo(remoteVideoRef.current).then(ok => { if (!ok) console.debug('remote play failed after offer answer'); });
              } catch (err) { console.debug('ontrack attach failed', err); }
            };
            // send local ICE candidates back to broadcaster
            pc.onicecandidate = (e) => { if (e.candidate && socketRef.current) socketRef.current.emit('candidate', { to: from, candidate: e.candidate }); };
            pc.onconnectionstatechange = () => { setDebugEvents(d => [{ ts: Date.now(), event: 'pc-connstate', from, state: pc.connectionState }, ...d].slice(0,50)); };
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('answer', { to: from, sdp: pc.localDescription });
            setDebugEvents(d => [{ ts: Date.now(), event: 'offer', from }, ...d].slice(0, 50));
          } catch (e) {
            setDebugEvents(d => [{ ts: Date.now(), event: 'offer-failed', err: String(e) }, ...d].slice(0, 50));
          }
        });
        socket.on('answer', async ({ from, sdp }) => { try { const pc = peersRef.current[from] || pcRef.current; if (pc) await pc.setRemoteDescription(new RTCSessionDescription(sdp)); setDebugEvents(d => [{ ts: Date.now(), event: 'answer', from }, ...d].slice(0, 50)); } catch (e) { setDebugEvents(d => [{ ts: Date.now(), event: 'answer-failed', err: String(e) }, ...d].slice(0, 50)); } });
        socket.on('candidate', async ({ from, candidate }) => { try { const pc = peersRef.current[from] || pcRef.current; if (pc && candidate) await pc.addIceCandidate(candidate); setDebugEvents(d => [{ ts: Date.now(), event: 'candidate', from }, ...d].slice(0, 50)); } catch (e) { setDebugEvents(d => [{ ts: Date.now(), event: 'candidate-failed', err: String(e) }, ...d].slice(0, 50)); } });
        socket.on('peer-joined', async ({ id, role }) => { setDebugEvents(d => [{ ts: Date.now(), event: 'peer-joined', id, role }, ...d].slice(0, 50)); if (isBroadcastingRef.current && socket.id) createOfferForPeer(id); });
        socket.on('request-offer', ({ from }) => {
          // broadcaster should create offer for requesting viewer
          try {
            if (isBroadcastingRef.current && from) {
              createOfferForPeer(from);
              setDebugEvents(d => [{ ts: Date.now(), event: 'request-offer', from }, ...d].slice(0, 50));
            }
          } catch (e) { console.debug('request-offer handling failed', e); }
        });
        socket.on('peer-left', ({ id }) => { const pc = peersRef.current[id]; setDebugEvents(d => [{ ts: Date.now(), event: 'peer-left', id }, ...d].slice(0, 50)); if (pc) { pc.close(); delete peersRef.current[id]; } });
        socket.on('livestream-comment', (msg) => { try { const item = (msg && msg.comment) ? msg.comment : msg; setComments(prev => { const next = [...prev, item]; if (isNearBottomRef.current) { setTimeout(() => { if (commentsRef.current) commentsRef.current.scrollTop = commentsRef.current.scrollHeight; }, 50); } else { setUnreadCount(c => c + 1); } return next; }); } catch (e) { setDebugEvents(d => [{ ts: Date.now(), event: 'comment-failed', err: String(e) }, ...d].slice(0, 50)); } });
        socket.on('livestream-gift', (msg) => { try { const gift = (msg && msg.gift) ? msg.gift : msg; setFlyingGift(gift); } catch (e) { setDebugEvents(d => [{ ts: Date.now(), event: 'gift-failed', err: String(e) }, ...d].slice(0, 50)); } });
  socket.on('livestream-like', () => { try { setLikes(l => l + 1); } catch (e) { setDebugEvents(d => [{ ts: Date.now(), event: 'like-failed', err: String(e) }, ...d].slice(0, 50)); } });

        socket.on('livestream-ended', (msg) => {
          try {
            setDebugEvents(d => [{ ts: Date.now(), event: 'livestream-ended', msg }, ...d].slice(0, 50));
            if (String(msg && (msg.LivestreamID || msg.roomId)) === String(selectedRoomId)) {
              try { if (window.__localStream) { window.__localStream.getTracks().forEach(t => t.stop()); window.__localStream = null; } } catch (e) { console.debug('stop local stream error', e); }
              setIsBroadcasting(false);
              isBroadcastingRef.current = false;
              setLiveError(null);
            }
          } catch (e) { console.debug('livestream-ended handler error', e); }
        });

        const connected = await new Promise((resolve) => {
          let settled = false;
          const onConnect = () => { if (!settled) { settled = true; resolve(true); } };
          const onError = () => { if (!settled) { settled = true; resolve(false); } };
          const to = setTimeout(() => { socket.off('connect', onConnect); socket.off('error', onError); resolve(false); }, 3000);
          socket.once('connect', () => { clearTimeout(to); socket.off('error', onError); onConnect(); });
          socket.once('error', () => { clearTimeout(to); socket.off('connect', onConnect); onError(); });
          socket.connect();
        });

        if (connected) {
          socketRef.current = socket;
          setChosenSignalBase(base);
          return true;
        }
  try { socket && socket.close && socket.close(); } catch (err) { console.debug('socket close failed', err); }
        return false;
      } catch (e) { console.debug('Signaling attempt fatal error', e); return false; }
    }

    (async () => {
      const ok = await tryConnectOnce(defaultBase);
      if (!ok && defaultBase !== 'http://localhost:5000') {
        await tryConnectOnce('http://localhost:5000');
      }
      setSocketConnected(Boolean(socketRef.current && socketRef.current.connected));
    })();

    return () => { mounted = false; if (socketRef.current && socketRef.current.disconnect) socketRef.current.disconnect(); };
  }, [selectedRoomId]);

  // localStorage helpers for persisting broadcaster session across reloads
  function persistBroadcast(room) {
    try {
      const payload = { roomId: String(room), ts: Date.now() };
      localStorage.setItem('livestream:activeBroadcaster', JSON.stringify(payload));
      persistedBroadcastRef.current = payload;
    } catch (e) { console.debug('persistBroadcast failed', e); }
  }

  function clearPersistedBroadcast() {
    try { localStorage.removeItem('livestream:activeBroadcaster'); persistedBroadcastRef.current = null; } catch (e) { console.debug('clearPersistedBroadcast failed', e); }
  }

  // on mount, read persisted broadcaster flag (in case of hard reload)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('livestream:activeBroadcaster');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.roomId) persistedBroadcastRef.current = parsed;
      }
    } catch (e) { console.debug('read persisted broadcast failed', e); }
  }, []);

  // if we detect a persisted broadcaster session and signaling is connected, auto-restore
  useEffect(() => {
    const persisted = persistedBroadcastRef.current;
    if (!persisted) return;
    if (!socketRef.current || !socketRef.current.connected) return;
    if (isBroadcastingRef.current) return; // already broadcasting
    // attempt to restore broadcaster session using the persisted roomId
    (async () => {
      try {
        if (startBroadcastRef.current) await startBroadcastRef.current(persisted.roomId);
        // persistBroadcast will be called inside startBroadcast again
      } catch (e) { console.debug('restore broadcast failed', e); }
    })();
  }, [socketConnected]);

  // helper to attempt video play with retries (handles autoplay policies)
  async function tryPlayVideo(el) {
    if (!el) return;
    const max = 4;
    for (let i = 0; i < max; i++) {
      try {
        // small delay on retries
        if (i > 0) await new Promise(r => setTimeout(r, 200 * i));
        await el.play();
        return true;
      } catch (e) {
        // continue and retry
        console.debug('video play attempt failed', i, e);
      }
    }
    return false;
  }

  async function startBroadcast(roomId) {
    setLiveError(null);
    if (!socketRef.current) return setLiveError('Signaling not initialized');
    setIsStarting(true);
    if (!socketRef.current.connected) {
      try {
        await new Promise((resolve, reject) => {
          const s = socketRef.current;
          const to = setTimeout(() => { s.off('connect', resolve); reject(new Error('connect timeout')); }, 5000);
          s.once('connect', () => { clearTimeout(to); resolve(); });
        });
  } catch (e) { console.debug('socket connect wait failed', e); setIsStarting(false); return setLiveError('Unable to connect to signaling server'); }
    }
    try {
      let room = roomId;
      if (!room) {
        try {
          const created = await livestreamApi.create({ title: `${user?.FullName || user?.Username || t('livestream.liveDefaultName')}'s stream` });
          const payload = created && created.data ? created.data : created;
          if (payload && payload.LivestreamID) {
            room = String(payload.LivestreamID);
          }
  } catch (e) { console.debug('Could not create livestream before broadcasting', e); }
      }
      if (!room) {
        if (socketRef.current && socketRef.current.id) {
          room = socketRef.current.id;
          setIsSelectedRoomEphemeral(true);
        }
      }
      if (room) {
        setSelectedRoomId(room);
        const numeric = /^[0-9]+$/.test(String(room));
        setIsSelectedRoomEphemeral(!numeric);
      }

      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (localVideoRef.current) {
        localVideoRef.current.muted = true;
        try {
          localVideoRef.current.srcObject = stream;
        } catch (e) { console.debug('assign local srcObject failed', e); }
        try { await tryPlayVideo(localVideoRef.current); } catch (playErr) { console.debug('local preview play failed', playErr); }
      }
      socketRef.current.emit('join-room', { roomId: room, role: 'broadcaster' });
      window.__localStream = stream;
      setIsBroadcasting(true);
      isBroadcastingRef.current = true;
  try { persistBroadcast(room); } catch (e) { console.debug('persist on start failed', e); }
      setIsStarting(false);
      setDebugEvents(d => [{ ts: Date.now(), event: 'started-broadcast', room }, ...d].slice(0, 50));
    } catch (err) { console.error('getUserMedia failed', err); setLiveError('Unable to access camera/microphone'); setIsStarting(false); }
  }

  // expose startBroadcast via ref to avoid missing-deps in restore effect
  startBroadcastRef.current = startBroadcast;

  async function stopBroadcast() {
    try {
      const stream = window.__localStream;
      if (stream) { stream.getTracks().forEach(t => t.stop()); window.__localStream = null; }
  Object.values(peersRef.current).forEach(pc => { try { pc.close(); } catch (e) { console.debug('pc close failed', e); } });
      peersRef.current = {};
      if (socketRef.current && socketRef.current.emit) socketRef.current.emit('leave-room', { roomId: selectedRoomId });
      setIsBroadcasting(false);
      isBroadcastingRef.current = false;
  try { if (typeof window !== 'undefined' && window.history && typeof window.history.pushState === 'function') { window.history.pushState({}, '', window.location.pathname + window.location.search + window.location.hash); } } catch (e) { console.debug('history pushState failed', e); }

      if (selectedRoomId && !isSelectedRoomEphemeral) {
        if (isEnding) return;
        setIsEnding(true);
  try { await livestreamApi.end(selectedRoomId); } catch (e) { console.debug('end API call failed', e); } finally { setIsEnding(false); }
      }

      setSelectedRoomId(null);
      setForceBroadcaster(false);
      setLikes(0);
      setComments([]);
      setFlyingGift(null);
      setIsSelectedRoomEphemeral(false);
    try { clearPersistedBroadcast(); } catch (e) { console.debug('clear persisted failed', e); }
  try { if (localVideoRef.current) localVideoRef.current.srcObject = null; } catch (e) { console.debug('clear local video failed', e); }
  try { if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null; } catch (e) { console.debug('clear remote video failed', e); }
      setLiveError(null);
  } catch (err) { console.debug('Signaling init error', err); }
  }

  function createOfferForPeer(peerId) {
    try {
      const localStream = window.__localStream;
      if (!localStream) return;
      if (!socketRef.current) return;
      const pc = new RTCPeerConnection(ICE_CONFIG);
      peersRef.current[peerId] = pc;
      localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
      pc.onicecandidate = (e) => { if (e.candidate && socketRef.current) socketRef.current.emit('candidate', { to: peerId, candidate: e.candidate }); };
      pc.onconnectionstatechange = () => { setDebugEvents(d => [{ ts: Date.now(), event: 'broadcaster-pc-connstate', peerId, state: pc.connectionState }, ...d].slice(0,50)); };
  pc.createOffer().then(async (offer) => { await pc.setLocalDescription(offer); socketRef.current.emit('offer', { to: peerId, sdp: pc.localDescription }); }).catch(e => { console.debug('createOffer failed', e); });
  } catch (e) { console.debug('createOfferForPeer error', e); }
  }

  function sendComment() {
    if (!commentText || !selectedRoomId) return;
    const payload = { content: commentText };
    if (!isSelectedRoomEphemeral && /^[0-9]+$/.test(String(selectedRoomId))) {
      livestreamApi.createComment(selectedRoomId, payload).then((saved) => {
        const savedComment = saved && saved.data ? saved.data : saved;
        const emitPayload = { roomId: String(selectedRoomId), comment: savedComment };
        if (socketRef.current && socketRef.current.emit) socketRef.current.emit('livestream-comment', emitPayload);
        setComments(prev => {
          const next = [...prev, savedComment];
          if (isNearBottom) {
            setTimeout(() => { if (commentsRef.current) commentsRef.current.scrollTop = commentsRef.current.scrollHeight; }, 50);
          } else { setUnreadCount(c => c + 1); }
          return next;
        });
        setCommentText('');
      }).catch(err => { console.debug('Failed to save comment', err); toast.error(t('livestream.commentSaveFailed')); });
  } else {
      const fakeSaved = { Content: commentText, CreatedDate: new Date().toISOString(), Author: { FullName: user?.FullName || user?.Username } };
      const emitPayload = { roomId: String(selectedRoomId), comment: fakeSaved };
      if (socketRef.current && socketRef.current.emit) socketRef.current.emit('livestream-comment', emitPayload);
      setComments(prev => {
        const next = [...prev, fakeSaved];
        if (isNearBottom) { setTimeout(() => { if (commentsRef.current) commentsRef.current.scrollTop = commentsRef.current.scrollHeight; }, 50); } else { setUnreadCount(c => c + 1); }
        return next;
      });
      setCommentText('');
    }
  }

  function sendGift(gift) {
    if (!selectedRoomId) return;
    setFlyingGift(gift);
  try { if (socketRef.current && socketRef.current.emit) socketRef.current.emit('livestream-gift', { roomId: String(selectedRoomId), gift }); } catch (e) { console.debug('emit gift failed', e); }
  }

  function sendLike() {
    setLikes(l => l + 1);
  try { if (socketRef.current && socketRef.current.emit) socketRef.current.emit('livestream-like', { roomId: String(selectedRoomId) }); } catch (e) { console.debug('emit like failed', e); }
  }

  useEffect(() => {
    let mounted = true;
    if (!selectedRoomId) return;
    if (!isSelectedRoomEphemeral && /^[0-9]+$/.test(String(selectedRoomId))) {
      livestreamApi.listComments(selectedRoomId).then(res => {
        if (!mounted) return;
        const list = (res && res.data && Array.isArray(res.data.comments)) ? res.data.comments : (res && res.comments ? res.comments : []);
        setComments(list);
        setTimeout(() => { if (commentsRef.current) { commentsRef.current.scrollTop = commentsRef.current.scrollHeight; setIsNearBottom(true); setUnreadCount(0); } }, 50);
      }).catch(e => { console.debug('load comments failed', e); });
    } else {
      setComments([]);
      setUnreadCount(0);
    }
    return () => { mounted = false; };
  }, [selectedRoomId, isSelectedRoomEphemeral]);

  // Auto-join as viewer when a roomId is selected and we're not broadcasting
  useEffect(() => {
    if (!selectedRoomId) return;
    if (isBroadcasting) return; // broadcaster shouldn't join as viewer
    if (!socketRef.current || !socketRef.current.connected) return;
    try {
      const room = String(selectedRoomId);
      socketRef.current.emit('join-room', { roomId: room, role: 'viewer' });
      // ask broadcaster(s) to create an offer for us
  try { socketRef.current.emit('request-offer', { roomId: room, from: socketRef.current.id }); } catch (err) { console.debug('emit request-offer failed', err); }
      setDebugEvents(d => [{ ts: Date.now(), event: 'join-room-viewer', room }, ...d].slice(0, 50));
      const numeric = /^[0-9]+$/.test(String(room));
      setIsSelectedRoomEphemeral(!numeric);
    } catch (e) { console.debug('join as viewer failed', e); }
  }, [selectedRoomId, socketConnected, isBroadcasting]);

  // attach remote stream playback when pcRef or remoteVideoRef changes (safe attach)
  useEffect(() => {
    // Attach remote ontrack handler once; use refs inside effect to avoid invalid deps
    const el = remoteVideoRef.current;
    const pc = pcRef.current;
    if (!el) return undefined;
    try {
      if (pc) {
        pc.ontrack = (ev) => {
          try { el.srcObject = ev.streams[0]; } catch (e) { console.debug('assign remote srcObject failed', e); }
          tryPlayVideo(el).then(ok => { if (!ok) console.debug('remote video play failed after retries'); });
        };
      }
    } catch (e) { console.debug('setup remote attach failed', e); }
  return () => { try { if (pc && pc.ontrack) pc.ontrack = null; } catch { /* ignore */ } };
  }, []);

  return {
    api,
    startBroadcast,
    stopBroadcast,
    createOfferForPeer,
    // viewer can explicitly request broadcaster create an offer for us
    requestOffer: (room) => {
      try {
        const r = room || selectedRoomId;
        if (!r || !socketRef.current) return;
        socketRef.current.emit('request-offer', { roomId: String(r), from: socketRef.current.id });
        setDebugEvents(d => [{ ts: Date.now(), event: 'manual-request-offer', room: r }, ...d].slice(0, 50));
      } catch (e) { console.debug('requestOffer failed', e); }
    },
    sendComment,
    sendGift,
    sendLike,
    setSelectedRoomId,
    setIsSelectedRoomEphemeral,
    setLiveError,
  };
}
