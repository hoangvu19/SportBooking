// Small helper to get backend origin from API_BASE_URL
import { API_BASE_URL } from '../config/apiConfig';

export function getBackendOrigin() {
  // API_BASE_URL typically 'http://localhost:5000/api'
  if (!API_BASE_URL) return '';
  return API_BASE_URL.replace(/\/api$/i, '');
}

export default getBackendOrigin;

/**
 * Convert a backend-stored path or URL into an absolute URL the frontend can load.
 * - preserves http/https absolute URLs
 * - converts backslashes to slashes
 * - prefixes backend origin for paths starting with '/' or 'uploads'
 */
export function toAbsoluteUrl(backendOrigin, raw, defaultFolder = '') {
  if (!raw) return null;
  let u = String(raw).trim();
  // normalize backslashes
  u = u.replace(/\\/g, '/');
  // already absolute
  if (/^https?:\/\//i.test(u)) return u;
  // leading protocol-relative (//host/...) keep as-is
  if (/^\/\//.test(u)) return u;

  // paths starting with '/' -> prefix backendOrigin
  if (u.startsWith('/')) {
    return (backendOrigin || '').replace(/\/$/, '') + u;
  }

  // handle common case where DB stores 'uploads/...' without leading slash
  if (u.startsWith('uploads/') || u.startsWith('./uploads/') || u.startsWith('./uploads')) {
    const path = u.replace(/^\.\/?/, '');
    return (backendOrigin || '').replace(/\/$/, '') + '/' + path;
  }

  // if the value is just a filename like 'abc.jpg', assume it's in /uploads/<defaultFolder>/ or /uploads/
  if (!u.includes('/') && /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(u)) {
    const folder = defaultFolder ? `${defaultFolder.replace(/^\/+|\/+$/g, '')}/` : '';
    return (backendOrigin || '').replace(/\/$/, '') + '/uploads/' + folder + u;
  }

  // fallback: return as-is (may be relative to frontend)
  return u;
}
