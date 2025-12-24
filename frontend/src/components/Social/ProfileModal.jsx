import React, { useState, useEffect, useRef } from 'react';
import useAuth from "../../hooks/useAuth";
import { Pencil, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useI18n } from '../../i18n/hooks';
import { userAPI, imageToBase64, areaAPI } from "../../utils/api";
import { getPhone } from '../../utils/normalize';

const ProfileModal = ({ setShowEdit, user: propUser, onSaved }) => {
    const { user: authUser, setUser: setAuthUser } = useAuth();
    // Prefer explicit propUser, then authenticated user
    const user = propUser || authUser;
    const { t } = useI18n();

    const [editForm, setEditForm] = useState({
        username: user?.username || '',
        bio: user?.bio || '',
        location: user?.location || '',
        cover_photo: null,
        profile_picture: null,
        full_name: user?.full_name || '',
        gender: user?.gender || user?.Gender || '',
        address: user?.address || user?.Address || user?.location || '',
        areaId: user?.areaId || user?.AreaID || user?.AreaId || null
    });

    const [areas, setAreas] = useState([]);

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

    useEffect(() => {
        let mounted = true;
        const loadAreas = async () => {
            try {
                const res = await areaAPI.getAll();
                if (res && res.success && Array.isArray(res.data)) {
                    if (!mounted) return;
                    setAreas(res.data);
                } else if (res && Array.isArray(res)) {
                    // Some endpoints may return array directly
                    setAreas(res);
                }
            } catch (err) {
                console.debug('Failed to load areas', err);
            }
        };
        loadAreas();
        return () => { mounted = false; };
    }, []);

    // When areas or the editForm.address changes, attempt to resolve a matching area
    // into editForm.areaId if the user hasn't already selected one. This is split
    // out of the initial loader to avoid making the initial loader depend on editForm
    // and to satisfy react-hooks/exhaustive-deps.
    useEffect(() => {
        if (!areas || areas.length === 0) return;
        if (editForm.areaId) return; // already set
        if (!editForm.address) return;

        try {
            const found = areas.find(a => (a.AreaName || a.name || a.name_en || '').toLowerCase() === String(editForm.address).toLowerCase());
            if (found) {
                setEditForm(s => ({ ...s, areaId: found.AreaID || found.id || found.areaId }));
            }
        } catch (err) {
            // harmless: matching failure shouldn't break UI
            console.debug('Area resolution failed', err);
        }
    }, [areas, editForm.address, editForm.areaId]);

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
            if (editForm.phone !== undefined) payload.phone = editForm.phone;
            else if (editForm.location !== undefined && payload.address === undefined) payload.address = editForm.location;

            // If areaId selected, send both areaId and area name to backend for compatibility
            if (editForm.areaId) {
                payload.areaId = editForm.areaId;
                // try to set a human-readable address from areas list
                const selArea = areas.find(a => String(a.AreaID || a.id) === String(editForm.areaId));
                if (selArea) payload.address = selArea.AreaName || selArea.name || payload.address;
            }

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
                    toast.success(t('profile.saved', 'Profile saved'));
                    // close modal first
                    if (typeof setShowEdit === 'function') setShowEdit(false);

                    // Refresh authenticated user context so other parts of the UI update immediately
                    try {
                        if (typeof setAuthUser === 'function') {
                                    const fresh = await userAPI.getProfile(userId, true).catch(() => null);
                            if (fresh && fresh.success && fresh.data) {
                                const fu = fresh.data;
                                const normalized = {
                                    ...fu,
                                    fullName: fu.fullName || fu.FullName || fu.full_name || fu.name || fu.HoTen || '',
                                    username: fu.username || fu.Username || fu.user_name || fu.UserName || fu.email || '',
                                    email: fu.email || fu.Email || ''
                                };
                                // include phone if present
                                try { normalized.phone = fu.phone || fu.Phone || fu.phoneNumber || fu.PhoneNumber || getPhone(fu) || normalized.phone || ''; } catch {/* ignore */ }
                                try {
                                    // Cache-bust profile picture to avoid stale browser cache when backend returns same filename
                                    if (normalized && typeof normalized.profile_picture === 'string' && (normalized.profile_picture.startsWith('http') || normalized.profile_picture.startsWith('/'))) {
                                        const base = normalized.profile_picture.split('?')[0];
                                        normalized.profile_picture = `${base}?v=${Date.now()}`;
                                    }
                                    setAuthUser(normalized);
                                } catch (e) { console.debug('setAuthUser failed', e); }
                                try { localStorage.setItem('userData', JSON.stringify(normalized)); } catch (e) { console.debug('Could not persist userData', e); }
                            }
                        }
                    } catch (e) {
                        console.debug('Failed to refresh auth user after profile save', e);
                    }

                    // notify parent/profile page to re-fetch its view
                    if (typeof onSaved === 'function') onSaved();

                    // Dispatch a global event so other listeners (pages/components) can react immediately
                    try { window.dispatchEvent(new CustomEvent('user:updated', { detail: { userId } })); } catch (e) { console.debug('Failed to dispatch user:updated', e); }
                } else {
                    toast.error(response.message || t('profile.saveFailed', 'Failed to save'));
                }
        } catch (err) {
            console.error('Save profile error:', err);
                    toast.error(t('profile.saveFailed', 'Failed to save'));
        }
    };
    // If we don't have a user to edit, show a friendly message and close option
    if (!user) return (
        <div className="fixed inset-0 z-50 h-screen overflow-y-auto bg-black/50 flex items-center justify-center p-4">
            <div className="w-full max-w-md sm:py-6 mx-auto">
                <div className="bg-white rounded-lg shadow p-6 text-center">
                    <p className="text-gray-700 mb-4">{t('profile.loginPrompt', 'Please log in to edit your profile.')}</p>
                    <div className="flex justify-center">
                        <button onClick={() => typeof setShowEdit === 'function' && setShowEdit(false)} className="px-4 py-2 rounded border">{t('common.cancel')}</button>
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

                    <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('profile.editTitle', 'Edit Profile')}</h1>

                    <form className="space-y-4" onSubmit={handleSaveProfile}>
                        {/* Profile Picture */}
                        <div>
                            <label htmlFor="profile_picture" className="block text-sm font-medium text-gray-700 mb-1">
                                    {t('profile.profilePicture', 'Profile Picture')}
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
                                aria-label={t('profile.changeProfilePictureAria', 'Change profile picture')}
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
                            {t('profile.coverPhoto', 'Cover Photo')}
                        </label>
                        
                    </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">{t('profile.fullName', 'Full name')}</label>
                            <input
                                value={editForm.full_name}
                                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                                className="w-full mt-1 p-2 border rounded"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">{t('profile.username', 'Username')}</label>
                            <input
                                value={editForm.username}
                                onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                                className="w-full mt-1 p-2 border rounded"
                            />
                        </div>

                        {/* phone removed from profile modal per design */}

                        <div>
                            <label className="block text-sm font-medium text-gray-700">{t('profile.gender', 'Gender')}</label>
                            <select
                                value={editForm.gender}
                                onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                                className="w-full mt-1 p-2 border rounded"
                            >
                                <option value="">{t('profile.preferNotToSay', 'Prefer not to say')}</option>
                                <option value="Male">{t('profile.male', 'Male')}</option>
                                <option value="Female">{t('profile.female', 'Female')}</option>
                                <option value="Other">{t('profile.other', 'Other')}</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">{t('profile.address', 'Address')}</label>
                            {/* Use area list instead of free-text address */}
                            {areas && areas.length > 0 ? (
                                <select
                                    value={editForm.areaId || ''}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        const sel = areas.find(a => String(a.AreaID || a.id) === String(val));
                                        setEditForm({ ...editForm, areaId: val || null, address: sel ? (sel.AreaName || sel.name || '') : '' });
                                    }}
                                    className="w-full mt-1 p-2 border rounded"
                                >
                                    <option value="">-- Chọn khu vực --</option>
                                    {areas.map(a => (
                                        <option key={a.AreaID || a.id} value={a.AreaID || a.id}>{a.AreaName || a.name}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    value={editForm.address}
                                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                                    className="w-full mt-1 p-2 border rounded"
                                />
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">{t('profile.bio', 'Bio')}</label>
                            <textarea
                                value={editForm.bio}
                                onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                                className="w-full mt-1 p-2 border rounded"
                            />
                        </div>

                        <div className="flex gap-3 justify-end">
                            <button type="button" onClick={() => typeof setShowEdit === 'function' && setShowEdit(false)} className="px-4 py-2 rounded border">{t('common.cancel')}</button>
                            <button type="submit" className="px-4 py-2 rounded bg-indigo-600 text-white">{t('common.save')}</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ProfileModal;