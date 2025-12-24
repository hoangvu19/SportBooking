import React, { useState, useEffect, useRef } from 'react';
import { useI18n } from '../i18n';
import ConfirmModal from '../components/Shared/ConfirmModalClean';
import { useNavigate, useLocation } from 'react-router-dom';
import { API_BASE_URL } from '../config/apiConfig';
import AuthContext from './authContext';
import { initSocket, disconnectSocket } from '../utils/socket';
import { normalizeUser } from '../utils/normalize';

const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [activeRole, setActiveRole] = useState(() => {
        try { return localStorage.getItem('activeRole') || null; } catch { return null; }
    });
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();
    const location = useLocation();
    const initializedRef = useRef(false);
    const activeRoleRef = useRef(activeRole);

    // Use central normalizeUser from utils/normalize for consistent canonical user shape

    // Helper to determine highest-priority role
    const getHighestRole = (rolesArray = []) => {
        const roleNames = rolesArray.map(r => (r.roleName || r.RoleName || '').toString().toLowerCase());
        if (roleNames.some(rn => rn.includes('admin'))) return 'admin';
        if (roleNames.some(rn => rn.includes('owner') || rn.includes('host'))) return 'owner';
        return null;
    };

    // Normalize various role string representations (localized or raw) to canonical values
    const normalizeRoleString = (raw) => {
        if (!raw) return null;
        try {
            const s = raw.toString().toLowerCase().normalize('NFKD').replace(/\p{Diacritic}/gu, '');
            if (s.includes('admin') || s.includes('quantri') || s.includes('quan tri')) return 'admin';
            if (s.includes('owner') || s.includes('host') || s.includes('chusan') || s.includes('chu') || s.includes('chus') || s.includes('chusan')) return 'owner';
            if (s.includes('user') || s.includes('khach') || s.includes('nguoi')) return 'user';
            if (s.includes('owner')) return 'owner';
            return s;
        } catch {
            return raw;
        }
    };

    useEffect(() => {
        activeRoleRef.current = activeRole;
    }, [activeRole]);

    useEffect(() => {
        const onPopState = (e) => {
            try {
                try {
                    const state = e && e.state ? e.state : (typeof window !== 'undefined' ? window.history.state : null);
                    if (state && state.__programmatic) {
                        console.debug('[AuthProvider] Ignoring popstate due to programmatic history state', state);
                        return;
                    }
                } catch { void 0; }
                // use the shared ignore ref so other handlers can clear it
                if (ignorePopRef.current) {
                    console.log('[AuthProvider Popstate] Ignoring due to ignorePopRef');
                    return;
                }
                
                const path = (typeof window !== 'undefined' && window.location && window.location.pathname) ? window.location.pathname : '';
                
                // If user is not authenticated, force redirect to login to prevent Back restoring protected pages
                try {
                    const token = (() => { try { return localStorage.getItem('authToken'); } catch { return null; } })();
                    if (!token) {
                        try { window.location.replace('/login'); } catch { void 0; }
                        return;
                    }
                } catch { void 0; }
                
                const targetIsAdmin = path.startsWith('/admin');
                const targetIsOwner = path.startsWith('/courts');
                
                // Get current path for comparison
                const currentPath = (typeof window !== 'undefined' && window.location && window.location.pathname) ? window.location.pathname : '';
                const currentIsAdmin = currentPath.startsWith('/admin');
                const currentIsOwner = currentPath.startsWith('/courts');

                // debug: log popstate diagnostic info
                try {
                    const tokenPresent = (() => { try { return !!localStorage.getItem('authToken'); } catch { return null; } })();
                    console.debug('[AuthProvider Popstate]', { 
                        path, 
                        currentPath, 
                        tokenPresent, 
                        targetIsAdmin, 
                        currentIsAdmin, 
                        targetIsOwner, 
                        currentIsOwner, 
                        ignore: ignorePopRef.current 
                    });
                } catch { void 0; }

                // CRITICAL FIX: If navigating within same role section via back button, ALWAYS allow it
                if (targetIsAdmin && currentIsAdmin) {
                    console.log('[AuthProvider Popstate] Admin -> Admin navigation - ALLOWING without modal');
                    return;
                }
                if (targetIsOwner && currentIsOwner) {
                    console.log('[AuthProvider Popstate] Owner -> Owner navigation - ALLOWING without modal');
                    return;
                }

                // Only check role mismatch when crossing role boundaries
                // Check both state and localStorage for current role (state might not be set yet)
                let currentRole = activeRoleRef.current;
                if (!currentRole) {
                    try { currentRole = localStorage.getItem('activeRole'); } catch { /* ignore */ }
                }
                
                const targetRole = targetIsAdmin ? 'admin' : (targetIsOwner ? 'owner' : null);

                if ((targetRole && targetRole !== currentRole) || (!targetRole && (currentRole === 'admin' || currentRole === 'owner'))) {
                    const prettyTarget = targetRole ? (targetRole === 'admin' ? 'Admin' : 'Owner') : 'User';
                    try {
                        ignorePopRef.current = true;
                        try { window.__lastProgrammaticNav = Date.now(); } catch { void 0; }
                        try { window.history.replaceState({ ...(window.history.state || {}), __programmatic: Date.now() }, '', window.location.href); } catch { void 0; }
                        window.__historyRoleConfirm = { targetRole, prettyTarget };
                        let restoreUrl = '/feed';
                        if (currentRole === 'admin') restoreUrl = '/admin';
                        else if (currentRole === 'owner') restoreUrl = '/courts';
                        try { window.history.replaceState({ ...(window.history.state || {}), __programmatic: Date.now() }, '', restoreUrl); } catch { void 0; }
                        window.dispatchEvent(new Event('historyRoleConfirm'));
                    } catch (e) {
                        console.warn('failed to trigger history role confirm', e);
                        // ensure flag cleared on failure
                        ignorePopRef.current = false;
                    }
                }
            } catch (err) {
                console.warn('popstate guard failed', err);
            }
        };
    try { window.addEventListener('popstate', onPopState); } catch { void 0; }
    return () => { try { window.removeEventListener('popstate', onPopState); } catch { void 0; } };
    }, []);

    // Router-level guard: also watch location changes (covers cases where popstate isn't fired
    // or when other code changes location directly). If the new URL maps to a different role
    // than the current activeRole, restore the current role URL and open the confirmation modal.
    useEffect(() => {
        try {
            const path = location && location.pathname ? location.pathname : '';
            const currentPath = (typeof window !== 'undefined' && window.location && window.location.pathname) ? window.location.pathname : '';
            
            const targetIsAdmin = path.startsWith('/admin');
            const targetIsOwner = path.startsWith('/courts');
            const currentIsAdmin = currentPath.startsWith('/admin');
            const currentIsOwner = currentPath.startsWith('/courts');

            // Debug logging
            console.log('[AuthProvider Location Guard]', { 
                path, 
                currentPath, 
                targetIsAdmin, 
                currentIsAdmin, 
                targetIsOwner, 
                currentIsOwner, 
                activeRole, 
                ignore: ignorePopRef.current 
            });

            if (ignorePopRef.current) {
                console.log('[AuthProvider] Ignoring due to ignorePopRef');
                return;
            }

            // CRITICAL FIX: If navigating within same role section, ALWAYS allow it
            // Admin -> Admin (any sub-page): allow
            // Owner -> Owner (any sub-page): allow
            if (targetIsAdmin && currentIsAdmin) {
                console.log('[AuthProvider] Admin -> Admin navigation - ALLOWING without modal');
                return;
            }
            if (targetIsOwner && currentIsOwner) {
                console.log('[AuthProvider] Owner -> Owner navigation - ALLOWING without modal');
                return;
            }

            // Only check role mismatch when crossing role boundaries
            // Check both state and localStorage for current role (state might not be set yet)
            let currentRole = activeRole;
            if (!currentRole) {
                try { currentRole = localStorage.getItem('activeRole'); } catch { /* ignore */ }
            }
            
            const targetRole = targetIsAdmin ? 'admin' : (targetIsOwner ? 'owner' : null);

            // Only trigger modal when CROSSING role boundaries (not within same section)
            if ((targetRole && targetRole !== currentRole) || (!targetRole && (currentRole === 'admin' || currentRole === 'owner'))) {
                console.log('[AuthProvider] Role boundary crossed - showing modal', { currentRole, targetRole });
                try {
                    ignorePopRef.current = true;
                    try { window.__lastProgrammaticNav = Date.now(); } catch { void 0; }
                    try { window.history.replaceState({ ...(window.history.state || {}), __programmatic: Date.now() }, '', window.location.href); } catch { void 0; }
                    const prettyTarget = targetRole ? (targetRole === 'admin' ? 'Admin' : 'Owner') : 'User';
                    window.__historyRoleConfirm = { targetRole, prettyTarget };

                    let restoreUrl = '/feed';
                    if (currentRole === 'admin') restoreUrl = '/admin';
                    else if (currentRole === 'owner') restoreUrl = '/courts';
                    try { window.history.replaceState({ ...(window.history.state || {}), __programmatic: Date.now() }, '', restoreUrl); } catch { try { navigate(restoreUrl, { replace: true }); } catch { void 0; } }

                    window.dispatchEvent(new Event('historyRoleConfirm'));
                } catch (e) {
                    console.debug('location guard failed', e);
                    ignorePopRef.current = false;
                }
            }
            } catch { void 0; }
    }, [location, activeRole, navigate]);

    useEffect(() => {

        const checkAuth = async () => {
            const token = (() => { try { return localStorage.getItem('authToken'); } catch { return null; } })();
            const persistedUserRaw = (() => { try { return localStorage.getItem('userData'); } catch { return null; } })();

            try {
                if (token) {
                    // Try to refresh user profile from backend
                    try {
                        const resp = await fetch(`${API_BASE_URL}/auth/me`, {
                            headers: { Authorization: `Bearer ${token}` }
                        });

                        if (resp.ok) {
                            const data = await resp.json();
                            const freshUser = data && data.data ? data.data : data || {};

                            // Ensure roles array and include default 'user' role when missing
                            const rolesArr = Array.isArray(freshUser.roles) ? [...freshUser.roles] : [];
                            const hasUserById = rolesArr.some(r => {
                                try { return (r && ((r.RoleID === 3) || (r.roleId === 3) || (Number(r.RoleID) === 3))); } catch { return false; }
                            });
                            const hasUserByName = rolesArr.some(r => {
                                const rn = (r && (r.roleName || r.RoleName || r.name || r.Role || '')).toString().toLowerCase();
                                return rn.includes('user');
                            });
                            if (!hasUserById && !hasUserByName) {
                                rolesArr.push({ roleName: 'User', RoleID: 3, name: 'user' });
                            }
                            freshUser.roles = rolesArr;

                            const normalized = normalizeUser(freshUser);
                            setUser(normalized);
                            try { localStorage.setItem('userData', JSON.stringify(normalized)); } catch (e) { console.warn('Could not persist userData', e); }

                            // Resolve active role preference
                            const roles = Array.isArray(freshUser.roles) ? freshUser.roles : [];
                            const highest = getHighestRole(roles);
                            let chosenRole = null;
                            try {
                                const persisted = (() => { try { return localStorage.getItem('activeRole'); } catch { return null; } })();
                                const persistedNorm = persisted ? persisted.toString().toLowerCase() : null;
                                if (persistedNorm) {
                                    const hasPersisted = roles.some(r => {
                                        const rn = (r.roleName || r.RoleName || r.name || r.Role || '').toString().toLowerCase();
                                        return rn.includes(persistedNorm) || persistedNorm.includes(rn);
                                    });
                                    if (hasPersisted) chosenRole = persistedNorm;
                                }
                            } catch { void 0; }
                            if (!chosenRole) chosenRole = highest;
                            if (chosenRole) {
                                try { localStorage.setItem('activeRole', chosenRole); } catch { void 0; }
                                setActiveRole(chosenRole);
                            }

                            const currentPath = (typeof window !== 'undefined' && window.location && window.location.pathname) ? window.location.pathname : '';
                            if (chosenRole === 'admin' && !currentPath.startsWith('/admin')) {
                                try { ignorePopRef.current = true; try { window.__lastProgrammaticNav = Date.now(); } catch { void 0; } } catch { void 0; }
                                try { window.location.replace('/admin'); } catch { try { navigate('/admin', { replace: true }); } catch { void 0; } }
                                setTimeout(() => { try { ignorePopRef.current = false; } catch { void 0; } }, 250);
                            } else if (chosenRole === 'owner' && !currentPath.startsWith('/courts')) {
                                try { ignorePopRef.current = true; try { window.__lastProgrammaticNav = Date.now(); } catch { void 0; } } catch { void 0; }
                                try { window.location.replace('/courts'); } catch { try { navigate('/courts', { replace: true }); } catch { void 0; } }
                                setTimeout(() => { try { ignorePopRef.current = false; } catch { void 0; } }, 250);
                            } else if (!chosenRole && (currentPath === '/' || currentPath === '')) {
                                try { ignorePopRef.current = true; try { window.__lastProgrammaticNav = Date.now(); } catch { void 0; } } catch { void 0; }
                                try { window.location.replace('/feed'); } catch { try { navigate('/feed', { replace: true }); } catch { void 0; } }
                                setTimeout(() => { try { ignorePopRef.current = false; } catch { void 0; } }, 250);
                            }
                        } else {
                            // If /auth/me returned non-ok, the token is likely invalid/expired.
                            // Clear the stored token so subsequent API calls don't keep failing with 401.
                            try {
                                localStorage.removeItem('authToken');
                            } catch  { /* ignore */ }

                            if (persistedUserRaw && persistedUserRaw !== 'undefined') {
                                try {
                                    const parsed = JSON.parse(persistedUserRaw);
                                    const normalized = normalizeUser(parsed);
                                    setUser(normalized);
                                } catch (e) { console.warn('Failed parsing persisted userData', e); }
                            }
                        }
                    } catch (err) {
                        console.warn('Failed to refresh user profile', err && (err.message || err));
                        if (persistedUserRaw && persistedUserRaw !== 'undefined') {
                            try {
                                const parsed = JSON.parse(persistedUserRaw);
                                const normalized = normalizeUser(parsed);
                                setUser(normalized);
                            } catch (e) { console.warn('Failed parsing persisted userData', e); }
                        }
                    }
                } else {
                    // No token: try to use persisted user if present
                    if (persistedUserRaw && persistedUserRaw !== 'undefined') {
                        try {
                            const parsed = JSON.parse(persistedUserRaw);
                            const normalized = normalizeUser(parsed);
                            setUser(normalized);
                        } catch (e) { console.warn('Failed parsing persisted userData', e); }
                    }
                }
            } catch (error) {
                console.error('Auth check failed:', error);
                try { localStorage.removeItem('authToken'); } catch { void 0; }
                try { localStorage.removeItem('userData'); } catch { void 0; }
            } finally {
                setIsLoading(false);
            }
        };

        // run auth check only once on mount — do NOT rerun on every location change
        if (!initializedRef.current) {
            initializedRef.current = true;
            checkAuth();
        }
    }, [navigate]);

    // Listen for global user updates and refresh auth context so all UI updates
    // immediately when some component (e.g., ProfileModal) updates the user.
    useEffect(() => {
        const onUserUpdated = async () => {
            try {
                const token = (() => { try { return localStorage.getItem('authToken'); } catch { return null; } })();
                if (!token) return;
                const resp = await fetch(`${API_BASE_URL}/auth/me`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (!resp.ok) return;
                const data = await resp.json();
                const freshUser = data && data.data ? data.data : data || {};
                const normalized = normalizeUser(freshUser);
                setUser(normalized);
                try { localStorage.setItem('userData', JSON.stringify(normalized)); } catch { void 0; }
            } catch (err) {
                console.debug('onUserUpdated failed', err && err.message);
            }
        };
        try { window.addEventListener('user:updated', onUserUpdated); } catch { void 0; }
        return () => { try { window.removeEventListener('user:updated', onUserUpdated); } catch { void 0; } };
    }, []);

    useEffect(() => {
        const onAuthExpired = (e) => {
            console.warn('Auth expired event received', e && e.detail);
            localStorage.removeItem('authToken');
            localStorage.removeItem('userData');
            setUser(null);
            // navigate to login
            try { window.location.replace('/login'); } catch { try { navigate('/login'); } catch { void 0; } }
        };

        window.addEventListener('auth:expired', onAuthExpired);
        // listen to active role changes from UI components
        const onActiveRoleChanged = (ev) => {
            try {
                const payload = ev && ev.detail;
                let newRole = null;
                if (payload) {
                    if (typeof payload === 'string') newRole = payload;
                    else if (typeof payload === 'object') newRole = payload.role || payload.roleName || payload.name || null;
                }
                // normalize and persist user's explicit selection where possible
                const normalized = normalizeRoleString(newRole);
                try { if (normalized) localStorage.setItem('activeRole', normalized); else localStorage.removeItem('activeRole'); } catch { void 0; }
                setActiveRole(normalized);
            } catch { void 0; }
        };
        window.addEventListener('activeRole:changed', onActiveRoleChanged);
        return () => {
            window.removeEventListener('auth:expired', onAuthExpired);
            window.removeEventListener('activeRole:changed', onActiveRoleChanged);
        };
    }, [navigate]);

    // history-role modal state: listens to custom event dispatched from popstate handler
    const { t } = useI18n();
    const [historyConfirm, setHistoryConfirm] = useState(null);
    const ignorePopRef = useRef(false);

    useEffect(() => {
        const onRequest = () => {
            try {
                const req = window.__historyRoleConfirm || null;
                if (!req) return;
                setHistoryConfirm(req);
            } catch { void 0; }
        };
        try { window.addEventListener('historyRoleConfirm', onRequest); } catch { void 0; }
        return () => { try { window.removeEventListener('historyRoleConfirm', onRequest); } catch { void 0; } };
    }, []);

    const acceptHistoryChange = () => {
        const req = historyConfirm || (typeof window !== 'undefined' && window.__historyRoleConfirm) || null;
        try {
            console.debug('[AuthProvider] acceptHistoryChange', { req, activeRole: activeRoleRef.current });
        } catch { void 0; }
        if (req) {
            const targetRole = req.targetRole;
            if (targetRole) {
                try { localStorage.setItem('activeRole', targetRole); } catch { void 0; }
                setActiveRole(targetRole);
                try { window.dispatchEvent(new CustomEvent('activeRole:changed', { detail: { role: targetRole } })); } catch { void 0; }
            } else {
                try { localStorage.removeItem('activeRole'); } catch { void 0; }
                setActiveRole(null);
                try { window.dispatchEvent(new CustomEvent('activeRole:changed', { detail: { role: null } })); } catch { void 0; }
            }
        }
        setHistoryConfirm(null);
        try { window.__historyRoleConfirm = null; } catch { void 0; }
        // navigate to the requested target using hard replace (so back won't restore previous role)
        try {
            const req2 = req;
            if (req2 && req2.targetRole === 'admin') {
                window.location.replace('/admin');
                return;
            }
            if (req2 && req2.targetRole === 'owner') {
                window.location.replace('/courts');
                return;
            }
            // fallback: user/feed
            window.location.replace('/feed');
        } catch {
            // ensure the guard is cleared if navigation fails
            ignorePopRef.current = false;
        }
    };

    const declineHistoryChange = () => {
        try { console.debug('[AuthProvider] declineHistoryChange', { activeRole: activeRoleRef.current, historyConfirm }); } catch { void 0; }
        const currentRole = activeRoleRef.current;
        if (currentRole === 'admin') window.location.replace('/admin');
    else if (currentRole === 'owner') window.location.replace('/courts');
        else window.location.replace('/feed');
        setHistoryConfirm(null);
        try { window.__historyRoleConfirm = null; } catch { void 0; }
        // allow popstate handling again after a small delay
        setTimeout(() => { ignorePopRef.current = false; }, 50);
    };

    const login = async (identifier, password) => {
        try {
            // Direct login: call server /auth/login which returns token + user
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier, password })
            });

            const data = await response.json();
            if (response.ok && data && data.success) {
                try { localStorage.setItem('authToken', data.data.token); } catch { /* ignore */ }

                const loginUser = data.data.user || {};
                const loginRoles = Array.isArray(loginUser.roles) ? [...loginUser.roles] : [];
                const hasUserById = loginRoles.some(r => { try { return (r && ((r.RoleID === 3) || (r.roleId === 3) || (Number(r.RoleID) === 3))); } catch { return false; } });
                const hasUserByName = loginRoles.some(r => { const rn = (r && (r.roleName || r.RoleName || r.name || r.Role || '')).toString().toLowerCase(); return rn.includes('user'); });
                if (!hasUserById && !hasUserByName) loginRoles.push({ roleName: 'User', RoleID: 3, name: 'user' });
                loginUser.roles = loginRoles;

                try {
                    const normalizedLoginUser = normalizeUser(loginUser);
                    localStorage.setItem('userData', JSON.stringify(normalizedLoginUser));
                    setUser(normalizedLoginUser);
                } catch {
                    localStorage.setItem('userData', JSON.stringify(loginUser));
                    setUser(loginUser);
                }

                // Init socket
                try { initSocket(); } catch (err) { console.error('Failed to init socket after login', err); }

                // Persist activeRole
                try {
                    const highest = getHighestRole(Array.isArray(data.data.user.roles) ? data.data.user.roles : []);
                    if (highest) { try { localStorage.setItem('activeRole', highest); } catch { /* ignore */ } setActiveRole(highest); }
                    else { try { localStorage.removeItem('activeRole'); } catch { /* ignore */ } setActiveRole(null); }
                } catch { /* ignore */ }

                // Navigate by role
                try { ignorePopRef.current = true; try { window.__lastProgrammaticNav = Date.now(); } catch { void 0; } } catch { void 0; }
                try {
                    const highest = getHighestRole(Array.isArray(data.data.user.roles) ? data.data.user.roles : []);
                    if (highest === 'admin') { try { window.location.replace('/admin'); } catch { try { navigate('/admin', { replace: true }); } catch { /* ignore */ } } }
                    else if (highest === 'owner') { try { window.location.replace('/courts'); } catch { try { navigate('/courts', { replace: true }); } catch { /* ignore */ } } }
                    else { try { window.location.replace('/feed'); } catch { try { navigate('/feed', { replace: true }); } catch { /* ignore */ } } }
                    setTimeout(() => { try { ignorePopRef.current = false; } catch { /* ignore */ } }, 250);
                } catch (navErr) { console.warn('Role-based navigation failed', navErr); try { navigate('/feed'); } catch { /* ignore */ } setTimeout(() => { try { ignorePopRef.current = false; } catch { /* ignore */ } }, 250); }

                return { success: true, user: data.data.user };
            }

            return { success: false, message: (data && data.message) || 'Login failed' };
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, message: 'An error occurred during login' };
        }
    };

    // Passwordless: request a login code to be sent to email (no password required)
    const sendLoginCode = async (email) => {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/send-login-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await response.json();
            if (response.ok && data.success) {
                // Server will give otpSessionId and in dev may return the OTP when DEV_SHOW_OTP=true
                try { localStorage.setItem('otpSessionId', data.data.otpSessionId); } catch { /* ignore */ }
                return { success: true, otpRequired: true, otpSessionId: data.data.otpSessionId, otp: data.data.otp };
            } else {
                return { success: false, message: data.message };
            }
        } catch (error) {
            console.error('sendLoginCode error:', error);
            return { success: false, message: 'An error occurred while requesting the login code' };
        }
    };

    // Credential-based OTP request: verify credentials then create an OTP session
    const requestLoginOtp = async (identifier, password) => {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/login-otp-request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier, password })
            });

            const data = await response.json();
            if (response.ok && data.success) {
                try { localStorage.setItem('otpSessionId', data.data.otpSessionId); } catch { /* ignore */ }
                return { success: true, otpRequired: true, otpSessionId: data.data.otpSessionId, otp: data.data.otp };
            }
            return { success: false, message: data.message };
        } catch (error) {
            console.error('requestLoginOtp error:', error);
            return { success: false, message: 'An error occurred while requesting OTP' };
        }
    };

    // Verify OTP and finalize login
    const verifyOtp = async (otpSessionId, code) => {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ otpSessionId, code })
            });

            const data = await response.json();
            if (response.ok && data.success) {
                localStorage.setItem('authToken', data.data.token);
                // Ensure login user object contains the default user role as well
                const loginUser = data.data.user || {};
                const loginRoles = Array.isArray(loginUser.roles) ? [...loginUser.roles] : [];
                const hasUserById = loginRoles.some(r => {
                    try { return (r && ((r.RoleID === 3) || (r.roleId === 3) || (Number(r.RoleID) === 3))); } catch { return false; }
                });
                const hasUserByName = loginRoles.some(r => {
                    const rn = (r && (r.roleName || r.RoleName || r.name || r.Role || '')).toString().toLowerCase();
                    return rn.includes('user');
                });
                if (!hasUserById && !hasUserByName) {
                    loginRoles.push({ roleName: 'User', RoleID: 3, name: 'user' });
                }
                                loginUser.roles = loginRoles;
                                // Normalize before persisting to localStorage and context
                                try {
                                    const normalizedLoginUser = normalizeUser(loginUser);
                                    localStorage.setItem('userData', JSON.stringify(normalizedLoginUser));
                                    setUser(normalizedLoginUser);
                                } catch  {
                                    // fallback
                                    localStorage.setItem('userData', JSON.stringify(loginUser));
                                    setUser(loginUser);
                                }

                // Initialize Socket.io connection after successful login
                try {
                    initSocket();
                } catch (error) {
                    console.error('Failed to initialize socket:', error);
                }

                // Persist a sensible activeRole on successful login: prefer server highest role
                try {
                    const highest = getHighestRole(Array.isArray(data.data.user.roles) ? data.data.user.roles : []);
                    if (highest) {
                        try { localStorage.setItem('activeRole', highest); } catch { void 0; }
                        setActiveRole(highest);
                    } else {
                        try { localStorage.removeItem('activeRole'); } catch { void 0; }
                        setActiveRole(null);
                    }
                } catch { void 0; }

                // Role priority: admin -> owner -> others
                try {
                    const highest = getHighestRole(Array.isArray(data.data.user.roles) ? data.data.user.roles : []);
                    // prevent our own programmatic navigation from triggering the history modal
                    try { ignorePopRef.current = true; try { window.__lastProgrammaticNav = Date.now(); } catch { void 0; } } catch { void 0; }
                    if (highest === 'admin') {
                        try { window.location.replace('/admin'); } catch { try { navigate('/admin', { replace: true }); } catch { void 0; } }
                    } else if (highest === 'owner') {
                        try { window.location.replace('/courts'); } catch { try { navigate('/courts', { replace: true }); } catch { void 0; } }
                    } else {
                        try { window.location.replace('/feed'); } catch { try { navigate('/feed', { replace: true }); } catch { void 0; } }
                    }
                    // clear the guard shortly after navigation completes
                    setTimeout(() => { try { ignorePopRef.current = false; } catch { void 0; } }, 250);
                } catch (navErr) {
                    console.warn('Role-based navigation failed, falling back to /feed', navErr && navErr.message);
                    try { navigate('/feed'); } catch { void 0; }
                    setTimeout(() => { try { ignorePopRef.current = false; } catch { void 0; } }, 250);
                }

                return { success: true, user: data.data.user };
            } else {
                return { success: false, message: data.message };
            }
        } catch (error) {
            console.error('Verify OTP error:', error);
            return { success: false, message: 'An error occurred while verifying OTP' };
        }
    };

        // account activation via token has been removed from this app (registrations create account immediately)

    const logout = () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
        // remove persisted activeRole on logout so next login starts with server default
        try { localStorage.removeItem('activeRole'); } catch { void 0; }
        // Clear notification cache on logout
        try { localStorage.removeItem('notifications_cache'); } catch { void 0; }
        setUser(null);
        
        // Disconnect Socket.io on logout
        try {
            disconnectSocket();
        } catch (error) {
            console.error('Failed to disconnect socket:', error);
        }
        
    // Navigate to login page using hard replace so back doesn't restore protected pages
    try { window.location.replace('/login'); } catch { void 0; }
    };

    const signup = async (userData) => {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userData)
            });

            const data = await response.json();

            if (response.ok && data.success) {
                    // If server indicates OTP is required to finalize registration, return that info
                    if (data.data && data.data.otpSessionId) {
                        return { success: true, otpRequired: true, otpSessionId: data.data.otpSessionId, otp: data.data.otp };
                    }

                    // Persist sensible default role for newly created accounts (if server already created the account)
                    try {
                        const defaultRole = 'user';
                        try { localStorage.setItem('activeRole', defaultRole); } catch { void 0; }
                        setActiveRole(defaultRole);
                        try { window.dispatchEvent(new CustomEvent('activeRole:changed', { detail: { role: defaultRole } })); } catch { void 0; }
                    } catch (e) {
                        console.warn('Failed to persist default active role for new signup', e);
                    }

                    return { success: true, message: data.message };
            } else {
                return { success: false, message: data.message };
            }
        } catch (error) {
            console.error('Signup error:', error);
            // More helpful message for network failures (e.g., backend not running)
            if (error && (error.message === 'Failed to fetch' || error.message.includes('NetworkError') || error.message.includes('connect'))) {
                return { success: false, message: `Không thể kết nối tới API (${API_BASE_URL}). Hãy đảm bảo backend đang chạy.` };
            }
            return { success: false, message: 'An error occurred during signup' };
        }
    };

    const verifyRegister = async (otpSessionId, code) => {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/register/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ otpSessionId, code })
            });

            const data = await response.json();
            if (response.ok && data.success) {
                return { success: true, message: data.message };
            }
            return { success: false, message: data.message };
        } catch (err) {
            console.error('verifyRegister error', err);
            return { success: false, message: 'An error occurred while verifying registration' };
        }
    };

    const forgotPassword = async (payload) => {
        // payload can be a string (email) or an object { username, email }
        try {
            let body = {};
            if (typeof payload === 'string') body = { email: payload };
            else body = payload || {};

            const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body)
            });

            const data = await response.json();

            if (response.ok && data.success) {
                return { success: true, message: data.message };
            } else {
                return { success: false, message: data.message };
            }
        } catch (error) {
            console.error('Forgot password error:', error);
            return { success: false, message: 'An error occurred while sending the password reset email' };
        }
    };

    const value = {
        user,
        setUser,
        isLoading,
        activeRole,
        setActiveRole,
        login,
        requestLoginOtp,
        verifyOtp,
        sendLoginCode,
        verifyRegister,
        logout,
        signup,
        forgotPassword
    };

    return (
        <AuthContext.Provider value={value}>
            {children}

            {historyConfirm && (
                <ConfirmModal
                    title={t('confirm.roleChangeTitle') || 'Xác nhận đổi vai trò'}
                    message={(t('confirm.roleChangeMessage') || 'Bạn vừa điều hướng tới trang {role}. Bạn có muốn đổi vai trò không?').replace('{role}', historyConfirm.prettyTarget)}
                    cancelLabel={t('common.cancel') || 'Hủy'}
                    confirmLabel={t('common.confirm') || 'Đồng ý'}
                    onCancel={declineHistoryChange}
                    onConfirm={acceptHistoryChange}
                />
            )}
        </AuthContext.Provider>
    );
};

export default AuthProvider;