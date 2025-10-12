import React from "react";
import { useNavigate } from "react-router-dom";
import DEFAULT_AVATAR from '../utils/defaults';
import { assets } from "../assets/assets";
import MenuItems from "./MenuItems";
import {  LogOut, User as UserIcon } from "lucide-react";
import { useAuth } from "../hooks/useAuth";


const SideBar = ({ sidebarOpen, setSidebarOpen }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

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
        <div className='flex gap-2 items-center cursor-pointer'>
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
        <LogOut onClick={() => { logout() }} className='w-4.5 text-gray-400 hover:text-gray-700 transition cursor-pointer' />
      </div>
    </div>
  );
};

export default SideBar;
