// ==================== NOTIFICATION APIs ====================
export const notificationAPI = {
    /**
     * Get notifications for current user
     */
    getAll: async () => {
        return apiCall('/notifications');
    },
    /**
     * Mark all notifications as read
     */
    markAllRead: async () => {
        return apiCall('/notifications/read-all', { method: 'POST' });
    },
};
/**
 * Centralized API Handler
 * Handles all API calls với error handling và loading states
 */

import { API_BASE_URL } from '../config/apiConfig';

// Simple in-memory cache for GET requests to avoid repeated identical calls
const GET_CACHE_TTL = 5000; // ms
const getCache = new Map(); // key -> { ts, data }
const inflightRequests = new Map(); // key -> Promise

/**
 * Get auth token from localStorage
 */
const getAuthToken = () => {
    return localStorage.getItem('authToken');
};

// ==================== CLIENT-SIDE COOLDOWN / THROTTLING ====================
// Prevent rapid duplicate requests from the same client (e.g., double-clicking like/share)
const CLIENT_THROTTLE = {
    like: 3000,   // 3s
    share: 3000,  // 3s
    comment: 5000 // 5s (for create comment)
};

// Map key -> timestamp(ms) of last call
const lastCallAt = new Map();

const callWithCooldown = async (key, cooldownMs, fn) => {
    const now = Date.now();
    const last = lastCallAt.get(key) || 0;
    if (now - last < cooldownMs) {
        console.debug('Client throttle active for', key);
        // Return a normalized failure object that callers already expect from API (safe to handle)
        return { success: false, message: 'Too many requests (client cooldown)' };
    }
    lastCallAt.set(key, now);
    try {
        const res = await fn();
        return res;
    } catch (err) {
        // On error, allow immediate retry by clearing the timestamp
        try {
            lastCallAt.delete(key);
        } catch (deleteErr) {
            console.debug('Error clearing cooldown key', deleteErr);
        }
        throw err;
    }
};

/**
 * Generic API call handler
 */
const apiCall = async (endpoint, options = {}) => {

    const url = `${API_BASE_URL}${endpoint}`;
    const token = getAuthToken();

    // Don't set Content-Type for FormData - browser will set it with boundary
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

    try {
        const method = (config.method || 'GET').toUpperCase();

        // For GET requests, check cache first
        const cacheKey = `${method}::${endpoint}`;
        if (method === 'GET') {
            const cached = getCache.get(cacheKey);
            if (cached && (Date.now() - cached.ts) < GET_CACHE_TTL) {
                console.debug('🌐 API Cache hit:', endpoint);
                return cached.data;
            }

            // If identical request is in-flight, return the same promise
            if (inflightRequests.has(cacheKey)) {
                console.debug('🌐 Reusing in-flight request for', endpoint);
                return await inflightRequests.get(cacheKey);
            }
        }

        console.log(`🌐 API Call: ${method} ${endpoint}`);
        const fetchPromise = fetch(url, config);
        if (method === 'GET') inflightRequests.set(cacheKey, fetchPromise);
        const response = await fetchPromise;
        if (method === 'GET') inflightRequests.delete(cacheKey);
        // Attempt to parse JSON (safe-guard: if no JSON, set to null)
        let data = null;
        try {
            data = await response.json();
        } catch {
            console.debug('No JSON response for', endpoint);
        }

        // Log status and payload for debugging
        console.log(`⤺ API Response: ${response.status} ${endpoint}`, data);

        if (!response.ok) {
            // Attach response body to Error for richer debugging in callers
            const err = new Error((data && data.message) ? data.message : `API call failed with status ${response.status}`);
            err.status = response.status;
            err.response = data;
            console.error(`❌ API Error: ${endpoint}`, { status: response.status, body: data });
            throw err;
        }

        console.log(`✅ API Success: ${endpoint}`, data);
        if (method === 'GET') {
            try { getCache.set(cacheKey, { ts: Date.now(), data }); } catch { /* ignore cache errors */ }
        }
        return data;
    } catch (error) {
        console.error(`❌ API Error: ${endpoint}`, error);

        // Centralized handling for authentication expiry / unauthorized responses
        try {
            const respStatus = error && error.status ? error.status : (error.response && error.response.status ? error.response.status : null);
            const respMessage = error && error.response && error.response.message ? String(error.response.message) : (error && error.message ? String(error.message) : '');

            const looksLikeTokenError = /token/i.test(respMessage) || /hết hạn/i.test(respMessage) || /invalid token/i.test(respMessage);
            if (respStatus === 401 || looksLikeTokenError) {
                // Avoid firing multiple redirects in quick succession during a page load
                if (!sessionStorage.getItem('authExpiredHandled')) {
                    try {
                        sessionStorage.setItem('authExpiredHandled', '1');
                        // Clear auth state
                        localStorage.removeItem('authToken');
                        localStorage.removeItem('userData');
                        // Let other parts of the app react if they want
                        window.dispatchEvent(new CustomEvent('auth:expired', { detail: { endpoint, message: respMessage } }));
                        // Redirect to login (SPA)
                        try { window.location.href = '/login'; } catch { /* best-effort */ }
                    } catch (e) {
                        console.debug('Error handling auth expiry', e);
                    }
                }
            }
        } catch (ee) {
            console.debug('Error in auth-expiry detection', ee);
        }

        throw error;
    }
};

// ==================== AUTH APIs ====================

export const authAPI = {
    /**
     * Register new user
     */
    register: async (userData) => {
        return apiCall('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData),
            skipAuth: true,
        });
    },

    /**
     * Login user
     */
    login: async (identifier, password) => {
        return apiCall('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ identifier, password }),
            skipAuth: true,
        });
    },

    /**
     * Get current user info
     */
    getCurrentUser: async () => {
        return apiCall('/auth/me');
    },
    /**
     * Change password for current user (requires auth)
     * body: { oldPassword, newPassword }
     */
    changePassword: async (oldPassword, newPassword) => {
        return apiCall('/auth/password', {
            method: 'PUT',
            body: JSON.stringify({ oldPassword, newPassword }),
        });
    },
};

// ==================== POST APIs ====================

export const postAPI = {
    /**
     * Get feed posts
     */
    getFeed: async (page = 1, limit = 10) => {
        return apiCall(`/posts/feed?page=${page}&limit=${limit}`);
    },

    /**
     * Create new post
     */
    create: async (postData) => {
        return apiCall('/posts', {
            method: 'POST',
            body: JSON.stringify(postData),
        });
    },

    /**
     * Get post by ID
     */
    getById: async (postId) => {
        return apiCall(`/posts/${postId}`);
    },

    /**
     * Delete post
     */
    delete: async (postId) => {
        return apiCall(`/posts/${postId}`, {
            method: 'DELETE',
        });
    },

    /**
     * Update post
     */
    update: async (postId, postData) => {
        return apiCall(`/posts/${postId}`, {
            method: 'PUT',
            body: JSON.stringify(postData),
        });
    },

    /**
     * Get user's posts
     */
    getUserPosts: async (userId, page = 1, limit = 10) => {
        return apiCall(`/users/${userId}/posts?page=${page}&limit=${limit}`);
    },
};

// ==================== COMMENT APIs ====================

export const commentAPI = {
    /**
     * Get comments for a post
     */
    getByPostId: async (postId) => {
        return apiCall(`/comments/post/${postId}`);
    },

    /**
     * Create new comment
     */
    create: async (commentData) => {
        // commentData may include { postId, content, parentCommentId, files }
        const hasFiles = commentData.files && commentData.files.length > 0;
        if (hasFiles) {
            const token = getAuthToken();
            const form = new FormData();
            form.append('postId', commentData.postId);
            form.append('content', commentData.content || '');
            if (commentData.parentCommentId) form.append('parentCommentId', commentData.parentCommentId);
            // files may be array of { id, file }
            commentData.files.forEach((f) => {
                const file = f && f.file ? f.file : f;
                form.append('images', file);
            });

            const headers = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            try {
                const response = await fetch(`${API_BASE_URL}/comments`, {
                    method: 'POST',
                    headers,
                    body: form,
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || 'API call failed');
                return data;
            } catch (err) {
                console.error('❌ API Error: /comments (multipart)', err);
                throw err;
            }
        }

        // fallback: JSON body
        return apiCall('/comments', {
            method: 'POST',
            body: JSON.stringify(commentData),
        });
    },

    /**
     * Delete comment
     */
    delete: async (commentId) => {
        return apiCall(`/comments/${commentId}`, {
            method: 'DELETE',
        });
    },
    /**
     * Update comment
     */
    update: async (commentId, data) => {
        return apiCall(`/comments/${commentId}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },
};

// ==================== REACTION APIs ====================

export const reactionAPI = {
    /**
     * Toggle like on post
     */
    toggleLike: async (postId) => {
        console.log('🔥 toggleLike called with postId:', postId);
        const requestBody = {
            postId: postId,
            reactionType: 'Like',
        };
        console.log('📤 Request body:', requestBody);
        // Prevent rapid duplicate likes from client
        return callWithCooldown(`like:${postId}`, CLIENT_THROTTLE.like, async () => {
            return apiCall('/reactions', {
                method: 'POST',
                body: JSON.stringify(requestBody),
            });
        });
    },

    /**
     * Get reactions for a post
     */
    getByPostId: async (postId) => {
        return apiCall(`/reactions/post/${postId}`);
    },
    /**
     * Get reaction counts for a post
     */
    getCounts: async (postId) => {
        return apiCall(`/reactions/post/${postId}/counts`);
    },
    /**
     * Get current user's reaction for a post (requires auth)
     */
    getUserReaction: async (postId) => {
        return apiCall(`/reactions/post/${postId}/user`);
    },
};

// ==================== MESSAGE APIs ====================

export const messageAPI = {
    /**
     * Send message
     */
    send: async (toUserId, text, mediaUrl = null, images = []) => {
        // Backend accepts { receiverId, content, images }
        const payload = {
            receiverId: toUserId,
            content: mediaUrl ? mediaUrl : (text || ''),
            images: images // array of base64 data URIs or URLs (max 5)
        };

        console.log('📤 messageAPI.send payload:', payload);
        const res = await apiCall('/messages', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        console.log('📥 messageAPI.send response:', res);

        // Broadcast a global event so other parts of the UI (e.g., Messages list)
        // can update pending/unread state immediately when a message is sent.
        try {
            const fromUserRaw = (() => {
                try { const token = getAuthToken(); return token ? JSON.parse(atob(token.split('.')[1])) : null; } catch { return null; }
            })();
            const fromUserId = res && res.data && (res.data.sender?._id || res.data.SenderID || res.data.senderId) ? (res.data.sender?._id || res.data.SenderID || res.data.senderId) : (fromUserRaw && (fromUserRaw.userId || fromUserRaw.AccountID || fromUserRaw._id));
            const detail = { toUserId, fromUserId, message: payload.content };
            window.dispatchEvent(new CustomEvent('message:sent', { detail }));
        } catch (err) {
            console.debug('Could not dispatch global message:sent event', err);
        }

        return res;
    },

    /**
     * Get conversation with user
     */
    getConversation: async (userId) => {
        console.log('📤 messageAPI.getConversation userId=', userId);
        const res = await apiCall(`/messages/conversation/${userId}`);
        console.log('📥 messageAPI.getConversation response:', res);
        return res;
    },
    /**
     * Get conversations list (users you've chatted with) with last message snippets
     */
    getConversations: async () => {
        const res = await apiCall('/messages/conversations');
        console.log('📥 messageAPI.getConversations response:', res);
        return res;
    }
    ,
    /**
     * Mark all messages from a sender as read (conversation-level)
     */
    markConversationRead: async (userId) => {
        // send senderId in body for backward-compatible server handling
        return apiCall(`/messages/conversation/${userId}/read-all`, {
            method: 'PUT',
            body: JSON.stringify({ senderId: userId })
        });
    }
    ,
    delete: async (messageId) => {
        return apiCall(`/messages/${messageId}`, {
            method: 'DELETE'
        });
    }
    ,
    update: async (messageId, data) => {
        return apiCall(`/messages/${messageId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }
};

// ==================== USER APIs ====================

export const userAPI = {
    /**
     * Search users
     */
    search: async (query, limit = 20) => {
        return apiCall(`/users/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    },

    /**
     * Get user profile
     */
    getProfile: async (userId) => {
        return apiCall(`/users/${userId}`);
    },

    /**
     * Get posts liked by user
     */
    getLikedPosts: async (userId, page = 1, limit = 20) => {
        return apiCall(`/users/${userId}/likes?page=${page}&limit=${limit}`);
    },

    /**
     * Update profile
     */
    updateProfile: async (userId, updateData) => {
        return apiCall(`/users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify(updateData),
        });
    },

    /**
     * Get suggestions
     */
    getSuggestions: async (limit = 10) => {
        return apiCall(`/users/suggestions?limit=${limit}`);
    },

    /**
     * Get followers
     */
    getFollowers: async () => {
        return apiCall('/users/followers');
    },

    /**
     * Get following
     */
    getFollowing: async () => {
        return apiCall('/users/following');
    },

    /**
     * Follow user
     */
    follow: async (userId) => {
        return apiCall(`/users/follow/${userId}`, {
            method: 'POST',
        });
    },

    /**
     * Unfollow user
     */
    unfollow: async (userId) => {
        return apiCall(`/users/unfollow/${userId}`, {
            method: 'DELETE',
        });
    },
};

// ==================== SHARE APIs ====================

export const shareAPI = {
    /**
     * Create a share
     */
    create: async (postId, note = '') => {
        return callWithCooldown(`share:create:${postId}`, CLIENT_THROTTLE.share, async () => {
            return apiCall('/shares', {
                method: 'POST',
                body: JSON.stringify({ postId, note }),
            });
        });
    },

    /**
     * Delete a share
     */
    delete: async (postId) => {
        return callWithCooldown(`share:delete:${postId}`, CLIENT_THROTTLE.share, async () => {
            return apiCall(`/shares/post/${postId}`, {
                method: 'DELETE',
            });
        });
    },

    /**
     * Get shares for a post
     */
    getByPostId: async (postId) => {
        return apiCall(`/shares/post/${postId}`);
    },

    /**
     * Get share count for a post
     */
    getCount: async (postId) => {
        return apiCall(`/shares/post/${postId}/count`);
    },

    /**
     * Check if current user shared a post
     */
    checkUserShared: async (postId) => {
        return apiCall(`/shares/post/${postId}/check`);
    },

    /**
     * Get shares by current user
     */
    getUserShares: async () => {
        return apiCall('/shares/user');
    },
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Upload image to base64
 */
export const imageToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });
};

/**
 * Format error message
 */
export const formatErrorMessage = (error) => {
    if (error.message) {
        return error.message;
    }
    return 'An error occurred. Please try again.';
};

// ==================== STORY APIs ====================

export const storyAPI = {
    /**
     * Get all active stories
     */
    getActive: async () => {
        return apiCall('/stories');
    },

    /**
     * Get stories by user ID
     */
    getUserStories: async (userId) => {
        return apiCall(`/stories/user/${userId}`);
    },

    /**
     * Create new story (with file upload support)
     */
    create: async (storyData) => {
        // Check if storyData contains a file (FormData) or just JSON
        const isFormData = storyData instanceof FormData;

        return apiCall('/stories', {
            method: 'POST',
            body: isFormData ? storyData : JSON.stringify(storyData),
        });
    },

    /**
     * Delete story
     */
    delete: async (storyId) => {
        return apiCall(`/stories/${storyId}`, {
            method: 'DELETE',
        });
    },

    /**
     * Record view (track who viewed)
     */
    view: async (storyId) => {
        return apiCall(`/stories/${storyId}/view`, {
            method: 'POST',
        });
    },

    /**
     * Get story viewers (who viewed this story)
     */
    getViewers: async (storyId) => {
        return apiCall(`/stories/${storyId}/viewers`);
    },

    /**
     * Get story view count
     */
    getViewCount: async (storyId) => {
        return apiCall(`/stories/${storyId}/views/count`);
    },
};

// ==================== FACILITY APIs ====================
export const facilityAPI = {
    /**
     * Get all facilities (using sport-fields endpoint)
     */
    getAll: async () => {
        return apiCall('/sport-fields');
    },

    /**
     * Get facility by ID (using sport-fields endpoint)
     */
    getById: async (facilityId) => {
        return apiCall(`/sport-fields/${facilityId}`);
    },

    /**
     * Get facility availability
     */
    getAvailability: async (facilityId) => {
        return apiCall(`/sport-fields/${facilityId}/availability`);
    },

    /**
     * Search facilities
     */
    search: async (query) => {
        return apiCall(`/sport-fields/search?query=${encodeURIComponent(query)}`);
    },

    /**
     * Get fields by facility
     */
    getByFacilityId: async (facilityId) => {
        return apiCall(`/sport-fields/facility/${facilityId}`);
    },
};

// ==================== BOOKING APIs ====================
export const bookingAPI = {
    /**
     * Get all bookings for current user
     */
    getMyBookings: async () => {
        return apiCall('/bookings/my-bookings');
    },

    /**
     * Get booking by ID
     */
    getById: async (bookingId) => {
        return apiCall(`/bookings/${bookingId}`);
    },

    /**
     * Create new booking
     */
    create: async (bookingData) => {
        return apiCall('/bookings', {
            method: 'POST',
            body: JSON.stringify(bookingData),
        });
    },

    /**
     * Cancel booking
     */
    cancel: async (bookingId) => {
        return apiCall(`/bookings/${bookingId}/cancel`, {
            method: 'PUT',
        });
    },

    /**
     * Get field availability for a specific date (requires auth)
     * Returns { success, message, data: [ { StartTime, EndTime, Status }, ... ] }
     */
    getFieldAvailability: async (fieldId, date) => {
        return apiCall(`/bookings/fields/${fieldId}/availability?date=${encodeURIComponent(date)}`);
    },

    /**
     * Update booking status (admin only)
     */
    updateStatus: async (bookingId, status) => {
        return apiCall(`/bookings/${bookingId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status }),
        });
    },
};

// ==========================================
// Rating API (Star ratings - 1 per user per target)
// ==========================================
export const ratingAPI = {
    /**
     * Set or update user's rating
     */
    setRating: async (targetType, targetId, rating) => {
        return apiCall('/ratings', {
            method: 'POST',
            body: JSON.stringify({ targetType, targetId, rating }),
        });
    },

    /**
     * Get user's own rating for a target
     */
    getMyRating: async (targetType, targetId) => {
        return apiCall(`/ratings/my-rating/${targetType}/${targetId}`);
    },

    /**
     * Get rating statistics for a target
     */
    getStats: async (targetType, targetId) => {
        return apiCall(`/ratings/stats/${targetType}/${targetId}`);
    },

    /**
     * Delete user's rating
     */
    deleteRating: async (targetType, targetId) => {
        return apiCall(`/ratings/${targetType}/${targetId}`, {
            method: 'DELETE',
        });
    },
};

// ==========================================
// Field Comment API (Multiple comments allowed per user)
// ==========================================
export const fieldCommentAPI = {
    /**
     * Get comments for a target
     */
    getComments: async (targetType, targetId, page = 1, limit = 20) => {
        return apiCall(`/field-comments/${targetType}/${targetId}?page=${page}&limit=${limit}`);
    },

    /**
     * Create new comment
     */
    createComment: async (targetType, targetId, content) => {
        return apiCall('/field-comments', {
            method: 'POST',
            body: JSON.stringify({ targetType, targetId, content }),
        });
    },

    /**
     * Update comment (only owner)
     */
    updateComment: async (commentId, content) => {
        return apiCall(`/field-comments/${commentId}`, {
            method: 'PUT',
            body: JSON.stringify({ content }),
        });
    },

    /**
     * Delete comment
     */
    deleteComment: async (commentId) => {
        return apiCall(`/field-comments/${commentId}`, {
            method: 'DELETE',
        });
    },

    /**
     * Get user's own comments
     */
    getMyComments: async (page = 1, limit = 20) => {
        return apiCall(`/field-comments/my-comments?page=${page}&limit=${limit}`);
    },
};

// Old feedback API (deprecated, keep for backward compatibility)
export const feedbackAPI = {
    /**
     * Get feedbacks for a target (Field, Facility, etc.)
     */
    getByTarget: async (targetType, targetId, page = 1, limit = 10) => {
        return apiCall(`/feedback/${targetType}/${targetId}?page=${page}&limit=${limit}`);
    },

    /**
     * Get rating statistics for a target
     */
    getStats: async (targetType, targetId) => {
        return apiCall(`/feedback/${targetType}/${targetId}/stats`);
    },

    /**
     * Create new feedback
     */
    create: async (feedbackData) => {
        return apiCall('/feedback', {
            method: 'POST',
            body: JSON.stringify(feedbackData),
        });
    },

    /**
     * Update feedback
     */
    update: async (feedbackId, feedbackData) => {
        return apiCall(`/feedback/${feedbackId}`, {
            method: 'PUT',
            body: JSON.stringify(feedbackData),
        });
    },

    /**
     * Delete feedback
     */
    delete: async (feedbackId) => {
        return apiCall(`/feedback/${feedbackId}`, {
            method: 'DELETE',
        });
    },

    /**
     * Get my feedbacks
     */
    getMyFeedbacks: async () => {
        return apiCall('/feedback/my-feedback');
    },
};

export default {
    authAPI,
    postAPI,
    commentAPI,
    reactionAPI,
    messageAPI,
    userAPI,
    storyAPI,
    facilityAPI,
    bookingAPI,
    feedbackAPI,
    imageToBase64,
    formatErrorMessage,
    shareAPI,
};
