import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaUsers, FaUserClock, FaUserCheck, FaUserShield, FaTrash, FaCheck, FaTimes, FaUserPlus, FaTimes as FaClose, FaSignOutAlt, FaMoon, FaSun, FaUserCircle, FaChevronDown } from 'react-icons/fa';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const SuperAdminDashboard = () => {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [statistics, setStatistics] = useState({
    totalUsers: 0,
    pendingApprovals: 0,
    approvedUsers: 0,
    adminUsers: 0
  });
  const [allAdmins, setAllAdmins] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [selectedTab, setSelectedTab] = useState('statistics'); // statistics, admins, pending
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '' });
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [adminToDelete, setAdminToDelete] = useState(null);
  const [isLightMode, setIsLightMode] = useState(
    window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
  );
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showProfileDropdown && !event.target.closest('.profile-dropdown-container')) {
        setShowProfileDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfileDropdown]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');

      const headers = { Authorization: `Bearer ${token}` };

      const [statsRes, adminsRes, pendingRes] = await Promise.all([
        axios.get(`${API_URL}/auth/admin/statistics`, { headers }),
        axios.get(`${API_URL}/auth/admin/all`, { headers }),
        axios.get(`${API_URL}/auth/pending-users`, { headers })
      ]);

      setStatistics(statsRes.data.data);
      setAllAdmins(adminsRes.data.data.admins);
      setPendingUsers(pendingRes.data.data.users);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId) => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${API_URL}/auth/admin/approve/${userId}`, {}, { headers });
      setSuccessMessage('User approved successfully');
      fetchData();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to approve user');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleReject = async (userId, reason = 'No reason provided') => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${API_URL}/auth/admin/reject/${userId}`, { reason }, { headers });
      setSuccessMessage('User rejected successfully');
      fetchData();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reject user');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleDeleteAdmin = async (adminId) => {
    setAdminToDelete(adminId);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteAdmin = async () => {
    if (!adminToDelete) return;

    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.delete(`${API_URL}/auth/admin/${adminToDelete}`, { headers });
      setSuccessMessage('Admin deleted successfully');
      setShowDeleteConfirm(false);
      setAdminToDelete(null);
      fetchData();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete admin');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    
    if (!newUser.name.trim() || !newUser.email.trim()) {
      setError('Name and email are required');
      setTimeout(() => setError(''), 3000);
      return;
    }

    try {
      setIsAddingUser(true);
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${API_URL}/auth/admin/add-user`, newUser, { headers });
      setSuccessMessage('User added successfully! Password reset email sent.');
      setShowAddUserModal(false);
      setNewUser({ name: '', email: '' });
      fetchData();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add user');
      setTimeout(() => setError(''), 3000);
    } finally {
      setIsAddingUser(false);
    }
  };

  const StatCard = ({ icon: Icon, title, value, color, gradient, glowColor, cardType }) => {
    const [isHovered, setIsHovered] = useState(false);

    // Light mode color schemes - ALL cards have LEFT borders
    const lightModeStyles = {
      pending: {
        iconBg: 'rgba(251, 191, 36, 0.15)',
        leftBorder: '#f59e0b',
        iconColor: '#d97706'
      },
      signup: {
        iconBg: 'rgba(59, 130, 246, 0.15)',
        leftBorder: '#3b82f6',
        iconColor: '#2563eb'
      },
      approved: {
        iconBg: 'rgba(34, 197, 94, 0.15)',
        leftBorder: '#16a34a',
        iconColor: '#16a34a'
      },
      admins: {
        iconBg: 'rgba(99, 102, 241, 0.15)',
        leftBorder: '#6366f1',
        iconColor: '#6366f1'
      }
    };

    const lightStyle = lightModeStyles[cardType] || {};

    return (
      <motion.div
        whileHover={{ scale: 1.02, y: -5 }}
        transition={{ duration: 0.3 }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="relative overflow-hidden rounded-2xl p-6"
        style={{
          background: isLightMode ? '#f9f9f9ff' : 'rgba(15, 23, 42, 0.4)',
          backdropFilter: isLightMode ? 'none' : 'blur(20px)',
          border: isLightMode 
            ? '1px solid #e2e8f0cc' 
            : isHovered 
              ? '1px solid rgba(255, 255, 255, 0.4)' 
              : '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: isLightMode 
            ? '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
            : '0 4px 16px 0 rgba(0, 0, 0, 0.3)',
          borderLeft: isLightMode && lightStyle.leftBorder ? `4px solid ${lightStyle.leftBorder}` : undefined,
          transition: 'border 0.3s ease, box-shadow 0.3s ease'
        }}
      >
        {/* Dark mode effects only - reduced glow */}
        {!isLightMode && (
          <>
            <div 
              className="absolute top-0 left-0 right-0 h-1/3 rounded-t-2xl pointer-events-none"
              style={{
                background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, transparent 100%)'
              }}
            />
          </>
        )}

        <div className="flex items-center justify-between relative z-10">
          <div>
            <p className="text-sm font-medium mb-2" style={{ color: isLightMode ? '#64748b' : 'rgba(255, 255, 255, 0.7)' }}>{title}</p>
            <p className="text-4xl font-bold" style={{ color: isLightMode ? '#1e293b' : '#ffffff' }}>
              {value}
            </p>
          </div>
          <div 
            className="p-4 rounded-xl"
            style={{
              background: isLightMode ? lightStyle.iconBg : 'rgba(255, 255, 255, 0.05)',
              border: isLightMode ? 'none' : `1px solid ${glowColor}40`
            }}
          >
            <Icon className="text-4xl" style={{ color: isLightMode ? lightStyle.iconColor : glowColor }} />
          </div>
        </div>
      </motion.div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen p-6 relative overflow-hidden transition-colors duration-300"
      style={{
        background: isLightMode 
          ? 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 50%, #f1f5f9 100%)'
          : 'linear-gradient(180deg, #0a0e27 0%, #1a1f3a 50%, #0f1729 100%)'
      }}
    >
      {/* Animated Background Grid - Symmetrical Lines */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(0, 255, 255, 0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 255, 255, 0.3) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        }} />
      </div>

      {/* Ambient Glow Effects */}
      <div className="absolute top-20 left-20 w-96 h-96 rounded-full opacity-10"
        style={{
          background: 'radial-gradient(circle, #00ffff 0%, transparent 70%)',
          filter: 'blur(60px)'
        }}
      />
      <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full opacity-10"
        style={{
          background: 'radial-gradient(circle, #ff00ff 0%, transparent 70%)',
          filter: 'blur(60px)'
        }}
      />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex items-start justify-between"
        >
          <div>
            <h1 className="text-5xl font-black mb-2 tracking-tight" style={{ color: isLightMode ? '#0F172A' : '#E5E7EB' }}>
              <FaUserShield className="inline-block mr-3" style={{ color: isLightMode ? '#0F172A' : '#E5E7EB' }} />
              Super Admin Dashboard
            </h1>
          </div>
          
          {/* Profile Dropdown */}
          <div className="relative mt-2 profile-dropdown-container">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowProfileDropdown(!showProfileDropdown)}
              className="flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all duration-300"
              style={{
                background: isLightMode ? 'rgba(15, 23, 42, 0.1)' : 'rgba(6, 182, 212, 0.1)',
                border: isLightMode ? '1px solid rgba(15, 23, 42, 0.3)' : '1px solid rgba(6, 182, 212, 0.3)',
                color: isLightMode ? '#0F172A' : '#06b6d4',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
              }}
            >
              <FaUserCircle className="text-2xl" />
              <FaChevronDown className="text-sm" />
            </motion.button>

            {/* Dropdown Menu */}
            {showProfileDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute right-0 mt-2 w-56 rounded-xl shadow-2xl overflow-hidden z-50"
                style={{
                  background: isLightMode ? 'rgba(255, 255, 255, 0.95)' : 'rgba(15, 23, 42, 0.95)',
                  backdropFilter: 'blur(20px)',
                  border: isLightMode ? '1px solid rgba(71, 85, 105, 0.3)' : '1px solid rgba(6, 182, 212, 0.3)'
                }}
              >
                {/* Theme Toggle */}
                <button
                  onClick={() => setIsLightMode(!isLightMode)}
                  className="w-full px-5 py-3 flex items-center gap-3 transition-all duration-200"
                  style={{
                    color: isLightMode ? '#182440' : '#E5E7EB',
                    borderBottom: isLightMode ? '1px solid rgba(71, 85, 105, 0.2)' : '1px solid rgba(6, 182, 212, 0.2)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = isLightMode ? 'rgba(71, 85, 105, 0.1)' : 'rgba(6, 182, 212, 0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  {isLightMode ? <FaMoon /> : <FaSun />}
                  <span>{isLightMode ? 'Dark Mode' : 'Light Mode'}</span>
                </button>

                {/* Logout */}
                <button
                  onClick={() => {
                    setShowProfileDropdown(false);
                    setShowLogoutConfirm(true);
                  }}
                  className="w-full px-5 py-3 flex items-center gap-3 transition-all duration-200"
                  style={{
                    color: isLightMode ? '#991b1b' : '#fca5a5'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = isLightMode ? 'rgba(185, 28, 28, 0.1)' : 'rgba(239, 68, 68, 0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <FaSignOutAlt />
                  <span>Logout</span>
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Messages */}
        {error && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="mb-6 p-4 rounded-xl text-red-200"
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              boxShadow: '0 0 20px rgba(239, 68, 68, 0.2)'
            }}
          >
            {error}
          </motion.div>
        )}

        {successMessage && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="mb-6 p-4 rounded-xl text-green-200"
            style={{
              background: 'rgba(34, 197, 94, 0.1)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              boxShadow: '0 0 20px rgba(34, 197, 94, 0.2)'
            }}
          >
            {successMessage}
          </motion.div>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={FaUserClock}
            title="Pending Approvals"
            value={statistics.pendingApprovals}
            glowColor="#FACC15"
            cardType="pending"
          />
          <StatCard
            icon={FaUsers}
            title="Signup Requests"
            value={statistics.totalUsers}
            glowColor="#0EA5E9"
            cardType="signup"
          />
          <StatCard
            icon={FaUserCheck}
            title="Approved Accounts"
            value={statistics.approvedUsers}
            glowColor="#D97706"
            cardType="approved"
          />
          <StatCard
            icon={FaUserShield}
            title="Active Admins"
            value={statistics.adminUsers}
            glowColor="#AC80D7"
            cardType="admins"
          />
        </div>

        {/* Tabs */}
        <div className="rounded-2xl overflow-hidden"
          style={{
            background: isLightMode ? 'rgba(255, 255, 255, 0.8)' : '#0f172a1a',
            backdropFilter: 'blur(20px)',
            border: isLightMode ? '1px solid rgba(15, 23, 42, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: isLightMode ? '0 1px 3px 0 rgba(0, 0, 0, 0.1)' : '0 4px 16px rgba(0, 0, 0, 0.3)'
          }}
        >
          <div className="flex items-center justify-between gap-4 p-6" style={{ borderBottom: isLightMode ? '1px solid rgba(15, 23, 42, 0.2)' : '1px solid rgba(6, 182, 212, 0.2)' }}>
            <div className="flex gap-4">
              <button
                onClick={() => setSelectedTab('pending')}
                className="px-6 py-3 rounded-xl font-medium transition-all duration-300"
                style={
                  selectedTab === 'pending'
                    ? {
                        background: isLightMode ? 'rgba(37, 99, 235, 0.15)' : 'rgba(6, 182, 212, 0.1)',
                        border: isLightMode ? '1px solid rgba(37, 99, 235, 0.5)' : '1px solid rgba(6, 182, 212, 0.4)',
                        color: isLightMode ? '#1e40af' : '#67e8f9'
                      }
                    : {
                        background: 'rgba(229, 231, 235, 0.05)',
                        border: isLightMode ? '1px solid rgba(71, 85, 105, 0.3)' : '1px solid rgba(6, 182, 212, 0.2)',
                        color: isLightMode ? '#475569' : '#9ca3af'
                      }
                }
              >
                Pending Approvals ({statistics.pendingApprovals})
              </button>
              <button
                onClick={() => setSelectedTab('admins')}
                className="px-6 py-3 rounded-xl font-medium transition-all duration-300"
                style={
                  selectedTab === 'admins'
                    ? {
                        background: isLightMode ? 'rgba(37, 99, 235, 0.15)' : 'rgba(6, 182, 212, 0.1)',
                        border: isLightMode ? '1px solid rgba(37, 99, 235, 0.5)' : '1px solid rgba(6, 182, 212, 0.4)',
                        color: isLightMode ? '#1e40af' : '#67e8f9'
                      }
                    : {
                        background: 'rgba(229, 231, 235, 0.05)',
                        border: isLightMode ? '1px solid rgba(71, 85, 105, 0.3)' : '1px solid rgba(6, 182, 212, 0.2)',
                        color: isLightMode ? '#475569' : '#9ca3af'
                      }
                }
              >
                All Admins ({statistics.totalUsers})
              </button>
            </div>
            
            {/* Add User Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowAddUserModal(true)}
              className="flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all duration-300"
              style={{
                background: isLightMode ? 'rgba(37, 99, 235, 0.15)' : 'rgba(6, 182, 212, 0.1)',
                border: isLightMode ? '1px solid rgba(37, 99, 235, 0.5)' : '1px solid rgba(6, 182, 212, 0.4)',
                color: isLightMode ? '#1e40af' : '#67e8f9'
              }}
            >
              <FaUserPlus /> Add New User
            </motion.button>
          </div>

          {/* Pending Users Tab */}
          {selectedTab === 'pending' && (
            <div className="space-y-4">
              {pendingUsers.length === 0 ? (
                <p className="text-center py-12 text-lg" style={{ color: isLightMode ? '#182440' : '#67e8f9' }}>No pending approvals</p>
              ) : (
                pendingUsers.map((user) => (
                  <motion.div
                    key={user.Pending_ID}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl p-5 flex items-center justify-between mb-4"
                    style={{
                      background: 'rgba(229, 231, 235, 0.08)',
                      backdropFilter: 'blur(15px)',
                      border: '1px solid rgba(6, 182, 212, 0.25)',
                      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2), inset 0 0 10px rgba(6, 182, 212, 0.08)'
                    }}
                  >
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg" style={{ color: isLightMode ? '#0F172A' : '#E5E7EB' }}>{user.Name}</h3>
                      <p className="text-sm mt-1" style={{ color: isLightMode ? '#0F172A' : '#E5E7EB' }}>{user.Email}</p>
                      <p className="text-xs mt-2" style={{ color: isLightMode ? '#64748b' : '#94a3b8' }}>
                        Requested: {new Date(user.RequestedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleApprove(user.Pending_ID)}
                        className="px-5 py-2 rounded-lg font-medium transition-all duration-300 flex items-center gap-2 text-green-300"
                        style={{
                          background: 'rgba(34, 197, 94, 0.1)',
                          border: '1px solid rgba(34, 197, 94, 0.4)',
                          boxShadow: '0 0 15px rgba(34, 197, 94, 0.2)'
                        }}
                      >
                        <FaCheck /> Approve
                      </button>
                      <button
                        onClick={() => handleReject(user.Pending_ID)}
                        className="px-5 py-2 rounded-lg font-medium transition-all duration-300 flex items-center gap-2 text-red-300"
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.4)',
                          boxShadow: '0 0 15px rgba(239, 68, 68, 0.2)'
                        }}
                      >
                        <FaTimes /> Reject
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          )}

          {/* All Admins Tab */}
          {selectedTab === 'admins' && (
            <div className="overflow-x-auto p-6">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: isLightMode ? '1px solid rgba(226, 232, 240, 0.8)' : '1px solid rgba(6, 182, 212, 0.3)' }}>
                    <th className="text-left font-semibold py-4 px-4" style={{ color: isLightMode ? '#0F172A' : '#E5E7EB' }}>Name</th>
                    <th className="text-left font-semibold py-4 px-4" style={{ color: isLightMode ? '#0F172A' : '#E5E7EB' }}>Email</th>
                    <th className="text-left font-semibold py-4 px-4" style={{ color: isLightMode ? '#0F172A' : '#E5E7EB' }}>Role</th>
                    <th className="text-left font-semibold py-4 px-4" style={{ color: isLightMode ? '#0F172A' : '#E5E7EB' }}>ID</th>
                    <th className="text-left font-semibold py-4 px-4" style={{ color: isLightMode ? '#0F172A' : '#E5E7EB' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allAdmins.map((admin) => (
                    <tr key={admin.Admin_ID} className="transition-all duration-300" 
                      style={{ 
                        borderBottom: isLightMode ? '1px solid rgba(226, 232, 240, 0.6)' : '1px solid rgba(6, 182, 212, 0.1)'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = isLightMode ? 'rgba(241, 245, 249, 0.5)' : 'rgba(6, 182, 212, 0.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td className="py-4 px-4" style={{ color: isLightMode ? '#0F172A' : '#E5E7EB' }}>{admin.Name}</td>
                      <td className="py-4 px-4" style={{ color: isLightMode ? '#0F172A' : '#E5E7EB' }}>{admin.Email}</td>
                      <td className="py-4 px-4">
                        <span
                          className="px-3 py-1 rounded-lg text-xs font-medium"
                          style={{
                            color: isLightMode ? '#0F172A' : '#E5E7EB',
                            background: admin.Role === 'Admin' 
                              ? 'rgba(168, 85, 247, 0.1)'
                              : 'rgba(6, 182, 212, 0.1)',
                            border: admin.Role === 'Admin'
                              ? '1px solid rgba(168, 85, 247, 0.4)'
                              : '1px solid rgba(6, 182, 212, 0.4)'
                          }}
                        >
                          {admin.Role}
                        </span>
                      </td>
                      <td className="py-4 px-4" style={{ color: isLightMode ? '#0F172A' : '#E5E7EB' }}>
                        #{admin.Admin_ID}
                      </td>
                      <td className="py-4 px-4">
                        <button
                          onClick={() => handleDeleteAdmin(admin.Admin_ID)}
                          className="p-2 rounded-lg transition-all duration-300"
                          title="Delete Admin"
                          style={{
                            background: isLightMode ? 'rgba(185, 28, 28, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                            border: isLightMode ? '1px solid rgba(185, 28, 28, 0.4)' : '1px solid rgba(239, 68, 68, 0.3)',
                            color: isLightMode ? '#991b1b' : '#fca5a5'
                          }}
                        >
                          <FaTrash />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Add User Modal */}
        {showAddUserModal && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
            style={{
              background: isLightMode ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.7)',
              backdropFilter: 'blur(10px)'
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl p-8 max-w-md w-full shadow-2xl"
              style={{
                background: isLightMode ? 'rgba(255, 255, 255, 0.95)' : 'rgba(15, 23, 42, 0.95)',
                backdropFilter: 'blur(20px)',
                border: isLightMode ? '1px solid rgba(37, 99, 235, 0.3)' : '1px solid rgba(6, 182, 212, 0.3)',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
              }}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: isLightMode ? '#182440' : '#ffffff' }}>
                  <FaUserPlus style={{ color: isLightMode ? '#182440' : '#ffffff' }} />
                  Add New User
                </h2>
                <button
                  onClick={() => {
                    setShowAddUserModal(false);
                    setNewUser({ name: '', email: '' });
                  }}
                  className="transition-colors duration-300"
                  style={{ color: isLightMode ? '#64748b' : '#9ca3af' }}
                >
                  <FaClose size={24} />
                </button>
              </div>

              <form onSubmit={handleAddUser} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: isLightMode ? '#182440' : '#d1d5db' }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl transition-all duration-200"
                    style={{
                      background: isLightMode ? 'rgba(241, 245, 249, 0.8)' : 'rgba(229, 231, 235, 0.08)',
                      border: '1px solid rgba(107, 114, 128, 0.4)',
                      outline: 'none',
                      color: isLightMode ? '#182440' : '#ffffff'
                    }}
                    onFocus={(e) => e.target.style.border = isLightMode ? '1px solid rgba(37, 99, 235, 0.6)' : '1px solid rgba(6, 182, 212, 0.6)'}
                    onBlur={(e) => e.target.style.border = '1px solid rgba(107, 114, 128, 0.4)'}
                    placeholder="Enter user's full name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: isLightMode ? '#182440' : '#d1d5db' }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl transition-all duration-200"
                    style={{
                      background: isLightMode ? 'rgba(241, 245, 249, 0.8)' : 'rgba(229, 231, 235, 0.08)',
                      border: '1px solid rgba(107, 114, 128, 0.4)',
                      outline: 'none',
                      color: isLightMode ? '#182440' : '#ffffff'
                    }}
                    onFocus={(e) => e.target.style.border = isLightMode ? '1px solid rgba(37, 99, 235, 0.6)' : '1px solid rgba(6, 182, 212, 0.6)'}
                    onBlur={(e) => e.target.style.border = '1px solid rgba(107, 114, 128, 0.4)'}
                    placeholder="Enter user's email"
                    required
                  />
                </div>

                <div className="rounded-xl p-4 mt-4"
                  style={{
                    background: isLightMode ? 'rgba(37, 99, 235, 0.08)' : 'rgba(6, 182, 212, 0.05)',
                    border: isLightMode ? '1px solid rgba(37, 99, 235, 0.2)' : '1px solid rgba(6, 182, 212, 0.2)'
                  }}
                >
                  <p className="text-sm" style={{ color: isLightMode ? '#182440' : '#d1d5db' }}>
                    A password reset email will be sent to the user automatically.
                  </p>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddUserModal(false);
                      setNewUser({ name: '', email: '' });
                    }}
                    className="flex-1 px-6 py-3 rounded-xl font-medium transition-all duration-300"
                    style={{
                      background: isLightMode ? 'rgba(71, 85, 105, 0.15)' : 'rgba(107, 114, 128, 0.2)',
                      border: isLightMode ? '1px solid rgba(71, 85, 105, 0.4)' : '1px solid rgba(107, 114, 128, 0.4)',
                      color: isLightMode ? '#334155' : '#d1d5db'
                    }}
                    disabled={isAddingUser}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 rounded-xl font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    style={{
                      background: isLightMode ? 'rgba(37, 99, 235, 0.15)' : 'rgba(6, 182, 212, 0.15)',
                      border: isLightMode ? '1px solid rgba(37, 99, 235, 0.5)' : '1px solid rgba(6, 182, 212, 0.4)',
                      color: isLightMode ? '#1e40af' : '#67e8f9'
                    }}
                    disabled={isAddingUser}
                  >
                    {isAddingUser ? (
                      'Adding...'
                    ) : (
                      <>
                        <FaUserPlus />
                        Add User
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Logout Confirmation Modal */}
        {showLogoutConfirm && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
            style={{
              background: isLightMode ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.7)',
              backdropFilter: 'blur(10px)'
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl p-8 max-w-md w-full shadow-2xl"
              style={{
                background: isLightMode ? 'rgba(255, 255, 255, 0.95)' : 'rgba(15, 23, 42, 0.95)',
                backdropFilter: 'blur(20px)',
                border: isLightMode ? '1px solid rgba(185, 28, 28, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
              }}
            >
              <div className="text-center">
                <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4"
                  style={{
                    background: isLightMode ? 'rgba(185, 28, 28, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                    border: isLightMode ? '1px solid rgba(185, 28, 28, 0.4)' : '1px solid rgba(239, 68, 68, 0.3)'
                  }}
                >
                  <FaSignOutAlt className="text-3xl" style={{ color: isLightMode ? '#991b1b' : '#f87171' }} />
                </div>
                <h2 className="text-2xl font-bold mb-2" style={{ color: isLightMode ? '#182440' : '#ffffff' }}>Logout Confirmation</h2>
                <p className="mb-6" style={{ color: isLightMode ? '#475569' : '#d1d5db' }}>Are you sure you want to logout?</p>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowLogoutConfirm(false)}
                    className="flex-1 px-6 py-3 rounded-xl font-medium transition-all duration-300"
                    style={{
                      background: isLightMode ? 'rgba(71, 85, 105, 0.15)' : 'rgba(107, 114, 128, 0.2)',
                      border: isLightMode ? '1px solid rgba(71, 85, 105, 0.4)' : '1px solid rgba(107, 114, 128, 0.4)',
                      color: isLightMode ? '#334155' : '#d1d5db'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      logout();
                      navigate('/login');
                    }}
                    className="flex-1 px-6 py-3 rounded-xl font-medium transition-all duration-300"
                    style={{
                      background: isLightMode ? 'rgba(185, 28, 28, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      border: isLightMode ? '1px solid rgba(185, 28, 28, 0.5)' : '1px solid rgba(239, 68, 68, 0.4)',
                      color: isLightMode ? '#991b1b' : '#fca5a5'
                    }}
                  >
                    Logout
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Delete Admin Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
            style={{
              background: isLightMode ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.7)',
              backdropFilter: 'blur(10px)'
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl p-8 max-w-md w-full shadow-2xl"
              style={{
                background: isLightMode ? 'rgba(255, 255, 255, 0.95)' : 'rgba(15, 23, 42, 0.95)',
                backdropFilter: 'blur(20px)',
                border: isLightMode ? '1px solid rgba(185, 28, 28, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
              }}
            >
              <div className="text-center">
                <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4"
                  style={{
                    background: isLightMode ? 'rgba(185, 28, 28, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                    border: isLightMode ? '1px solid rgba(185, 28, 28, 0.4)' : '1px solid rgba(239, 68, 68, 0.3)'
                  }}
                >
                  <FaTrash className="text-3xl" style={{ color: isLightMode ? '#991b1b' : '#f87171' }} />
                </div>
                <h2 className="text-2xl font-bold mb-2" style={{ color: isLightMode ? '#182440' : '#ffffff' }}>Delete User</h2>
                <p className="mb-6" style={{ color: isLightMode ? '#475569' : '#d1d5db' }}>Are you sure you want to delete this user? This action cannot be undone.</p>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setAdminToDelete(null);
                    }}
                    className="flex-1 px-6 py-3 rounded-xl font-medium transition-all duration-300"
                    style={{
                      background: isLightMode ? 'rgba(71, 85, 105, 0.15)' : 'rgba(107, 114, 128, 0.2)',
                      border: isLightMode ? '1px solid rgba(71, 85, 105, 0.4)' : '1px solid rgba(107, 114, 128, 0.4)',
                      color: isLightMode ? '#334155' : '#d1d5db'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteAdmin}
                    className="flex-1 px-6 py-3 rounded-xl font-medium transition-all duration-300"
                    style={{
                      background: isLightMode ? 'rgba(185, 28, 28, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      border: isLightMode ? '1px solid rgba(185, 28, 28, 0.5)' : '1px solid rgba(239, 68, 68, 0.4)',
                      color: isLightMode ? '#991b1b' : '#fca5a5'
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperAdminDashboard;