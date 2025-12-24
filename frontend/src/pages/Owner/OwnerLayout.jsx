import React, { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import BookingCalendar from '../../components/Owner/BookingCalendar';
import useAuth from '../../hooks/useAuth';
import OwnerSidebar from '../../components/Owner/OwnerSidebar';
import OwnerHeader from '../../components/Owner/OwnerHeader';
import { OwnerSearchProvider, useOwnerSearch } from '../../contexts/OwnerSearchContext';

const OwnerLogout = () => {
  const { logout } = useAuth();
  return (
    <button onClick={() => logout()} className="px-3 py-1 text-sm text-red-600 border border-red-100 rounded hover:bg-red-50">
      Log out
    </button>
  );
};
const OwnerLayoutContent = () => {
  // ensure auth provider is present and guard owner routes
  const { activeRole } = useAuth();
  const navigate = useNavigate();
  const { setSearchQuery } = useOwnerSearch();

  useEffect(() => {
    try {
      if (!activeRole || activeRole !== 'owner') {
        try { navigate('/', { replace: true }); } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }, [activeRole, navigate]);

  return (
    <div className='bg-gray-50 min-h-screen'>
      <div className='flex'>
        <OwnerSidebar />
        <main className='flex-1 max-w-6xl mx-auto p-6'>
            <OwnerHeader onSearch={setSearchQuery} />
            <div className='bg-white rounded-md p-6 shadow'>
              <Outlet />
            </div>
        </main>
      </div>
    </div>
  );
};

const OwnerLayout = () => (
  <OwnerSearchProvider>
    <OwnerLayoutContent />
  </OwnerSearchProvider>
);

export default OwnerLayout;
