import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config/apiConfig';
import AuthContext from './authContext';

const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const token = localStorage.getItem('authToken');
                const userData = localStorage.getItem('userData');
                
                if (token && userData && userData !== 'undefined') {
                    const user = JSON.parse(userData);
                    setUser(user);
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

    useEffect(() => {
        const onAuthExpired = (e) => {
            console.warn('Auth expired event received', e && e.detail);
            localStorage.removeItem('authToken');
            localStorage.removeItem('userData');
            setUser(null);
            // navigate to login
            try { navigate('/login'); } catch { /* ignore */ }
        };

        window.addEventListener('auth:expired', onAuthExpired);
        return () => window.removeEventListener('auth:expired', onAuthExpired);
    }, [navigate]);

    const login = async (identifier, password) => {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ identifier, password })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                localStorage.setItem('authToken', data.data.token);
                localStorage.setItem('userData', JSON.stringify(data.data.user));
                setUser(data.data.user);
                
                navigate('/feed');
                return { success: true, user: data.data.user };
            } else {
                return { success: false, message: data.message };
            }
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, message: 'An error occurred during login' };
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
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
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
            return { success: false, message: 'An error occurred during signup' };
        }
    };

    const forgotPassword = async (email) => {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
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
            return { success: false, message: 'An error occurred while sending the password reset email' };
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

export default AuthProvider;