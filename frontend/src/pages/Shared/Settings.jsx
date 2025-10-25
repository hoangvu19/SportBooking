import React, { useState } from 'react';
import { authAPI } from '../../utils/api';
import toast from 'react-hot-toast';
import { useI18n } from '../../i18n';
import TRANSLATIONS from '../../i18n/translations';
import { Eye, EyeOff } from 'lucide-react';

const Settings = () => {
  const { t, lang, setLang } = useI18n();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

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
    setLoading(true);
    try {
      await authAPI.changePassword(oldPassword, newPassword);
      toast.success(t('settings.passwordSuccess'));
      // Keep the user signed in after password change (no logout)
      // Clear inputs
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      // Reload settings page to refresh any data if needed
      try {
        setTimeout(() => { window.location.reload(); }, 800);
      } catch { /* ignore */ }
    } catch (err) {
      console.error('Change password failed', err);
      toast.error(err?.message || 'Unable to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-md p-6 shadow-sm">
      <h2 className="text-xl font-semibold mb-4">{t('settings.title')}</h2>

      <section className="mb-6">
        <h3 className="font-medium mb-2">{t('settings.changePassword')}</h3>
        <form onSubmit={handleChangePassword} className="space-y-3 max-w-md">
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

          <div className="relative">
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
          <div>
            <button disabled={loading} className="px-4 py-2 bg-indigo-600 text-white rounded">{t('settings.save')}</button>
          </div>
        </form>
      </section>

      <section>
        <h3 className="font-medium mb-2">{t('settings.language')}</h3>
        <p className="text-sm text-gray-500 mb-2">{t('settings.languageHelp')}</p>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setLang('en');
              try { toast.success((TRANSLATIONS['en'] && TRANSLATIONS['en'].settings && TRANSLATIONS['en'].settings.languageChanged) || 'Language updated'); } catch { toast.success('Language updated'); }
            }}
            className={`px-3 py-2 border rounded ${lang === 'en' ? 'bg-indigo-600 text-white' : ''}`}>
            English
          </button>
          <button
            onClick={() => {
              setLang('vi');
              try { toast.success((TRANSLATIONS['vi'] && TRANSLATIONS['vi'].settings && TRANSLATIONS['vi'].settings.languageChanged) || 'Đã thay đổi ngôn ngữ'); } catch { toast.success('Đã thay đổi ngôn ngữ'); }
            }}
            className={`px-3 py-2 border rounded ${lang === 'vi' ? 'bg-indigo-600 text-white' : ''}`}>
            Tiếng Việt
          </button>
        </div>
      </section>
    </div>
  );
};

export default Settings;
