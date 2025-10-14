/**
 * Simple signaling server using socket.io
 * Events:
 * - join-room: { roomId, role: 'broadcaster'|'viewer' }
 * - offer: { to, sdp }
 * - answer: { to, sdp }
 * - candidate: { to, candidate }
 */
function init(io) {
  const namespace = io.of('/webrtc');
  // set namespace for emitter
  try {
    const emitter = require('./signalingEmitter');
    emitter.setNamespace(namespace);
  } catch (e) { /* ignore */ }

  namespace.on('connection', (socket) => {
    console.log('Signal: client connected', socket.id);

    socket.on('join-room', ({ roomId, role }) => {
      socket.join(roomId);
      socket.data.role = role;
      socket.data.roomId = roomId;
      console.log(`Signal: ${socket.id} joined ${roomId} as ${role}`);
      // Notify others
      socket.to(roomId).emit('peer-joined', { id: socket.id, role });
    });

    socket.on('offer', (payload) => {
      const { to, sdp } = payload;
      if (to) namespace.to(to).emit('offer', { from: socket.id, sdp });
    });

    socket.on('answer', (payload) => {
      const { to, sdp } = payload;
      if (to) namespace.to(to).emit('answer', { from: socket.id, sdp });
    });

    socket.on('candidate', (payload) => {
      const { to, candidate } = payload;
      if (to) namespace.to(to).emit('candidate', { from: socket.id, candidate });
    });

    // Livestream comment relay: broadcast comment to everyone in the room
    socket.on('livestream-comment', (payload) => {
      const { roomId, comment } = payload || {};
      if (!roomId || !comment) return;
      // include sender id and timestamp
      const message = { from: socket.id, comment, createdAt: new Date() };
      namespace.to(roomId).emit('livestream-comment', message);
    });

    // Viewer can request broadcaster to create an offer for them (relay)
    socket.on('request-offer', (payload) => {
      const { roomId, from } = payload || {};
      if (!roomId || !from) return;
      namespace.to(roomId).emit('request-offer', { from });
    });

    // Livestream gift relay: broadcast gift to everyone in the room
    socket.on('livestream-gift', (payload) => {
      const { roomId, gift } = payload || {};
      if (!roomId || !gift) return;
      const message = { from: socket.id, gift, createdAt: new Date() };
      namespace.to(roomId).emit('livestream-gift', message);
    });

    // Livestream like relay: broadcast like event to everyone in the room
    socket.on('livestream-like', (payload) => {
      const { roomId } = payload || {};
      if (!roomId) return;
      const message = { from: socket.id, createdAt: new Date() };
      namespace.to(roomId).emit('livestream-like', message);
    });

    socket.on('disconnect', (reason) => {
      const { roomId } = socket.data || {};
      if (roomId) socket.to(roomId).emit('peer-left', { id: socket.id });
      console.log('Signal: client disconnected', socket.id, reason);
    });
  });
}

module.exports = { init };
