import React, { useState } from 'react';
import axios from 'axios';
import { Mail, Lock, User, ArrowRight, Loader2 } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export function LoginPage({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (isLogin) {
        // Login - application/x-www-form-urlencoded
        const data = new URLSearchParams();
        data.append('username', formData.username);
        data.append('password', formData.password);

        const response = await axios.post(`${API_BASE_URL}/auth/login`, data, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });

        const { access_token, user } = response.data;
        onLogin(access_token, user || { username: formData.username });
      } else {
        // Register - JSON
        await axios.post(`${API_BASE_URL}/auth/register`, {
          username: formData.username,
          email: formData.email,
          password: formData.password,
        });

        setSuccess('Registration successful! Please log in.');
        setIsLogin(true);
        // Clear password but keep username for easier login
        setFormData({ ...formData, password: '' });
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white font-sans text-abstra-dark">
      {/* Left Decorative Panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center relative overflow-hidden bg-gradient-to-br from-[#D49B9B] to-[#5E3C48] abstra-art-panel">
        {/* Glassmorphism decorative elements */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-white/10 rounded-full blur-3xl mix-blend-overlay"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#5E3C48]/40 rounded-full blur-3xl mix-blend-overlay"></div>
        
        <div className="relative z-10 p-12 text-center text-white backdrop-blur-sm bg-white/5 border border-white/10 rounded-3xl shadow-2xl max-w-md mx-8">
          <h1 className="text-5xl font-bold mb-6 tracking-tight drop-shadow-md">CloudOps AI</h1>
          <p className="text-lg text-white/90 leading-relaxed font-light drop-shadow">
            Next-generation autonomous cloud operations and incident management platform powered by artificial intelligence.
          </p>
        </div>
      </div>

      {/* Right Login Form Panel */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-16 md:px-24 bg-white relative">
        <div className="w-full max-w-sm mx-auto">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-12 text-center">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-[#5E3C48] to-[#D49B9B] bg-clip-text text-transparent">
              CloudOps AI
            </h1>
          </div>

          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-3xl font-bold mb-3 tracking-tight text-abstra-dark">
              {isLogin ? 'Welcome back' : 'Create an account'}
            </h2>
            <p className="text-gray-500">
              {isLogin 
                ? 'Enter your credentials to access your dashboard' 
                : 'Sign up to start automating your cloud operations'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 rounded-xl bg-red-50 text-red-600 text-sm border border-red-100 flex items-start shadow-sm">
                <span className="block sm:inline">{error}</span>
              </div>
            )}
            
            {success && (
              <div className="p-4 rounded-xl bg-signal-teal/10 text-signal-teal text-sm border border-signal-teal/20 flex items-start shadow-sm">
                <span className="block sm:inline">{success}</span>
              </div>
            )}

            <div className="space-y-4">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-abstra-mauve transition-colors">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  name="username"
                  required
                  placeholder="Username"
                  value={formData.username}
                  onChange={handleChange}
                  className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-abstra-mauve/20 focus:border-abstra-mauve transition-all outline-none text-abstra-dark placeholder:text-gray-400"
                />
              </div>

              {!isLogin && (
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-abstra-mauve transition-colors">
                    <Mail size={18} />
                  </div>
                  <input
                    type="email"
                    name="email"
                    required
                    placeholder="Email address"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-abstra-mauve/20 focus:border-abstra-mauve transition-all outline-none text-abstra-dark placeholder:text-gray-400"
                  />
                </div>
              )}

              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-abstra-mauve transition-colors">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  name="password"
                  required
                  placeholder="Password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-abstra-mauve/20 focus:border-abstra-mauve transition-all outline-none text-abstra-dark placeholder:text-gray-400"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 px-6 rounded-2xl bg-abstra-dark text-white font-medium hover:bg-abstra-mauve focus:ring-4 focus:ring-abstra-mauve/20 transition-all flex items-center justify-center disabled:opacity-70 shadow-lg shadow-abstra-dark/10 group"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  {isLogin ? 'Sign In' : 'Create Account'}
                  <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-gray-500">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError(null);
                setSuccess(null);
              }}
              className="font-medium text-abstra-mauve hover:text-abstra-terracotta transition-colors"
            >
              {isLogin ? 'Sign up' : 'Log in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
