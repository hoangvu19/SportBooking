import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Pencil, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { userAPI, imageToBase64 } from '../utils/api';

const ProfileModal = ({ setShowEdit, user: propUser, onSaved }) => {
    const { user: authUser } = useAuth();
    // Prefer explicit propUser, then authenticated user
    const user = propUser || authUser;

    const [editForm, setEditForm] = useState({
        username: user?.username || '',
        bio: user?.bio || '',
        location: user?.location || '',
        cover_photo: null,
        profile_picture: null,
        full_name: user?.full_name || '',
        gender: user?.gender || user?.Gender || '',
        address: user?.address || user?.Address || user?.location || ''
    });

    const previewRef = useRef({ profile: null, cover: null });
    const profileInputRef = useRef(null);

    useEffect(() => {
        const p = previewRef.current.profile;
        const c = previewRef.current.cover;
        return () => {
            if (p) URL.revokeObjectURL(p);
            if (c) URL.revokeObjectURL(c);
        };
    }, []);

    const handleProfileChange = (file) => {
        if (!file) return;
        if (previewRef.current.profile) URL.revokeObjectURL(previewRef.current.profile);
        previewRef.current.profile = URL.createObjectURL(file);
        setEditForm((s) => ({ ...s, profile_picture: file }));
    };

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        try {
            // Prepare payload using backend-expected field names
            const payload = {};
            if (editForm.full_name !== undefined) payload.fullName = editForm.full_name;
            if (editForm.gender !== undefined) payload.gender = editForm.gender;
            // Send bio directly to backend. Backend will map to the correct DB column.
            if (editForm.full_name !== undefined && editForm.full_name !== '') {
                // already handled above
            }
            if (editForm.address !== undefined) payload.address = editForm.address;
            if (editForm.bio !== undefined) payload.bio = editForm.bio;
            else if (editForm.location !== undefined && payload.address === undefined) payload.address = editForm.location;

            // If profile picture file selected, convert to base64 and send as avatarUrl
            if (editForm.profile_picture) {
                try {
                    const b64 = await imageToBase64(editForm.profile_picture);
                    payload.avatarUrl = b64;
                } catch (err) {
                    console.error('Failed to convert avatar to base64:', err);
                }
            }

            // Normalize user id - backend may expect AccountID or _id
            const userId = user?.AccountID || user?._id || user?.userId;
            const response = await userAPI.updateProfile(userId, payload);

            if (response.success) {
                toast.success('Profile saved');
                if (typeof setShowEdit === 'function') setShowEdit(false);
                if (typeof onSaved === 'function') onSaved();
            } else {
                toast.error(response.message || 'Failed to save');
            }
        } catch (err) {
            console.error('Save profile error:', err);
            toast.error('Failed to save');
        }
    };
    // If we don't have a user to edit, show a friendly message and close option
    if (!user) return (
        <div className="fixed inset-0 z-50 h-screen overflow-y-auto bg-black/50 flex items-center justify-center p-4">
            <div className="w-full max-w-md sm:py-6 mx-auto">
                <div className="bg-white rounded-lg shadow p-6 text-center">
                    <p className="text-gray-700 mb-4">Vui lòng đăng nhập để chỉnh sửa hồ sơ.</p>
                    <div className="flex justify-center">
                        <button onClick={() => typeof setShowEdit === 'function' && setShowEdit(false)} className="px-4 py-2 rounded border">Đóng</button>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 h-screen overflow-y-auto bg-black/50 flex items-start sm:items-center justify-center p-4">
            <div className="w-full max-w-2xl sm:py-6 mx-auto">
                <div className="bg-white rounded-lg shadow p-6 relative">
                    <button
                        type="button"
                        onClick={() => typeof setShowEdit === 'function' && setShowEdit(false)}
                        className="absolute top-4 right-4 p-2 rounded bg-gray-100 hover:bg-gray-200"
                        aria-label="Close"
                    >
                        <X className="w-4 h-4" />
                    </button>

                    <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Profile</h1>

                    <form className="space-y-4" onSubmit={handleSaveProfile}>
                        {/* Profile Picture */}
                        <div>
                            <label htmlFor="profile_picture" className="block text-sm font-medium text-gray-700 mb-1">
                                Profile Picture
                            </label>
                            <input
                                ref={profileInputRef}
                                hidden
                                type="file"
                                accept="image/*"
                                id="profile_picture"
                                onChange={(e) => handleProfileChange(e.target.files[0])}
                            />

                            <div
                                className="mt-4 relative w-24 h-24 cursor-pointer"
                                onClick={() => profileInputRef.current && profileInputRef.current.click()}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    // don't intercept when IME composition is active
                                    if (e.nativeEvent && e.nativeEvent.isComposing) return;
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        profileInputRef.current && profileInputRef.current.click();
                                    }
                                }}
                                aria-label="Change profile picture"
                            >
                                <img
                                    src={editForm.profile_picture ? previewRef.current.profile : user.profile_picture}
                                    alt="Profile Preview"
                                    className="w-24 h-24 rounded-full object-cover"
                                />
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition">
                                    <Pencil className="w-5 h-5 text-white" />
                                </div>
                            </div>
                        </div>

                    {/* cover photo */}
                    <div className="flex flex-col items-start gap-3">
                        <label htmlFor="cover_photo" className="block text-sm font-medium text-gray-700 mb-1">
                            Cover Photo
                        </label>
                        
                    </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Full name</label>
                            <input
                                value={editForm.full_name}
                                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                                className="w-full mt-1 p-2 border rounded"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Username</label>
                            <input
                                value={editForm.username}
                                onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                                className="w-full mt-1 p-2 border rounded"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Gender</label>
                            <select
                                value={editForm.gender}
                                onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                                className="w-full mt-1 p-2 border rounded"
                            >
                                <option value="">Prefer not to say</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Address</label>
                            <input
                                value={editForm.address}
                                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                                className="w-full mt-1 p-2 border rounded"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Bio</label>
                            <textarea
                                value={editForm.bio}
                                onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                                className="w-full mt-1 p-2 border rounded"
                            />
                        </div>

                        <div className="flex gap-3 justify-end">
                            <button type="button" onClick={() => typeof setShowEdit === 'function' && setShowEdit(false)} className="px-4 py-2 rounded border">Cancel</button>
                            <button type="submit" className="px-4 py-2 rounded bg-indigo-600 text-white">Save</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ProfileModal;