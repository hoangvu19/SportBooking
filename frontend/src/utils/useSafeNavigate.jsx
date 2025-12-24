import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// Hook that returns a navigate wrapper which marks programmatic history entries
// and forces a hard replace for critical auth/role paths (/login, /admin, /courts).
export default function useSafeNavigate() {
  const navigate = useNavigate();

  const safeNavigate = useCallback((to, options) => {
    // If destination is a string, normalize
    const dest = typeof to === 'string' ? to : (to && to.pathname) || '';

    // For critical auth/role targets, prefer a hard replace so Back cannot restore
  if (typeof dest === 'string' && (dest.startsWith('/login') || dest.startsWith('/admin') || dest.startsWith('/courts'))) {
      try {
        // use a full page replace first (most robust)
        window.location.replace(dest);
        return;
      } catch {
        // fallback to SPA replace
        try { navigate(dest, { replace: true }); } catch { /* ignore */ }
        return;
      }
    }

    // Do SPA navigate then mark the newest history entry as programmatic so popstate guards can ignore it
    try {
      navigate(to, options);
    } catch {
      // best-effort: if navigate throws for some reason, try direct location
      try { window.location.href = typeof to === 'string' ? to : (to && to.pathname) || window.location.href; } catch { /* ignore */ }
      return;
    }

    // mark the current history entry as programmatic so popstate handlers can ignore it
    try {
      const prevState = window.history.state || {};
      window.history.replaceState({ ...prevState, __programmatic: Date.now() }, '', window.location.pathname + window.location.search);
    } catch {
      // ignore
    }
  }, [navigate]);

  return safeNavigate;
}
