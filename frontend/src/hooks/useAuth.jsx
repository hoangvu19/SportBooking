import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { USE_MOCK_DATA } from '../config/apiConfig';
import { mockLogin as mockLoginFn, mockUser } from '../utils/mockData';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    // Check if user is logged in on app start
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const token = localStorage.getItem('authToken');
                const userData = localStorage.getItem('userData');
                
                if (token && userData && userData !== 'undefined') {
                    const user = JSON.parse(userData);
                    setUser(user);
                } else if (USE_MOCK_DATA) {
                    // Auto-login with mock user in production without backend
                    setUser(mockUser);
                    localStorage.setItem('authToken', 'mock-token');
                    localStorage.setItem('userData', JSON.stringify(mockUser));
                }
            } catch (error) {
                console.error('Auth check failed:', error);
                localStorage.removeItem('authToken');
                localStorage.removeItem('userData');
            } finally {
                setIsLoading(false);
            }
        };

        checkAuth();
    }, []);

    const login = async (identifier, password) => {
        try {
            // Use mock data if in production without backend
            if (USE_MOCK_DATA) {
                const result = await mockLoginFn(identifier, password);
                if (result.success) {
                    localStorage.setItem('authToken', result.data.token);
                    localStorage.setItem('userData', JSON.stringify(result.data.user));
                    setUser(result.data.user);
                    navigate('/feed');
                    return { success: true, user: result.data.user };
                }
                return result;
            }

            const response = await fetch('http://localhost:5000/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ identifier, password })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Save token and user data - backend trả về data.data.token và data.data.user
                localStorage.setItem('authToken', data.data.token);
                localStorage.setItem('userData', JSON.stringify(data.data.user));
                setUser(data.data.user);
                
                // Navigate to feed after successful login
                navigate('/feed');
                return { success: true, user: data.data.user };
            } else {
                return { success: false, message: data.message };
            }
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, message: 'Có lỗi xảy ra khi đăng nhập' };
        }
    };

    const logout = () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
        setUser(null);
        navigate('/');
    };

    const signup = async (userData) => {
        try {
            const response = await fetch('http://localhost:5000/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userData)
            });

            const data = await response.json();

            if (response.ok && data.success) {
                return { success: true, message: data.message };
            } else {
                return { success: false, message: data.message };
            }
        } catch (error) {
            console.error('Signup error:', error);
            return { success: false, message: 'Có lỗi xảy ra khi đăng ký' };
        }
    };

    const forgotPassword = async (email) => {
        try {
            const response = await fetch('http://localhost:5000/api/auth/forgot-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                return { success: true, message: data.message };
            } else {
                return { success: false, message: data.message };
            }
        } catch (error) {
            console.error('Forgot password error:', error);
            return { success: false, message: 'Có lỗi xảy ra khi gửi email khôi phục' };
        }
    };

    const value = {
        user,
        isLoading,
        login,
        logout,
        signup,
        forgotPassword
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

