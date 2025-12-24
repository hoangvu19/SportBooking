import React, { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import AdminSidebar from '../../components/Admin/AdminSidebar';
import AdminHeader from '../../components/Admin/AdminHeader';
import useAuth from '../../hooks/useAuth';
import { AdminSearchProvider, useAdminSearch } from '../../contexts/AdminSearchContext';

const AdminLayoutContent = () => {
  const { activeRole, user } = useAuth();
  const navigate = useNavigate();
  const { setSearchQuery } = useAdminSearch();

  useEffect(() => {
    try {
      const stored = (() => { try { return window.localStorage.getItem('activeRole'); } catch { return null; } })();
      const userHasAdmin = Array.isArray(user?.roles) && user.roles.some(r => {
        try { const rn = (r.roleName || r.RoleName || r.name || r.Role || '').toString().toLowerCase(); return rn.includes('admin') || rn.includes('quantri'); } catch { return false; }
      });
      // Only default activeRole to 'admin' when there is no persisted role yet.
      // If the user already has a stored role (e.g., 'owner'), do not overwrite it.
      if (stored === null && userHasAdmin) {
        try {
          window.localStorage.setItem('activeRole', 'admin');
          window.dispatchEvent(new CustomEvent('activeRole:changed', { detail: 'admin' }));
        } catch { /* ignore */ }
      }
      if (!activeRole || activeRole !== 'admin') {
        if (stored !== 'admin') {
          try { navigate('/', { replace: true }); } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }
  }, [activeRole, navigate, user]);
  return (
    <div className="min-h-screen bg-gray-100 flex">
      <AdminSidebar />
      <div className="flex-1 min-h-screen">
        <AdminHeader onSearch={setSearchQuery} />
        <main className="p-6 max-w-6xl mx-auto">
          <div className="bg-white rounded-md p-6 shadow">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

const AdminLayout = () => (
  <AdminSearchProvider>
    <AdminLayoutContent />
  </AdminSearchProvider>
);

export default AdminLayout;
