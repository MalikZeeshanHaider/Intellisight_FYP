/**
 * Sidebar Navigation Component
 * Futuristic Sci-Fi Navigation with Neon Accents
 */

import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
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
  FiClock,
  FiChevronLeft,
  FiChevronRight
} from 'react-icons/fi';
import { GiTeacher } from 'react-icons/gi';

const Sidebar = ({ onClose, onCollapseChange }) => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { isDarkMode } = useTheme();
  const [hoveredItem, setHoveredItem] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleCollapseToggle = () => {
    const newCollapsedState = !isCollapsed;
    setIsCollapsed(newCollapsedState);
    if (onCollapseChange) {
      onCollapseChange(newCollapsedState);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleNavClick = () => {
    // Close sidebar on mobile when nav item is clicked
    if (onClose) {
      onClose();
    }
  };

  const navItems = [
    {
      path: '/dashboard',
      icon: FiHome,
      label: 'Dashboard',
      exact: true
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
      label: 'Unknown Faces'
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
      path: '/cameras',
      icon: FiVideo,
      label: 'Cameras'
    },
    {
      path: '/logs',
      icon: FiFileText,
      label: 'Logs'
    },
  ];

  return (
    <motion.div 
      initial={{ x: -280 }}
      animate={{ 
        x: 0,
        width: isCollapsed ? '5rem' : '18rem'
      }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
      className="h-screen flex flex-col fixed left-0 top-0 z-50 overflow-hidden"
      style={{
        background: isDarkMode 
          ? 'linear-gradient(180deg, #0a0e27 0%, #1a1f3a 50%, #0f1729 100%)'
          : 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 50%, #f1f5f9 100%)',
        boxShadow: isDarkMode
          ? '4px 0 40px rgba(0, 255, 255, 0.15), inset -1px 0 2px rgba(0, 255, 255, 0.3)'
          : '4px 0 40px rgba(100, 116, 139, 0.2), inset -1px 0 2px rgba(100, 116, 139, 0.15)'
      }}
    >
      {/* Animated Background Grid */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: isDarkMode
            ? `linear-gradient(rgba(0, 255, 255, 0.3) 1px, transparent 1px),
               linear-gradient(90deg, rgba(0, 255, 255, 0.3) 1px, transparent 1px)`
            : `linear-gradient(rgba(100, 116, 139, 0.4) 1px, transparent 1px),
               linear-gradient(90deg, rgba(100, 116, 139, 0.4) 1px, transparent 1px)`,
          backgroundSize: '30px 30px'
        }} />
      </div>

      {/* Neon Glow Border */}
      <div className="absolute top-0 right-0 w-px h-full"
        style={{
          background: isDarkMode
            ? 'linear-gradient(180deg, transparent, rgba(255, 255, 255, 0.15) 50%, transparent)'
            : 'linear-gradient(180deg, transparent, rgba(100, 116, 139, 0.3) 50%, transparent)',
          boxShadow: isDarkMode
            ? '0 0 5px rgba(255, 255, 255, 0.1)'
            : '0 0 5px rgba(100, 116, 139, 0.15)'
        }}
      />

      {/* Logo Section */}
      <div 
        className={`relative ${isCollapsed ? 'px-2 py-3' : 'p-6'}`}
        style={{
          borderBottom: isDarkMode 
            ? '1px solid rgba(6, 182, 212, 0.2)' 
            : '1px solid rgba(100, 116, 139, 0.2)'
        }}
      >

        {/* Holographic Logo Effect */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, type: "spring" }}
          className="relative"
        >
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'}`}>
            {/* Logo - Same size in both modes */}
            <img
              src="/models/intellisight1.png"
              alt="IntelliSight Logo"
              className="object-contain transition-all duration-300 w-20 h-20"
            />

            {/* Text Content - Only show when not collapsed */}
            {!isCollapsed && (
              <div>
                <motion.h1
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-3xl font-black tracking-tight"
                  style={{
                    color: isDarkMode ? '#c0f0f0' : '#305796'
                  }}
                >
                  IntelliSight
                </motion.h1>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-4 relative">
        <ul className="space-y-1">
          {navItems.map((item, index) => (
            <motion.li
              key={item.path}
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              onMouseEnter={() => setHoveredItem(item.path)}
              onMouseLeave={() => setHoveredItem(null)}
            >
              <NavLink
                to={item.path}
                end={item.exact}
                onClick={handleNavClick}
              >
                {({ isActive }) => (
                  <div
                    className={`
                      relative flex items-center ${isCollapsed ? 'justify-center px-3' : 'space-x-3 px-4'} py-2.5 rounded-xl
                      transition-all duration-300 group overflow-hidden
                      ${isActive 
                        ? (isDarkMode ? 'text-white' : 'text-blue-900') 
                        : (isDarkMode ? 'text-cyan-100/70 hover:text-white' : 'text-slate-600 hover:text-blue-900')}
                    `}
                    style={{
                      background: isActive
                        ? (isDarkMode 
                          ? 'linear-gradient(135deg, rgba(0, 255, 255, 0.12), rgba(0, 128, 255, 0.12))'
                          : 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(147, 197, 253, 0.15))')
                        : hoveredItem === item.path
                        ? (isDarkMode
                          ? 'linear-gradient(135deg, rgba(0, 255, 255, 0.08), rgba(0, 128, 255, 0.08))'
                          : 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(147, 197, 253, 0.08))')
                        : 'transparent',
                      border: isActive
                        ? (isDarkMode ? '1px solid rgba(0, 255, 255, 0.25)' : '1px solid rgba(59, 130, 246, 0.3)')
                        : '1px solid transparent',
                      boxShadow: isActive
                        ? (isDarkMode
                          ? '0 0 10px rgba(0, 255, 255, 0.15), inset 0 0 10px rgba(0, 255, 255, 0.05)'
                          : '0 0 10px rgba(59, 130, 246, 0.2), inset 0 0 10px rgba(59, 130, 246, 0.08)')
                        : 'none'
                    }}
                  >
                    {/* Active Indicator Line */}
                    <AnimatePresence>
                      {isActive && (
                        <motion.div
                          initial={{ scaleY: 0 }}
                          animate={{ scaleY: 1 }}
                          exit={{ scaleY: 0 }}
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full"
                          style={{
                            background: isDarkMode
                              ? 'linear-gradient(180deg, #00ffff, #0080ff)'
                              : 'linear-gradient(180deg, #3b82f6, #60a5fa)',
                            boxShadow: isDarkMode
                              ? '0 0 6px rgba(0, 255, 255, 0.4)'
                              : '0 0 6px rgba(59, 130, 246, 0.5)'
                          }}
                        />
                      )}
                    </AnimatePresence>

                    {/* Icon with Glow Effect */}
                    <motion.div
                      className="relative z-10"
                    >
                      <item.icon
                        size={isCollapsed ? 22 : 18}
                        className={`transition-all duration-300 ${
                          isActive 
                            ? (isDarkMode 
                              ? 'drop-shadow-[0_0_6px_rgba(0,255,255,0.4)]' 
                              : 'drop-shadow-[0_0_6px_rgba(59,130,246,0.5)]')
                            : ''
                        }`}
                      />
                    </motion.div>

                    {/* Label - Only show when not collapsed */}
                    {!isCollapsed && (
                      <span className="font-semibold relative z-10 tracking-wide text-sm">
                        {item.label}
                      </span>
                    )}

                    {/* Hover Glow Effect */}
                    <motion.div
                      animate={{
                        opacity: hoveredItem === item.path ? 1 : 0,
                        scale: hoveredItem === item.path ? 1 : 0.8
                      }}
                      className="absolute inset-0 rounded-xl -z-10"
                      style={{
                        background: 'radial-gradient(circle at center, #3057962d, transparent)',
                        filter: 'blur(10px)'
                      }}
                    />
                  </div>
                )}
              </NavLink>
            </motion.li>
          ))}
        </ul>
      </nav>

      {/* Bottom Section - Reduced padding for visibility */}
      <div 
        className="relative p-3 space-y-1.5"
        style={{
          borderTop: isDarkMode
            ? '1px solid rgba(6, 182, 212, 0.2)'
            : '1px solid rgba(100, 116, 139, 0.2)'
        }}
      >
        {/* Toggle Collapse Button - Moved above Settings */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleCollapseToggle}
          className="w-full relative flex items-center justify-center py-1.5 rounded-xl transition-all duration-300 overflow-hidden group"
          style={{
            background: isDarkMode
              ? 'linear-gradient(135deg, rgba(0, 255, 255, 0.1), rgba(0, 128, 255, 0.02))'
              : 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(147, 197, 253, 0.1))',
            border: isDarkMode
              ? '1px solid rgba(0, 255, 255, 0.3)'
              : '1px solid rgba(59, 130, 246, 0.3)',
            color: isDarkMode ? '#00ffff' : '#3b82f6'
          }}
        >
          {isCollapsed ? <FiChevronRight size={18} /> : <FiChevronLeft size={18} />}
        </motion.button>

        {/* Settings Button */}
        <NavLink
          to="/settings"
        >
          {({ isActive }) => (
            <div
              className={`
                relative flex items-center ${isCollapsed ? 'justify-center px-2' : 'space-x-3 px-4'} py-2 rounded-xl
                transition-all duration-300 group overflow-hidden
                ${isActive 
                  ? (isDarkMode ? 'text-white' : 'text-blue-900')
                  : (isDarkMode ? 'text-cyan-100/70 hover:text-white' : 'text-slate-600 hover:text-blue-900')}
              `}
              style={{
                background: isActive
                  ? (isDarkMode
                    ? 'linear-gradient(135deg, rgba(0, 255, 255, 0.09), rgba(0, 128, 255, 0.08))'
                    : 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(147, 197, 253, 0.15))')
                  : 'transparent',
                border: isActive
                  ? (isDarkMode
                    ? '1px solid rgba(0, 255, 255, 0.24)'
                    : '1px solid rgba(59, 130, 246, 0.3)')
                  : '1px solid transparent',
                boxShadow: isActive
                  ? (isDarkMode
                    ? '0 0 10px rgba(0, 255, 255, 0.11)'
                    : '0 0 10px rgba(59, 130, 246, 0.2)')
                  : 'none'
              }}
            >
              <motion.div
                whileHover={{ rotate: 180 }}
                transition={{ duration: 0.5 }}
              >
                <FiSettings size={18} />
              </motion.div>
              {!isCollapsed && <span className="font-semibold tracking-wide text-sm">Settings</span>}
            </div>
          )}
        </NavLink>

        {/* Logout Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleLogout}
          className={`w-full relative flex items-center ${isCollapsed ? 'justify-center px-3' : 'space-x-3 px-4'} py-2 rounded-xl transition-all duration-300 overflow-hidden group`}
          style={{
            background: isDarkMode
              ? 'linear-gradient(135deg, rgba(255, 0, 80, 0.06), rgba(255, 77, 77, 0.06))'
              : 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(248, 113, 113, 0.1))',
            border: isDarkMode
              ? '1px solid rgba(255, 0, 80, 0.25)'
              : '1px solid rgba(239, 68, 68, 0.3)',
            color: isDarkMode ? '#ff6b8a' : '#dc2626'
          }}
        >
          {/* Animated Background on Hover */}
          <motion.div
            initial={{ x: '-100%' }}
            whileHover={{ x: '100%' }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0 bg-gradient-to-r from-transparent via-red-500/20 to-transparent"
          />
          
          <div>
            <FiLogOut size={18} />
          </div>
          {!isCollapsed && <span className="font-bold tracking-wide relative z-10 text-sm">Log Out</span>}
          
          {/* Pulse Effect - Only show when not collapsed */}
          {!isCollapsed && (
            <motion.div
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.5, 0, 0.5]
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute right-4 w-2 h-2 rounded-full bg-red-400"
              style={{ boxShadow: '0 0 8px rgba(255, 77, 77, 0.5)' }}
            />
          )}
        </motion.button>
      </div>
    </motion.div>
  );
};

export default Sidebar;
export { Sidebar };
