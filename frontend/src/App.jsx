import React, { Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import Login from "./pages/login";    
import Feed from "./pages/Feed";
import Messages from "./pages/Messages";
import ChatBox from "./pages/ChatBox";  
import Connections from "./pages/Connection"; 
import Discover from "./pages/Discover";
import Profile from "./pages/Profile";
import CreatePost from "./pages/CreatePost";
const PostDetail = React.lazy(() => import("./pages/PostDetail.jsx"));
import { useAuth } from "./hooks/useAuth.jsx";
import Layout from "./pages/Layout";
import {Toaster} from 'react-hot-toast';
import Loading from "./components/Loading";
import SanList from "./pages/SanList";
import SanDetail from "./pages/SanDetail";
import Booking from "./pages/Booking.jsx";

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
            <Route path="post/:postId" element={
              <Suspense fallback={<Loading />}>
                <PostDetail />
              </Suspense>
            } />
            {/* Các route cho phần đặt sân bóng */}
            <Route path="san-list" element={<SanList />} />
            <Route path="san/:sanId" element={<SanDetail />} />
            <Route path="booking" element={<Booking />} />
          </Route>
        )}
      </Routes>
    </>
  );
};

export default App;