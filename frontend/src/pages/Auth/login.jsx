import React, { useState, useRef, useEffect } from "react"; 
import { assets } from "../../assets/assets";
import { Eye, EyeOff, Mail, Lock, User, ChevronDown } from "lucide-react";
import useAuth from "../../hooks/useAuth";
import { useI18n } from '../../i18n/hooks';
import "../../CSS/LoginStyles.css";

const Login = () => {
    const { login, requestLoginOtp, signup, verifyOtp, verifyRegister, forgotPassword } = useAuth();
    const { t } = useI18n();
    const [currentForm, setCurrentForm] = useState('login');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [inlineOtp, setInlineOtp] = useState('');
    const [captchaCode, setCaptchaCode] = useState(''); // client-side captcha for login (no email)
    const otpCanvasRef = useRef(null);
    const [isRequestingCode, setIsRequestingCode] = useState(false);

    useEffect(() => {
        const canvas = otpCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const width = 140;
        const height = 48;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // background
        ctx.clearRect(0, 0, width, height);
        const g = ctx.createLinearGradient(0, 0, width, height);
        g.addColorStop(0, 'rgba(255,255,255,0.02)');
        g.addColorStop(1, 'rgba(255,255,255,0.06)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height);

        // noise lines
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(Math.random() * width, Math.random() * height);
            ctx.bezierCurveTo(Math.random() * width, Math.random() * height, Math.random() * width, Math.random() * height, Math.random() * width, Math.random() * height);
            ctx.strokeStyle = `rgba(255,255,255,${0.03 + Math.random() * 0.07})`;
            ctx.lineWidth = 1 + Math.random() * 1.5;
            ctx.stroke();
        }

        // Display server-provided inlineOtp first (registration/dev preview),
        // otherwise fall back to client-side captchaCode, otherwise placeholder
        const display = (inlineOtp && inlineOtp.length) ? inlineOtp : (captchaCode && captchaCode.length ? captchaCode : '——');
        const otp = display.toString();
        const charCount = Math.max(otp.length, 1);
        const baseX = 12;
        const slot = (width - baseX * 2) / charCount;

        for (let i = 0; i < charCount; i++) {
            const ch = otp[i] || '–';
            const fontSize = 22 + Math.round(Math.random() * 6);
            ctx.save();
            const x = baseX + i * slot + (Math.random() * 6 - 3);
            const y = 28 + (Math.random() * 6 - 3);
            const angle = (Math.random() * 24 - 12) * Math.PI / 180;
            ctx.translate(x, y);
            ctx.rotate(angle);
            ctx.font = `bold ${fontSize}px "Segoe UI", Roboto, Arial, sans-serif`;
            const palettes = ['#ffffff', '#f0f8ff', '#fbe7ff'];
            ctx.fillStyle = palettes[i % palettes.length];
            ctx.fillText(ch, 0, 0);
            ctx.restore();
        }

        // speckles
        for (let i = 0; i < 20; i++) {
            ctx.beginPath();
            ctx.fillStyle = `rgba(255,255,255,${0.02 + Math.random() * 0.06})`;
            ctx.arc(Math.random() * width, Math.random() * height, Math.random() * 1.6, 0, Math.PI * 2);
            ctx.fill();
        }
    }, [inlineOtp, captchaCode]);
    const [formData, setFormData] = useState({
        usernameOrEmail: '',
        password: '',
        otpCode: '',
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
        if (inlineOtp) setInlineOtp('');
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            // If user has entered an OTP in the form, attempt verification first
            const enteredOtp = formData.otpCode && formData.otpCode.trim();
            const sid = otpSessionId || (() => { try { return localStorage.getItem('otpSessionId'); } catch { return null; } })();
            if (enteredOtp) {
                // If we have a server session id, verify server-side
                if (sid) {
                    const res = await verifyOtp(sid, enteredOtp);
                    if (!res.success) {
                        setError(res.message || t('auth.otpFailed', 'OTP verification failed'));
                    }
                    setIsLoading(false);
                    return;
                }

                // No server session: try client-side captcha match
                const enteredNorm = enteredOtp.replace(/\s+/g, '').toUpperCase();
                const clientCode = (captchaCode || '').toString().replace(/\s+/g, '').toUpperCase();
                if (clientCode && enteredNorm === clientCode) {
                    const loginRes = await login(formData.usernameOrEmail.trim(), formData.password);
                    if (!loginRes || !loginRes.success) {
                        setError(loginRes?.message || t('auth.loginFailed', 'Login failed'));
                    }
                    setIsLoading(false);
                    return;
                }

                setError(t('auth.otpSessionMissing', 'OTP session missing. Please request a new code.'));
                setIsLoading(false);
                return;
            }

            // Otherwise request credential-based OTP (login via OTP inline, no email)
            const result = await requestLoginOtp(
                formData.usernameOrEmail.trim(),
                formData.password
            );
            console.debug('handleLogin requestLoginOtp result:', result);
                if (!result.success) {
                setError(result.message || t('auth.loginFailed', 'Login failed'));
            } else if (result.otpRequired || result.otpSessionId) {
                setOtpSessionId(result.otpSessionId || result.data?.otpSessionId);
                try { localStorage.setItem('otpSessionId', result.otpSessionId || result.data?.otpSessionId); } catch { void 0; }
                if (result.otp) setInlineOtp(result.otp);
                setCurrentForm('otp');
            }
        } catch (err) {
            console.error('handleLogin error', err);
            setError(t('auth.loginError', 'An error occurred during login'));
        } finally {
            setIsLoading(false);
        }
    };

    const [otpSessionId, setOtpSessionId] = useState(null);
    const [isRegisteringOtp, setIsRegisteringOtp] = useState(false);
    const autoRequestRef = useRef(0);

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            let res;
            // Registration flow with server-side OTP
            if (isRegisteringOtp) {
                res = await verifyRegister(otpSessionId, formData.otpCode.trim());
                if (res.success) {
                    setCurrentForm('login');
                    setIsRegisteringOtp(false);
                } else {
                    setError(res.message || t('auth.otpFailed', 'OTP verification failed'));
                    // auto-request new code/captcha on failure
                        if (autoRequestRef.current < 2) {
                        autoRequestRef.current += 1;
                        setTimeout(() => { try { handleRequestCode(); } catch { void 0; } }, 700);
                    }
                }
                setIsLoading(false);
                return;
            }

            // If we have a server-side OTP session id, verify via backend
            if (otpSessionId) {
                res = await verifyOtp(otpSessionId, formData.otpCode.trim());
                if (!res.success) {
                    setError(res.message || t('auth.otpFailed', 'OTP verification failed'));
                    if (autoRequestRef.current < 2) {
                        autoRequestRef.current += 1;
                        setTimeout(() => { try { handleRequestCode(); } catch { void 0; } }, 700);
                    }
                }
                setIsLoading(false);
                return;
            }

            // No server session: maybe user is using the client-generated captcha.
            const entered = (formData.otpCode || '').toString().replace(/\s+/g, '').toUpperCase();
            const clientCode = (captchaCode || '').toString().replace(/\s+/g, '').toUpperCase();
                if (clientCode && entered && entered === clientCode) {
                // Client captcha matched: proceed to normal credential login
                const loginRes = await login(formData.usernameOrEmail.trim(), formData.password);
                if (!loginRes || !loginRes.success) {
                    setError(loginRes?.message || t('auth.loginFailed', 'Login failed'));
                    if (autoRequestRef.current < 2) {
                        autoRequestRef.current += 1;
                        setTimeout(() => { try { handleRequestCode(); } catch { void 0; } }, 700);
                    }
                } else {
                    // Clear captcha/inline display after successful attempt
                    setCaptchaCode('');
                    setInlineOtp('');
                    try { localStorage.removeItem('login_captcha'); } catch { void 0; }
                }
                setIsLoading(false);
                return;
            }

            // fallback error
            setError(t('auth.otpFailed', 'OTP verification failed'));
        } catch {
            setError(t('auth.otpError', 'An error occurred while verifying OTP'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendOtp = async () => {
        // Re-use entered identifier & password to request a new OTP
        setIsLoading(true);
        setError('');
        try {
            // Require password to resend credential-based OTP
            if (!formData.password || formData.password.length === 0) {
                throw new Error(t('auth.enterPasswordToResend', 'Please enter your password to request a new code'));
            }
            const result = await requestLoginOtp(formData.usernameOrEmail.trim(), formData.password);
            console.debug('handleResendOtp result:', result);
            if (!result.success) {
                setError(result.message || t('auth.unableToResendOtp', 'Unable to resend OTP'));
            } else {
                setOtpSessionId(result.otpSessionId);
                if (result.otp) setInlineOtp(result.otp);
            }
        } catch {
            setError(t('auth.unableToResendOtp', 'Unable to resend OTP'));
        } finally {
            setIsLoading(false);
        }
    };

    // removed server email-send flow for login; login uses inline/client-side OTP only

    const handleRequestCode = async () => {
        // Client-only: generate a client-side captcha for login (no email send)
        setError('');
        setIsRequestingCode(true);
        try {
            const gen = (len = 5) => {
                const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
                let s = '';
                for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
                return s;
            };
            const code = gen(5);
            setCaptchaCode(code);
            setInlineOtp('');
            // Clear any server-side otp session to avoid accidental verify calls
            try { localStorage.removeItem('otpSessionId'); } catch { void 0; }
            setOtpSessionId(null);
            try { localStorage.setItem('login_captcha', code); } catch { void 0; }
        } catch (err) {
            console.error('request code error', err);
            setError(t('auth.unableToSendCode', 'Unable to generate code'));
        } finally {
            setIsRequestingCode(false);
        }
    };

    useEffect(() => {
        if (currentForm === 'login') {
            const gen = (len = 5) => {
                const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
                let s = '';
                for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
                return s;
            };
            const code = gen(5);
            setCaptchaCode(code);
            setInlineOtp('');
            try { localStorage.removeItem('otpSessionId'); } catch { void 0; }
            setOtpSessionId(null);
            try { localStorage.setItem('login_captcha', code); } catch { void 0; }
        }
    }, [currentForm]);

    const handleSignup = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        if (formData.password !== formData.confirmPassword) {
            setError(t('auth.passwordsNotMatch', 'Passwords do not match'));
            setIsLoading(false);
            return;
        }

        // Client-side validations
        const usernameVal = (formData.username || '').trim();
        const fullNameVal = (formData.fullName || '').trim();
        const phoneVal = (formData.phoneNumber || '').trim();
        if (!/^[A-Za-z0-9._-]{4,30}$/.test(usernameVal)) {
            setError(t('auth.usernameInvalid', 'Username must be 4-30 characters, letters/numbers/._- only'));
            setIsLoading(false);
            return;
        }

        if (fullNameVal.length < 3) {
            setError(t('auth.fullNameTooShort', 'Full name must be at least 3 characters'));
            setIsLoading(false);
            return;
        }

        if (formData.password.length < 8) {
            setError(t('auth.passwordTooShort', 'Password must be at least 8 characters'));
            setIsLoading(false);
            return;
        }
        // Password complexity: require upper, lower, digit, special
        const pwdRegex = /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,128}/;
        if (!pwdRegex.test(formData.password)) {
            setError(t('auth.passwordComplexity', 'Password must include uppercase, lowercase, number and special character'));
            setIsLoading(false);
            return;
        }

        if (phoneVal) {
            const digits = phoneVal.replace(/[^0-9]/g, '');
            if (digits.length < 9 || digits.length > 15) {
                setError(t('auth.phoneInvalid', 'Phone number is invalid'));
                setIsLoading(false);
                return;
            }
        }

        try {
            const result = await signup({
                username: formData.username,
                email: formData.email,
                password: formData.password,
                fullName: formData.fullName,
                phoneNumber: formData.phoneNumber,
                address: formData.address
            });

            if (result.success) {
                if (result.otpRequired) {
                    // Await OTP verification to finalize registration
                    setOtpSessionId(result.otpSessionId);
                    setIsRegisteringOtp(true);
                    setCurrentForm('otp');
                    if (result.otp) {
                        setInlineOtp(result.otp);
                    }
                } else {
                    // registration complete
                    setCurrentForm('login');
                    setFormData(prev => ({
                        ...prev,
                        usernameOrEmail: formData.username,
                        password: ''
                    }));
                }
            } else {
                setError(result.message || t('auth.registrationFailed'));
            }
        } catch {
            setError(t('auth.registrationError'));
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
            </div>
            
            
            
            <div className="flex-1 flex items-center justify-center p-6 md:p-10 z-10 relative">
                
                <div className="w-full max-w-md login-form rounded-3xl p-8 shadow-2xl ring-2 ring-white/30 relative">
                    {/* OTP preview (shown inline next to OTP input) */}
                    
                    {currentForm === 'login' && (
                        <>
                            <h2 className="text-3xl font-bold bg-gradient-to-r from-white via-purple-100 to-white bg-clip-text text-transparent mb-6 text-center text-glow">{t('auth.loginTitle', 'Login')}</h2>
                            <form onSubmit={handleLogin} className="space-y-4">
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/70 h-5 w-5" />
                                    <input
                                        type="text"
                                        name="usernameOrEmail"
                                        value={formData.usernameOrEmail}
                                        onChange={handleInputChange}
                                        placeholder={t('auth.usernamePlaceholder', 'Username or Email')}
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
                                        placeholder={t('auth.passwordPlaceholder', 'Password')}
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

                                <div className="relative">
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="text"
                                            name="otpCode"
                                            value={formData.otpCode}
                                            onChange={handleInputChange}
                                            placeholder={t('auth.otpPlaceholder', 'Verification code (6 digits)')}
                                            className="flex-1 pl-4 pr-4 py-3 bg-white/10 border-2 border-purple-400/30 rounded-xl text-white placeholder-white/70"
                                        />

                                        <div className="w-36 h-12 flex-shrink-0 flex flex-col items-center justify-center bg-white/6 backdrop-blur-md border border-white/10 rounded-lg">
                                            <div className="text-xs text-white/70">Verification code</div>
                                            <canvas ref={otpCanvasRef} className="w-36 h-12 mt-1" role="img" aria-label={t('auth.verificationImage','Verification code image')} onContextMenu={(e)=>{e.preventDefault();}}></canvas>
                                            <button type="button" onClick={handleRequestCode} disabled={isRequestingCode} className="text-xs text-blue-200 hover:underline mt-1">
                                                {isRequestingCode ? t('auth.requesting','...') : t('auth.requestCode','Request Captcha')}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {error && (
                                    <div className="text-red-200 text-sm text-center bg-gradient-to-r from-red-500/20 to-pink-500/20 p-3 rounded-xl border border-red-400/40 backdrop-blur-sm">
                                        {error}
                                    </div>
                                )}

                                

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full mx-auto block py-3 login-btn text-white rounded-xl transition-all duration-100 font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.05] ring-2 ring-white/20"
                                >
                                    {isLoading ? t('auth.loggingIn', 'Logging in...') : t('auth.loginButton', 'Login')}
                                </button>


                                <div className="text-center space-y-2">
                                    <button
                                        type="button"
                                        onClick={() => setCurrentForm('forgot')}
                                        className="text-blue-200 hover:text-blue-100 text-sm font-semibold underline block w-full transition-colors duration-200"
                                    >
                                        {t('auth.forgotPassword', 'Forgot password?')}
                                    </button>
                                    <div className="text-white/90 text-sm font-medium">
                                        {t('auth.noAccount', "Don't have an account?")} {' '}
                                        <button
                                            type="button"
                                            onClick={() => setCurrentForm('signup')}
                                            className="text-blue-200 hover:text-blue-100 hover:underline font-bold transition-colors duration-200"
                                        >
                                            {t('auth.signupLink', 'Sign up')}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </>
                    )}

                        {currentForm === 'forgot' && (
                            <>
                                <h2 className="text-2xl font-bold text-center mb-4">{t('auth.forgotPasswordTitle','Forgot password')}</h2>
                                <form onSubmit={async (e) => {
                                    e.preventDefault();
                                    setIsLoading(true);
                                    setError('');
                                    try {
                                        const payload = {
                                            username: (formData.username || formData.usernameOrEmail || '').trim(),
                                            email: (formData.emailReset || formData.email || formData.usernameOrEmail || '').trim()
                                        };
                                        const res = await forgotPassword(payload);
                                        if (res.success) {
                                            setError(res.message || t('auth.forgotPasswordSent','A reset email was sent'));
                                            setTimeout(() => { setCurrentForm('login'); setError(''); }, 2500);
                                        } else {
                                            setError(res.message || t('auth.forgotPasswordFailed','Unable to send reset email'));
                                        }
                                    } catch (err) {
                                        console.error('forgot submit error', err);
                                        setError(t('auth.forgotPasswordFailed','Unable to send reset email'));
                                    } finally { setIsLoading(false); }
                                }} className="space-y-4">
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/80 h-5 w-5" />
                                        <input
                                            type="text"
                                            name="username"
                                            value={formData.username}
                                            onChange={handleInputChange}
                                            placeholder={t('auth.usernamePlaceholder','Username')}
                                            className="w-full pl-12 pr-4 py-3 bg-white/10 border-2 border-purple-400/30 rounded-xl text-white placeholder-white/70"
                                            required
                                        />
                                    </div>

                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/70 h-5 w-5" />
                                        <input
                                            type="email"
                                            name="emailReset"
                                            value={formData.emailReset}
                                            onChange={handleInputChange}
                                            placeholder={t('auth.emailPlaceholder','Email')}
                                            className="w-full pl-12 pr-4 py-3 bg-white/10 border-2 border-purple-400/30 rounded-xl text-white placeholder-white/70"
                                            required
                                        />
                                    </div>

                                    {error && (
                                        <div className="text-red-200 text-sm text-center bg-gradient-to-r from-red-500/20 to-pink-500/20 p-3 rounded-xl border border-red-400/40 backdrop-blur-sm">
                                            {error}
                                        </div>
                                    )}

                                    <div className="flex gap-2">
                                        <button type="submit" disabled={isLoading} className="flex-1 py-3 login-btn text-white rounded-xl font-bold">{isLoading ? t('auth.sending','Sending...') : t('auth.sendReset','Send reset email')}</button>
                                        <button type="button" onClick={() => setCurrentForm('login')} className="py-3 px-4 text-white/80 hover:underline">{t('auth.backToLogin','Back')}</button>
                                    </div>
                                </form>
                            </>
                        )}

                    {currentForm === 'otp' && (
                        <>
                            <h2 className="text-2xl font-bold text-center mb-4">{t('auth.otpTitle', 'Enter verification code')}</h2>
                            <form onSubmit={handleVerifyOtp} className="space-y-4">
                                <div className="relative">
                                    <input
                                        type="text"
                                        name="otpCode"
                                        value={formData.otpCode}
                                        onChange={handleInputChange}
                                        placeholder={t('auth.otpPlaceholder', 'Verification code (6 digits)')}
                                        className="w-full pl-4 pr-4 py-3 bg-white/10 border-2 border-purple-400/30 rounded-xl text-white placeholder-white/70"
                                        required
                                    />
                                </div>

                                {error && (
                                    <div className="text-red-200 text-sm text-center bg-gradient-to-r from-red-500/20 to-pink-500/20 p-3 rounded-xl border border-red-400/40 backdrop-blur-sm">
                                        {error}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full mx-auto block py-3 login-btn text-white rounded-xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed ring-2 ring-white/20"
                                >
                                    {isLoading ? t('auth.verifying', 'Verifying...') : t('auth.verify', 'Verify')}
                                </button>

                                <div className="text-center space-y-2">
                                    <button type="button" className="text-sm text-white/80 hover:underline" onClick={() => { setCurrentForm('login'); setOtpSessionId(null); }}>{t('auth.backToLogin', 'Back to login')}</button>
                                    <button type="button" className="text-sm text-blue-200 hover:underline" onClick={handleResendOtp} disabled={isLoading}>{isLoading ? t('auth.resendingCode', '...') : t('auth.resendCode', 'Resend code')}</button>
                                </div>
                            </form>
                        </>
                    )}


                    {currentForm === 'signup' && (
                        <>
                            <h2 className="text-3xl font-bold bg-gradient-to-r from-white via-green-100 to-white bg-clip-text text-transparent mb-6 text-center drop-shadow-lg">{t('auth.signupTitle', 'Sign up')}</h2>
                            <form onSubmit={handleSignup} className="space-y-4">
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/80 h-5 w-5" />
                                        <input
                                            type="text"
                                            name="username"
                                            value={formData.username}
                                            onChange={handleInputChange}
                                            placeholder={t('auth.usernamePlaceholder', 'Username')}
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
                                            placeholder={t('auth.emailPlaceholder', 'Email')}
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
                                            placeholder={t('auth.fullNamePlaceholder', 'Full name')}
                                            className="w-full pl-12 pr-4 py-3 bg-gradient-to-r from-white/10 via-white/15 to-white/10 border border-white/20 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-purple-400/50 backdrop-blur-sm transition-all duration-300 hover:bg-white/20"
                                            required
                                        />
                                    </div>

                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/70 h-5 w-5" />
                                        <input
                                            type="tel"
                                            name="phoneNumber"
                                            value={formData.phoneNumber}
                                            onChange={handleInputChange}
                                            placeholder={t('auth.phoneNumberPlaceholder', 'Phone number (e.g. +84901234567)')}
                                            className="w-full pl-12 pr-4 py-3 bg-gradient-to-r from-white/10 via-white/15 to-white/10 border border-white/20 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-purple-400/50 backdrop-blur-sm transition-all duration-300 hover:bg-white/20"
                                            required
                                        />
                                    </div>

                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/70 h-5 w-5" />
                                        <input
                                            type="password"
                                            name="password"
                                            value={formData.password}
                                            onChange={handleInputChange}
                                            placeholder={t('auth.passwordPlaceholder', 'Password')}
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
                                            placeholder={t('auth.confirmPasswordPlaceholder', 'Confirm password')}
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

                                

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full py-3 bg-gradient-to-r from-pink-500 via-purple-500 to-yellow-500 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg ring-2 ring-white/20"
                                >
                                    {isLoading ? t('auth.registering', 'Registering...') : t('auth.registerButton', 'REGISTER')}
                                </button>

                                <div className="text-center">
                                    <div className="text-white/80 text-sm">
                                        {t('auth.haveAccount', 'Already have an account?')} {' '}
                                        <button
                                            type="button"
                                            onClick={() => setCurrentForm('login')}
                                            className="text-white hover:underline font-semibold"
                                        >
                                            {t('auth.loginNow', 'Login now')}
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