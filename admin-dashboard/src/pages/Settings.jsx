/**
 * Settings Page
 * Application configuration and preferences
 */

import React, { useState } from 'react';
import { FiSettings, FiSave, FiMoon, FiSun } from 'react-icons/fi';
import { useTheme } from '../context/ThemeContext';

const Settings = () => {
  const { isDarkMode, toggleTheme } = useTheme();
  const [settings, setSettings] = useState({
    pollingInterval: parseInt(import.meta.env.VITE_POLLING_INTERVAL) || 5000,
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  });

  const handleSave = () => {
    // In a real app, this would save to backend or update environment
    alert('Settings saved! (This is a demo - actual saving would require backend implementation)');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-display font-black" style={{ color: '#003d82' }}>Settings</h1>
      </div>

      {/* Theme Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6">Appearance</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Theme Mode
            </label>
            <div className="flex items-center space-x-4">
              <button
                onClick={toggleTheme}
                className="flex items-center space-x-3 px-6 py-3 rounded-xl transition-all font-semibold"
                style={{
                  backgroundColor: isDarkMode ? '#003d82' : '#305796',
                  color: '#fff'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#6b9bd1'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isDarkMode ? '#003d82' : '#305796'}
              >
                {isDarkMode ? (
                  <>
                    <FiMoon size={20} />
                    <span>Dark Mode</span>
                  </>
                ) : (
                  <>
                    <FiSun size={20} />
                    <span>Light Mode</span>
                  </>
                )}
              </button>
              
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Current theme: <span className="font-semibold">{isDarkMode ? 'Dark' : 'Light'}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Form */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6">General Settings</h2>
        
        <div className="space-y-6">
          {/* API Base URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              API Base URL
            </label>
            <input
              type="text"
              value={settings.apiBaseUrl}
              onChange={(e) => setSettings({...settings, apiBaseUrl: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="http://localhost:3000/api"
            />
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              The base URL for backend API endpoints
            </p>
          </div>

          {/* Polling Interval */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Real-time Update Interval
            </label>
            <select
              value={settings.pollingInterval}
              onChange={(e) => setSettings({...settings, pollingInterval: Number(e.target.value)})}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value={3000}>3 seconds</option>
              <option value={5000}>5 seconds</option>
              <option value={10000}>10 seconds</option>
              <option value={30000}>30 seconds</option>
            </select>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              How often to refresh data from the server
            </p>
          </div>

          {/* Save Button */}
          <div className="pt-4">
            <button
              onClick={handleSave}
              className="flex items-center space-x-2 px-6 py-3 rounded-xl font-semibold transition"
              style={{ backgroundColor: '#003d82', color: '#fff' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#305796'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#003d82'}
            >
              <FiSave size={20} />
              <span>Save Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* System Info */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6">System Information</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <p className="text-sm text-gray-600 dark:text-gray-400">Application Name</p>
            <p className="text-lg font-semibold text-gray-800 dark:text-white">IntelliSight Dashboard</p>
          </div>
          
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <p className="text-sm text-gray-600 dark:text-gray-400">Version</p>
            <p className="text-lg font-semibold text-gray-800 dark:text-white">1.0.0</p>
          </div>
          
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <p className="text-sm text-gray-600 dark:text-gray-400">Current API URL</p>
            <p className="text-sm font-mono text-gray-800 dark:text-white break-all">{settings.apiBaseUrl}</p>
          </div>
          
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <p className="text-sm text-gray-600 dark:text-gray-400">Update Interval</p>
            <p className="text-lg font-semibold text-gray-800 dark:text-white">{settings.pollingInterval / 1000}s</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
