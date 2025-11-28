/**
 * Sidebar Navigation Component
 * Matches the IntelliSight dashboard design with dark blue sidebar
 */

import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  FiHome,
  FiUsers,
  FiMapPin,
  FiFileText,
  FiSettings,
  FiLogOut,
  FiVideo,
  FiAlertCircle,
  FiActivity,
  FiClock
} from 'react-icons/fi';
import { GiTeacher } from 'react-icons/gi';

const Sidebar = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    {
      path: '/dashboard',
      icon: FiHome,
      label: 'Dashboard',
      exact: true
    },
    {
      path: '/zone1-live',
      icon: FiVideo,
      label: 'Zone 1 Live'
    },
    {
      path: '/active-presence',
      icon: FiActivity,
      label: 'Active Presence'
    },
    {
      path: '/attendance-logs',
      icon: FiClock,
      label: 'Attendance Logs'
    },
    {
      path: '/unknown-faces',
      icon: FiAlertCircle,
      label: 'Unknown Faces',
      badge: true
    },
    {
      path: '/students',
      icon: FiUsers,
      label: 'Students'
    },
    {
      path: '/teachers',
      icon: GiTeacher,
      label: 'Teachers'
    },
    {
      path: '/zones',
      icon: FiMapPin,
      label: 'Zones'
    },
    {
      path: '/logs',
      icon: FiFileText,
      label: 'Logs'
    },
  ];

  return (
    <div className="h-screen w-64 bg-sidebar-dark text-white flex flex-col fixed left-0 top-0 shadow-2xl z-50">
      {/* Logo Section */}
      <div className="p-6 border-b border-sidebar-darker">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-lg flex items-center justify-center shadow-lg">
            <span className="text-xl font-bold">IS</span>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">IntelliSight</h1>
            <p className="text-xs text-blue-200 opacity-75">Admin Dashboard</p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-6 overflow-y-auto custom-scrollbar">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                end={item.exact}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${isActive
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-blue-100 hover:bg-sidebar-darker hover:text-white'
                  }`
                }
              >
                <item.icon size={20} />
                <span className="font-medium">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Bottom Section */}
      <div className="p-4 border-t border-sidebar-darker space-y-2">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${isActive
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-blue-100 hover:bg-sidebar-darker hover:text-white'
            }`
          }
        >
          <FiSettings size={20} />
          <span className="font-medium">Settings</span>
        </NavLink>

        <button
          onClick={handleLogout}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-red-300 hover:bg-red-900/20 hover:text-red-200 transition-all duration-200"
        >
          <FiLogOut size={20} />
          <span className="font-medium">Log Out</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
