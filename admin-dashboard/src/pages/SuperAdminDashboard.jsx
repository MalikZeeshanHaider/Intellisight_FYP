import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaUsers, FaUserClock, FaUserCheck, FaUserShield, FaTrash, FaCheck, FaTimes, FaUserPlus, FaTimes as FaClose } from 'react-icons/fa';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const SuperAdminDashboard = () => {
  const { token } = useAuth();
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

  useEffect(() => {
    fetchData();
  }, []);

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
    if (!window.confirm('Are you sure you want to delete this admin?')) return;

    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.delete(`${API_URL}/auth/admin/${adminId}`, { headers });
      setSuccessMessage('Admin deleted successfully');
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

  const StatCard = ({ icon: Icon, title, value, color, gradient }) => (
    <motion.div
      whileHover={{ scale: 1.02, y: -5 }}
      className={`bg-gradient-to-br ${gradient} rounded-xl p-6 shadow-lg`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white/80 text-sm font-medium mb-1">{title}</p>
          <p className="text-white text-3xl font-bold">{value}</p>
        </div>
        <div className={`${color} bg-white/20 p-4 rounded-xl`}>
          <Icon className="text-3xl text-white" />
        </div>
      </div>
    </motion.div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
            <FaUserShield className="text-yellow-400" />
            Super Admin Dashboard
          </h1>
          <p className="text-blue-200">Manage users and view system statistics</p>
        </motion.div>

        {/* Messages */}
        {error && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200"
          >
            {error}
          </motion.div>
        )}

        {successMessage && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-xl text-green-200"
          >
            {successMessage}
          </motion.div>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={FaUsers}
            title="Total Users"
            value={statistics.totalUsers}
            color="text-blue-500"
            gradient="from-blue-500 to-blue-600"
          />
          <StatCard
            icon={FaUserClock}
            title="Pending Approvals"
            value={statistics.pendingApprovals}
            color="text-yellow-500"
            gradient="from-yellow-500 to-yellow-600"
          />
          <StatCard
            icon={FaUserCheck}
            title="Approved Users"
            value={statistics.approvedUsers}
            color="text-green-500"
            gradient="from-green-500 to-green-600"
          />
          <StatCard
            icon={FaUserShield}
            title="Admin Users"
            value={statistics.adminUsers}
            color="text-purple-500"
            gradient="from-purple-500 to-purple-600"
          />
        </div>

        {/* Add User Button */}
        <div className="mb-6 flex justify-end">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowAddUserModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition"
          >
            <FaUserPlus /> Add New User
          </motion.button>
        </div>

        {/* Tabs */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-6">
          <div className="flex gap-4 mb-6 border-b border-white/20 pb-4">
            <button
              onClick={() => setSelectedTab('pending')}
              className={`px-6 py-2 rounded-lg font-medium transition ${
                selectedTab === 'pending'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white/10 text-blue-200 hover:bg-white/20'
              }`}
            >
              Pending Approvals ({statistics.pendingApprovals})
            </button>
            <button
              onClick={() => setSelectedTab('admins')}
              className={`px-6 py-2 rounded-lg font-medium transition ${
                selectedTab === 'admins'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white/10 text-blue-200 hover:bg-white/20'
              }`}
            >
              All Admins ({statistics.totalUsers})
            </button>
          </div>

          {/* Pending Users Tab */}
          {selectedTab === 'pending' && (
            <div className="space-y-4">
              {pendingUsers.length === 0 ? (
                <p className="text-blue-200 text-center py-8">No pending approvals</p>
              ) : (
                pendingUsers.map((user) => (
                  <motion.div
                    key={user.Pending_ID}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white/10 rounded-xl p-4 flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <h3 className="text-white font-semibold">{user.Name}</h3>
                      <p className="text-blue-200 text-sm">{user.Email}</p>
                      <p className="text-blue-300 text-xs mt-1">
                        Requested: {new Date(user.RequestedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(user.Pending_ID)}
                        className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition flex items-center gap-2"
                      >
                        <FaCheck /> Approve
                      </button>
                      <button
                        onClick={() => handleReject(user.Pending_ID)}
                        className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition flex items-center gap-2"
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
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="text-left text-blue-200 font-semibold py-3 px-4">Name</th>
                    <th className="text-left text-blue-200 font-semibold py-3 px-4">Email</th>
                    <th className="text-left text-blue-200 font-semibold py-3 px-4">Role</th>
                    <th className="text-left text-blue-200 font-semibold py-3 px-4">ID</th>
                    <th className="text-left text-blue-200 font-semibold py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allAdmins.map((admin) => (
                    <tr key={admin.Admin_ID} className="border-b border-white/10 hover:bg-white/5">
                      <td className="text-white py-3 px-4">{admin.Name}</td>
                      <td className="text-blue-200 py-3 px-4">{admin.Email}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            admin.Role === 'Admin'
                              ? 'bg-purple-500/20 text-purple-300'
                              : 'bg-blue-500/20 text-blue-300'
                          }`}
                        >
                          {admin.Role}
                        </span>
                      </td>
                      <td className="text-blue-200 py-3 px-4">
                        #{admin.Admin_ID}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleDeleteAdmin(admin.Admin_ID)}
                          className="p-2 bg-red-500/20 hover:bg-red-500/40 text-red-300 rounded-lg transition"
                          title="Delete Admin"
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
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 max-w-md w-full border border-white/20 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <FaUserPlus className="text-green-400" />
                  Add New User
                </h2>
                <button
                  onClick={() => {
                    setShowAddUserModal(false);
                    setNewUser({ name: '', email: '' });
                  }}
                  className="text-gray-400 hover:text-white transition"
                >
                  <FaClose size={24} />
                </button>
              </div>

              <form onSubmit={handleAddUser} className="space-y-4">
                <div>
                  <label className="block text-blue-200 text-sm font-medium mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                    placeholder="Enter user's full name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-blue-200 text-sm font-medium mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                    placeholder="Enter user's email"
                    required
                  />
                </div>

                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mt-4">
                  <p className="text-blue-200 text-sm">
                    📧 A password reset email will be sent to the user automatically.
                  </p>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddUserModal(false);
                      setNewUser({ name: '', email: '' });
                    }}
                    className="flex-1 px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-xl font-medium transition"
                    disabled={isAddingUser}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isAddingUser}
                  >
                    {isAddingUser ? 'Adding...' : 'Add User'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
