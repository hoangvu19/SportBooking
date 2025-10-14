import React, { useState, useEffect } from "react";
import { Image, X } from "lucide-react";
import toast from "react-hot-toast";
import { postAPI, imageToBase64 } from "../../utils/api";
import { useAuth } from "../../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import DEFAULT_AVATAR from "../../utils/defaults";

const CreatePost = () => {
    const { user: currentUser } = useAuth();
    const navigate = useNavigate();
    
    const [content, setContent] = useState("");
    const [images, setImages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [user, setUser] = useState(null);

    useEffect(() => {
        if (currentUser) {
            setUser(currentUser);
        }
    }, [currentUser]);

    const handleSubmit = async () => {
        try {
            setLoading(true);
            
            // Validation
            if (!content && images.length === 0) {
                throw new Error('Vui lòng nhập nội dung hoặc chọn ảnh');
            }

            // Convert images to base64
            const imageUrls = await Promise.all(
                Array.from(images).map(img => imageToBase64(img))
            );

            // Create post via API
            const response = await postAPI.create({
                content: content,
                imageUrls: imageUrls
            });
            
            if (response.success) {
                // Clear form
                setContent("");
                setImages([]);
                
                // Redirect to feed after 1 second
                setTimeout(() => {
                    navigate('/feed');
                }, 1000);
                
                return Promise.resolve(response.data);
            } else {
                throw new Error(response.message || 'Không thể tạo bài viết');
            }
        } catch (error) {
            console.error('Create post error:', error);
            throw error;
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className='min-h-screen bg-gradient-to-b from-slate-50 to-white'>
            <div className='max-w-6xl mx-auto p-6'>
                {/* Title */}
                <div className='mb-8'>
                    <h1 className='text-3xl font-bold text-slate-900 mb-2'>Create Post</h1>
                    <p className='text-slate-600'>Share your thoughts with the world</p>
                </div>

                {!user ? (
                    <div className="text-center py-8">
                        <p className="text-gray-500">Vui lòng đăng nhập để tạo bài viết</p>
                    </div>
                ) : (
                <div className='max-w-xl bg-white p-4 sm:p-8 sm:pb-3 rounded-xl shadow-md space-y-4'>
                    {/* Header */}
                    <div className='flex items-center gap-3'>
                                        <img src={user.profile_picture || user.AvatarUrl || user.ProfilePictureURL || user.avatarUrl || DEFAULT_AVATAR} onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_AVATAR; }} alt="" className='w-12 h-12 rounded-full shadow'/>
                        <div>
                            <h2 className='font-semibold'>{user.full_name || user.FullName}</h2>
                            <p className='text-sm text-gray-500'>@{user.username || user.Username}</p>
                        </div>
                    </div>

                    {/* Text Area */}
                    <textarea 
                        data-testid="createpost-textarea"
                        className='w-full resize-none max-h-20 mt-4 text-sm outline-none placeholder-gray-400' 
                        placeholder="What's happening?" 
                        onChange={((e)=>setContent(e.target.value))} 
                        value={content}>
                    </textarea>
                        {/* Images */}
                    {images.length > 0 && (
                        <div className='flex flex-wrap gap-2 mt-4'>
                            {images.map((image, i) => (
                            <div key={i} className='relative group'>
                                <img src={URL.createObjectURL(image)} className='h-20 rounded-md' alt="" />
                                <div 
                                onClick={() => setImages(images.filter((_, index) => index !== i))} 
                                className='absolute hidden group-hover:flex justify-center items-center top-0 right-0 bottom-0 left-0 bg-black/40 rounded-md cursor-pointer'>
                                <X className="w-6 h-6 text-white"/>
                                </div>
                            </div>
                            ))}
                        </div>
                    )}

                    {/* Bottom Bar */}
                    <div className='flex items-center justify-between pt-3 border-t border-gray-300'>
                        <label htmlFor="images" className='flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition cursor-pointer'>
                            <Image className='size-6'/>
                        </label>
                        <input type="file"  id="images"  accept="image/*"  hidden  multiple  onChange={((e) => setImages([...images, ...e.target.files]))} />
                        <button data-testid="publish-post-button" disabled={loading || (!content && images.length === 0)} onClick={() => toast.promise(
                                handleSubmit(),
                                {
                                    loading: 'Đang đăng...',
                                    success: <p>Đăng bài thành công!</p>,
                                    error: (err) => <p>{err?.message || 'Có lỗi xảy ra'}</p>
                                }
                        )}  className='text-sm bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 active:scale-95 transition text-white font-medium px-8 py-2 rounded-md cursor-pointer'>
                            Publish Post
                            </button>
                    </div>

                </div>
                )}
            </div>
        </div>
    );
}
export default CreatePost;