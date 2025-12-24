import { API_BASE_URL } from '../config/apiConfig';

const getAuthToken = () => localStorage.getItem('authToken');

const buildHeaders = (isFormData = false, extra = {}) => {
  const headers = { ...extra };
  if (!isFormData) headers['Content-Type'] = 'application/json';
  const token = getAuthToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const activeRole = localStorage.getItem('activeRole');
    if (activeRole) headers['X-Active-Role'] = activeRole;
  } catch {''}
  return headers;
};

// Helper to inspect current auth info (useful in browser console)
export const getAuthInfo = () => {
  try {
    return {
      authToken: getAuthToken(),
      activeRole: (() => { try { return localStorage.getItem('activeRole'); } catch { return null; } })()
    };
  } catch {
    return { authToken: null, activeRole: null };
  }
};

const handleResponse = async (res) => {
  let data = null;
  try {
    data = await res.json();
  } catch  {
    // no json
  }
  if (!res.ok) {
    const err = new Error((data && data.message) ? data.message : `HTTP ${res.status}`);
    err.status = res.status;
    err.response = data;
    throw err;
  }
  return { data };
};

const apiClient = {
  get: async (path, opts = {}) => {
    const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
    const headers = buildHeaders(false, opts.headers);
    // Debug: log auth & role for report endpoints to help diagnose 401
    try {
      if (url.includes('/api/reports')) {
        console.debug('[apiClient] GET', url, { Authorization: !!headers.Authorization, XActiveRole: headers['X-Active-Role'], rawAuth: headers.Authorization });
      }
    } catch { void 0; }
    const res = await fetch(url, { method: 'GET', headers, ...opts });
    return handleResponse(res);
  },
  post: async (path, body, opts = {}) => {
    const isFormData = body instanceof FormData;
    const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
    const headers = buildHeaders(isFormData, opts.headers);
    try {
      if (url.includes('/api/reports')) {
        console.debug('[apiClient] POST', url, { Authorization: !!headers.Authorization, XActiveRole: headers['X-Active-Role'], rawAuth: headers.Authorization });
      }
    } catch { void 0; }
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: isFormData ? body : JSON.stringify(body),
      ...opts,
    });
    return handleResponse(res);
  },
  put: async (path, body, opts = {}) => {
    const isFormData = body instanceof FormData;
    const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
    const headers = buildHeaders(isFormData, opts.headers);
    try {
      if (url.includes('/api/reports')) {
        console.debug('[apiClient] PUT', url, { Authorization: !!headers.Authorization, XActiveRole: headers['X-Active-Role'], rawAuth: headers.Authorization });
      }
    } catch { void 0; }
    const res = await fetch(url, {
      method: 'PUT',
      headers,
      body: isFormData ? body : JSON.stringify(body),
      ...opts,
    });
    return handleResponse(res);
  },
  patch: async (path, body, opts = {}) => {
    const isFormData = body instanceof FormData;
    const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
    const headers = buildHeaders(isFormData, opts.headers);
    try {
      if (url.includes('/api/reports')) {
        console.debug('[apiClient] PATCH', url, { Authorization: !!headers.Authorization, XActiveRole: headers['X-Active-Role'], rawAuth: headers.Authorization });
      }
    } catch { void 0; }
    const res = await fetch(url, {
      method: 'PATCH',
      headers,
      body: isFormData ? body : JSON.stringify(body),
      ...opts,
    });
    return handleResponse(res);
  },
  delete: async (path, opts = {}) => {
    const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
    const headers = buildHeaders(false, opts.headers);
    try {
      if (url.includes('/api/reports')) {
        console.debug('[apiClient] DELETE', url, { Authorization: !!headers.Authorization, XActiveRole: headers['X-Active-Role'], rawAuth: headers.Authorization });
      }
    } catch { void 0; }
    const res = await fetch(url, { method: 'DELETE', headers, ...opts });
    return handleResponse(res);
  }
};

export default apiClient;
