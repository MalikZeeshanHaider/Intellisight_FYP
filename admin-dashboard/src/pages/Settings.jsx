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
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Settings</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">Configure dashboard preferences</p>
      </div>

      {/* Theme Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 transition-colors duration-300">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6">Appearance</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Theme Mode
            </label>
            <div className="flex items-center space-x-4">
              <button
                onClick={toggleTheme}
                className={`flex items-center space-x-3 px-6 py-3 rounded-xl transition-all duration-300 ${
                  isDarkMode
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-2 border-cyan-500/40 text-cyan-400'
                    : 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border-2 border-blue-500/40 text-blue-600'
                } hover:scale-105`}
                style={{
                  boxShadow: isDarkMode
                    ? '0 0 20px rgba(6, 182, 212, 0.3)'
                    : '0 0 20px rgba(59, 130, 246, 0.3)'
                }}
              >
                {isDarkMode ? (
                  <>
                    <FiMoon size={24} />
                    <span className="font-semibold">Dark Mode</span>
                  </>
                ) : (
                  <>
                    <FiSun size={24} />
                    <span className="font-semibold">Light Mode</span>
                  </>
                )}
              </button>
              
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Current theme: <span className="font-semibold">{isDarkMode ? 'Dark' : 'Light'}</span>
              </p>
            </div>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Switch between dark and light mode for better viewing experience
            </p>
          </div>
        </div>
      </div>

      {/* Settings Form */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 transition-colors duration-300">
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
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
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
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
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
              className="flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              <FiSave size={20} />
              <span>Save Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* System Info */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 transition-colors duration-300">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6">System Information</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg transition-colors">
            <p className="text-sm text-gray-600 dark:text-gray-400">Application Name</p>
            <p className="text-lg font-semibold text-gray-800 dark:text-white">IntelliSight Dashboard</p>
          </div>
          
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg transition-colors">
            <p className="text-sm text-gray-600 dark:text-gray-400">Version</p>
            <p className="text-lg font-semibold text-gray-800 dark:text-white">1.0.0</p>
          </div>
          
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg transition-colors">
            <p className="text-sm text-gray-600 dark:text-gray-400">Current API URL</p>
            <p className="text-sm font-mono text-gray-800 dark:text-white break-all">{settings.apiBaseUrl}</p>
          </div>
          
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">Update Interval</p>
            <p className="text-lg font-semibold text-gray-800">{settings.pollingInterval / 1000}s</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
