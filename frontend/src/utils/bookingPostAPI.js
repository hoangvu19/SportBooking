/**
 * Booking Post API
 * API calls cho tính năng "Booking Post" - bài đăng sau khi đặt sân
 */

import { API_BASE_URL } from '../config/apiConfig';

const getAuthToken = () => localStorage.getItem('authToken');

// Simple in-memory short-lived cache for booking posts keyed by postId
const bookingPostCache = new Map(); // postId -> { expires: Date, data: any }
const CACHE_TTL_MS = 5 * 1000; // 5 seconds

const apiCall = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getAuthToken();

  const isFormData = options.body instanceof FormData;
  const defaultHeaders = {};

  if (!isFormData) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  if (token && !options.skipAuth) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  const response = await fetch(url, config);
  let data = null;

  try {
    data = await response.json();
  } catch {
    console.debug('No JSON response for', endpoint);
  }

  if (!response.ok) {
    const err = new Error(
      data?.message || `API call failed with status ${response.status}`
    );
    err.response = data;
    throw err;
  }

  return data;
};

/**
 * Booking Post API endpoints
 */
export const bookingPostAPI = {
  /**
   * Tạo booking post sau khi đặt sân và thanh toán cọc
   * @param {Object} data - { bookingId, content, maxPlayers, imageUrls }
   */
  create: async (data) => {
    return apiCall('/booking-posts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Lấy booking posts theo môn thể thao
   * @param {number} sportTypeId 
   * @param {Object} params - { page, limit }
   */
  getBySportType: async (sportTypeId, params = {}) => {
    const queryParams = new URLSearchParams({
      page: params.page || 1,
      limit: params.limit || 20,
    }).toString();
    return apiCall(`/booking-posts/sport-type/${sportTypeId}?${queryParams}`);
  },

  /**
   * Lấy tất cả booking posts
   * @param {Object} params - { page, limit }
   */
  getAll: async (params = {}) => {
    const queryParams = new URLSearchParams({
      page: params.page || 1,
      limit: params.limit || 20,
    }).toString();
    return apiCall(`/booking-posts?${queryParams}`);
  },

  /**
   * Lấy thông tin chi tiết booking post
   * @param {number} postId 
   */
  getById: async (postId) => {
    if (!postId) throw new Error('postId required');
    const key = String(postId);
    const now = Date.now();
    const cached = bookingPostCache.get(key);
    if (cached && cached.expires > now) {
      return cached.data;
    }

    const data = await apiCall(`/booking-posts/${postId}`);
    try {
      bookingPostCache.set(key, { expires: now + CACHE_TTL_MS, data });
      // schedule cleanup just after expiry to avoid memory growth
      setTimeout(() => {
        const cur = bookingPostCache.get(key);
        if (cur && cur.expires <= Date.now()) bookingPostCache.delete(key);
      }, CACHE_TTL_MS + 50);
    } catch {
      // ignore cache set failures in restricted environments
    }

    return data;
  },

  /**
   * Thêm người chơi từ comment (chỉ owner)
   * @param {number} postId 
   * @param {number} playerId 
   */
  addPlayer: async (postId, playerId) => {
    return apiCall(`/booking-posts/${postId}/add-player`, {
      method: 'POST',
      body: JSON.stringify({ playerId }),
    });
  },

  /**
   * Chấp nhận lời mời tham gia
   * @param {number} postId 
   */
  acceptInvitation: async (postId) => {
    return apiCall(`/booking-posts/${postId}/accept`, {
      method: 'POST',
    });
  },

  /**
   * Từ chối lời mời tham gia
   * @param {number} postId 
   */
  rejectInvitation: async (postId) => {
    return apiCall(`/booking-posts/${postId}/reject`, {
      method: 'POST',
    });
  },

  /**
   * Lấy danh sách người chơi của post
   * @param {number} postId 
   */
  getPlayers: async (postId) => {
    return apiCall(`/booking-posts/${postId}/players`);
  },

  /**
   * Lấy lời mời của user hiện tại
   */
  getMyInvitations: async () => {
    return apiCall('/booking-posts/my-invitations');
  },
};

export default bookingPostAPI;
