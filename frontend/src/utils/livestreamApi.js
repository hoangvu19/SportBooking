/**
 * Livestream API
 * Handles livestream-related operations
 */

import { API_BASE_URL } from '../config/apiConfig';

// Livestream API base URL — use API_BASE_URL directly; endpoints in this file include the '/livestreams' segment
const LIVESTREAM_API_BASE_URL = API_BASE_URL;

/**
 * Get auth token from localStorage
 */
const getAuthToken = () => {
  return localStorage.getItem('authToken');
};

/**
 * Generic API call handler for livestreams
 */
const apiCall = async (endpoint, options = {}) => {
  const url = `${LIVESTREAM_API_BASE_URL}${endpoint}`;
  const token = getAuthToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'API call failed');
    }

    return data;
  } catch (error) {
    console.error('Livestream API Error:', error);
    throw error;
  }
};

export const livestreamAPI = {
  /**
   * Get all active livestreams
   */
  listActive: async (limit = 20) => {
    return apiCall(`/livestreams/active?limit=${limit}`);
  },

  /**
   * Create new livestream
   */
  create: async (payload) => {
    return apiCall('/livestreams', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Get livestream by ID
   */
  getById: async (id) => {
    return apiCall(`/livestreams/${id}`);
  },

  /**
   * End livestream
   */
  end: async (id) => {
    return apiCall(`/livestreams/${id}/end`, {
      method: 'PUT',
    });
  },

  /**
   * Add comment to livestream
   */
  addComment: async (livestreamId, text) => {
    return apiCall(`/livestreams/${livestreamId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  },

  /**
   * Get comments for livestream
   */
  getComments: async (livestreamId) => {
    return apiCall(`/livestreams/${livestreamId}/comments`);
  },
};

export default livestreamAPI;
