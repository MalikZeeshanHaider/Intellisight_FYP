/**
 * Main Layout Component
 * Wraps all authenticated pages with sidebar
 */

import React from 'react';
import Sidebar from './Sidebar';

const Layout = ({ children }) => {
  return (
    <div className="flex min-h-screen" style={{ background: 'var(--background)' }}>
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 ml-72">
        <main className="p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
