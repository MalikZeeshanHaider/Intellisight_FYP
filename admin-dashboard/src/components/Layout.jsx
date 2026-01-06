/**
 * Main Layout Component
 * Wraps all authenticated pages with sidebar - Mobile Responsive
 */

import React, { useState } from 'react';
import Sidebar from './Sidebar';
import { FiMenu, FiX } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--background)' }}>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-4 left-4 z-[60] lg:hidden p-3 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 backdrop-blur-xl border border-cyan-500/30 shadow-lg"
        style={{ boxShadow: '0 4px 20px rgba(0, 255, 255, 0.2)' }}
      >
        {sidebarOpen ? (
          <FiX size={24} className="text-cyan-400" />
        ) : (
          <FiMenu size={24} className="text-cyan-400" />
        )}
      </button>

      {/* Mobile Overlay */}
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

      {/* Sidebar - Hidden on mobile by default, shown when sidebarOpen is true */}
      <div className={`
        fixed lg:fixed inset-y-0 left-0 z-50
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <Sidebar onClose={() => setSidebarOpen(false)} onCollapseChange={setIsCollapsed} />
      </div>

      {/* Main Content - Dynamic margin based on sidebar state */}
      <motion.div 
        animate={{ 
          marginLeft: isCollapsed ? '5rem' : '18rem'
        }}
        transition={{ type: "spring", stiffness: 100, damping: 20 }}
        className="flex-1 w-full lg:ml-72"
      >
        <main className="p-4 sm:p-6 lg:p-8 pt-20 lg:pt-8">
          {children}
        </main>
      </motion.div>
    </div>
  );
};

export default Layout;
