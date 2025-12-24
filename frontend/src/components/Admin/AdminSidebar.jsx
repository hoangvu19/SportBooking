import React from 'react';
import { NavLink } from 'react-router-dom';
// Sidebar no longer renders bottom user mini-card; avatar is shown in header instead
import { assets } from '../../assets/assets';
import { useI18n } from '../../i18n/hooks';

const SvgIcon = ({ name }) => {
  // Minimal inline SVGs for important icons (home, grid, users, shield, chart, message)
  switch (name) {
    case 'home':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 10.5L12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10.5z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      );
    case 'dashboard':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="8" height="8" stroke="currentColor" strokeWidth="1.2"/><rect x="13" y="3" width="8" height="5" stroke="currentColor" strokeWidth="1.2"/><rect x="13" y="10" width="8" height="11" stroke="currentColor" strokeWidth="1.2"/><rect x="3" y="13" width="8" height="8" stroke="currentColor" strokeWidth="1.2"/></svg>
      );
    case 'users':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 11c1.657 0 3-1.567 3-3.5S17.657 4 16 4s-3 1.567-3 3.5S14.343 11 16 11zM8 11c1.657 0 3-1.567 3-3.5S9.657 4 8 4 5 5.567 5 7.5 6.343 11 8 11z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 20a6 6 0 0 1 6-6h8a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      );
    case 'moderation':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2l3 6 6 .5-4.5 4 1.5 6L12 15l-6 4 1.5-6L3 8.5 9 8 12 2z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      );
    case 'stats':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 3v18h18" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/><rect x="7" y="12" width="2" height="7" fill="currentColor"/><rect x="11" y="8" width="2" height="11" fill="currentColor"/><rect x="15" y="4" width="2" height="15" fill="currentColor"/></svg>
      );
    case 'calendar':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.2"/><path d="M16 3v4M8 3v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      );
    case 'clipboard':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 2h6v2h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2V2z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      );
    case 'bell':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0 1 18 14.158V11c0-3.07-1.63-5.64-4.5-6.32V4a1.5 1.5 0 0 0-3 0v.68C7.63 5.36 6 7.929 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h11z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      );
    case 'heart':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" stroke="currentColor" strokeWidth="1.0" strokeLinecap="round" strokeLinejoin="round"/></svg>
      );
    case 'star':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" stroke="currentColor" strokeWidth="1.0" strokeLinecap="round" strokeLinejoin="round"/></svg>
      );
    case 'sport':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.2"/><path d="M12 3a9 9 0 0 0 0 18M12 3a9 9 0 0 1 0 18M3 12h18" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      );
    default:
      return null;
  }
};

const IconButton = ({ to, title, icon, badge }) => (
  <NavLink
    to={to}
    className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded text-sm transition-colors ${isActive ? 'bg-gray-800 text-white' : 'text-gray-200 hover:bg-gray-700'}`}>
    <div className="w-5 h-5 text-gray-300"><SvgIcon name={icon} /></div>
    <div className="flex-1 text-sm">{title}</div>
    {badge ? <div className="text-xs bg-red-500 text-white rounded px-2 py-0.5">{badge}</div> : null}
  </NavLink>
);

const AdminSidebar = () => {
  const { t } = useI18n();

  return (
    <aside className="w-64 bg-gray-900 text-gray-200 h-screen sticky top-0 flex flex-col">
      <div className="py-8 flex items-center justify-center border-b border-[#0b1220]">
        <img src={assets.logo} alt="logo" className="w-20 h-20 object-contain" />
      </div>

      <nav className="p-2 mt-2 space-y-1 flex-1">
        <IconButton to="/admin" title={t('menu.dashboard') || 'Dashboard'} icon="dashboard" />
        <IconButton to="/admin/broadcast" title={t('menu.broadcast') || 'Broadcast'} icon="bell" />

        {/* Admin-specific sections */}
        <div className="border-t border-gray-800 my-2"></div>

        <div className="px-4 py-2 text-xs text-gray-400 uppercase tracking-wider">{t('menu.management') || 'Management'}</div>
        <IconButton to="/admin/users" title={t('menu.manageAccounts') || 'Manage Accounts'} icon="users" />
        <IconButton to="/admin/sports" title={t('menu.manageSports') || 'Manage Sports'} icon="sport" />
        <IconButton to="/admin/bookings" title={t('menu.manageBookings') || 'Manage Bookings'} icon="calendar" />

        <div className="border-t border-gray-800 my-2"></div>
        <div className="px-4 py-2 text-xs text-gray-400 uppercase tracking-wider">{t('menu.moderation') || 'Moderation'}</div>
        <IconButton to="/admin/moderation" title={t('menu.contentModeration') || 'Content Moderation'} icon="moderation" />
        <IconButton to="/admin/reports" title={t('menu.userReports') || 'User Reports'} icon="clipboard" />
      </nav>

      <div className="p-4 border-t border-[#0b1220]">
        {/* Bottom mini-card removed to match admin mockup — avatar lives in header now */}
      </div>
    </aside>
  );
};

export default AdminSidebar;
