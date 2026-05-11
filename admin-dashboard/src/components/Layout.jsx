/**
 * Main Layout — Sidebar + top navbar.
 */

import React, { useState } from 'react';
import Sidebar from './Sidebar';
import { FiMenu, FiX } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const { isDarkMode } = useTheme();

  const D = isDarkMode;

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--background)' }}>

      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <div className={`fixed lg:fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <Sidebar onClose={() => setSidebarOpen(false)} onCollapseChange={setIsCollapsed} />
      </div>

      {/* Right column */}
      <motion.div
        animate={{ marginLeft: isCollapsed ? '5rem' : '18rem' }}
        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        className="flex-1 flex flex-col min-h-screen lg:ml-72"
      >
        {/* Mobile-only top bar */}
        <div className="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-4 h-14 flex-shrink-0"
          style={{
            background:    D ? 'rgba(10,14,39,.92)' : 'rgba(248,250,252,.92)',
            backdropFilter:'blur(16px)',
            borderBottom:  D ? '1px solid rgba(255,255,255,.06)' : '1px solid rgba(15,23,42,.1)',
          }}
        >
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-xl flex-shrink-0"
            style={{
              background: D ? 'rgba(6,182,212,.1)' : 'rgba(59,130,246,.1)',
              border:     D ? '1px solid rgba(6,182,212,.3)' : '1px solid rgba(59,130,246,.3)',
            }}
          >
            {sidebarOpen
              ? <FiX    size={20} style={{ color: D ? '#67e8f9' : '#3b82f6' }} />
              : <FiMenu size={20} style={{ color: D ? '#67e8f9' : '#3b82f6' }} />}
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
