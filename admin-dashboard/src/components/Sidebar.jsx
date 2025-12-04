/**
 * Sidebar Navigation Component
 * Futuristic Sci-Fi Navigation with Neon Accents
 */

import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
  FiClock,
  FiZap,
  FiRadio
} from 'react-icons/fi';
import { GiTeacher } from 'react-icons/gi';
import { HiSparkles } from 'react-icons/hi';

const Sidebar = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [hoveredItem, setHoveredItem] = useState(null);

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
    <motion.div 
      initial={{ x: -280 }}
      animate={{ x: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
      className="h-screen w-72 flex flex-col fixed left-0 top-0 z-50 overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #0a0e27 0%, #1a1f3a 50%, #0f1729 100%)',
        boxShadow: '4px 0 40px rgba(0, 255, 255, 0.15), inset -1px 0 2px rgba(0, 255, 255, 0.3)'
      }}
    >
      {/* Animated Background Grid */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(0, 255, 255, 0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 255, 255, 0.3) 1px, transparent 1px)
          `,
          backgroundSize: '30px 30px'
        }} />
      </div>

      {/* Neon Glow Border */}
      <div className="absolute top-0 right-0 w-px h-full"
        style={{
          background: 'linear-gradient(180deg, transparent, #00ffff 50%, transparent)',
          boxShadow: '0 0 20px #00ffff, 0 0 40px #00ffff'
        }}
      />

      {/* Logo Section */}
      <div className="relative p-6 border-b border-cyan-500/20">
        {/* Holographic Logo Effect */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, type: "spring" }}
          className="relative"
        >
          <div className="flex items-center space-x-4">
            {/* Logo */}
            <img
              src="/models/intellisight1.png"
              alt="IntelliSight Logo"
              className="w-24 h-24 object-contain"
            />

            {/* Text Content */}
            <div>
              <motion.h1
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="text-2xl font-black tracking-tight text-transparent bg-clip-text"
                style={{
                  backgroundImage: 'linear-gradient(90deg, #00ffff, #ffffff)'
                }}
              >
                IntelliSight
              </motion.h1>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="flex items-center gap-1 mt-1"
              >
                <motion.div
                  animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.5, 1, 0.5]
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-1.5 h-1.5 rounded-full bg-cyan-400"
                  style={{ boxShadow: '0 0 8px #00ffff' }}
                />
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">Live System</span>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-6 overflow-y-auto custom-scrollbar relative">
        {/* System Status Indicator */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 px-4 py-3 rounded-xl relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(0, 255, 255, 0.1), rgba(0, 128, 255, 0.1))',
            border: '1px solid rgba(0, 255, 255, 0.2)'
          }}
        >
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              >
                <FiRadio className="text-cyan-400" size={16} />
              </motion.div>
              <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">Navigation</span>
            </div>
            <HiSparkles className="text-yellow-400" size={14} />
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
        </motion.div>

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
              >
                {({ isActive }) => (
                  <div
                    className={`
                      relative flex items-center space-x-3 px-4 py-3.5 rounded-xl
                      transition-all duration-300 group overflow-hidden
                      ${isActive ? 'text-white' : 'text-cyan-100/70 hover:text-white'}
                    `}
                    style={{
                      background: isActive
                        ? 'linear-gradient(135deg, rgba(0, 255, 255, 0.2), rgba(0, 128, 255, 0.2))'
                        : hoveredItem === item.path
                        ? 'linear-gradient(135deg, rgba(0, 255, 255, 0.1), rgba(0, 128, 255, 0.1))'
                        : 'transparent',
                      border: isActive
                        ? '1px solid rgba(0, 255, 255, 0.4)'
                        : '1px solid transparent',
                      boxShadow: isActive
                        ? '0 0 20px rgba(0, 255, 255, 0.3), inset 0 0 20px rgba(0, 255, 255, 0.1)'
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
                            background: 'linear-gradient(180deg, #00ffff, #0080ff)',
                            boxShadow: '0 0 10px #00ffff'
                          }}
                        />
                      )}
                    </AnimatePresence>

                    {/* Icon with Glow Effect */}
                    <motion.div
                      animate={{
                        scale: isActive ? [1, 1.1, 1] : 1,
                        rotate: isActive ? [0, 5, -5, 0] : 0
                      }}
                      transition={{ duration: 2, repeat: isActive ? Infinity : 0 }}
                      className="relative z-10"
                    >
                      <item.icon
                        size={20}
                        className={`transition-all duration-300 ${
                          isActive ? 'drop-shadow-[0_0_8px_rgba(0,255,255,0.8)]' : ''
                        }`}
                      />
                    </motion.div>

                    {/* Label */}
                    <span className="font-semibold relative z-10 tracking-wide">
                      {item.label}
                    </span>

                    {/* Badge for Unknown Faces */}
                    {item.badge && (
                      <motion.span
                        animate={{
                          scale: [1, 1.2, 1],
                          opacity: [0.8, 1, 0.8]
                        }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="ml-auto px-2 py-0.5 text-xs font-bold rounded-full"
                        style={{
                          background: 'linear-gradient(135deg, #ff0080, #ff4d4d)',
                          color: '#fff',
                          boxShadow: '0 0 10px rgba(255, 0, 128, 0.5)'
                        }}
                      >
                        NEW
                      </motion.span>
                    )}

                    {/* Hover Glow Effect */}
                    <motion.div
                      animate={{
                        opacity: hoveredItem === item.path ? 1 : 0,
                        scale: hoveredItem === item.path ? 1 : 0.8
                      }}
                      className="absolute inset-0 rounded-xl -z-10"
                      style={{
                        background: 'radial-gradient(circle at center, rgba(0, 255, 255, 0.15), transparent)',
                        filter: 'blur(10px)'
                      }}
                    />

                    {/* Scan Line Effect for Active Item */}
                    {isActive && (
                      <motion.div
                        animate={{ y: ['0%', '100%'] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0 rounded-xl overflow-hidden opacity-20"
                      >
                        <div
                          className="w-full h-8"
                          style={{
                            background: 'linear-gradient(180deg, transparent, rgba(0, 255, 255, 0.5), transparent)'
                          }}
                        />
                      </motion.div>
                    )}
                  </div>
                )}
              </NavLink>
            </motion.li>
          ))}
        </ul>
      </nav>

      {/* Bottom Section */}
      <div className="relative p-4 border-t border-cyan-500/20 space-y-2">
        {/* Settings Button */}
        <NavLink
          to="/settings"
        >
          {({ isActive }) => (
            <div
              className={`
                relative flex items-center space-x-3 px-4 py-3 rounded-xl
                transition-all duration-300 group overflow-hidden
                ${isActive ? 'text-white' : 'text-cyan-100/70 hover:text-white'}
              `}
              style={{
                background: isActive
                  ? 'linear-gradient(135deg, rgba(0, 255, 255, 0.2), rgba(0, 128, 255, 0.2))'
                  : 'transparent',
                border: isActive
                  ? '1px solid rgba(0, 255, 255, 0.4)'
                  : '1px solid transparent',
                boxShadow: isActive
                  ? '0 0 20px rgba(0, 255, 255, 0.3)'
                  : 'none'
              }}
            >
              <motion.div
                whileHover={{ rotate: 180 }}
                transition={{ duration: 0.5 }}
              >
                <FiSettings size={20} />
              </motion.div>
              <span className="font-semibold tracking-wide">Settings</span>
            </div>
          )}
        </NavLink>

        {/* Logout Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleLogout}
          className="w-full relative flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 overflow-hidden group"
          style={{
            background: 'linear-gradient(135deg, rgba(255, 0, 80, 0.1), rgba(255, 77, 77, 0.1))',
            border: '1px solid rgba(255, 0, 80, 0.3)',
            color: '#ff4d6d'
          }}
        >
          {/* Animated Background on Hover */}
          <motion.div
            initial={{ x: '-100%' }}
            whileHover={{ x: '100%' }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0 bg-gradient-to-r from-transparent via-red-500/20 to-transparent"
          />
          
          <motion.div
            animate={{ x: [0, 5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <FiLogOut size={20} />
          </motion.div>
          <span className="font-bold tracking-wide relative z-10">Log Out</span>
          
          {/* Pulse Effect */}
          <motion.div
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.5, 0, 0.5]
            }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute right-4 w-2 h-2 rounded-full bg-red-500"
            style={{ boxShadow: '0 0 10px #ff0050' }}
          />
        </motion.button>

        {/* System Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-4 px-4 py-3 rounded-xl"
          style={{
            background: 'linear-gradient(135deg, rgba(0, 255, 255, 0.05), rgba(0, 128, 255, 0.05))',
            border: '1px solid rgba(0, 255, 255, 0.1)'
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">System Status</span>
            <motion.div
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-2 h-2 rounded-full bg-green-400"
              style={{ boxShadow: '0 0 8px #00ff00' }}
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-cyan-300/70">
            <FiZap size={12} />
            <span>All systems operational</span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default Sidebar;
