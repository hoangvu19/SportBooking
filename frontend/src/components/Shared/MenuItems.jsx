import React from 'react'
import { menuItemsData } from "../../assets/assets";
import { NavLink, useLocation } from 'react-router-dom'
import { useI18n } from '../../i18n/hooks'


const MenuItems = ({setSidebarOpen}) => {
  const { t } = useI18n();
  const location = useLocation();

  // Debug: log menu items and current location to help find why items disappear
  // Remove this after investigating
  if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
    console.debug('MenuItems: rendering, location=', location.pathname, 'menuItemsData=', menuItemsData);
  }

  return (
    <div className='px-6 text-gray-600 space-y-1 font-medium'>
      {menuItemsData.map((item) => {
        // Hiển thị tất cả các menu cùng một cấp
        const label = item.labelKey ? t(item.labelKey) : item.label || '';
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) => `px-3.5 py-2 flex items-center gap-3 rounded-xl ${isActive ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50'}`}
          >
            <item.Icon className="w-5 h-5" />
            {label}
          </NavLink>
        );
      })}

    </div>
  );
}

export default MenuItems;
