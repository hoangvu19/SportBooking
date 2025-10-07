import React from "react";
import Sidebar from "../components/SideBar";
import { Outlet } from "react-router-dom";
import {dummyUserData} from "../assets/assets"
import Loading from "../components/Loading";
import { Menu, X } from "lucide-react";
import NotificationBell from "../components/NotificationBell";

const Layout = () => {
    const user = dummyUserData
    const [sidebarOpen, setSidebarOpen] = React.useState(false);

    return user ? (
        <div className='w-full flex h-screen bg-slate-50'>
            <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
            <div className='flex-1 overflow-y-auto relative'>
                {/* Notification bell fixed top right */}
                <div className="fixed top-4 right-8 z-50">
                  <NotificationBell />
                </div>
                <main className='max-w-6xl mx-auto px-6 py-8'>
                    <Outlet/>
                </main>
            </div>
            {
                sidebarOpen ?
                <X className='absolute top-3 right-3 p-2 z-100 bg-white rounded-md shadow w-10 h-10 text-gray-600 sm:hidden' onClick={() => setSidebarOpen(false)}/>
                :
                <Menu className='absolute top-3 right-3 p-2 z-100 bg-white rounded-md shadow w-10 h-10 text-gray-600 sm:hidden' onClick={() => setSidebarOpen(true)}/>
            }
        </div>
    ) : (
        <Loading/>
    )
}

export default Layout;
