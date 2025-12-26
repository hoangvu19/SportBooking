// ==================== NOTIFICATION APIs ====================
export const notificationAPI = {
    /**
     * Get notifications for current user with pagination
     */
    getAll: async (page = 1, limit = 20, onlyAdminSystem = false) => {
        const q = `?page=${page}&limit=${limit}` + (onlyAdminSystem ? '&onlyAdminSystem=1' : '');
        return apiCall(`/notifications${q}`);
    },
    /**
     * Get unread notification count
     */
    getUnreadCount: async () => {
        return apiCall('/notifications/unread-count');
    },
    /**
     * Mark a specific notification as read
     */
    markAsRead: async (notificationId) => {
        return apiCall(`/notifications/${notificationId}/read`, { method: 'PUT' });
    },
    /**
     * Mark all notifications as read
     */
    markAllRead: async () => {
        return apiCall('/notifications/read-all', { method: 'PUT' });
    },
    /**
     * Delete a notification
     */
    delete: async (notificationId) => {
        return apiCall(`/notifications/${notificationId}`, { method: 'DELETE' });
    },
    /**
     * Admin: get sent notifications (sent items)
     */
    getSent: async (page = 1, limit = 50) => {
        return apiCall(`/notifications/sent?page=${page}&limit=${limit}`);
    },
    /**
     * Admin: delete a sent notification
     */
    deleteSent: async (notificationId) => {
        return apiCall(`/notifications/sent/${notificationId}`, { method: 'DELETE' });
    },
    /**
     * Admin: delete a grouped sent notification (by type+content)
     * body: { type, content }
     */
    deleteSentGroup: async (payload) => {
        return apiCall('/notifications/sent/delete-group', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    },
    /**
     * Admin: broadcast notification to all users
     * body: { type, contentId, content }
     */
    broadcast: async (payload) => {
        return apiCall('/notifications/broadcast', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    },
    /**
     * Admin: send notification to a single user
     * body: { recipientId, type, contentId, content }
     */
    send: async (payload) => {
        return apiCall('/notifications/send', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    },
};
/**
 * Centralized API Handler
 * Handles all API calls với error handling và loading states
 */

import { API_BASE_URL } from '../config/apiConfig';
import { normalizeUser } from './normalize';

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
    // Attach client's active role (if any) so backend can honor role-scoped responses
    try {
        const activeRole = localStorage.getItem('activeRole');
        if (activeRole) defaultHeaders['X-Active-Role'] = activeRole;
    } catch {
        // ignore storage errors
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

            // If identical request is in-flight, return the same promise (which resolves to parsed data)
            if (inflightRequests.has(cacheKey)) {
                console.debug('🌐 Reusing in-flight request for', endpoint);
                return await inflightRequests.get(cacheKey);
            }
        }

        console.log(`🌐 API Call: ${method} ${endpoint}`);

        // Support a request timeout so UI doesn't hang indefinitely when backend is slow/unreachable.
        // Increase default timeout and add simple retry/backoff for idempotent requests (GET/HEAD).
        const defaultTimeoutMs = 20000; // default 20s
        const timeoutMs = typeof options.timeout === 'number' ? options.timeout : defaultTimeoutMs;
        const maxRetries = typeof options.retries === 'number' ? options.retries : (method === 'GET' ? 2 : 0);

        // Helper to perform one fetch attempt with AbortController and timeout
        const doRequestOnce = async () => {
            const controller = new AbortController();
            config.signal = controller.signal;
            const timeoutId = setTimeout(() => {
                try { controller.abort(); } catch { void 0; }
            }, timeoutMs);
            try {
                const response = await fetch(url, config);

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
                    // Avoid noisy error logs for client-side 4xx not-found responses
                    if (response.status >= 500) {
                        console.error(`❌ API Error: ${endpoint}`, { status: response.status, body: data });
                    } else {
                        console.debug(`❌ API Client Error: ${endpoint}`, { status: response.status, body: data });
                    }
                    throw err;
                }

                console.log(`✅ API Success: ${endpoint}`, data);
                if (method === 'GET') {
                    try { getCache.set(cacheKey, { ts: Date.now(), data }); } catch { /* ignore cache errors */ }
                }
                return data;
            } finally {
                clearTimeout(timeoutId);
            }
        };

        // Try the request with retry/backoff for network/timeouts on idempotent methods
        const requestPromise = (async () => {
            let attempt = 0;
            let lastErr = null;
            while (attempt <= maxRetries) {
                try {
                    const res = await doRequestOnce();
                    return res;
                } catch (err) {
                    lastErr = err;
                    // If error is a non-retriable HTTP error (4xx other than 408/429), break
                    const status = err && err.status ? err.status : null;
                    if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) {
                        throw err; // client error - don't retry
                    }
                    attempt++;
                    if (attempt > maxRetries) break;
                    // exponential backoff before next attempt
                    const backoffMs = 200 * Math.pow(2, attempt - 1) + Math.random() * 100;
                    console.debug(`Retrying API call ${endpoint} (attempt ${attempt}) after ${backoffMs}ms`);
                    await new Promise(res => setTimeout(res, backoffMs));
                }
            }
            // if we reached here, rethrow last error (normalize later)
            throw lastErr || new Error('Unknown network error');
        })();

        // Track in-flight GET requests so duplicate requests reuse the same parsed-data promise
        if (method === 'GET') inflightRequests.set(cacheKey, requestPromise);

        return await requestPromise;
    } catch (error) {
        // Normalize abort/timeout errors to a friendly message
        let normalizedError = error;
        if ((error && error.name === 'AbortError') || /timeout/i.test(String(error && error.message))) {
            normalizedError = new Error('Request timed out');
            normalizedError.status = 408;
        }
        // Log server / unexpected errors at error level, but keep common client-side errors quieter
        const logStatus = normalizedError && normalizedError.status ? normalizedError.status : (normalizedError && normalizedError.response && normalizedError.response.status ? normalizedError.response.status : null);
        if (logStatus && logStatus >= 500) {
            console.error(`❌ API Error: ${endpoint}`, normalizedError);
        } else {
            console.debug(`❌ API Error (client/non-critical): ${endpoint}`, normalizedError);
        }

        // Centralized handling for authentication expiry / unauthorized responses
        try {
            const respStatus = normalizedError && normalizedError.status ? normalizedError.status : (normalizedError.response && normalizedError.response.status ? normalizedError.response.status : null);
            const respMessage = normalizedError && normalizedError.response && normalizedError.response.message ? String(normalizedError.response.message) : (normalizedError && normalizedError.message ? String(normalizedError.message) : '');

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
                    } catch (err) {
                        console.debug('Error handling auth expiry', err);
                    }
                }
            }
        } catch (ee) {
            console.debug('Error in auth-expiry detection', ee);
        }

        throw normalizedError;
    }
};

// ==================== AUTH APIs ====================

export const authAPI = {
    /**
     * Assign role to user (admin only)
     */
    assignRole: async (accountId, roleId) => {
        return apiCall('/roles/assign', {
            method: 'POST',
            body: JSON.stringify({ accountId, roleId }),
        });
    },

    /**
     * Remove role from user (admin only)
     */
    removeRole: async (accountId, roleId) => {
        return apiCall('/roles/remove', {
            method: 'POST',
            body: JSON.stringify({ accountId, roleId }),
        });
    },
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
    /**
     * Admin: Get all accounts
     */
    getAccounts: async () => {
        return apiCall('/admin/accounts/list');
    },

    /**
     * Admin: Create new account (dùng endpoint riêng cho admin)
     */
    createAccount: async (userData) => {
        return apiCall('/admin/accounts', {
            method: 'POST',
            body: JSON.stringify(userData),
        });
    },

    /**
     * Admin: Update account info
     */
    updateAccount: async (accountId, updateData) => {
        return apiCall(`/admin/accounts/${accountId}`, {
            method: 'PUT',
            body: JSON.stringify(updateData),
        });
    },

    /**
     * Admin: Delete account
     */
    deleteAccount: async (accountId) => {
        return apiCall(`/admin/accounts/${accountId}`, {
            method: 'DELETE',
        });
    },

    /**
     * Get all roles
     */
    getRoles: async () => {
        return apiCall('/roles');
    },

    /**
     * Admin: Get all areas for address selection
     */
    getAreas: async () => {
        return apiCall('/admin/accounts/areas');
    },
};

// ==================== POST APIs ====================

export const postAPI = {
    /**
     * Get feed posts (with optional cache bypass for immediate refresh after mutation)
     */
    getFeed: async (page = 1, limit = 10, bypassCache = false) => {
        const ts = bypassCache ? `&_nocache=${Date.now()}` : '';
        return apiCall(`/posts/feed?page=${page}&limit=${limit}${ts}`);
    },

    /**
     * Create new post
     */
    create: async (postData) => {
        // If caller provides a FormData (multipart), forward as-is so browser sets correct Content-Type
        const isFormData = postData instanceof FormData;
        return apiCall('/posts', {
            method: 'POST',
            body: isFormData ? postData : JSON.stringify(postData),
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
    getUserPosts: async (userId, page = 1, limit = 10, bypassCache = false) => {
        const ts = bypassCache ? `&_nocache=${Date.now()}` : '';
        return apiCall(`/users/${userId}/posts?page=${page}&limit=${limit}${ts}`);
    },
};

// ==================== COMMENT APIs ====================

export const commentAPI = {
    /**
     * Get comments for a post
     */
    getByPostId: async (postId, bypassCache = false) => {
        const ts = bypassCache ? `?_nocache=${Date.now()}` : '';
        return apiCall(`/comments/post/${postId}${ts}`);
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
        // Backend accepts either JSON ({ receiverId, content, images })
        // or multipart/form-data when sending File objects (images/videos)
        const hasFiles = Array.isArray(images) && images.some(i => (i && typeof i === 'object' && (i instanceof File || i.file || i.size)));

        if (hasFiles) {
            // Build FormData and POST via fetch directly so browser sets boundary
            const token = getAuthToken();
            const form = new FormData();
            form.append('receiverId', toUserId);
            form.append('content', mediaUrl ? mediaUrl : (text || ''));

            images.forEach((f) => {
                const file = f && f.file ? f.file : f;
                if (!file) return;
                // append under the field name 'images' (server expects 'images')
                form.append('images', file);
            });

            const headers = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            try {
                const response = await fetch(`${API_BASE_URL}/messages`, {
                    method: 'POST',
                    headers,
                    body: form,
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || 'API call failed');
                console.log('📥 messageAPI.send response:', data);
                // dispatch event
                try {
                    const fromUserRaw = (() => {
                        try { const token = getAuthToken(); return token ? JSON.parse(atob(token.split('.')[1])) : null; } catch { return null; }
                    })();
                    const fromUserNorm = normalizeUser(fromUserRaw || {});
                    const fromUserId = data && data.data && (data.data.sender?._id || data.data.SenderID || data.data.senderId) ? (data.data.sender?._id || data.data.SenderID || data.data.senderId) : (fromUserNorm.id || (fromUserRaw && (fromUserRaw.userId || fromUserRaw.AccountID || fromUserRaw._id)));
                    const detail = { toUserId, fromUserId, message: form.get('content') };
                    window.dispatchEvent(new CustomEvent('message:sent', { detail }));
                } catch (err) { console.debug('Could not dispatch global message:sent event', err); }

                return data;
            } catch (err) {
                console.error('❌ API Error: /messages (multipart)', err);
                throw err;
            }
        }

        // fallback to JSON body
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
            const fromUserNorm = normalizeUser(fromUserRaw || {});
            const fromUserId = res && res.data && (res.data.sender?._id || res.data.SenderID || res.data.senderId) ? (res.data.sender?._id || res.data.SenderID || res.data.senderId) : (fromUserNorm.id || (fromUserRaw && (fromUserRaw.userId || fromUserRaw.AccountID || fromUserRaw._id)));
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
    getProfile: async (userId, bypassCache = false) => {
        const ts = bypassCache ? `?_nocache=${Date.now()}` : '';
        return apiCall(`/users/${userId}${ts}`);
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
    getFollowing: async (bypassCache = false) => {
        const ts = bypassCache ? `?_nocache=${Date.now()}` : '';
        return apiCall(`/users/following${ts}`);
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
     * Get story by ID (detail)
     */
    getById: async (storyId) => {
        return apiCall(`/stories/${storyId}`);
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
    /**
     * Get archived stories
     */
    getArchived: async () => {
        return apiCall('/stories/archived');
    },
};

// ==================== REPORT APIs ====================
export const reportAPI = {
    /**
     * Create a new report
     * body: { contentType, contentId, reason, description }
     */
    create: async (payload) => {
        return apiCall('/reports', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    }
};

// ==================== FACILITY APIs ====================
// Use the /facilities endpoints (server exposes facilityRoutesNew) so the client
// receives full facility objects (including sportFields). Keep a helper to fetch
// fields by facility via the sport-fields endpoint when needed.
export const facilityAPI = {
    /**
     * Get all facilities (with optional cache bypass)
     */
    getAll: async (bypassCache = false) => {
        const endpoint = bypassCache ? `/facilities?_nocache=${Date.now()}` : '/facilities';
        return apiCall(endpoint);
    },

    /**
     * Get facility by ID
     * Try /facilities/:id first (new controller). If not found (404),
     * fall back to legacy /sport-fields/:id so older IDs still work.
     */
    getById: async (facilityId, bypassCache = false) => {
        const ts = bypassCache ? `?_nocache=${Date.now()}` : '';
        try {
            return await apiCall(`/facilities/${facilityId}${ts}`);
        } catch (err) {
            // If facility route returns 404 or a not-found message, try legacy endpoint
            const looksLikeNotFound = err && (err.status === 404 || (err.message && /không tìm|not found/i.test(err.message)));
            if (looksLikeNotFound) {
                console.debug('facilityAPI.getById: fallback to /sport-fields for id', facilityId);
                return await apiCall(`/sport-fields/${facilityId}${ts}`);
            }
            throw err;
        }
    },

    /**
     * Get facility availability (if implemented on server)
     */
    getAvailability: async (facilityId) => {
        return apiCall(`/facilities/${facilityId}/availability`);
    },

    /**
     * Search facilities
     * Accepts either a query string or an object of query params (e.g. { sportTypeId, areaId, searchTerm })
     */
    search: async (params, bypassCache = false) => {
        const ts = bypassCache ? `&_nocache=${Date.now()}` : '';
        if (!params) return apiCall(`/facilities${ts ? `?${ts.slice(1)}` : ''}`);
        if (typeof params === 'string') {
            return apiCall(`/facilities/search?query=${encodeURIComponent(params)}${ts}`);
        }
        // build querystring from object
        const qp = new URLSearchParams();
        Object.keys(params).forEach(key => {
            const val = params[key];
            if (val === null || typeof val === 'undefined' || val === '') return;
            qp.append(key, String(val));
        });
        const qs = qp.toString();
        return apiCall(`/facilities/search${qs ? `?${qs}` : ''}${ts}`);
    },

    /**
     * Get fields by facility (uses sport-fields route)
     */
    getByFacilityId: async (facilityId) => {
        return apiCall(`/sport-fields/facility/${facilityId}`);
    },
    /**
     * Create a new facility (Owner/Admin)
     * body: { facilityName, areaId }
     */
    create: async (facilityData) => {
        return apiCall('/facilities', {
            method: 'POST',
            body: JSON.stringify(facilityData),
        });
    },

    /**
     * Update facility
     * PUT /facilities/:id
     */
    update: async (facilityId, facilityData) => {
        return apiCall(`/facilities/${facilityId}`, {
            method: 'PUT',
            body: JSON.stringify(facilityData),
        });
    },

    /**
     * Delete facility
     */
    delete: async (facilityId) => {
        return apiCall(`/facilities/${facilityId}`, {
            method: 'DELETE',
        });
    },

    /**
     * Get facilities owned by current authenticated owner (with optional cache bypass)
     */
    getMyFacilities: async (bypassCache = false) => {
        const ts = bypassCache ? `?_nocache=${Date.now()}` : '';
        return apiCall(`/facilities/mine${ts}`);
    },
    /**
     * Upload images for a facility (multipart/form-data)
     * files: array of File objects
     */
    uploadImages: async (facilityId, files = []) => {
        if (!facilityId) throw new Error('facilityId required');
        if (!Array.isArray(files) || files.length === 0) return { success: true, data: [] };

        const token = getAuthToken();
        const form = new FormData();
        files.forEach((f) => form.append('images', f));

        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        try {
            const response = await fetch(`${API_BASE_URL}/facilities/${facilityId}/images`, {
                method: 'POST',
                headers,
                body: form,
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Upload failed');
            return data;
        } catch (err) {
            console.error('❌ API Error: /facilities/:id/images (multipart)', err);
            throw err;
        }
    },
    /**
     * Delete a facility image
     */
    deleteImage: async (facilityId, imageId) => {
        return apiCall(`/facilities/${facilityId}/images/${imageId}`, {
            method: 'DELETE'
        });
    },
};

// ==================== SPORT FIELD (AREA) APIs ====================
export const sportFieldAPI = {
    /**
     * Create sport field (area) under a facility
     * POST /sport-fields/facility/:facilityId
     * body: { fieldName, fieldType, rentalPrice, status, sportTypeId }
     */
    create: async (facilityId, fieldData) => {
        return apiCall(`/sport-fields/facility/${facilityId}`, {
            method: 'POST',
            body: JSON.stringify(fieldData),
        });
    },

    getByFacility: async (facilityId) => {
        return apiCall(`/sport-fields/facility/${facilityId}`);
    },
    /**
     * Get sport fields for a facility but bypass client GET cache by appending a timestamp.
     * Use this when the client has just uploaded images and needs fresh server data immediately.
     */
    getByFacilityFresh: async (facilityId) => {
        return apiCall(`/sport-fields/facility/${facilityId}?ts=${Date.now()}`);
    },
    /**
     * Get sport field by id
     */
    getById: async (fieldId) => {
        return apiCall(`/sport-fields/${fieldId}`);
    },
    /**
     * Update sport field
     */
    update: async (fieldId, data) => {
        return apiCall(`/sport-fields/${fieldId}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },

    /**
     * Delete sport field
     */
    delete: async (fieldId) => {
        return apiCall(`/sport-fields/${fieldId}`, {
            method: 'DELETE',
        });
    }
    ,
    /**
     * Upload images for a sport field (multipart/form-data)
     * files: array of File objects
     */
    uploadImages: async (fieldId, files = []) => {
        if (!fieldId) throw new Error('fieldId required');
        if (!Array.isArray(files) || files.length === 0) return { success: true, data: [] };

        const token = getAuthToken();
        const form = new FormData();
        files.forEach((f) => form.append('images', f));

        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        try {
            const response = await fetch(`${API_BASE_URL}/sport-fields/${fieldId}/images`, {
                method: 'POST',
                headers,
                body: form,
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Upload failed');
            return data;
        } catch (err) {
            console.error('❌ API Error: /sport-fields/:id/images (multipart)', err);
            throw err;
        }
    },
    /**
     * Delete a sport field image
     */
    deleteImage: async (fieldId, imageId) => {
        return apiCall(`/sport-fields/${fieldId}/images/${imageId}`, {
            method: 'DELETE'
        });
    }
};

// ==================== AREA APIs ====================
export const areaAPI = {
    /**
     * Get all areas (province/city list)
     */
    getAll: async () => {
        return apiCall('/areas');
    }
};

// ==================== SPORT TYPE APIs ====================
export const sportTypeAPI = {
    /**
     * Get all sport types (canonical list from DB)
     */
    getAll: async () => {
        return apiCall('/sport-types');
    },

    /**
     * Get sport type by id
     */
    getById: async (id) => {
        return apiCall(`/sport-types/${id}`);
    }
};

// ==================== BOOKING APIs ====================
export const bookingAPI = {
    /**
     * Get all bookings for current user
     */
    getMyBookings: async (params = {}) => {
        const query = new URLSearchParams();
        if (params.status) query.append('status', params.status);
        if (params.page) query.append('page', params.page);
        if (params.limit) query.append('limit', params.limit);
        const qs = query.toString();
        return apiCall(`/bookings/my-bookings${qs ? '?' + qs : ''}`);
    },

    /**
     * Get all bookings for facility owner (owner only)
     */
    getFacilityBookings: async (params = {}, bypassCache = false) => {
        const query = new URLSearchParams();
        if (params.status) query.append('status', params.status);
        if (params.page) query.append('page', params.page);
        if (params.limit) query.append('limit', params.limit);
        if (bypassCache) query.append('_nocache', Date.now());
        const qs = query.toString();
        return apiCall(`/bookings/facility/bookings${qs ? '?' + qs : ''}`);
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
     * Confirm booking (owner only)
     */
    confirm: async (bookingId) => {
        return apiCall(`/bookings/${bookingId}/confirm`, {
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

    /**
     * Get revenue statistics (owner only)
     */
    getRevenueStats: async (params = {}) => {
        const query = new URLSearchParams();
        if (params.startDate) query.append('startDate', params.startDate);
        if (params.endDate) query.append('endDate', params.endDate);
        const qs = query.toString();
        return apiCall(`/bookings/revenue/stats${qs ? '?' + qs : ''}`);
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
     * @param {string} targetType
     * @param {number|string} targetId
     * @param {boolean} [bypassCache=false] - when true, append a timestamp to avoid client GET cache
     */
    getStats: async (targetType, targetId, bypassCache = false) => {
        const ts = bypassCache ? `?_nocache=${Date.now()}` : '';
        return apiCall(`/ratings/stats/${targetType}/${targetId}${ts}`);
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
// NOTE: fieldComment API removed — use feedbackAPI which operates on `Feedback` table

// Old feedback API (deprecated, keep for backward compatibility)
export const feedbackAPI = {
    /**
     * Get feedbacks for a target (Field, Facility, etc.)
     */
    /**
     * Get feedbacks for a target (Field, Facility, etc.)
     * @param {string} targetType
     * @param {number|string} targetId
     * @param {number} page
     * @param {number} limit
     * @param {boolean} [bypassCache=false] - append timestamp to avoid client GET cache
     */
    getByTarget: async (targetType, targetId, page = 1, limit = 10, bypassCache = false) => {
        const ts = bypassCache ? `&_nocache=${Date.now()}` : '';
        return apiCall(`/feedback/${targetType}/${targetId}?page=${page}&limit=${limit}${ts}`);
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

// ==================== CUSTOMER MANAGEMENT APIs ====================
export const customerAPI = {
    /**
     * Get all customers who have booked at owner's facilities
     */
    getAll: async (params = {}, bypassCache = false) => {
        const query = new URLSearchParams();
        if (params.search) query.append('search', params.search);
        if (params.page) query.append('page', params.page);
        if (params.limit) query.append('limit', params.limit);
        if (bypassCache) query.append('_nocache', Date.now());
        const qs = query.toString();
        return apiCall(`/customers${qs ? '?' + qs : ''}`);
    },

    /**
     * Get customer booking history
     */
    getBookings: async (customerId, params = {}, bypassCache = false) => {
        const query = new URLSearchParams();
        if (params.status) query.append('status', params.status);
        if (params.startDate) query.append('startDate', params.startDate);
        if (params.endDate) query.append('endDate', params.endDate);
        if (params.page) query.append('page', params.page);
        if (params.limit) query.append('limit', params.limit);
        if (bypassCache) query.append('_nocache', Date.now());
        const qs = query.toString();
        return apiCall(`/customers/${customerId}/bookings${qs ? '?' + qs : ''}`);
    },

    /**
     * Get customer statistics
     */
    getStats: async (customerId, params = {}, bypassCache = false) => {
        const query = new URLSearchParams();
        if (params.startDate) query.append('startDate', params.startDate);
        if (params.endDate) query.append('endDate', params.endDate);
        if (bypassCache) query.append('_nocache', Date.now());
        const qs = query.toString();
        return apiCall(`/customers/${customerId}/stats${qs ? '?' + qs : ''}`);
    }
};

// ==================== AI RECOMMENDATION APIs ====================
export const aiAPI = {
    /**
     * Get AI system health status
     */
    getHealth: async () => {
        return apiCall('/ai/health');
    },

    /**
     * Get trending posts (AI-powered)
     */
    getTrendingPosts: async (limit = 10) => {
        return apiCall(`/ai/feed/trending?limit=${limit}`);
    },

    /**
     * Get personalized feed for current user (AI-powered)
     */
    getPersonalizedFeed: async (limit = 20) => {
        return apiCall(`/ai/feed/personalized?limit=${limit}`);
    },

    /**
     * Get trending sport fields (AI-powered)
     */
    getTrendingFields: async (limit = 10, options = {}) => {
        const query = new URLSearchParams({ limit });
        if (options.sportType) query.append('sportType', options.sportType);
        if (options.area) query.append('area', options.area);
        return apiCall(`/ai/fields/trending?${query.toString()}`);
    },

    /**
     * Get field recommendations for user (AI-powered)
     */
    getFieldRecommendations: async (options = {}) => {
        const query = new URLSearchParams();
        if (options.limit) query.append('limit', options.limit);
        if (options.sportType) query.append('sportType', options.sportType);
        if (options.priceRange) query.append('priceRange', options.priceRange);
        if (options.timeSlot) query.append('timeSlot', options.timeSlot);
        return apiCall(`/ai/fields/recommendations?${query.toString()}`);
    }
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
    areaAPI,
    sportTypeAPI,
    sportFieldAPI,
    bookingAPI,
    customerAPI,
    feedbackAPI,
    aiAPI,
    imageToBase64,
    formatErrorMessage,
    shareAPI,
};
