import React, { useState, useEffect } from 'react';
import { useI18n } from '../../i18n/hooks';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { MapPin, Clipboard, Users, BarChart, MessageSquare, Wallet, LogOut as LogOutIcon } from 'lucide-react';
import { assets } from '../../assets/assets';
import useAuth from '../../hooks/useAuth';

// menuDefinition moved into component so we can use translations via useI18n()

const OwnerSidebar = ({ className = '' }) => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const location = useLocation();
  const { t } = useI18n();

  const menuDefinition = React.useMemo(() => [
    { type: 'link', to: '/courts', icon: MapPin, label: t('owner.sidebar.manageFacilities') || 'Manage facilities' },
    {
      type: 'group', id: 'bookings', icon: Clipboard, label: t('owner.sidebar.manageBookings') || 'Manage bookings', items: [
        { to: '/courts/bookings', label: t('owner.sidebar.bookings.all') || 'All bookings' },
        { to: '/courts/bookings/cancellations', label: t('owner.sidebar.bookings.cancellations') || 'Cancellations' },
      ]
    },
    { type: 'link', to: '/courts/customers', icon: Users, label: t('owner.sidebar.customers') || 'Manage customers' },
    { type: 'link', to: '/courts/dashboard', icon: BarChart, label: t('owner.sidebar.dashboard') || 'Dashboard' },
  ], [t]);

  // build initial open-state for groups based on menuDefinition
  const groupIds = menuDefinition.filter(m => m.type === 'group').map(g => g.id);
  const [open, setOpen] = useState(() => Object.fromEntries(groupIds.map(id => [id, false])));

  // auto-open groups when current location matches a sub-route
  useEffect(() => {
    const p = location.pathname || '';
    const localGroupIds = menuDefinition.filter(m => m.type === 'group').map(g => g.id);
    const nextOpen = {};
    localGroupIds.forEach(id => {
      // find group's base prefix by looking up first item path
      const group = menuDefinition.find(m => m.type === 'group' && m.id === id);
  const prefix = group && group.items && group.items[0] && group.items[0].to ? group.items[0].to.split('/').slice(0,3).join('/') : `/courts/${id}`;
  nextOpen[id] = p.startsWith(prefix) || p.startsWith(`/courts/${id}`);
    });
    setOpen(nextOpen);
  }, [location.pathname, menuDefinition]);

  const isActive = (basePath) => {
    const p = location.pathname || '';
    return p === basePath || p.startsWith(basePath + '/') || p.startsWith(basePath + '?');
  };

  const linkClass = (basePath) => `flex items-center gap-3 py-3 px-3 rounded text-sm ${isActive(basePath) ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-700 hover:bg-gray-100'}`;

  return (
    <aside className={`w-60 xl:w-72 bg-white border-r border-gray-200 ${className}`} style={{height: '100vh', position: 'sticky', top: 0}}>
      <div className='flex flex-col h-full'>
        {/* scrollable main area (takes available space so footer stays pinned) */}
        <div className='flex-1 overflow-auto px-4 py-4'>
          <img onClick={() => navigate('/')} src={assets.logo} className='w-28 mx-auto my-4 cursor-pointer block' alt="Logo" />
          <hr className='border-gray-300 mb-4' />

          <nav>
            <ul className='flex flex-col gap-1'>
              {menuDefinition.map((m) => {
                if (m.type === 'link') {
                  const Icon = m.icon;
                  return (
                    <li key={m.to}>
                      <Link to={m.to} className={linkClass(m.to)}>
                        {Icon && <Icon className='w-5 h-5' />}
                        {m.label}
                      </Link>
                    </li>
                  );
                }

                // group
                const Icon = m.icon;
                return (
                  <li key={m.id}>
                    <div onClick={() => setOpen(prev => ({...prev, [m.id]: !prev[m.id]}))} className={`${isActive(`/courts/${m.id}`) ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-700 hover:bg-gray-100'} flex items-center gap-3 py-3 px-3 rounded text-sm cursor-pointer`}>
                      {Icon && <Icon className='w-5 h-5' />}
                      {m.label}
                      <span className='ml-auto'>{open[m.id] ? '▾' : '▸'}</span>
                    </div>
                    {open[m.id] && (
                      <ul className='pl-8'>
                        {m.items.map(it => (
                          <li key={it.to}>
                            <Link to={it.to} className={`block py-2 text-sm ${isActive(it.to) ? 'text-gray-900 font-semibold' : 'text-gray-700 hover:underline'}`}>{it.label}</Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        <div className='px-4 py-3 border-t bg-white'>
          <div className='mt-2'>
            <button onClick={logout} className='flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded w-full justify-center'>
              <LogOutIcon className='w-4 h-4' />
              {t('owner.sidebar.logout') || 'Log out'}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default OwnerSidebar;
