import React, { useEffect, useState, useRef } from 'react';
import { User as UserIcon } from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import DEFAULT_AVATAR from '../../utils/defaults';
// using window.location.replace for role navigation (hard replace)
import { useI18n } from '../../i18n/hooks';

const SearchWithToggle = ({ onSearch }) => {
  const { t } = useI18n();
  // simple search (no sticky pin)

  const [q, setQ] = useState('');

  const handleKey = (e) => {
    if (e.key === 'Enter') {
      onSearch && onSearch(q.trim());
    }
  };

  const clear = () => { setQ(''); onSearch && onSearch(''); };

  return (
    <div className="relative">
      <input
        aria-label={t('common.searchAria') || 'Search'}
        placeholder={t('common.searchPlaceholder') || 'Search ...'}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={handleKey}
        className="w-full rounded-full border border-gray-300 px-4 py-2 pl-12 pr-20 text-sm bg-white text-gray-700 shadow-sm placeholder-gray-400 focus:outline-none"
      />

      <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </span>

      {/* search button (left of pin) */}
      <button
        type="button"
        onClick={() => onSearch && onSearch(q.trim())}
        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 p-2"
        title={t('common.search') || 'Search'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {q && (
        <button type="button" onClick={clear} className="absolute right-10 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1" title={t('common.clear') || 'Clear'}>
          ✕
        </button>
      )}

      {/* pin button removed */}
    </div>
  );
};

const AdminHeader = ({ onSearch }) => {
  const { user } = useAuth();
  const { t, lang, setLang } = useI18n();

  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef = useRef(null);
  const avatarToggleRef = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (avatarRef.current && avatarRef.current.contains(e.target)) return;
      if (avatarToggleRef.current && avatarToggleRef.current.contains(e.target)) return;
      if (avatarOpen) setAvatarOpen(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [avatarOpen]);

  return (
  <header className="flex items-center justify-between p-4 bg-white border-b">
      <div className="flex-1">
        <div className="max-w-3xl mx-auto">
          <div className="relative">
            <SearchWithToggle onSearch={onSearch} />
          </div>
        </div>
      </div>

  <div className="flex items-center gap-4 ml-6">
        <div className="text-sm text-gray-500 hidden md:flex items-center space-x-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLang && setLang('en')}
              aria-pressed={lang === 'en'}
              className={`px-2 py-1 rounded ${lang === 'en' ? 'bg-gray-100 text-gray-900' : 'hover:text-cyan-500 text-gray-600'}`}
            >
              En
            </button>
            <div className="text-gray-300">|</div>
            <button
              onClick={() => setLang && setLang('vi')}
              aria-pressed={lang === 'vi'}
              className={`px-2 py-1 rounded ${lang === 'vi' ? 'bg-gray-100 text-gray-900' : 'hover:text-cyan-500 text-gray-600'}`}
            >
              VN
            </button>
          </div>

          <div className="flex items-center gap-3 relative">
            <div className="text-sm text-gray-800">{user?.fullName || user?.username}</div>

            <div ref={avatarToggleRef} className="text-gray-400 cursor-pointer" role="button" tabIndex={0}
                 onClick={() => setAvatarOpen(s => !s)} onKeyDown={(e) => { if (e.key === 'Enter') setAvatarOpen(s=>!s); }}>
              {user && (user.avatarUrl || user.profile_picture || user.AvatarUrl || user.ProfilePictureURL) ? (
                <img src={user.avatarUrl || user.profile_picture || user.AvatarUrl || user.ProfilePictureURL} alt="avatar" className="w-6 h-6 rounded-full object-cover" onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_AVATAR; }} />
              ) : (
                <UserIcon className="w-6 h-6" />
              )}
            </div>

            {avatarOpen && (
              <div ref={avatarRef} className="absolute right-0 top-full mt-2 w-64 bg-white border border-gray-200 rounded shadow-lg z-50">
                <div className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-r from-pink-400 to-indigo-400 flex items-center justify-center text-white font-semibold">
                      {user && (user.avatarUrl || user.profile_picture || user.AvatarUrl || user.ProfilePictureURL) ? (
                        <img src={user.avatarUrl || user.profile_picture || user.AvatarUrl || user.ProfilePictureURL} alt="avatar" className="w-full h-full object-cover" onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_AVATAR; }} />
                      ) : (
                        (user && (user.fullName || user.name || user.username) && (user.fullName || user.name || user.username)[0]) || 'U'
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{user?.fullName || user?.username || 'User'}</div>
                      <div className="text-xs text-gray-500">@{user?.username || 'user'}</div>
                      {user?.email && <div className="text-xs text-gray-400">{user.email}</div>}
                    </div>
                  </div>
                </div>

                <div className="px-2 py-2 border-t">
                    <div className="text-xs text-gray-500 uppercase px-2">{t('settings.roles') || 'Roles'}</div>
                  <div className="mt-2 space-y-1 px-2">
                    {Array.isArray(user?.roles) && user.roles.length > 0 ? (
                      user.roles.map((r, i) => {
                        // try multiple fields for role label
                        const rnRaw = (r && (r.roleName || r.RoleName || r.name || r.Role || r.code || r.role || r.displayName || '')).toString();
                        const rn = rnRaw;

                        return (
                          <button
                            key={i}
                            onClick={() => {
                              try {
                                // normalize role before persisting/dispatching
                                let normalized = rn.toString().toLowerCase().normalize('NFKD').replace(/\p{Diacritic}/gu, '');
                                if (normalized.includes('admin') || normalized.includes('quantri')) normalized = 'admin';
                                else if (normalized.includes('owner') || normalized.includes('host') || normalized.includes('chu') || normalized.includes('chusan')) normalized = 'owner';
                                else if (normalized.includes('user') || normalized.includes('khach')) normalized = 'user';

                                try { localStorage.setItem('activeRole', normalized); } catch { /* ignore */ }
                                try { window.dispatchEvent(new CustomEvent('activeRole:changed', { detail: normalized })); } catch { /* ignore */ }

                                // Use hard replace navigation so browser history can't return to previous role
                                if (normalized === 'owner') {
                                  window.location.replace('/courts');
                                } else if (normalized === 'admin') {
                                  window.location.replace('/admin');
                                } else {
                                  window.location.replace('/');
                                }
                              } catch (e) {
                                console.warn('set activeRole or navigate failed', e);
                              } finally {
                                setAvatarOpen(false);
                              }
                            }}
                            className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm"
                          >
                            {rn}
                          </button>
                        );
                      })
                    ) : (
                      <div className="text-sm text-gray-600 px-2 py-2">{t('settings.noRoles') || 'No roles found'}</div>
                    )}
                  </div>
                </div>

                <div className="px-3 py-2 border-t">
                  <button onClick={() => { try { localStorage.removeItem('authToken'); localStorage.removeItem('userData'); window.dispatchEvent(new CustomEvent('logout')); window.location.replace('/login'); } catch (e) { console.warn(e); } }} className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm text-red-600">{t('settings.logout') || 'Log out'}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default AdminHeader;
