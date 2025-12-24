import React, { useState } from 'react';
import { authAPI, userAPI } from '../../utils/api';
import { getPhone, normalizeUser } from '../../utils/normalize';
import TRANSLATIONS from '../../i18n/translations';
import toast from 'react-hot-toast';
import { useI18n } from '../../i18n';
import { Eye, EyeOff } from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import DEFAULT_AVATAR from '../../utils/defaults';

const Settings = () => {
  const { t, lang, setLang } = useI18n();
  const location = useLocation();
  const { user, setUser, setActiveRole, activeRole } = useAuth();
  const isOwnerSettings = typeof window !== 'undefined' ? location.pathname.startsWith('/courts') : false;
  const serverRoles = Array.isArray(user?.roles) && user.roles.length > 0 ? user.roles : [];
  let displayRoles = [];
  if (serverRoles.length === 0) {
    displayRoles = [{ roleName: 'User', RoleID: 3, name: 'user' }];
  } else {
    const hasPriv = serverRoles.some(r => {
      const rn = (r.roleName || r.RoleName || r.name || r.Role || '').toString().toLowerCase();
      return rn.includes('admin') || rn.includes('owner') || rn.includes('host');
    });
    if (hasPriv) {
      displayRoles = serverRoles.filter(r => {
        const rn = (r.roleName || r.RoleName || r.name || r.Role || '').toString().toLowerCase();
        return rn.includes('admin') || rn.includes('owner') || rn.includes('host');
      });
      // make sure a User option exists alongside privileged roles
      const hasUser = serverRoles.some(r => {
        const rn = (r.roleName || r.RoleName || r.name || r.Role || '').toString().toLowerCase();
        return rn.includes('user');
      });
      if (!hasUser) displayRoles.push({ roleName: 'User', RoleID: 3, name: 'user' });
    } else {
      // No privileged roles -> show whatever server returned (could be just user)
      displayRoles = serverRoles;
    }
  }
  const onlyUserRole = displayRoles.length === 1 && ((displayRoles[0].roleName || displayRoles[0].name || '').toString().toLowerCase().includes('user'));
  const hasPrivInDisplay = displayRoles.some(r => {
    const rn = (r.roleName || r.RoleName || r.name || r.Role || '').toString().toLowerCase();
    return rn.includes('admin') || rn.includes('owner') || rn.includes('host');
  });
  // Show roles when there are multiple/non-user roles, or when on Owner settings and the account has privileged roles
  const showRoles = (displayRoles.length > 0 && !onlyUserRole) || (isOwnerSettings && hasPrivInDisplay);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editProfileMode, setEditProfileMode] = useState(false);
  // use normalized user values so aliases like FullName / full_name / name are handled
  const _norm = normalizeUser(user || {});
  const [editUsername, setEditUsername] = useState(_norm.username || user?.username || '');
  const [editFullName, setEditFullName] = useState(_norm.fullName || user?.fullName || user?.name || '');
  const [editEmail, setEditEmail] = useState(_norm.email || user?.email || '');
  const [editPhone, setEditPhone] = useState(getPhone(_norm) || getPhone(user) || user?.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmType, setConfirmType] = useState(null); // 'password' | 'role' | 'profile'
  const [confirmPayload, setConfirmPayload] = useState(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');

  // keep form values in sync if user changes elsewhere
  React.useEffect(() => {
    const n = normalizeUser(user || {});
    setEditUsername(n.username || user?.username || '');
    setEditFullName(n.fullName || user?.fullName || user?.name || '');
    setEditEmail(n.email || user?.email || '');
    setEditPhone(getPhone(n) || getPhone(user) || user?.phone || '');
  }, [user]);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!oldPassword || !newPassword) {
      toast.error(t('settings.fillPasswords'));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('settings.passwordMismatch'));
      return;
    }
    if (newPassword.length < 6) {
      toast.error(t('settings.passwordTooShort'));
      return;
    }
    // Open confirmation modal before performing password change
    setConfirmType('password');
    setConfirmPayload({ oldPassword, newPassword });
    setConfirmOpen(true);
  };

  const performChangePassword = async (oldP, newP) => {
    setConfirmOpen(false);
    setLoading(true);
    try {
      await authAPI.changePassword(oldP, newP);
      // show notification modal
      setNotifTitle(t('settings.passwordChangedTitle') || 'Password changed');
      setNotifMessage(t('settings.passwordSuccess') || 'Your password has been updated.');
      setNotifOpen(true);
      // Clear inputs
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      // no reload: keep the user signed in and let AuthProvider remain unchanged
    } catch (err) {
      console.error('Change password failed', err);
      toast.error(err?.message || 'Unable to change password');
    } finally {
      setLoading(false);
    }
  };

  const performChangeRole = async (norm, label) => {
    setConfirmOpen(false);
    try {
      try { localStorage.setItem('activeRole', norm); } catch { /* ignore */ }
      try { setActiveRole(norm); } catch { /* ignore */ }
      try { window.dispatchEvent(new CustomEvent('activeRole:changed', { detail: { role: norm } })); } catch { /* ignore */ }
      // navigate based on role
  // Use a full replace navigation (hard reload) so browser history cannot be
  // used to return to the previous role page. This mirrors logout/login
  // behaviour where back shouldn't restore the prior protected layout.
  if (norm.includes('owner') || norm.includes('host')) window.location.replace('/courts/bookings');
  else if (norm.includes('admin')) window.location.replace('/admin');
  else window.location.replace('/');

      setNotifTitle(t('settings.roleChangedTitle') || 'Role changed');
      setNotifMessage((t('settings.roleChangedMessage') || 'Your active role is now') + ` ${label}`);
      setNotifOpen(true);
    } catch (err) {
      console.error('Change role failed', err);
      toast.error(err?.message || 'Unable to change role');
    }
  };

  const performChangeLanguage = async (newLang) => {
    setConfirmOpen(false);
    try {
      // apply language change via i18n hook
      setLang(newLang);
      // show toast in chosen language
      try { toast.success(TRANSLATIONS[newLang]?.settings?.languageChanged || 'Language updated'); } catch { toast.success('Language updated'); }
      // no notification modal for language change (toast only)
    } catch (err) {
      console.error('Change language failed', err);
      toast.error('Unable to change language');
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: profile + roles */}
        <aside className="col-span-1 bg-white rounded-lg p-6 shadow-sm border">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-pink-400 to-indigo-400 flex items-center justify-center text-white text-xl font-semibold overflow-hidden">
              {(_norm && (_norm.avatar || _norm.profile_picture || user?.avatarUrl || user?.profile_picture)) ? (
                <img src={_norm.avatar || user.avatarUrl || user.profile_picture} alt="avatar" className="w-full h-full object-cover" onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_AVATAR; }} />
              ) : (
                ((_norm && (_norm.fullName || _norm.username)) ? (_norm.fullName || _norm.username)[0] : ((user && (user.fullName || user.name || user.username) && (user.fullName || user.name || user.username)[0]) || 'U'))
              )}
            </div>
            <div>
              <div className="text-lg font-semibold">{_norm?.fullName || _norm?.username || user?.username || 'User'}</div>
              <div className="text-sm text-gray-500">@{_norm?.username || user?.username || 'user'}</div>
            </div>
              {/* Confirmation modal */}
              {confirmOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                  <div className="bg-white max-w-lg w-full rounded-lg p-6 shadow-lg">
                    <h3 className="text-lg font-semibold mb-2">
                      {confirmType === 'password' ? (t('settings.confirmPasswordTitle') || 'Confirm password change') : (confirmType === 'role' ? (t('settings.confirmRoleTitle') || 'Confirm role change') : (confirmType === 'language' ? (t('settings.confirmLanguageTitle') || 'Confirm language change') : 'Confirm'))}
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                      {confirmType === 'password' ? (t('settings.confirmPasswordMessage') || 'Are you sure you want to change your password?') : (confirmType === 'role' ? ((t('settings.confirmRoleMessage') || 'Are you sure you want to switch your active role to') + ` ${confirmPayload?.label || ''}`) : (confirmType === 'language' ? (t('settings.confirmLanguageMessage') || 'Change the display language?') : 'Are you sure?'))}
                    </p>
                    <div className="flex justify-end gap-3">
                      <button onClick={() => setConfirmOpen(false)} className="px-4 py-2 border rounded">{t('common.cancel') || 'Cancel'}</button>
                      <button onClick={() => {
                        if (confirmType === 'password') {
                          performChangePassword(confirmPayload?.oldPassword, confirmPayload?.newPassword);
                        } else if (confirmType === 'role') {
                          performChangeRole(confirmPayload?.norm, confirmPayload?.label);
                        } else if (confirmType === 'language') {
                          performChangeLanguage(confirmPayload?.lang);
                        }
                      }} className="px-4 py-2 bg-indigo-600 text-white rounded">{t('common.confirm') || 'Confirm'}</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Notification modal (simple confirmation page) */}
              {notifOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                  <div className="bg-white max-w-md w-full rounded-lg p-6 shadow-lg text-center">
                    <h3 className="text-xl font-semibold mb-2">{notifTitle}</h3>
                    <p className="text-sm text-gray-700 mb-4">{notifMessage}</p>
                    <div className="flex justify-center gap-3">
                      <button onClick={() => setNotifOpen(false)} className="px-4 py-2 bg-indigo-600 text-white rounded">{t('common.close') || 'Close'}</button>
                    </div>
                  </div>
                </div>
              )}
          </div>

          {showRoles && (
            <div className="mt-6">
              <div className="text-xs text-gray-500 font-medium mb-2">{t('settings.roles') || 'Roles'}</div>
              <div className="flex flex-wrap gap-2">
                {displayRoles.map((r, idx) => {
                  const raw = (r.roleName || r.RoleName || r.name || r.Role || r || '').toString();
                  const display = raw && raw.toString ? raw.toString() : String(raw || '');
                  const norm = display.replace(/^ROLE_/, '').toLowerCase();
                  const label = display.startsWith('ROLE_') ? display.replace(/^ROLE_/, '') : (display.charAt(0).toUpperCase() + display.slice(1));
                  const isActive = activeRole && activeRole.toString().toLowerCase() === norm;
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        // Open confirmation before switching role
                        setConfirmType('role');
                        setConfirmPayload({ norm, label });
                        setConfirmOpen(true);
                      }}
                      className={`px-3 py-2 min-w-[96px] h-10 flex items-center justify-center rounded-lg text-sm font-medium transition ${isActive ? 'bg-indigo-600 text-white shadow' : 'bg-white border text-gray-700 hover:bg-gray-50'}`}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-6 border-t pt-4">
            {!editProfileMode ? (
              <>
          <div className="text-sm text-gray-600 mb-2">{t('profile.username') || 'Username'}: <span className="font-medium text-gray-800">{_norm?.username || user?.username || '-'}</span></div>
            <div className="text-sm text-gray-600 mb-2">{t('profile.fullName') || 'Full name'}: <span className="font-medium text-gray-800">{_norm?.fullName || user?.fullName || user?.name || '-'}</span></div>
                <div className="text-sm text-gray-600 mb-2">Email: <span className="font-medium text-gray-800">{_norm?.email || user?.email || '-'}</span></div>
                <div className="text-sm text-gray-600 mb-2">Phone: <span className="font-medium text-gray-800">{getPhone(_norm) || getPhone(user) || '-'}</span></div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setEditProfileMode(true)} className="px-3 py-2 rounded bg-indigo-600 text-white">Edit profile</button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500">{t('settings.username') || 'Username'}</label>
                  <input value={editUsername} onChange={e => setEditUsername(e.target.value)} className="mt-1 block w-full border rounded px-3 py-2" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">{t('settings.fullName') || 'Full name'}</label>
                  <input value={editFullName} onChange={e => setEditFullName(e.target.value)} className="mt-1 block w-full border rounded px-3 py-2" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Email</label>
                  <input value={editEmail} onChange={e => setEditEmail(e.target.value)} className="mt-1 block w-full border rounded px-3 py-2" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">{t('settings.phone') || 'Phone'}</label>
                  <input value={editPhone} onChange={e => setEditPhone(e.target.value)} className="mt-1 block w-full border rounded px-3 py-2" />
                </div>
                <div className="flex gap-2">
                  <button disabled={savingProfile} onClick={async () => {
                    // Save profile
                    try {
                      setSavingProfile(true);
                      const userId = user && (user._id || user.userId || user.AccountID || user.id);
                      if (!userId) throw new Error('User ID not found');
                      const payload = { username: editUsername, fullName: editFullName, email: editEmail };
                      if (editPhone !== undefined) payload.phone = editPhone;
                      const res = await userAPI.updateProfile(userId, payload);
                      toast.success(t('settings.profileSaved') || 'Profile updated');
                      const updated = (res && res.data) ? res.data : res;
                      try { if (updated && !updated.phone && editPhone) updated.phone = editPhone; } catch {/* ignore */ }
                      try { localStorage.setItem('userData', JSON.stringify(updated)); } catch { /* ignore */ }
                      try { if (setUser) setUser(updated); } catch { /* ignore */ }
                      // close edit mode
                      setEditProfileMode(false);
                      setNotifTitle(t('settings.profileSavedTitle') || 'Profile updated');
                      setNotifMessage(t('settings.profileSavedMessage') || 'Your profile has been updated.');
                      setNotifOpen(true);
                    } catch (err) {
                      console.error('Update profile failed', err);
                      toast.error(err?.message || 'Unable to update profile');
                    } finally {
                      setSavingProfile(false);
                    }
                  }} className="px-3 py-2 rounded bg-indigo-600 text-white disabled:opacity-60">{t('common.save')}</button>
                  <button onClick={() => { setEditProfileMode(false); setEditUsername(user?.username||''); setEditFullName(user?.fullName||user?.name||''); setEditEmail(user?.email||''); }} className="px-3 py-2 border rounded">{t('common.cancel')}</button>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Right: password + language */}
        <div className="col-span-2 space-y-6">
          <div className="bg-white rounded-lg p-6 shadow-sm border">
            <h2 className="text-lg font-semibold mb-2">{t('settings.changePassword')}</h2>
            <p className="text-sm text-gray-500 mb-4">{t('settings.changePasswordHelp') || ''}</p>

            <form onSubmit={handleChangePassword} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <label className="block text-sm text-gray-700">{t('settings.oldPassword')}</label>
                <input
                  type={showOldPassword ? 'text' : 'password'}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="mt-1 block w-full border rounded px-3 py-2 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowOldPassword(v => !v)}
                  className="absolute right-2 top-9 p-1 text-gray-500"
                  aria-label={showOldPassword ? 'Hide old password' : 'Show old password'}
                >
                  {showOldPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <div className="relative">
                <label className="block text-sm text-gray-700">{t('settings.newPassword')}</label>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1 block w-full border rounded px-3 py-2 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(v => !v)}
                  className="absolute right-2 top-9 p-1 text-gray-500"
                  aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                >
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <div className="relative md:col-span-2">
                <label className="block text-sm text-gray-700">{t('settings.confirmPassword')}</label>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 block w-full border rounded px-3 py-2 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(v => !v)}
                  className="absolute right-2 top-9 p-1 text-gray-500"
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <div className="md:col-span-2 flex items-center gap-3">
                <button disabled={loading} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">{t('settings.save')}</button>
                <button type="button" onClick={() => { setOldPassword(''); setNewPassword(''); setConfirmPassword(''); }} className="px-3 py-2 border rounded">{t('common.cancel') || 'Cancel'}</button>
              </div>
            </form>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border">
            <h2 className="text-lg font-semibold mb-2">{t('settings.language')}</h2>
            <p className="text-sm text-gray-500 mb-4">{t('settings.languageHelp')}</p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  // confirm before applying language change
                  setConfirmType('language');
                  setConfirmPayload({ lang: 'en' });
                  setConfirmOpen(true);
                }}
                className={`px-4 py-2 rounded-lg border ${lang === 'en' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700'}`}>
                English
              </button>
              <button
                onClick={() => {
                  setConfirmType('language');
                  setConfirmPayload({ lang: 'vi' });
                  setConfirmOpen(true);
                }}
                className={`px-4 py-2 rounded-lg border ${lang === 'vi' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700'}`}>
                Tiếng Việt
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
