/**
 * Main Layout Component
 * Sidebar + sticky top header (page title + mobile toggle).
 * AlertBell is mounted globally in App.jsx — not here.
 */

import React, { useState } from 'react';
import Sidebar from './Sidebar';
import { FiMenu, FiX } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';

const getPageTitle = (pathname) => {
  const map = {
    '/dashboard':            'Dashboard',
    '/students':             'Students',
    '/teachers':             'Teachers',
    '/zones':                'Zones',
    '/cameras':              'Cameras',
    '/unknown-faces':        'Unknown Faces',
    '/logs':                 'Logs',
    '/settings':             'Settings',
    '/active-presence':      'Active Presence',
    '/attendance-analytics': 'Attendance Analytics',
  };
  for (const [prefix, title] of Object.entries(map)) {
    if (pathname.startsWith(prefix)) return title;
  }
  return 'IntelliSight';
};

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed]  = useState(false);
  const location = useLocation();

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--background)' }}>

      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <div className={`
        fixed lg:fixed inset-y-0 left-0 z-50
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <Sidebar onClose={() => setSidebarOpen(false)} onCollapseChange={setIsCollapsed} />
      </div>

      {/* Right column */}
      <motion.div
        animate={{ marginLeft: isCollapsed ? '5rem' : '18rem' }}
        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        className="flex-1 flex flex-col min-h-screen lg:ml-72"
      >
        {/* Mobile menu toggle — shown only on small screens, no title bar */}
        <div className="sticky top-0 z-30 lg:hidden flex items-center px-4 h-12 shrink-0"
          style={{ background: 'rgba(10,14,39,0.88)', backdropFilter: 'blur(16px)' }}
        >
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-xl"
            style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.3)' }}
          >
            {sidebarOpen
              ? <FiX    size={20} className="text-cyan-400" />
              : <FiMenu size={20} className="text-cyan-400" />}
          </button>
        </div>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </motion.div>
    </div>
  );
};

export default Layout;
