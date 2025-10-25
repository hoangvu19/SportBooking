import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DEFAULT_AVATAR from "../../utils/defaults";
import { assets } from "../../assets/assets";
import MenuItems from "./MenuItems";
import {  LogOut, User as UserIcon, Settings as SettingsIcon, FileText as FileTextIcon, Archive as ArchiveIcon } from "lucide-react";
import useAuth from "../../hooks/useAuth";
import { useI18n } from '../../i18n';


const SideBar = ({ sidebarOpen, setSidebarOpen }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const avatarMenuRef = useRef(null);
  const avatarToggleRef = useRef(null);
  useEffect(() => {
    console.debug('SideBar: avatarMenuOpen changed ->', avatarMenuOpen);
    const onDocClick = (e) => {
      // if click inside menu or on the avatar toggle, ignore
      if (avatarMenuRef.current && avatarMenuRef.current.contains(e.target)) return;
      if (avatarToggleRef.current && avatarToggleRef.current.contains(e.target)) return;
      if (avatarMenuOpen) setAvatarMenuOpen(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [avatarMenuOpen]);

  return (
    <div className={`w-60 xl:w-72 bg-white border-r border-gray-200 flex flex-col justify-between max-sm:absolute top-0 bottom-0 z-20 ${
      sidebarOpen ? 'translate-x-0' : 'max-sm:-translate-x-full'
    } transition-all duration-300 ease-in-out`}>
      <div>
        <img onClick={() => navigate('/')} src={assets.logo} className='w-26 ml-7 my-2 cursor-pointer' alt="Logo" />
        <hr className='border-gray-300 mb-8' />
        <MenuItems setSidebarOpen={setSidebarOpen} />
      </div>

      <div className='w-full border-t border-gray-200 p-4 px-7 flex items-center justify-between'>
  <div className='relative flex gap-2 items-center overflow-visible'>
          {/* Avatar + name - clicking avatar toggles small menu */}
          <div
            ref={avatarToggleRef}
            className='flex gap-2 items-center cursor-pointer'
            onClick={() => { console.debug('SideBar: avatar clicked, toggling menu', !avatarMenuOpen); setAvatarMenuOpen((s) => !s); }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setAvatarMenuOpen((s) => !s); }}
          >
            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
              {user?.avatarUrl || user?.profile_picture || user?.AvatarUrl || user?.ProfilePictureURL ? (
                <img src={user.avatarUrl || user.profile_picture || user.AvatarUrl || user.ProfilePictureURL || DEFAULT_AVATAR} onError={(e)=>{ e.target.onerror = null; e.target.src = DEFAULT_AVATAR }} alt="Avatar" className="w-full h-full rounded-full object-cover" />
              ) : (
                <UserIcon className="w-6 h-6 text-white" />
              )}
            </div>
            <div>
              <h1 className='text-sm font-medium'>{user?.fullName || user?.username || 'User'}</h1>
              <p className='text-xs text-gray-500'>@{user?.username || 'username'}</p>
            </div>
          </div>

          {/* Dropdown menu positioned above the avatar */}
          {avatarMenuOpen && (
            <div ref={avatarMenuRef} style={{ position: 'fixed', left: 16, bottom: 88, width: 200 }} className="bg-white border border-gray-200 rounded-md shadow-lg py-1 z-60">
              {console.debug('SideBar: rendering avatar menu (fixed)')}
              <button aria-label="Settings" onClick={() => { setAvatarMenuOpen(false); navigate('/settings'); }} className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2">
                <SettingsIcon className="w-4 h-4 text-gray-600" />
                <span>{t('menu.settings')}</span>
              </button>
              <button aria-label="Terms" onClick={() => { setAvatarMenuOpen(false); navigate('/terms'); }} className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2">
                <FileTextIcon className="w-4 h-4 text-gray-600" />
                <span>{t('menu.terms')}</span>
              </button>
              <button aria-label="Archive" onClick={() => { setAvatarMenuOpen(false); navigate('/archive'); }} className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2">
                <ArchiveIcon className="w-4 h-4 text-gray-600" />
                <span>{t('menu.archive')}</span>
              </button>
            </div>
          )}
        </div>

        <LogOut onClick={() => { logout() }} className='w-4.5 text-gray-400 hover:text-gray-700 transition cursor-pointer' />
      </div>

      {/* click outside handler to close the avatar menu */}
      
    </div>
  );
};

export default SideBar;
