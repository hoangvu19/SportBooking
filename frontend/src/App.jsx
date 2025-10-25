import React, { Suspense } from "react";
import { Routes, Route } from "react-router-dom";
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
const PostDetail = React.lazy(() => import("./pages/Social/PostDetail.jsx"));
import useAuth from "./hooks/useAuth";
import Layout from "./pages/Shared/Layout";
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
  
  // Show loading until auth is checked
  if (isLoading) {
    return <Loading />;
  }

  return (
    <>
      <Toaster position="top-center" reverseOrder={false} />
      <Routes>
        {!user ? (
          <Route path="*" element={<Login />} />
        ) : (
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
            <Route path="post/:postId" element={
              <Suspense fallback={<Loading />}>
                <PostDetail />
              </Suspense>
            } />
            <Route path="settings" element={<Settings />} />
            <Route path="terms" element={<Terms />} />
            <Route path="archive" element={<Archive />} />
            {/* Các route cho phần đặt sân bóng */}
            <Route path="sanlist" element={<SanList />} />
            <Route path="san-list" element={<SanList />} />
            <Route path="san/:sanId" element={<SanDetail />} />
            <Route path="booking" element={<Booking />} />
            <Route path="my-bookings" element={<MyBookings />} />
            {/* Các route cho livestream */}
            <Route path="live-rooms" element={<LiveRooms />} />
          </Route>
        )}
      </Routes>
    </>
  );
};

export default App;