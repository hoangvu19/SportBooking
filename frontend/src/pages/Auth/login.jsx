import React, { useState } from "react"; 
import { assets } from "../../assets/assets";
import { Eye, EyeOff, Mail, Lock, User, ChevronDown } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import "../../CSS/LoginStyles.css";

const Login = () => {
    const { login, signup} = useAuth();
    const [currentForm, setCurrentForm] = useState('login');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [formData, setFormData] = useState({
        usernameOrEmail: '',
        password: '',
        username: '',
        email: '',
        fullName: '',
        phoneNumber: '',
        gender: '',
        address: '',
        confirmPassword: '',
        emailReset: ''
    });

    const handleInputChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value // Don't trim while typing
        });
        if (error) setError('');
        if (successMessage) setSuccessMessage('');
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const result = await login(
                formData.usernameOrEmail.trim(), 
                formData.password
            );
            
            if (!result.success) {
                setError(result.message || 'Đăng nhập thất bại');
            }
        } catch {
            setError('Có lỗi xảy ra khi đăng nhập');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setSuccessMessage('');

        if (formData.password !== formData.confirmPassword) {
            setError('Mật khẩu không khớp');
            setIsLoading(false);
            return;
        }

        if (formData.password.length < 6) {
            setError('Mật khẩu phải có ít nhất 6 ký tự');
            setIsLoading(false);
            return;
        }

        try {
            const result = await signup({
                username: formData.username,
                email: formData.email,
                password: formData.password,
                fullName: formData.fullName,
                phoneNumber: formData.phoneNumber,
                gender: formData.gender,
                address: formData.address
            });

            if (result.success) {
                setSuccessMessage('Đăng ký thành công! Vui lòng đăng nhập.');
                setCurrentForm('login');
                setFormData(prev => ({
                    ...prev,
                    usernameOrEmail: formData.username,
                    password: ''
                }));
            } else {
                setError(result.message || 'Đăng ký thất bại');
            }
        } catch {
            setError('Có lỗi xảy ra khi đăng ký');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen relative flex sports-decoration">
             <img src={assets.bgImage} alt="" className='absolute top-0 left-0 -z-10 w-full h-full object-cover'/>
            {/* Stadium Background Image */}
            <div 
                className="absolute inset-0 login-container"
                style={{ backgroundImage: `url(${assets.bgImage})` }}
            >
                {/* Colorful floating orbs */}
                <div className="absolute inset-0">
                    {/* Main floating elements */}
                    <div className="absolute top-16 left-12 w-20 h-20 bg-purple-400/30 rounded-full blur-lg animate-pulse shadow-lg shadow-purple-400/50"></div>
                    <div className="absolute bottom-24 right-16 w-24 h-24 bg-pink-400/25 rounded-full blur-xl animate-pulse shadow-xl shadow-pink-400/30" style={{animationDelay: '2s'}}></div>
                    <div className="absolute top-1/3 right-1/4 w-16 h-16 bg-yellow-400/30 rounded-full blur-md animate-pulse shadow-md shadow-yellow-400/40" style={{animationDelay: '4s'}}></div>
                    
                    {/* Additional colorful accents */}
                    <div className="absolute top-1/4 left-1/3 w-8 h-8 bg-blue-400/35 rounded-full blur-sm animate-pulse" style={{animationDelay: '1s'}}></div>
                    <div className="absolute bottom-1/3 left-1/4 w-12 h-12 bg-green-400/25 rounded-full blur-md animate-pulse" style={{animationDelay: '3s'}}></div>
                </div>
            </div>
            
            
            
            <div className="flex-1 flex items-center justify-center p-6 md:p-10 z-10 relative">
                {/* Sports 3D Scene */}
                <div className="sports-scene">
                    {/* Stadium Field Lines */}
                    <div className="field-line field-line-1"></div>
                    <div className="field-line field-line-2"></div>
                    
                    {/* Running Player */}
                    
                    
                    {/* Penalty Scene */}
                    <div className="penalty-kicker">⚽</div>
                    

                    <div className="flying-ball ball-2">🏀</div>
                    <div className="flying-ball ball-3">🏈</div>
                    
                    
                   
                </div>

                {/* Enhanced floating orbs */}
                <div className="floating-orb"></div>
                <div className="floating-orb"></div>
                <div className="floating-orb"></div>
                <div className="floating-orb"></div>
                
                <div className="w-full max-w-md login-form rounded-3xl p-8 shadow-2xl ring-2 ring-white/30">
                    
                    {currentForm === 'login' && (
                        <>
                            <h2 className="text-3xl font-bold bg-gradient-to-r from-white via-purple-100 to-white bg-clip-text text-transparent mb-6 text-center text-glow">Đăng nhập</h2>
                            <form onSubmit={handleLogin} className="space-y-4">
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/70 h-5 w-5" />
                                    <input
                                        type="text"
                                        name="usernameOrEmail"
                                        value={formData.usernameOrEmail}
                                        onChange={handleInputChange}
                                        placeholder="Username hoặc Email"
                                        className="w-full pl-12 pr-4 py-3 bg-white/10 border-2 border-purple-400/30 rounded-xl text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-yellow-400/60 focus:border-pink-400/70 focus:bg-white/20 login-input shadow-lg backdrop-blur-sm"
                                        required
                                    />
                                </div>

                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/70 h-5 w-5" />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        name="password"
                                        value={formData.password}
                                        onChange={handleInputChange}
                                        placeholder="Mật khẩu"
                                        className="w-full pl-12 pr-12 py-3 bg-white/10 border-2 border-purple-400/30 rounded-xl text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-yellow-400/60 focus:border-pink-400/70 focus:bg-white/20 login-input shadow-lg backdrop-blur-sm"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/70 hover:text-white"
                                    >
                                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                    </button>
                                </div>

                                {error && (
                                    <div className="text-red-200 text-sm text-center bg-gradient-to-r from-red-500/20 to-pink-500/20 p-3 rounded-xl border border-red-400/40 backdrop-blur-sm">
                                        {error}
                                    </div>
                                )}

                                {successMessage && (
                                    <div className="text-green-200 text-sm text-center bg-gradient-to-r from-green-500/20 to-emerald-500/20 p-3 rounded-xl border border-green-400/40 backdrop-blur-sm">
                                        {successMessage}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full mx-auto block py-3 login-btn text-white rounded-xl transition-all duration-100 font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.05] ring-2 ring-white/20"
                                >
                                    {isLoading ? 'Đang đăng nhập...' : 'ĐĂNG NHẬP'}
                                </button>

                                <div className="text-center space-y-2">
                                    <button
                                        type="button"
                                        // onClick={() => setCurrentForm('forgot')}
                                        className="text-blue-200 hover:text-blue-100 text-sm font-semibold underline block w-full transition-colors duration-200"
                                    >
                                        Quên mật khẩu?
                                    </button>
                                    <div className="text-white/90 text-sm font-medium">
                                        Chưa có tài khoản? {' '}
                                        <button
                                            type="button"
                                            onClick={() => setCurrentForm('signup')}
                                            className="text-blue-200 hover:text-blue-100 hover:underline font-bold transition-colors duration-200"
                                        >
                                            Đăng ký ngay
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </>
                    )}

                    {currentForm === 'signup' && (
                        <>
                            <h2 className="text-3xl font-bold bg-gradient-to-r from-white via-green-100 to-white bg-clip-text text-transparent mb-6 text-center drop-shadow-lg">Đăng ký</h2>
                            <form onSubmit={handleSignup} className="space-y-4">
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/80 h-5 w-5" />
                                        <input
                                            type="text"
                                            name="username"
                                            value={formData.username}
                                            onChange={handleInputChange}
                                            placeholder="Tên đăng nhập"
                                            className="w-full pl-12 pr-4 py-3 bg-gradient-to-r from-white/15 via-purple-50/10 to-pink-50/5 border border-white/30 rounded-lg text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-yellow-400/50 backdrop-blur-sm transition-all duration-300 hover:bg-white/25 shadow-md"
                                            required
                                        />
                                    </div>

                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/70 h-5 w-5" />
                                        <input
                                            type="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleInputChange}
                                            placeholder="Email"
                                            className="w-full pl-12 pr-4 py-3 bg-gradient-to-r from-white/10 via-white/15 to-white/10 border border-white/20 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-purple-400/50 backdrop-blur-sm transition-all duration-300 hover:bg-white/20"
                                            required
                                        />
                                    </div>

                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/70 h-5 w-5" />
                                        <input
                                            type="text"
                                            name="fullName"
                                            value={formData.fullName}
                                            onChange={handleInputChange}
                                            placeholder="Họ và tên"
                                            className="w-full pl-12 pr-4 py-3 bg-gradient-to-r from-white/10 via-white/15 to-white/10 border border-white/20 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-purple-400/50 backdrop-blur-sm transition-all duration-300 hover:bg-white/20"
                                            required
                                        />
                                    </div>

                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/70 h-5 w-5 pointer-events-none z-10" />
                                        <select
                                            name="gender"
                                            value={formData.gender}
                                            onChange={handleInputChange}
                                            className="w-full pl-12 pr-4 py-3 bg-gradient-to-r from-white/10 via-white/15 to-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-400/50 backdrop-blur-sm transition-all duration-300 hover:bg-white/20 appearance-none cursor-pointer"
                                            required
                                        >
                                            <option value="" className="text-gray-400">Chọn giới tính</option>
                                            <option value="male" className="text-black bg-white">👨 Nam</option>
                                            <option value="female" className="text-black bg-white">👩 Nữ</option>
                                        </select>
                                            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/70 h-5 w-5 pointer-events-none" />
                                    </div>

                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/70 h-5 w-5" />
                                        <input
                                            type="password"
                                            name="password"
                                            value={formData.password}
                                            onChange={handleInputChange}
                                            placeholder="Mật khẩu"
                                            className="w-full pl-12 pr-4 py-3 bg-gradient-to-r from-white/10 via-white/15 to-white/10 border border-white/20 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-purple-400/50 backdrop-blur-sm transition-all duration-300 hover:bg-white/20"
                                            required
                                            minLength={6}
                                        />
                                    </div>

                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/70 h-5 w-5" />
                                        <input
                                            type="password"
                                            name="confirmPassword"
                                            value={formData.confirmPassword}
                                            onChange={handleInputChange}
                                            placeholder="Xác nhận mật khẩu"
                                            className="w-full pl-12 pr-4 py-3 bg-gradient-to-r from-white/10 via-white/15 to-white/10 border border-white/20 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-purple-400/50 backdrop-blur-sm transition-all duration-300 hover:bg-white/20"
                                            required
                                        />
                                    </div>
                                </div>

                                {error && (
                                    <div className="text-red-200 text-sm text-center bg-gradient-to-r from-red-500/20 to-pink-500/20 p-3 rounded-xl border border-red-400/40 backdrop-blur-sm">
                                        {error}
                                    </div>
                                )}

                                {successMessage && (
                                    <div className="text-green-200 text-sm text-center bg-gradient-to-r from-green-500/20 to-emerald-500/20 p-3 rounded-xl border border-green-400/40 backdrop-blur-sm">
                                        {successMessage}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full py-3 bg-gradient-to-r from-pink-500 via-purple-500 to-yellow-500 text-white rounded-lg hover:from-pink-600 hover:via-purple-600 hover:to-yellow-600 transition-all duration-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-[1.02] ring-2 ring-white/20"
                                >
                                    {isLoading ? 'Đang đăng ký...' : 'Đăng ký'}
                                </button>

                                <div className="text-center">
                                    <div className="text-white/80 text-sm">
                                        Đã có tài khoản? {' '}
                                        <button
                                            type="button"
                                            onClick={() => setCurrentForm('login')}
                                            className="text-white hover:underline font-semibold"
                                        >
                                            Đăng nhập ngay
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Login;