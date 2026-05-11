import React, { useState, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  FiHome, FiUsers, FiMapPin, FiFileText, FiSettings, FiLogOut,
  FiVideo, FiAlertCircle, FiActivity, FiChevronLeft, FiChevronRight,
  FiBarChart2, FiShield,
} from 'react-icons/fi';
import { GiTeacher } from 'react-icons/gi';

// ── NavItem lives OUTSIDE Sidebar so it is never re-created on parent renders ──
const NavItem = ({ item, isCollapsed, isDarkMode, onNavClick }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.li
      initial={{ opacity: 0, x: -50 }}
      animate={{ opacity: 1, x: 0 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <NavLink to={item.path} end={item.exact} onClick={onNavClick}>
        {({ isActive }) => (
          <div
            className={`relative flex items-center ${isCollapsed ? 'justify-center px-3' : 'space-x-3 px-4'} py-2.5 rounded-xl transition-all duration-200 overflow-hidden`}
            style={{
              color: isActive
                ? (isDarkMode ? '#ffffff' : '#1e3a8a')
                : (isDarkMode ? 'rgba(207,250,254,0.7)' : '#475569'),
              background: isActive
                ? (isDarkMode
                    ? 'linear-gradient(135deg,rgba(0,255,255,.12),rgba(0,128,255,.12))'
                    : 'linear-gradient(135deg,rgba(59,130,246,.15),rgba(147,197,253,.15))')
                : hovered
                ? (isDarkMode
                    ? 'linear-gradient(135deg,rgba(0,255,255,.07),rgba(0,128,255,.07))'
                    : 'linear-gradient(135deg,rgba(59,130,246,.08),rgba(147,197,253,.08))')
                : 'transparent',
              border: isActive
                ? (isDarkMode ? '1px solid rgba(0,255,255,.25)' : '1px solid rgba(59,130,246,.3)')
                : '1px solid transparent',
              boxShadow: isActive
                ? (isDarkMode
                    ? '0 0 10px rgba(0,255,255,.15),inset 0 0 10px rgba(0,255,255,.05)'
                    : '0 0 10px rgba(59,130,246,.2),inset 0 0 10px rgba(59,130,246,.08)')
                : 'none',
            }}
          >
            {/* Active indicator bar */}
            <AnimatePresence>
              {isActive && (
                <motion.div
                  initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} exit={{ scaleY: 0 }}
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full"
                  style={{
                    background: isDarkMode
                      ? 'linear-gradient(180deg,#00ffff,#0080ff)'
                      : 'linear-gradient(180deg,#3b82f6,#60a5fa)',
                    boxShadow: isDarkMode ? '0 0 6px rgba(0,255,255,.4)' : '0 0 6px rgba(59,130,246,.5)',
                  }}
                />
              )}
            </AnimatePresence>

            {/* Icon */}
            <item.icon
              size={isCollapsed ? 22 : 18}
              className="relative z-10 flex-shrink-0"
              style={isActive ? {
                filter: isDarkMode
                  ? 'drop-shadow(0 0 6px rgba(0,255,255,.4))'
                  : 'drop-shadow(0 0 6px rgba(59,130,246,.5))',
              } : {}}
            />

            {/* Label */}
            {!isCollapsed && (
              <span className="font-semibold relative z-10 tracking-wide text-sm">{item.label}</span>
            )}
          </div>
        )}
      </NavLink>
    </motion.li>
  );
};

// ── Sidebar ───────────────────────────────────────────────────────────────────
const Sidebar = ({ onClose, onCollapseChange }) => {
  const navigate = useNavigate();
  const { logout, user, hasPermission } = useAuth();
  const { isDarkMode } = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isSuperAdmin = user?.isSuperAdmin === true;

  const handleCollapseToggle = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    if (onCollapseChange) onCollapseChange(next);
  };

  const handleLogout = async () => { await logout(); navigate('/login'); };
  const handleNavClick = useCallback(() => { if (onClose) onClose(); }, [onClose]);

  const navItems = [
    { path: '/dashboard',            icon: FiHome,        label: 'Dashboard',       exact: true },
    { path: '/active-presence',      icon: FiActivity,    label: 'Active Presence', permission: 'view_active_presence' },
    { path: '/unknown-faces',        icon: FiAlertCircle, label: 'Unknown Faces',   permission: 'view_unknown_faces' },
    { path: '/attendance-analytics', icon: FiBarChart2,   label: 'Attendance',      permission: 'view_attendance' },
    { path: '/students',             icon: FiUsers,       label: 'Students',        permission: 'manage_students' },
    { path: '/teachers',             icon: GiTeacher,     label: 'Faculty',         permission: 'manage_teachers' },
    { path: '/zones',                icon: FiMapPin,      label: 'Zones',           permission: 'manage_zones' },
    { path: '/cameras',              icon: FiVideo,       label: 'Cameras',         permission: 'manage_cameras' },
    { path: '/logs',                 icon: FiFileText,    label: 'Logs',            permission: 'view_logs' },
  ];

  const visibleItems = navItems.filter(
    (item) => !item.permission || hasPermission(item.permission),
  );

  const adminItems = [
    { path: '/super-admin', icon: FiUsers,   label: 'Manage Users' },
    { path: '/roles',       icon: FiShield,  label: 'Roles & Permissions' },
  ];

  return (
    <motion.div
      initial={{ x: -280 }}
      animate={{ x: 0, width: isCollapsed ? '5rem' : '18rem' }}
      transition={{ type: 'spring', stiffness: 100, damping: 20 }}
      className="h-screen flex flex-col fixed left-0 top-0 z-50 overflow-hidden"
      style={{
        background: isDarkMode
          ? 'linear-gradient(180deg,#0a0e27 0%,#1a1f3a 50%,#0f1729 100%)'
          : 'linear-gradient(180deg,#f8fafc 0%,#e2e8f0 50%,#f1f5f9 100%)',
        boxShadow: isDarkMode
          ? '4px 0 40px rgba(0,255,255,.15),inset -1px 0 2px rgba(0,255,255,.3)'
          : '4px 0 40px rgba(100,116,139,.2),inset -1px 0 2px rgba(100,116,139,.15)',
      }}
    >
      {/* Background grid */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: isDarkMode
            ? 'linear-gradient(rgba(0,255,255,.3) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,255,.3) 1px,transparent 1px)'
            : 'linear-gradient(rgba(100,116,139,.4) 1px,transparent 1px),linear-gradient(90deg,rgba(100,116,139,.4) 1px,transparent 1px)',
          backgroundSize: '30px 30px',
        }} />
      </div>

      {/* Neon right border */}
      <div className="absolute top-0 right-0 w-px h-full pointer-events-none" style={{
        background: isDarkMode
          ? 'linear-gradient(180deg,transparent,rgba(255,255,255,.15) 50%,transparent)'
          : 'linear-gradient(180deg,transparent,rgba(100,116,139,.3) 50%,transparent)',
      }} />

      {/* Logo */}
      <div
        className={`relative ${isCollapsed ? 'px-2 py-3' : 'p-6'}`}
        style={{ borderBottom: isDarkMode ? '1px solid rgba(6,182,212,.2)' : '1px solid rgba(100,116,139,.2)' }}
      >
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'}`}>
          <img src="/models/intellisight1.png" alt="IntelliSight" className="object-contain w-20 h-20" />
          {!isCollapsed && (
            <h1
              className="text-3xl font-black tracking-tight"
              style={{ color: isDarkMode ? '#c0f0f0' : '#305796' }}
            >
              IntelliSight
            </h1>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-4 relative overflow-y-auto">
        <ul className="space-y-1">
          {visibleItems.map((item) => (
            <NavItem
              key={item.path}
              item={item}
              isCollapsed={isCollapsed}
              isDarkMode={isDarkMode}
              onNavClick={handleNavClick}
            />
          ))}
        </ul>

        {/* Super Admin section */}
        {isSuperAdmin && (
          <div className="mt-4">
            {!isCollapsed && (
              <p
                className="text-xs font-bold uppercase tracking-widest mb-2 px-1"
                style={{ color: isDarkMode ? 'rgba(0,255,255,.4)' : 'rgba(59,130,246,.5)' }}
              >
                Administration
              </p>
            )}
            <ul className="space-y-1">
              {adminItems.map((item) => (
                <NavItem
                  key={item.path}
                  item={item}
                  isCollapsed={isCollapsed}
                  isDarkMode={isDarkMode}
                  onNavClick={handleNavClick}
                />
              ))}
            </ul>
          </div>
        )}
      </nav>

      {/* Bottom section */}
      <div
        className="relative p-3 space-y-2"
        style={{ borderTop: isDarkMode ? '1px solid rgba(6,182,212,.2)' : '1px solid rgba(100,116,139,.2)' }}
      >
        {/* Collapse toggle */}
        <motion.button
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={handleCollapseToggle}
          className="w-full flex items-center justify-center py-2 rounded-lg transition-all duration-300 mb-2"
          style={{
            background: isDarkMode
              ? 'linear-gradient(135deg,rgba(100,116,139,.15),rgba(71,85,105,.1))'
              : 'linear-gradient(135deg,rgba(203,213,225,.4),rgba(226,232,240,.3))',
            border: isDarkMode ? '1px solid rgba(100,116,139,.3)' : '1px solid rgba(148,163,184,.3)',
            color: isDarkMode ? '#cbd5e1' : '#475569',
          }}
        >
          {isCollapsed ? <FiChevronRight size={18} /> : <FiChevronLeft size={18} />}
        </motion.button>

        {/* Settings */}
        <SettingsLink isCollapsed={isCollapsed} isDarkMode={isDarkMode} onNavClick={handleNavClick} />

        {/* Logout */}
        <motion.button
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={handleLogout}
          className={`w-full relative flex items-center ${isCollapsed ? 'justify-center px-3' : 'space-x-3 px-4'} py-2 rounded-xl transition-all duration-300 overflow-hidden`}
          style={{
            background: isDarkMode ? 'linear-gradient(135deg,rgba(255,0,80,.06),rgba(255,77,77,.06))' : 'linear-gradient(135deg,rgba(239,68,68,.1),rgba(248,113,113,.1))',
            border: isDarkMode ? '1px solid rgba(255,0,80,.25)' : '1px solid rgba(239,68,68,.3)',
            color: isDarkMode ? '#ff6b8a' : '#dc2626',
          }}
        >
          <FiLogOut size={18} />
          {!isCollapsed && <span className="font-bold tracking-wide relative z-10 text-sm">Log Out</span>}
          {!isCollapsed && (
            <motion.div
              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute right-4 w-2 h-2 rounded-full bg-red-400"
              style={{ boxShadow: '0 0 8px rgba(255,77,77,.5)' }}
            />
          )}
        </motion.button>
      </div>
    </motion.div>
  );
};

// Settings link separated for the same reason (stable reference)
const SettingsLink = ({ isCollapsed, isDarkMode, onNavClick }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <NavLink to="/settings" onClick={onNavClick}>
      {({ isActive }) => (
        <div
          className={`relative flex items-center ${isCollapsed ? 'justify-center px-2' : 'space-x-3 px-4'} py-2 rounded-xl transition-all duration-200`}
          style={{
            color: isActive
              ? (isDarkMode ? '#ffffff' : '#1e3a8a')
              : (isDarkMode ? 'rgba(207,250,254,.7)' : '#475569'),
            background: isActive
              ? (isDarkMode
                  ? 'linear-gradient(135deg,rgba(0,255,255,.09),rgba(0,128,255,.08))'
                  : 'linear-gradient(135deg,rgba(59,130,246,.15),rgba(147,197,253,.15))')
              : hovered
              ? (isDarkMode ? 'linear-gradient(135deg,rgba(0,255,255,.07),rgba(0,128,255,.07))' : 'linear-gradient(135deg,rgba(59,130,246,.08),rgba(147,197,253,.08))')
              : 'transparent',
            border: isActive
              ? (isDarkMode ? '1px solid rgba(0,255,255,.24)' : '1px solid rgba(59,130,246,.3)')
              : '1px solid transparent',
          }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <motion.div whileHover={{ rotate: 180 }} transition={{ duration: 0.5 }}>
            <FiSettings size={18} />
          </motion.div>
          {!isCollapsed && <span className="font-semibold tracking-wide text-sm">Settings</span>}
        </div>
      )}
    </NavLink>
  );
};

export default Sidebar;
export { Sidebar };
