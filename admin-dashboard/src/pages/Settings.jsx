/**
 * Settings Page
 * Comprehensive application configuration and preferences
 */

import React, { useState } from 'react';
import { 
  FiSettings, FiSave, FiMoon, FiSun, FiBell, FiShield, 
  FiDatabase, FiDownload, FiGlobe, FiEye, FiClock,
  FiAlertCircle, FiRefreshCw, FiMonitor, FiUser, FiLock
} from 'react-icons/fi';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

const Settings = () => {
  const { isDarkMode, toggleTheme } = useTheme();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('appearance');
  const [saveStatus, setSaveStatus] = useState('');
  
  const [settings, setSettings] = useState({
    // General Settings
    language: 'en',
    timezone: 'Asia/Karachi',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h',
    
    // API Settings
    pollingInterval: parseInt(import.meta.env.VITE_POLLING_INTERVAL) || 5000,
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
    apiTimeout: 30000,
    
    // Notification Settings
    enableNotifications: true,
    notifyNewDetections: true,
    notifyUnknownFaces: true,
    notifySystemAlerts: true,
    emailNotifications: false,
    notificationSound: true,
    
    // Face Recognition Settings
    recognitionThreshold: 0.6,
    detectionInterval: 5000,
    maxFacesPerFrame: 10,
    enableLivePreview: true,
    autoEnroll: false,
    
    // Camera Settings
    videoQuality: 'high',
    frameRate: 30,
    enableMotionDetection: false,
    recordUnknownFaces: true,
    
    // Data Management
    autoDeleteOldLogs: true,
    logRetentionDays: 30,
    maxStorageSize: 5000, // MB
    enableDataBackup: false,
    
    // Security Settings
    sessionTimeout: 30, // minutes
    requirePasswordChange: false,
    enableTwoFactor: false,
    logSecurityEvents: true,
    
    // Display Settings
    showWelcomeMessage: true,
    compactMode: false,
    animationsEnabled: true,
    showStatistics: true,
    
    // Export Settings
    defaultExportFormat: 'csv',
    includeImages: true,
    compressExports: true,
  });

  const handleSave = () => {
    // Simulate saving
    setSaveStatus('saving');
    setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(''), 2000);
    }, 1000);
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all settings to default values?')) {
      // Reset to default values
      setSaveStatus('reset');
      setTimeout(() => setSaveStatus(''), 2000);
    }
  };

  const tabs = [
    { id: 'appearance', label: 'Appearance', icon: FiMonitor },
    { id: 'general', label: 'General', icon: FiSettings },
    { id: 'notifications', label: 'Notifications', icon: FiBell },
    { id: 'recognition', label: 'Face Recognition', icon: FiEye },
    { id: 'camera', label: 'Camera', icon: FiMonitor },
    { id: 'data', label: 'Data Management', icon: FiDatabase },
    { id: 'security', label: 'Security', icon: FiShield },
    { id: 'export', label: 'Export', icon: FiDownload },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-display font-black" style={{ color: isDarkMode ? '#00ffff' : '#003d82' }}>
            Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage your application preferences and configuration
          </p>
        </div>
        
        {/* Quick Actions */}
        <div className="flex items-center space-x-3">
          <button
            onClick={handleReset}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl font-semibold transition border"
            style={{
              backgroundColor: 'transparent',
              borderColor: isDarkMode ? '#475569' : '#cbd5e1',
              color: isDarkMode ? '#94a3b8' : '#475569'
            }}
          >
            <FiRefreshCw size={18} />
            <span>Reset</span>
          </button>
          
          <button
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            className="flex items-center space-x-2 px-6 py-2 rounded-xl font-semibold transition"
            style={{ 
              backgroundColor: isDarkMode ? '#003d82' : '#305796', 
              color: '#fff',
              opacity: saveStatus === 'saving' ? 0.7 : 1
            }}
          >
            <FiSave size={18} />
            <span>
              {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : 'Save Changes'}
            </span>
          </button>
        </div>
      </div>

      {/* User Info Card */}
      {user && (
        <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 dark:from-cyan-500/20 dark:to-blue-500/20 rounded-xl p-4 border border-blue-300/30 dark:border-cyan-400/30">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-full bg-blue-600 dark:bg-cyan-500 flex items-center justify-center text-white font-bold text-xl">
              {user.name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">{user.name || 'Admin User'}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{user.email}</p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex overflow-x-auto border-b border-gray-200 dark:border-gray-700">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-6 py-4 font-semibold transition whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-b-2'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
                style={{
                  borderColor: activeTab === tab.id ? (isDarkMode ? '#00ffff' : '#003d82') : 'transparent',
                  color: activeTab === tab.id ? (isDarkMode ? '#00ffff' : '#003d82') : undefined,
                  backgroundColor: activeTab === tab.id ? (isDarkMode ? 'rgba(0, 255, 255, 0.05)' : 'rgba(0, 61, 130, 0.05)') : 'transparent'
                }}
              >
                <Icon size={18} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="p-6">
          {/* Appearance Tab */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Appearance Settings</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Theme Mode
                  </label>
                  <button
                    onClick={toggleTheme}
                    className="w-full flex items-center justify-between px-6 py-4 rounded-xl transition-all font-semibold border-2"
                    style={{
                      backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc',
                      borderColor: isDarkMode ? '#00ffff' : '#305796',
                      color: isDarkMode ? '#00ffff' : '#305796'
                    }}
                  >
                    <div className="flex items-center space-x-3">
                      {isDarkMode ? <FiMoon size={22} /> : <FiSun size={22} />}
                      <span>{isDarkMode ? 'Dark Mode' : 'Light Mode'}</span>
                    </div>
                    <div className="text-sm opacity-70">Click to toggle</div>
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Compact Mode
                  </label>
                  <label className="flex items-center justify-between px-6 py-4 rounded-xl border-2 border-gray-300 dark:border-gray-600 cursor-pointer bg-gray-50 dark:bg-gray-700/50">
                    <span className="font-semibold text-gray-800 dark:text-white">Reduce spacing</span>
                    <input
                      type="checkbox"
                      checked={settings.compactMode}
                      onChange={(e) => setSettings({ ...settings, compactMode: e.target.checked })}
                      className="w-5 h-5 rounded"
                    />
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Enable Animations
                  </label>
                  <label className="flex items-center justify-between px-6 py-4 rounded-xl border-2 border-gray-300 dark:border-gray-600 cursor-pointer bg-gray-50 dark:bg-gray-700/50">
                    <span className="font-semibold text-gray-800 dark:text-white">Smooth transitions</span>
                    <input
                      type="checkbox"
                      checked={settings.animationsEnabled}
                      onChange={(e) => setSettings({ ...settings, animationsEnabled: e.target.checked })}
                      className="w-5 h-5 rounded"
                    />
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Show Statistics
                  </label>
                  <label className="flex items-center justify-between px-6 py-4 rounded-xl border-2 border-gray-300 dark:border-gray-600 cursor-pointer bg-gray-50 dark:bg-gray-700/50">
                    <span className="font-semibold text-gray-800 dark:text-white">Dashboard stats</span>
                    <input
                      type="checkbox"
                      checked={settings.showStatistics}
                      onChange={(e) => setSettings({ ...settings, showStatistics: e.target.checked })}
                      className="w-5 h-5 rounded"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">General Settings</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <FiGlobe className="inline mr-2" />
                    Language
                  </label>
                  <select
                    value={settings.language}
                    onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                    className="custom-settings-dropdown w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-medium"
                  >
                    <option value="en">English</option>
                    <option value="ur">اردو (Urdu)</option>
                    <option value="ar">العربية (Arabic)</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                    <option value="de">Deutsch</option>
                  </select>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Select your preferred language
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <FiClock className="inline mr-2" />
                    Timezone
                  </label>
                  <select
                    value={settings.timezone}
                    onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                    className="custom-settings-dropdown w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-medium"
                  >
                    <option value="Asia/Karachi">Asia/Karachi (PKT)</option>
                    <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                    <option value="Europe/London">Europe/London (GMT)</option>
                    <option value="America/New_York">America/New York (EST)</option>
                    <option value="America/Los_Angeles">America/Los Angeles (PST)</option>
                    <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Date Format
                  </label>
                  <select
                    value={settings.dateFormat}
                    onChange={(e) => setSettings({ ...settings, dateFormat: e.target.value })}
                    className="custom-settings-dropdown w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-medium"
                  >
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Time Format
                  </label>
                  <select
                    value={settings.timeFormat}
                    onChange={(e) => setSettings({ ...settings, timeFormat: e.target.value })}
                    className="custom-settings-dropdown w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-medium"
                  >
                    <option value="12h">12-hour (AM/PM)</option>
                    <option value="24h">24-hour</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    API Base URL
                  </label>
                  <input
                    type="text"
                    value={settings.apiBaseUrl}
                    onChange={(e) => setSettings({ ...settings, apiBaseUrl: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
                    placeholder="http://localhost:3000/api"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Real-time Update Interval
                  </label>
                  <select
                    value={settings.pollingInterval}
                    onChange={(e) => setSettings({ ...settings, pollingInterval: Number(e.target.value) })}
                    className="custom-settings-dropdown w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-medium"
                  >
                    <option value={3000}>3 seconds</option>
                    <option value={5000}>5 seconds</option>
                    <option value={10000}>10 seconds</option>
                    <option value={30000}>30 seconds</option>
                    <option value={60000}>1 minute</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Notification Settings</h2>
              
              <div className="space-y-4">
                {[
                  { key: 'enableNotifications', label: 'Enable All Notifications', desc: 'Master toggle for all notification types' },
                  { key: 'notifyNewDetections', label: 'New Face Detections', desc: 'Alert when new faces are detected' },
                  { key: 'notifyUnknownFaces', label: 'Unknown Faces Alert', desc: 'Notify when unrecognized faces appear' },
                  { key: 'notifySystemAlerts', label: 'System Alerts', desc: 'Important system and error notifications' },
                  { key: 'emailNotifications', label: 'Email Notifications', desc: 'Send notifications via email' },
                  { key: 'notificationSound', label: 'Notification Sounds', desc: 'Play sound for notifications' },
                ].map((item) => (
                  <label key={item.key} className="flex items-center justify-between p-4 rounded-xl border-2 border-gray-300 dark:border-gray-600 cursor-pointer bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                    <div className="flex items-start space-x-3">
                      <FiBell className="mt-1 text-blue-600 dark:text-cyan-400" size={20} />
                      <div>
                        <div className="font-semibold text-gray-800 dark:text-white">{item.label}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">{item.desc}</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings[item.key]}
                      onChange={(e) => setSettings({ ...settings, [item.key]: e.target.checked })}
                      className="w-5 h-5 rounded"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Face Recognition Tab */}
          {activeTab === 'recognition' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Face Recognition Settings</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Recognition Threshold
                  </label>
                  <input
                    type="range"
                    min="0.3"
                    max="0.9"
                    step="0.05"
                    value={settings.recognitionThreshold}
                    onChange={(e) => setSettings({ ...settings, recognitionThreshold: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mt-1">
                    <span>Less Strict (0.3)</span>
                    <span className="font-bold text-blue-600 dark:text-cyan-400">{settings.recognitionThreshold}</span>
                    <span>More Strict (0.9)</span>
                  </div>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Higher values reduce false positives but may miss valid matches
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Detection Interval
                  </label>
                  <select
                    value={settings.detectionInterval}
                    onChange={(e) => setSettings({ ...settings, detectionInterval: Number(e.target.value) })}
                    className="custom-settings-dropdown w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-medium"
                  >
                    <option value={1000}>1 second (High CPU)</option>
                    <option value={3000}>3 seconds</option>
                    <option value={5000}>5 seconds (Recommended)</option>
                    <option value={10000}>10 seconds</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Max Faces Per Frame
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={settings.maxFacesPerFrame}
                    onChange={(e) => setSettings({ ...settings, maxFacesPerFrame: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-medium"
                  />
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Maximum number of faces to detect in each frame
                  </p>
                </div>

                <div>
                  <label className="flex items-center justify-between p-4 rounded-xl border-2 border-gray-300 dark:border-gray-600 cursor-pointer bg-gray-50 dark:bg-gray-700/50">
                    <div>
                      <div className="font-semibold text-gray-800 dark:text-white">Enable Live Preview</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Show real-time detection</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.enableLivePreview}
                      onChange={(e) => setSettings({ ...settings, enableLivePreview: e.target.checked })}
                      className="w-5 h-5 rounded"
                    />
                  </label>
                </div>

                <div>
                  <label className="flex items-center justify-between p-4 rounded-xl border-2 border-gray-300 dark:border-gray-600 cursor-pointer bg-gray-50 dark:bg-gray-700/50">
                    <div>
                      <div className="font-semibold text-gray-800 dark:text-white">Auto-Enroll Unknown</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Automatically enroll detected faces</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.autoEnroll}
                      onChange={(e) => setSettings({ ...settings, autoEnroll: e.target.checked })}
                      className="w-5 h-5 rounded"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Camera Tab */}
          {activeTab === 'camera' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Camera Settings</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Video Quality
                  </label>
                  <select
                    value={settings.videoQuality}
                    onChange={(e) => setSettings({ ...settings, videoQuality: e.target.value })}
                    className="custom-settings-dropdown w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-medium"
                  >
                    <option value="low">Low (480p)</option>
                    <option value="medium">Medium (720p)</option>
                    <option value="high">High (1080p)</option>
                    <option value="ultra">Ultra (4K)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Frame Rate
                  </label>
                  <select
                    value={settings.frameRate}
                    onChange={(e) => setSettings({ ...settings, frameRate: Number(e.target.value) })}
                    className="custom-settings-dropdown w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-medium"
                  >
                    <option value={15}>15 FPS</option>
                    <option value={24}>24 FPS</option>
                    <option value={30}>30 FPS</option>
                    <option value={60}>60 FPS</option>
                  </select>
                </div>

                <div>
                  <label className="flex items-center justify-between p-4 rounded-xl border-2 border-gray-300 dark:border-gray-600 cursor-pointer bg-gray-50 dark:bg-gray-700/50">
                    <div>
                      <div className="font-semibold text-gray-800 dark:text-white">Motion Detection</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Activate on movement only</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.enableMotionDetection}
                      onChange={(e) => setSettings({ ...settings, enableMotionDetection: e.target.checked })}
                      className="w-5 h-5 rounded"
                    />
                  </label>
                </div>

                <div>
                  <label className="flex items-center justify-between p-4 rounded-xl border-2 border-gray-300 dark:border-gray-600 cursor-pointer bg-gray-50 dark:bg-gray-700/50">
                    <div>
                      <div className="font-semibold text-gray-800 dark:text-white">Record Unknown Faces</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Save images of unrecognized faces</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.recordUnknownFaces}
                      onChange={(e) => setSettings({ ...settings, recordUnknownFaces: e.target.checked })}
                      className="w-5 h-5 rounded"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Data Management Tab */}
          {activeTab === 'data' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Data Management</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="flex items-center justify-between p-4 rounded-xl border-2 border-gray-300 dark:border-gray-600 cursor-pointer bg-gray-50 dark:bg-gray-700/50">
                    <div>
                      <div className="font-semibold text-gray-800 dark:text-white">Auto-Delete Old Logs</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Automatically remove old records</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.autoDeleteOldLogs}
                      onChange={(e) => setSettings({ ...settings, autoDeleteOldLogs: e.target.checked })}
                      className="w-5 h-5 rounded"
                    />
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Log Retention Period
                  </label>
                  <select
                    value={settings.logRetentionDays}
                    onChange={(e) => setSettings({ ...settings, logRetentionDays: Number(e.target.value) })}
                    className="custom-settings-dropdown w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-medium"
                    disabled={!settings.autoDeleteOldLogs}
                  >
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                    <option value={30}>30 days</option>
                    <option value={60}>60 days</option>
                    <option value={90}>90 days</option>
                    <option value={180}>6 months</option>
                    <option value={365}>1 year</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Max Storage Size (MB)
                  </label>
                  <input
                    type="number"
                    min="100"
                    max="50000"
                    step="100"
                    value={settings.maxStorageSize}
                    onChange={(e) => setSettings({ ...settings, maxStorageSize: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-medium"
                  />
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Current: {(settings.maxStorageSize / 1024).toFixed(2)} GB
                  </p>
                </div>

                <div>
                  <label className="flex items-center justify-between p-4 rounded-xl border-2 border-gray-300 dark:border-gray-600 cursor-pointer bg-gray-50 dark:bg-gray-700/50">
                    <div>
                      <div className="font-semibold text-gray-800 dark:text-white">Enable Data Backup</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Automatic daily backups</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.enableDataBackup}
                      onChange={(e) => setSettings({ ...settings, enableDataBackup: e.target.checked })}
                      className="w-5 h-5 rounded"
                    />
                  </label>
                </div>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-300 dark:border-yellow-600 rounded-xl p-4">
                <div className="flex items-start space-x-3">
                  <FiAlertCircle className="text-yellow-600 dark:text-yellow-400 mt-0.5" size={20} />
                  <div>
                    <h3 className="font-semibold text-yellow-800 dark:text-yellow-300">Data Management Warning</h3>
                    <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                      Deleting old logs is permanent and cannot be undone. Make sure to backup important data before enabling auto-deletion.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Security Settings</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <FiLock className="inline mr-2" />
                    Session Timeout
                  </label>
                  <select
                    value={settings.sessionTimeout}
                    onChange={(e) => setSettings({ ...settings, sessionTimeout: Number(e.target.value) })}
                    className="custom-settings-dropdown w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-medium"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={60}>1 hour</option>
                    <option value={120}>2 hours</option>
                    <option value={480}>8 hours</option>
                  </select>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Auto-logout after inactivity
                  </p>
                </div>

                <div>
                  <label className="flex items-center justify-between p-4 rounded-xl border-2 border-gray-300 dark:border-gray-600 cursor-pointer bg-gray-50 dark:bg-gray-700/50">
                    <div>
                      <div className="font-semibold text-gray-800 dark:text-white">Require Password Change</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Periodic password updates</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.requirePasswordChange}
                      onChange={(e) => setSettings({ ...settings, requirePasswordChange: e.target.checked })}
                      className="w-5 h-5 rounded"
                    />
                  </label>
                </div>

                <div>
                  <label className="flex items-center justify-between p-4 rounded-xl border-2 border-gray-300 dark:border-gray-600 cursor-pointer bg-gray-50 dark:bg-gray-700/50">
                    <div>
                      <div className="font-semibold text-gray-800 dark:text-white">Two-Factor Authentication</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Extra security layer</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.enableTwoFactor}
                      onChange={(e) => setSettings({ ...settings, enableTwoFactor: e.target.checked })}
                      className="w-5 h-5 rounded"
                    />
                  </label>
                </div>

                <div>
                  <label className="flex items-center justify-between p-4 rounded-xl border-2 border-gray-300 dark:border-gray-600 cursor-pointer bg-gray-50 dark:bg-gray-700/50">
                    <div>
                      <div className="font-semibold text-gray-800 dark:text-white">Log Security Events</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Track security activities</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.logSecurityEvents}
                      onChange={(e) => setSettings({ ...settings, logSecurityEvents: e.target.checked })}
                      className="w-5 h-5 rounded"
                    />
                  </label>
                </div>
              </div>

              <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-600 rounded-xl p-4">
                <div className="flex items-start space-x-3">
                  <FiShield className="text-red-600 dark:text-red-400 mt-0.5" size={20} />
                  <div>
                    <h3 className="font-semibold text-red-800 dark:text-red-300">Security Recommendation</h3>
                    <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                      We strongly recommend enabling two-factor authentication and using strong, unique passwords for enhanced security.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Export Tab */}
          {activeTab === 'export' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Export Settings</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Default Export Format
                  </label>
                  <select
                    value={settings.defaultExportFormat}
                    onChange={(e) => setSettings({ ...settings, defaultExportFormat: e.target.value })}
                    className="custom-settings-dropdown w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-medium"
                  >
                    <option value="csv">CSV (Comma Separated)</option>
                    <option value="excel">Excel (XLSX)</option>
                    <option value="json">JSON</option>
                    <option value="pdf">PDF Report</option>
                  </select>
                </div>

                <div>
                  <label className="flex items-center justify-between p-4 rounded-xl border-2 border-gray-300 dark:border-gray-600 cursor-pointer bg-gray-50 dark:bg-gray-700/50">
                    <div>
                      <div className="font-semibold text-gray-800 dark:text-white">Include Images</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Attach face images in exports</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.includeImages}
                      onChange={(e) => setSettings({ ...settings, includeImages: e.target.checked })}
                      className="w-5 h-5 rounded"
                    />
                  </label>
                </div>

                <div>
                  <label className="flex items-center justify-between p-4 rounded-xl border-2 border-gray-300 dark:border-gray-600 cursor-pointer bg-gray-50 dark:bg-gray-700/50">
                    <div>
                      <div className="font-semibold text-gray-800 dark:text-white">Compress Exports</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Create ZIP archives</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.compressExports}
                      onChange={(e) => setSettings({ ...settings, compressExports: e.target.checked })}
                      className="w-5 h-5 rounded"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* System Info */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6 flex items-center">
          <FiSettings className="mr-2" />
          System Information
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl border border-blue-200 dark:border-blue-700">
            <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
              <FiUser className="mr-2" />
              Application Name
            </p>
            <p className="text-lg font-semibold text-gray-800 dark:text-white mt-1">IntelliSight FYP</p>
          </div>
          
          <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200 dark:border-green-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">Version</p>
            <p className="text-lg font-semibold text-gray-800 dark:text-white mt-1">1.0.0</p>
          </div>
          
          <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl border border-purple-200 dark:border-purple-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">Build</p>
            <p className="text-lg font-semibold text-gray-800 dark:text-white mt-1">Production</p>
          </div>
          
          <div className="p-4 bg-gradient-to-br from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 rounded-xl border border-orange-200 dark:border-orange-700 md:col-span-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">Current API URL</p>
            <p className="text-sm font-mono text-gray-800 dark:text-white break-all mt-1">{settings.apiBaseUrl}</p>
          </div>
          
          <div className="p-4 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-xl border border-indigo-200 dark:border-indigo-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">Update Interval</p>
            <p className="text-lg font-semibold text-gray-800 dark:text-white mt-1">{settings.pollingInterval / 1000}s</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
