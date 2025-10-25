import logo from './wws_logo.png';
import sample_cover from './sample_cover.jpg'
import sample_profile from './sample_profile.jpg'
import bgImage from './image.png'
import { Home, MessageCircle, Search, UserIcon, Users, Calendar, CalendarCheck, Video } from 'lucide-react'
import sponsored_img from './sponsored_img.png'

export const assets = {
    logo,
    sample_cover,
    sample_profile,
    bgImage,
    sponsored_img
}

export const menuItemsData = [
    { to: '/', labelKey: 'menu.feed', Icon: Home },
    { to: '/messages', labelKey: 'menu.messages', Icon: MessageCircle },
    { to: '/live-rooms', labelKey: 'menu.liveRooms', Icon: Video },
    { to: '/connections', labelKey: 'menu.connections', Icon: Users },
    { to: '/discover', labelKey: 'menu.discover', Icon: Search },
    { to: '/profile', labelKey: 'menu.profile', Icon: UserIcon },
    { to: '/sanlist', labelKey: 'menu.bookingSports', Icon: Calendar },
    { to: '/my-bookings', labelKey: 'menu.myBookings', Icon: CalendarCheck }
];
