import React from 'react'
import { menuItemsData } from "../../assets/assets";
import { NavLink } from 'react-router-dom'
import { useI18n } from '../../i18n/hooks'


const MenuItems = ({setSidebarOpen}) => {
  const { t } = useI18n();

  // optional debug removed for lint compatibility

  return (
    <div className='px-6 text-gray-600 space-y-1 font-medium'>
      {menuItemsData.map((item) => {
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

      {/* Owner/Admin links removed */}

    </div>
  );
}

export default MenuItems;
