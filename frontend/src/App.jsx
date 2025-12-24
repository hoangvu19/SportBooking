import React, { Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Auth/login";
import Feed from "./pages/Social/Feed";
import Messages from "./pages/Social/Messages";
import ChatBox from "./pages/Social/ChatBox";  
import Connections from "./pages/Social/Connection"; 
import Discover from "./pages/Social/Discover";
import Profile from "./pages/Social/Profile";
import CreatePost from "./pages/Social/CreatePost";
import Settings from "./pages/Shared/Settings";
import Terms from "./pages/Shared/Terms";
import Archive from "./pages/Shared/Archive";
// Owner/Admin scaffolding removed
const PostDetail = React.lazy(() => import("./pages/Social/PostDetail.jsx"));
import useAuth from "./hooks/useAuth";
import useRealtime from './hooks/useRealtime';
import Layout from "./pages/Shared/Layout";
import AdminLayout from "./pages/Admin/AdminLayout";
import AdminDashboard from "./pages/Admin/Dashboard";
import ManageAccounts from "./pages/Admin/ManageAccounts";
import ManageBookings from "./pages/Admin/ManageBookings";
import ManageSports from "./pages/Admin/ManageSports";
import Moderation from "./pages/Admin/Moderation";
import ReportsManager from "./pages/Admin/ReportsManager";
import BroadcastNotification from "./pages/Admin/BroadcastNotification";
import SentNotifications from "./pages/Admin/SentNotifications";
import OwnerLayout from "./pages/Owner/OwnerLayout";
import OwnerBookings from "./pages/Owner/Bookings";
import BookingCancellations from "./pages/Owner/BookingCancellations";
import Customers from "./pages/Owner/Customers";
import OwnerFacilities from "./pages/Owner/Facilities";
import FacilitiesDetail from "./pages/Owner/FacilitiesDetail";
import FacilitiesFieldsList from "./pages/Owner/FacilitiesFieldsList";
import OwnerDashboard from "./pages/Owner/Dashboard";
import {Toaster} from 'react-hot-toast';
import Loading from "./components/Shared/Loading";
import SanList from "./pages/Sport/SanList";
import SanDetail from "./pages/Sport/SanDetail";
import Booking from "./pages/Sport/Booking.jsx";
import MyBookings from "./pages/Sport/MyBookings.jsx";
import Livestreams from "./pages/Livestream/Livestreams";
import LiveRooms from "./pages/Livestream/LiveRooms";

const App = () => {
  const { user, isLoading } = useAuth();
  // connect to realtime namespace so app receives server push events
  useRealtime();
  
  // Show loading until auth is checked
  if (isLoading) {
    return <Loading />;
  }

  const roles = Array.isArray(user && user.roles) ? user.roles : [];
  const roleNames = roles.map(r => (r.roleName || r.RoleName || '').toString().toLowerCase());
  const isAdmin = roleNames.some(rn => rn.includes('admin'));
  const isOwner = roleNames.some(rn => rn.includes('owner') || rn.includes('host'));

  return (
    <>
      <Toaster position="top-center" reverseOrder={false} />
    <Routes>
        {!user ? (
          <Route path="*" element={<Login />} />
        ) : (
          <>
            {isAdmin && (
              <Route path="admin/*" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="users" element={<ManageAccounts />} />
                <Route path="bookings" element={<ManageBookings />} />
                <Route path="sports" element={<ManageSports />} />
                <Route path="moderation" element={<Moderation />} />
                <Route path="reports" element={<ReportsManager />} />
                <Route path="broadcast" element={<BroadcastNotification />} />
                <Route path="sent-notifications" element={<SentNotifications />} />
              </Route>
            )}
            {isOwner && (
              <Route path="courts/*" element={<OwnerLayout />}>
                <Route index element={<OwnerFacilities />} />
                <Route path="bookings" element={<OwnerBookings />} />
                <Route path="dashboard" element={<OwnerDashboard />} />
                <Route path="bookings/cancellations" element={<BookingCancellations />} />
                <Route path="customers" element={<Customers />} />
                <Route path="facilities" element={<OwnerFacilities />} />
                <Route path="facilities/field/:fieldId" element={<FacilitiesDetail />} />
                <Route path="facilities/:facilityId/fields" element={<FacilitiesFieldsList />} />
                <Route path="settings" element={<Settings />} />
              </Route>
            )}

            <Route path="/" element={<Layout />}>
              <Route index element={<Feed />} />
              <Route path="feed" element={<Feed />} />
              <Route path="messages" element={<Messages />} />
              <Route path="messages/:userId" element={<ChatBox />} />
              <Route path="connections" element={<Connections />} />
              <Route path="discover" element={<Discover />} />
              <Route path="profile" element={<Profile />} />
              <Route path="profile/:profileId" element={<Profile />} />
              <Route path="create-post" element={<CreatePost />} />
              <Route path="livestreams" element={<Livestreams />} />
              <Route
                path="post/:postId"
                element={
                  <Suspense fallback={<Loading />}>
                    <PostDetail />
                  </Suspense>
                }
              />
              <Route path="settings" element={<Settings />} />
              <Route path="terms" element={<Terms />} />
              <Route path="archive" element={<Archive />} />

              {/* Booking routes */}
              <Route path="sanlist" element={<SanList />} />
              <Route path="san-list" element={<SanList />} />
              <Route path="san/:sanId" element={<SanDetail />} />
              <Route path="booking" element={<Booking />} />
              <Route path="my-bookings" element={<MyBookings />} />

              {/* Livestream */}
              <Route path="live-rooms" element={<LiveRooms />} />
            </Route>
            {/* Redirect unmatched routes to a sensible place */}
            <Route path="*" element={<Navigate to={user ? '/feed' : '/login'} replace />} />
          </>
        )}
      </Routes>
    </>
  );
};

export default App;