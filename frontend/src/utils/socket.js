import { io } from 'socket.io-client';
import { API_BASE_URL } from '../config/apiConfig';

let socket = null;
const getSocketServerUrl = () => {
  // API_BASE_URL is http://localhost:5000/api, we need http://localhost:5000
  return API_BASE_URL.replace('/api', '');
};
export const initSocket = () => {
  if (socket) return socket;

  const token = localStorage.getItem('authToken');
  if (!token) {
    console.warn('No auth token found, Socket.io connection not initialized');
    return null;
  }

  const serverUrl = getSocketServerUrl();
  console.log('🔌 Connecting to Socket.io server:', `${serverUrl}/realtime`);

  // Connect to /realtime namespace
  socket = io(`${serverUrl}/realtime`, {
    auth: {
      token: token
    },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5
  });

  socket.on('connect', () => {
    console.log('✅ Socket.io connected:', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ Socket.io disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('Socket.io connection error:', error);
  });

  return socket;
};
export const getSocket = () => {
  if (!socket) {
    return initSocket();
  }
  return socket;
};
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    console.log('Socket.io disconnected');
  }
};
export const emitEvent = (eventName, data) => {
  if (socket && socket.connected) {
    socket.emit(eventName, data);
  } else {
    console.warn('Socket not connected, cannot emit event:', eventName);
  }
};
export const onEvent = (eventName, callback) => {
  if (socket) {
    socket.on(eventName, callback);
  }
};

export const offEvent = (eventName, callback) => {
  if (socket) {
    socket.off(eventName, callback);
  }
};

export default {
  initSocket,
  getSocket,
  disconnectSocket,
  emitEvent,
  onEvent,
  offEvent
};
