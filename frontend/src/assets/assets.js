import logo from './wws_logo.png';
import sample_cover from './sample_cover.jpg'
import sample_profile from './sample_profile.jpg'
import bgImage from './image.png'
import group_users from './group_users.png'
import { Home, MessageCircle, Search, UserIcon, Users, Calendar, Video } from 'lucide-react'
import sponsored_img from './sponsored_img.png'

export const assets = {
    logo,
    sample_cover,
    sample_profile,
    bgImage,
    group_users,
    sponsored_img
}

export const menuItemsData = [
    { to: '/', label: 'Feed', Icon: Home },
    { to: '/messages', label: 'Messages', Icon: MessageCircle },
    { to: '/live-rooms', label: 'Live Rooms', Icon: Video },
    { to: '/connections', label: 'Connections', Icon: Users },
    { to: '/discover', label: 'Discover', Icon: Search },
    { to: '/profile', label: 'Profile', Icon: UserIcon },
    { to: '/sanlist', label: 'Booking Sports', Icon: Calendar },
    { to: '/my-bookings', label: 'My Bookings', Icon: Calendar }
    
];
