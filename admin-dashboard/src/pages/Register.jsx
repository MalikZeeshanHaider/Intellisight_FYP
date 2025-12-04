import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../api/api';
import { motion } from 'framer-motion';
import { FaLock, FaUser, FaEnvelope, FaIdBadge, FaEye, FaEyeSlash, FaUserPlus, FaShieldAlt } from 'react-icons/fa';
import { HiSparkles, HiUserAdd } from 'react-icons/hi';

const Register = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: 'ADMIN' // Default role
    });
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            await authAPI.register(formData);
            navigate('/login', { state: { message: 'Registration successful! Please log in.' } });
        } catch (err) {
            setError(err.response?.data?.message || 'Registration failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1, delayChildren: 0.2 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
    };

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4 bg-gradient-to-br from-navy-darker via-navy-primary to-steel-900">
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-20 left-10 w-72 h-72 bg-accent-blue/20 rounded-full blur-3xl animate-pulse-slow"></div>
                <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent-cyan/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
            </div>

            <motion.div variants={containerVariants} initial="hidden" animate="visible" className="max-w-md w-full z-10">
                <motion.div variants={itemVariants} className="glass-card p-10 relative overflow-hidden">
                    <div className="absolute -inset-1 bg-gradient-to-r from-accent-blue via-accent-cyan to-accent-purple opacity-20 blur-2xl -z-10"></div>
                    
                    <motion.div variants={itemVariants} className="text-center mb-8">
                        <motion.img
                            src="/models/intellisight1.png"
                            alt="IntelliSight Logo"
                            className="w-32 h-32 object-contain mx-auto mb-4"
                            initial={{ scale: 0 }}
                            animate={{ 
                                scale: 1,
                                filter: [
                                    'drop-shadow(0 0 12px rgba(0, 255, 255, 0.6))',
                                    'drop-shadow(0 0 20px rgba(0, 255, 255, 0.9))',
                                    'drop-shadow(0 0 12px rgba(0, 255, 255, 0.6))'
                                ]
                            }}
                            transition={{ 
                                scale: { type: "spring", stiffness: 200, damping: 15 },
                                filter: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                            }}
                        />
                        <h2 className="text-4xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-accent-cyan via-accent-blue to-accent-purple mb-2">
                            Create Account
                        </h2>
                        <div className="flex items-center justify-center gap-2 text-gray-300">
                            <HiSparkles className="text-accent-cyan" />
                            <p className="text-sm font-medium">Register New Admin</p>
                        </div>
                    </motion.div>
                    <motion.form variants={itemVariants} onSubmit={handleSubmit} className="space-y-5">
                        <motion.div variants={itemVariants}>
                            <label className="block text-sm font-semibold text-white mb-2">Full Name</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <FaUser className="text-steel-500" />
                                </div>
                                <input
                                    id="name"
                                    name="name"
                                    type="text"
                                    required
                                    className="input-futuristic pl-11"
                                    placeholder="John Doe"
                                    value={formData.name}
                                    onChange={handleChange}
                                />
                            </div>
                        </motion.div>

                        <motion.div variants={itemVariants}>
                            <label className="block text-sm font-semibold text-white mb-2">Email Address</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <FaEnvelope className="text-steel-500" />
                                </div>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    className="input-futuristic pl-11"
                                    placeholder="admin@intellisight.com"
                                    value={formData.email}
                                    onChange={handleChange}
                                />
                            </div>
                        </motion.div>

                        <motion.div variants={itemVariants}>
                            <label className="block text-sm font-semibold text-white mb-2">Role</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <FaShieldAlt className="text-steel-500" />
                                </div>
                                <select
                                    id="role"
                                    name="role"
                                    className="input-futuristic pl-11"
                                    value={formData.role}
                                    onChange={handleChange}
                                >
                                    <option value="ADMIN">Admin</option>
                                    <option value="SUPER_ADMIN">Super Admin</option>
                                    <option value="VIEWER">Viewer</option>
                                </select>
                            </div>
                        </motion.div>

                        <motion.div variants={itemVariants}>
                            <label className="block text-sm font-semibold text-white mb-2">Password</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <FaLock className="text-steel-500" />
                                </div>
                                <input
                                    id="password"
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="new-password"
                                    required
                                    className="input-futuristic pl-11 pr-11"
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={handleChange}
                                />
                                <button
                                    type="button"
                                    className="absolute inset-y-0 right-0 pr-4 flex items-center"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? (
                                        <FaEyeSlash className="text-steel-500 hover:text-accent-blue transition-colors" />
                                    ) : (
                                        <FaEye className="text-steel-500 hover:text-accent-blue transition-colors" />
                                    )}
                                </button>
                            </div>
                        </motion.div>

                        {error && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 px-4 py-3 rounded-xl"
                            >
                                <span className="font-medium">{error}</span>
                            </motion.div>
                        )}

                        <motion.div variants={itemVariants}>
                            <motion.button
                                type="submit"
                                disabled={isLoading}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className={`btn-futuristic w-full text-center ${isLoading ? 'opacity-75 cursor-not-allowed' : ''}`}
                            >
                                {isLoading ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <motion.div
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                            className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                                        />
                                        <span>Creating Account...</span>
                                    </div>
                                ) : (
                                    <span className="flex items-center justify-center gap-2">
                                        <FaUserPlus />
                                        Create Account
                                    </span>
                                )}
                            </motion.button>
                        </motion.div>

                        <motion.div variants={itemVariants} className="text-center pt-4">
                            <p className="text-sm text-gray-300">
                                Already have an account?{' '}
                                <Link to="/login" className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-accent-blue to-accent-cyan hover:from-accent-cyan hover:to-accent-blue transition-all">
                                    Sign In
                                </Link>
                            </p>
                        </motion.div>
                    </motion.form>
                </motion.div>
                
                <motion.p variants={itemVariants} className="text-center text-sm text-white/60 mt-6">
                    &copy; 2025 IntelliSight. All rights reserved.
                </motion.p>
            </motion.div>
        </div>
    );
};

export default Register;
