import React, { useState, useEffect } from "react";
import { Search } from "lucide-react";
import Loading from "../components/Loading";
import UserCard from "../components/UserCard";
import { userAPI } from "../utils/api";

const Discover = () => {

    const [input, setInput] = useState("");
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Load suggestions on mount
    useEffect(() => {
        loadSuggestions();
    }, []);

    const loadSuggestions = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await userAPI.getSuggestions(20);
            
            if (response.success) {
                // Map backend response to frontend format
                setUsers(response.data.map(u => ({
                    _id: u.AccountID || u._id,
                    username: u.username,
                    full_name: u.full_name,
                    profile_picture: u.profile_picture || 'https://via.placeholder.com/100',
                    bio: u.bio || u.address || '',
                    location: u.address || '',
                    followers_count: 0,  // Backend doesn't return this for suggestions
                    is_following: false,  // Not following yet (it's a suggestion)
                })));
            }
        } catch (err) {
            console.error('Error loading suggestions:', err);
            setError('Không thể tải gợi ý');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (e) => {
        if(e.key === "Enter" && input.trim()) {
            try {
                setUsers([]);
                setLoading(true);
                setError(null);
                
                const response = await userAPI.search(input.trim(), 20);
                
                if (response.success) {
                    // Map backend response to frontend format
                    setUsers(response.data.map(u => ({
                        _id: u.AccountID || u._id,
                        username: u.username,
                        full_name: u.full_name,
                        profile_picture: u.profile_picture || 'https://via.placeholder.com/100',
                        bio: u.bio || u.address || '',
                        location: u.address || '',
                        followers_count: 0,  // Backend doesn't return this for search
                        is_following: false,  // Don't know yet
                    })));
                    
                    if (response.data.length === 0) {
                        setError('Không tìm thấy kết quả');
                    }
                }
            } catch (err) {
                console.error('Error searching:', err);
                setError('Lỗi khi tìm kiếm');
            } finally {
                setLoading(false);
            }
        }
    }

    return (
        <div className='min-h-screen bg-gradient-to-b from-slate-50 to-white'>
            <div className='max-w-6xl mx-auto p-6'>
                {/* Title */}
                <div className='mb-8'>
                <h1 className='text-3xl font-bold text-slate-900 mb-2'>Connections</h1>
                <p className='text-slate-600'>Manage your network and discover new connections</p>
                </div>

                {/* Search */}
                <div className='mb-8 shadow-md rounded-md border border-slate-200/60 bg-white/80'>
                    <div className='p-6'>
                        <div className='relative'>
                        <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5' />
                        <input type="text" placeholder='Search people by name, username, bio, or location...' className='pl-10 sm:pl-12 py-2 w-full border border-gray-300 rounded-md max-sm:text-sm' onChange={(e)=>setInput(e.target.value)} value={input} onKeyUp={handleSearch}/>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className='bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4'>
                        {error}
                    </div>
                )}

                <div className='flex flex-wrap gap-6'>
                    {users.map((user) => (
                        <UserCard user={user} key={user._id} />
                    ))}
                    </div>

                    {
                    loading && (
                        <Loading height='60vh' />
                    )
                }

            </div>
        </div>
    );
}

export default Discover;