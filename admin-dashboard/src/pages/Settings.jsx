/**
 * Settings Page
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  FiSettings, FiSave, FiMoon, FiSun, FiBell, FiShield,
  FiDatabase, FiDownload, FiGlobe, FiEye, FiClock,
  FiAlertCircle, FiRefreshCw, FiMonitor, FiUser, FiLock, FiCheck,
  FiSend, FiXCircle, FiKey,
} from 'react-icons/fi';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { accessRequestAPI, rolesAPI } from '../api/api';

const STORAGE_KEY = 'intellisight_settings';

const DEFAULT_SETTINGS = {
  language: 'en',
  timezone: 'Asia/Karachi',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '24h',
  pollingInterval: 5000,
  apiBaseUrl: 'http://localhost:3000/api',
  apiTimeout: 30000,
  enableNotifications: true,
  notifyNewDetections: true,
  notifyUnknownFaces: true,
  notifySystemAlerts: true,
  emailNotifications: false,
  notificationSound: true,
  recognitionThreshold: 0.6,
  detectionInterval: 5000,
  maxFacesPerFrame: 10,
  enableLivePreview: true,
  autoEnroll: false,
  videoQuality: 'high',
  frameRate: 30,
  enableMotionDetection: false,
  recordUnknownFaces: true,
  autoDeleteOldLogs: true,
  logRetentionDays: 30,
  maxStorageSize: 5000,
  enableDataBackup: false,
  sessionTimeout: 30,
  requirePasswordChange: false,
  enableTwoFactor: false,
  logSecurityEvents: true,
  showWelcomeMessage: true,
  compactMode: false,
  animationsEnabled: true,
  showStatistics: true,
  defaultExportFormat: 'csv',
  includeImages: true,
  compressExports: true,
};

function loadSettings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

const CAT_COLORS = {
  General:             { text: '#6366f1', bg: 'rgba(99,102,241,.08)',  border: 'rgba(99,102,241,.25)'  },
  Monitoring:          { text: '#06b6d4', bg: 'rgba(6,182,212,.08)',   border: 'rgba(6,182,212,.25)'   },
  'People Management': { text: '#22c55e', bg: 'rgba(34,197,94,.08)',   border: 'rgba(34,197,94,.25)'   },
  Infrastructure:      { text: '#f97316', bg: 'rgba(249,115,22,.08)',  border: 'rgba(249,115,22,.25)'  },
  System:              { text: '#a855f7', bg: 'rgba(168,85,247,.08)',  border: 'rgba(168,85,247,.25)'  },
};

const STATUS_CONFIG = {
  pending:  { icon: FiClock,   color: '#f59e0b', bg: 'rgba(245,158,11,.1)',  border: 'rgba(245,158,11,.3)',  label: 'Pending'  },
  approved: { icon: FiCheck,   color: '#22c55e', bg: 'rgba(34,197,94,.1)',   border: 'rgba(34,197,94,.3)',   label: 'Approved' },
  rejected: { icon: FiXCircle, color: '#ef4444', bg: 'rgba(239,68,68,.1)',   border: 'rgba(239,68,68,.3)',   label: 'Rejected' },
};

const Settings = () => {
  const { isDarkMode, toggleTheme } = useTheme();
  const { user, hasPermission }     = useAuth();
  const isSuperAdmin = user?.isSuperAdmin === true;

  const [activeTab,   setActiveTab]   = useState('appearance');
  const [saveStatus,  setSaveStatus]  = useState('idle');
  const [settings,    setSettings]    = useState(loadSettings);

  // ── Access & Permissions tab state ──────────────────────────────────────────
  const [allPerms,       setAllPerms]       = useState([]);
  const [myRequests,     setMyRequests]     = useState([]);
  const [accessLoading,  setAccessLoading]  = useState(false);
  const [accessLoaded,   setAccessLoaded]   = useState(false);
  const [accessChecked,  setAccessChecked]  = useState(new Set());
  const [accessMessage,  setAccessMessage]  = useState('');
  const [submitting,     setSubmitting]     = useState(false);
  const [accessFlash,    setAccessFlash]    = useState(null);

  // Apply compact mode
  useEffect(() => {
    if (settings.compactMode) document.documentElement.classList.add('compact');
    else                       document.documentElement.classList.remove('compact');
  }, [settings.compactMode]);

  // Apply animation preference
  useEffect(() => {
    if (!settings.animationsEnabled) document.documentElement.classList.add('no-animations');
    else                              document.documentElement.classList.remove('no-animations');
  }, [settings.animationsEnabled]);

  // Lazy-load access data when tab first opens
  useEffect(() => {
    if (activeTab !== 'access' || accessLoaded || isSuperAdmin) return;
    setAccessLoading(true);
    Promise.all([
      rolesAPI.listPermissions(),
      accessRequestAPI.getMyRequests(),
    ]).then(([permsRes, reqRes]) => {
      setAllPerms(permsRes.data ?? []);
      setMyRequests(reqRes.data ?? []);
      setAccessLoaded(true);
    }).catch(() => {}).finally(() => setAccessLoading(false));
  }, [activeTab, accessLoaded, isSuperAdmin]);

  const missingPerms = useMemo(
    () => allPerms.filter((p) => !hasPermission(p.Key)),
    [allPerms, hasPermission],
  );

  const byCategory = useMemo(() => {
    const map = {};
    for (const p of missingPerms) (map[p.Category] ??= []).push(p);
    return map;
  }, [missingPerms]);

  const requestStatusMap = useMemo(() => {
    const map = {};
    for (const r of myRequests) {
      if (!map[r.Permission_Key] || new Date(r.RequestedAt) > new Date(map[r.Permission_Key].RequestedAt)) {
        map[r.Permission_Key] = r;
      }
    }
    return map;
  }, [myRequests]);

  const showAccessFlash = (type, text) => {
    setAccessFlash({ type, text });
    setTimeout(() => setAccessFlash(null), 4000);
  };

  const toggleAccessPerm = (key) => {
    setAccessChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleAccessSubmit = async () => {
    if (!accessChecked.size) return;
    try {
      setSubmitting(true);
      await accessRequestAPI.submit([...accessChecked], accessMessage);
      const res = await accessRequestAPI.getMyRequests();
      setMyRequests(res.data ?? []);
      setAccessChecked(new Set());
      setAccessMessage('');
      showAccessFlash('ok', 'Request submitted! The admin will review it shortly.');
    } catch (err) {
      showAccessFlash('err', err.response?.data?.message || 'Failed to submit request.');
    } finally {
      setSubmitting(false);
    }
  };

  const set = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));

  const handleSave = () => {
    setSaveStatus('saving');
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch {}
    setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 600);
  };

  const handleReset = () => {
    if (!window.confirm('Reset all settings to default values?')) return;
    const defaults = { ...DEFAULT_SETTINGS };
    setSettings(defaults);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
    setSaveStatus('reset');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const tabs = [
    { id: 'appearance',    label: 'Appearance',      icon: FiMonitor  },
    { id: 'general',       label: 'General',          icon: FiSettings },
    { id: 'notifications', label: 'Notifications',    icon: FiBell     },
    { id: 'recognition',   label: 'Face Recognition', icon: FiEye      },
    { id: 'camera',        label: 'Camera',           icon: FiMonitor  },
    { id: 'data',          label: 'Data Management',  icon: FiDatabase },
    { id: 'security',      label: 'Security',         icon: FiShield   },
    { id: 'export',        label: 'Export',           icon: FiDownload },
    ...(!isSuperAdmin ? [{ id: 'access', label: 'Access & Permissions', icon: FiKey }] : []),
  ];

  const inputCls  = 'w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-medium focus:outline-none focus:border-blue-500 dark:focus:border-cyan-400 transition';
  const selectCls = inputCls + ' cursor-pointer';
  const checkRowCls = 'flex items-center justify-between p-4 rounded-xl border-2 border-gray-300 dark:border-gray-600 cursor-pointer bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition';

  const saveLabel = saveStatus === 'saving' ? 'Saving…'
    : saveStatus === 'saved' ? 'Saved!'
    : saveStatus === 'reset' ? 'Reset!'
    : 'Save Changes';

  const D = isDarkMode;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-display font-black" style={{ color: D ? '#c0f0f0' : '#003d82' }}>
            Settings
          </h1>
          <p className="mt-2" style={{ color: D ? 'rgba(192,240,240,0.6)' : '#6b7280' }}>
            Manage your application preferences and configuration
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleReset}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl font-semibold transition border hover:bg-gray-100 dark:hover:bg-gray-700"
            style={{ borderColor: D ? '#475569' : '#cbd5e1', color: D ? '#94a3b8' : '#475569' }}
          >
            <FiRefreshCw size={18} />
            <span>Reset</span>
          </button>

          <button
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            className="flex items-center space-x-2 px-6 py-2 rounded-xl font-semibold transition"
            style={{
              backgroundColor: saveStatus === 'saved' || saveStatus === 'reset' ? '#16a34a' : (D ? '#003d82' : '#305796'),
              color: '#fff',
              opacity: saveStatus === 'saving' ? 0.7 : 1,
            }}
          >
            {saveStatus === 'saved' || saveStatus === 'reset' ? <FiCheck size={18} /> : <FiSave size={18} />}
            <span>{saveLabel}</span>
          </button>
        </div>
      </div>

      {saveStatus === 'idle' && (
        <p className="text-xs text-gray-400 dark:text-gray-500 -mt-2">
          Changes are not saved until you click <strong>Save Changes</strong>.
        </p>
      )}

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
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-6 py-4 font-semibold transition whitespace-nowrap ${
                  active ? 'border-b-2' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
                style={{
                  borderColor: active ? (D ? '#00ffff' : '#003d82') : 'transparent',
                  color: active ? (D ? '#00ffff' : '#003d82') : undefined,
                  backgroundColor: active ? (D ? 'rgba(0,255,255,0.05)' : 'rgba(0,61,130,0.05)') : 'transparent',
                }}
              >
                <Icon size={18} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="p-6">

          {/* ── Appearance ──────────────────────────────────────── */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Appearance Settings</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Theme Mode</label>
                  <button
                    onClick={toggleTheme}
                    className="w-full flex items-center justify-between px-6 py-4 rounded-xl transition-all font-semibold border-2 hover:opacity-90"
                    style={{
                      backgroundColor: D ? '#1e293b' : '#f8fafc',
                      borderColor: D ? '#00ffff' : '#305796',
                      color: D ? '#00ffff' : '#305796',
                    }}
                  >
                    <div className="flex items-center space-x-3">
                      {D ? <FiMoon size={22} /> : <FiSun size={22} />}
                      <span>{D ? 'Dark Mode' : 'Light Mode'}</span>
                    </div>
                    <span className="text-sm opacity-70">Click to toggle</span>
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Compact Mode</label>
                  <label className={checkRowCls}>
                    <span className="font-semibold text-gray-800 dark:text-white">Reduce spacing</span>
                    <input type="checkbox" checked={settings.compactMode}
                      onChange={e => set('compactMode', e.target.checked)} className="w-5 h-5 rounded accent-blue-600" />
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Enable Animations</label>
                  <label className={checkRowCls}>
                    <span className="font-semibold text-gray-800 dark:text-white">Smooth transitions</span>
                    <input type="checkbox" checked={settings.animationsEnabled}
                      onChange={e => set('animationsEnabled', e.target.checked)} className="w-5 h-5 rounded accent-blue-600" />
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Show Statistics</label>
                  <label className={checkRowCls}>
                    <span className="font-semibold text-gray-800 dark:text-white">Dashboard stats</span>
                    <input type="checkbox" checked={settings.showStatistics}
                      onChange={e => set('showStatistics', e.target.checked)} className="w-5 h-5 rounded accent-blue-600" />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ── General ─────────────────────────────────────────── */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">General Settings</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <FiGlobe className="inline mr-2" />Language
                  </label>
                  <select value={settings.language} onChange={e => set('language', e.target.value)} className={selectCls}>
                    <option value="en">English</option>
                    <option value="ur">اردو (Urdu)</option>
                    <option value="ar">العربية (Arabic)</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                    <option value="de">Deutsch</option>
                  </select>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Select your preferred language</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <FiClock className="inline mr-2" />Timezone
                  </label>
                  <select value={settings.timezone} onChange={e => set('timezone', e.target.value)} className={selectCls}>
                    <option value="Asia/Karachi">Asia/Karachi (PKT)</option>
                    <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                    <option value="Europe/London">Europe/London (GMT)</option>
                    <option value="America/New_York">America/New York (EST)</option>
                    <option value="America/Los_Angeles">America/Los Angeles (PST)</option>
                    <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Date Format</label>
                  <select value={settings.dateFormat} onChange={e => set('dateFormat', e.target.value)} className={selectCls}>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Time Format</label>
                  <select value={settings.timeFormat} onChange={e => set('timeFormat', e.target.value)} className={selectCls}>
                    <option value="12h">12-hour (AM/PM)</option>
                    <option value="24h">24-hour</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">API Base URL</label>
                  <input type="text" value={settings.apiBaseUrl}
                    onChange={e => set('apiBaseUrl', e.target.value)}
                    className={inputCls + ' font-mono text-sm'}
                    placeholder="http://localhost:3000/api" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Real-time Update Interval</label>
                  <select value={settings.pollingInterval} onChange={e => set('pollingInterval', Number(e.target.value))} className={selectCls}>
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

          {/* ── Notifications ───────────────────────────────────── */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Notification Settings</h2>
              <div className="space-y-4">
                {[
                  { key: 'enableNotifications',  label: 'Enable All Notifications', desc: 'Master toggle for all notification types' },
                  { key: 'notifyNewDetections',   label: 'New Face Detections',       desc: 'Alert when new faces are detected' },
                  { key: 'notifyUnknownFaces',    label: 'Unknown Faces Alert',        desc: 'Notify when unrecognized faces appear' },
                  { key: 'notifySystemAlerts',    label: 'System Alerts',              desc: 'Important system and error notifications' },
                  { key: 'emailNotifications',    label: 'Email Notifications',        desc: 'Send notifications via email' },
                  { key: 'notificationSound',     label: 'Notification Sounds',        desc: 'Play sound for notifications' },
                ].map(item => (
                  <label key={item.key} className={checkRowCls}>
                    <div className="flex items-start space-x-3">
                      <FiBell className="mt-1 text-blue-600 dark:text-cyan-400" size={20} />
                      <div>
                        <div className="font-semibold text-gray-800 dark:text-white">{item.label}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">{item.desc}</div>
                      </div>
                    </div>
                    <input type="checkbox" checked={settings[item.key]}
                      onChange={e => set(item.key, e.target.checked)} className="w-5 h-5 rounded accent-blue-600" />
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* ── Face Recognition ────────────────────────────────── */}
          {activeTab === 'recognition' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Face Recognition Settings</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Recognition Threshold</label>
                  <input type="range" min="0.3" max="0.9" step="0.05"
                    value={settings.recognitionThreshold}
                    onChange={e => set('recognitionThreshold', parseFloat(e.target.value))}
                    className="w-full accent-blue-600" />
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mt-1">
                    <span>Less Strict (0.3)</span>
                    <span className="font-bold text-blue-600 dark:text-cyan-400">{settings.recognitionThreshold}</span>
                    <span>More Strict (0.9)</span>
                  </div>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Higher values reduce false positives but may miss valid matches</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Detection Interval</label>
                  <select value={settings.detectionInterval} onChange={e => set('detectionInterval', Number(e.target.value))} className={selectCls}>
                    <option value={1000}>1 second (High CPU)</option>
                    <option value={3000}>3 seconds</option>
                    <option value={5000}>5 seconds (Recommended)</option>
                    <option value={10000}>10 seconds</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Max Faces Per Frame</label>
                  <input type="number" min="1" max="20"
                    value={settings.maxFacesPerFrame}
                    onChange={e => set('maxFacesPerFrame', parseInt(e.target.value))}
                    className={inputCls} />
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Maximum number of faces to detect in each frame</p>
                </div>

                <div>
                  <label className={checkRowCls}>
                    <div>
                      <div className="font-semibold text-gray-800 dark:text-white">Enable Live Preview</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Show real-time detection</div>
                    </div>
                    <input type="checkbox" checked={settings.enableLivePreview}
                      onChange={e => set('enableLivePreview', e.target.checked)} className="w-5 h-5 rounded accent-blue-600" />
                  </label>
                </div>

                <div>
                  <label className={checkRowCls}>
                    <div>
                      <div className="font-semibold text-gray-800 dark:text-white">Auto-Enroll Unknown</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Automatically enroll detected faces</div>
                    </div>
                    <input type="checkbox" checked={settings.autoEnroll}
                      onChange={e => set('autoEnroll', e.target.checked)} className="w-5 h-5 rounded accent-blue-600" />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ── Camera ──────────────────────────────────────────── */}
          {activeTab === 'camera' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Camera Settings</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Video Quality</label>
                  <select value={settings.videoQuality} onChange={e => set('videoQuality', e.target.value)} className={selectCls}>
                    <option value="low">Low (480p)</option>
                    <option value="medium">Medium (720p)</option>
                    <option value="high">High (1080p)</option>
                    <option value="ultra">Ultra (4K)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Frame Rate</label>
                  <select value={settings.frameRate} onChange={e => set('frameRate', Number(e.target.value))} className={selectCls}>
                    <option value={15}>15 FPS</option>
                    <option value={24}>24 FPS</option>
                    <option value={30}>30 FPS</option>
                    <option value={60}>60 FPS</option>
                  </select>
                </div>

                <div>
                  <label className={checkRowCls}>
                    <div>
                      <div className="font-semibold text-gray-800 dark:text-white">Motion Detection</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Activate on movement only</div>
                    </div>
                    <input type="checkbox" checked={settings.enableMotionDetection}
                      onChange={e => set('enableMotionDetection', e.target.checked)} className="w-5 h-5 rounded accent-blue-600" />
                  </label>
                </div>

                <div>
                  <label className={checkRowCls}>
                    <div>
                      <div className="font-semibold text-gray-800 dark:text-white">Record Unknown Faces</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Save images of unrecognized faces</div>
                    </div>
                    <input type="checkbox" checked={settings.recordUnknownFaces}
                      onChange={e => set('recordUnknownFaces', e.target.checked)} className="w-5 h-5 rounded accent-blue-600" />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ── Data Management ─────────────────────────────────── */}
          {activeTab === 'data' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Data Management</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                <div>
                  <label className={checkRowCls}>
                    <div>
                      <div className="font-semibold text-gray-800 dark:text-white">Auto-Delete Old Logs</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Automatically remove old records</div>
                    </div>
                    <input type="checkbox" checked={settings.autoDeleteOldLogs}
                      onChange={e => set('autoDeleteOldLogs', e.target.checked)} className="w-5 h-5 rounded accent-blue-600" />
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Log Retention Period</label>
                  <select value={settings.logRetentionDays} onChange={e => set('logRetentionDays', Number(e.target.value))}
                    disabled={!settings.autoDeleteOldLogs} className={selectCls + (!settings.autoDeleteOldLogs ? ' opacity-50 cursor-not-allowed' : '')}>
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Max Storage Size (MB)</label>
                  <input type="number" min="100" max="50000" step="100"
                    value={settings.maxStorageSize}
                    onChange={e => set('maxStorageSize', parseInt(e.target.value))}
                    className={inputCls} />
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Current: {(settings.maxStorageSize / 1024).toFixed(2)} GB
                  </p>
                </div>

                <div>
                  <label className={checkRowCls}>
                    <div>
                      <div className="font-semibold text-gray-800 dark:text-white">Enable Data Backup</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Automatic daily backups</div>
                    </div>
                    <input type="checkbox" checked={settings.enableDataBackup}
                      onChange={e => set('enableDataBackup', e.target.checked)} className="w-5 h-5 rounded accent-blue-600" />
                  </label>
                </div>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-300 dark:border-yellow-600 rounded-xl p-4">
                <div className="flex items-start space-x-3">
                  <FiAlertCircle className="text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" size={20} />
                  <div>
                    <h3 className="font-semibold text-yellow-800 dark:text-yellow-300">Data Management Warning</h3>
                    <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                      Deleting old logs is permanent and cannot be undone. Back up important data before enabling auto-deletion.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Security ────────────────────────────────────────── */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Security Settings</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <FiLock className="inline mr-2" />Session Timeout
                  </label>
                  <select value={settings.sessionTimeout} onChange={e => set('sessionTimeout', Number(e.target.value))} className={selectCls}>
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={60}>1 hour</option>
                    <option value={120}>2 hours</option>
                    <option value={480}>8 hours</option>
                  </select>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Auto-logout after inactivity</p>
                </div>

                {[
                  { key: 'requirePasswordChange', label: 'Require Password Change', desc: 'Periodic password updates' },
                  { key: 'enableTwoFactor',       label: 'Two-Factor Authentication', desc: 'Extra security layer' },
                  { key: 'logSecurityEvents',     label: 'Log Security Events',        desc: 'Track security activities' },
                ].map(item => (
                  <div key={item.key}>
                    <label className={checkRowCls}>
                      <div>
                        <div className="font-semibold text-gray-800 dark:text-white">{item.label}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">{item.desc}</div>
                      </div>
                      <input type="checkbox" checked={settings[item.key]}
                        onChange={e => set(item.key, e.target.checked)} className="w-5 h-5 rounded accent-blue-600" />
                    </label>
                  </div>
                ))}
              </div>

              <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-600 rounded-xl p-4">
                <div className="flex items-start space-x-3">
                  <FiShield className="text-red-600 dark:text-red-400 mt-0.5 shrink-0" size={20} />
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

          {/* ── Export ──────────────────────────────────────────── */}
          {activeTab === 'export' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Export Settings</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Default Export Format</label>
                  <select value={settings.defaultExportFormat} onChange={e => set('defaultExportFormat', e.target.value)} className={selectCls}>
                    <option value="csv">CSV (Comma Separated)</option>
                    <option value="excel">Excel (XLSX)</option>
                    <option value="json">JSON</option>
                    <option value="pdf">PDF Report</option>
                  </select>
                </div>

                {[
                  { key: 'includeImages',   label: 'Include Images',   desc: 'Attach face images in exports' },
                  { key: 'compressExports', label: 'Compress Exports', desc: 'Create ZIP archives' },
                ].map(item => (
                  <div key={item.key}>
                    <label className={checkRowCls}>
                      <div>
                        <div className="font-semibold text-gray-800 dark:text-white">{item.label}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">{item.desc}</div>
                      </div>
                      <input type="checkbox" checked={settings[item.key]}
                        onChange={e => set(item.key, e.target.checked)} className="w-5 h-5 rounded accent-blue-600" />
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Access & Permissions ────────────────────────────── */}
          {activeTab === 'access' && (
            <div className="space-y-6">
              {/* Section header */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                    <FiKey className="text-blue-600 dark:text-cyan-400" />
                    Access &amp; Permissions
                  </h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Request additional permissions from the Super Admin. Selected permissions are sent as a review request.
                  </p>
                </div>
              </div>

              {/* Flash message */}
              {accessFlash && (
                <div
                  className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium"
                  style={{
                    background: accessFlash.type === 'ok'
                      ? (D ? 'rgba(34,197,94,.12)' : 'rgba(34,197,94,.08)')
                      : (D ? 'rgba(239,68,68,.12)' : 'rgba(239,68,68,.08)'),
                    border: `1px solid ${accessFlash.type === 'ok' ? 'rgba(34,197,94,.35)' : 'rgba(239,68,68,.35)'}`,
                    color: accessFlash.type === 'ok'
                      ? (D ? '#86efac' : '#15803d')
                      : (D ? '#fca5a5' : '#dc2626'),
                  }}
                >
                  {accessFlash.type === 'ok' ? <FiCheck size={15} /> : <FiXCircle size={15} />}
                  {accessFlash.text}
                </div>
              )}

              {/* Loading */}
              {accessLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    border: '3px solid rgba(59,130,246,.2)',
                    borderTopColor: D ? '#06b6d4' : '#3b82f6',
                    animation: 'spin .8s linear infinite',
                  }} />
                  <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                </div>
              ) : missingPerms.length === 0 ? (
                /* Full access state */
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                    style={{ background: D ? 'rgba(34,197,94,.12)' : 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.3)' }}>
                    <FiShield size={28} style={{ color: '#22c55e' }} />
                  </div>
                  <p className="text-lg font-bold text-gray-800 dark:text-white">You have full access</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">No additional permissions are available to request.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Permission groups */}
                  {Object.entries(byCategory).map(([cat, perms]) => {
                    const catStyle = CAT_COLORS[cat] ?? { text: '#64748b', bg: 'rgba(100,116,139,.08)', border: 'rgba(100,116,139,.25)' };
                    return (
                      <div key={cat} className="rounded-xl overflow-hidden border"
                        style={{ borderColor: D ? 'rgba(255,255,255,.07)' : 'rgba(15,23,42,.08)' }}>
                        {/* Category header */}
                        <div className="flex items-center gap-2 px-4 py-3"
                          style={{ background: catStyle.bg, borderBottom: `1px solid ${catStyle.border}` }}>
                          <div className="w-2 h-2 rounded-full" style={{ background: catStyle.text }} />
                          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: catStyle.text }}>
                            {cat}
                          </span>
                          <span className="ml-auto text-xs font-medium" style={{ color: catStyle.text, opacity: .7 }}>
                            {perms.length} permission{perms.length !== 1 ? 's' : ''}
                          </span>
                        </div>

                        {/* Permission rows */}
                        <div className="divide-y" style={{ divideColor: D ? 'rgba(255,255,255,.04)' : 'rgba(15,23,42,.05)' }}>
                          {perms.map((perm) => {
                            const isChecked  = accessChecked.has(perm.Key);
                            const reqStatus  = requestStatusMap[perm.Key];
                            const SC         = reqStatus ? STATUS_CONFIG[reqStatus.Status] : null;

                            return (
                              <label
                                key={perm.Key}
                                className="flex items-center gap-4 px-4 py-3 cursor-pointer transition-colors"
                                style={{
                                  background: isChecked
                                    ? (D ? 'rgba(6,182,212,.07)' : 'rgba(59,130,246,.05)')
                                    : (D ? 'rgba(255,255,255,.01)' : '#fff'),
                                }}
                              >
                                {/* Custom checkbox */}
                                <div
                                  className="w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center transition-all"
                                  style={{
                                    background: isChecked ? (D ? '#06b6d4' : '#3b82f6') : 'transparent',
                                    border: `2px solid ${isChecked ? (D ? '#06b6d4' : '#3b82f6') : (D ? 'rgba(255,255,255,.25)' : 'rgba(0,0,0,.2)')}`,
                                  }}
                                >
                                  {isChecked && <FiCheck size={10} style={{ color: '#fff', strokeWidth: 3 }} />}
                                </div>
                                <input type="checkbox" className="sr-only" checked={isChecked} onChange={() => toggleAccessPerm(perm.Key)} />

                                {/* Text */}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-gray-800 dark:text-white">{perm.Name}</p>
                                  {perm.Description && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{perm.Description}</p>
                                  )}
                                </div>

                                {/* Status badge */}
                                {SC && (
                                  <div
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg flex-shrink-0 text-[11px] font-semibold"
                                    style={{ background: SC.bg, border: `1px solid ${SC.border}`, color: SC.color }}
                                  >
                                    <SC.icon size={11} />
                                    {SC.label}
                                  </div>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {/* Message + submit */}
                  <div className="rounded-xl border p-4 space-y-4"
                    style={{
                      background: D ? 'rgba(255,255,255,.02)' : 'rgba(248,250,252,.9)',
                      borderColor: D ? 'rgba(255,255,255,.07)' : 'rgba(15,23,42,.08)',
                    }}>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Message to Admin <span className="font-normal opacity-60">(optional)</span>
                      </label>
                      <textarea
                        rows={3}
                        value={accessMessage}
                        onChange={(e) => setAccessMessage(e.target.value)}
                        placeholder="Briefly explain why you need this access…"
                        className="w-full px-4 py-3 rounded-xl text-sm resize-none border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-cyan-400 transition"
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <p className="flex-1 text-xs text-gray-500 dark:text-gray-400">
                        {accessChecked.size === 0
                          ? 'Select at least one permission above to send a request.'
                          : `${accessChecked.size} permission${accessChecked.size > 1 ? 's' : ''} selected`}
                      </p>
                      <button
                        onClick={handleAccessSubmit}
                        disabled={!accessChecked.size || submitting}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{
                          background: D ? 'rgba(6,182,212,.15)' : 'rgba(59,130,246,.12)',
                          border: D ? '1px solid rgba(6,182,212,.4)' : '1px solid rgba(59,130,246,.4)',
                          color: D ? '#67e8f9' : '#2563eb',
                        }}
                      >
                        <FiSend size={14} />
                        {submitting ? 'Sending…' : 'Send Request'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Recent request history */}
              {myRequests.length > 0 && !accessLoading && (
                <div>
                  <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <FiClock size={14} />
                    Recent Requests
                  </h3>
                  <div className="space-y-2">
                    {[...myRequests]
                      .sort((a, b) => new Date(b.RequestedAt) - new Date(a.RequestedAt))
                      .slice(0, 10)
                      .map((req) => {
                        const SC  = STATUS_CONFIG[req.Status] ?? STATUS_CONFIG.pending;
                        const perm = allPerms.find((p) => p.Key === req.Permission_Key);
                        return (
                          <div
                            key={req.Request_ID}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl"
                            style={{
                              background: D ? 'rgba(255,255,255,.03)' : 'rgba(248,250,252,.9)',
                              border: D ? '1px solid rgba(255,255,255,.06)' : '1px solid rgba(15,23,42,.08)',
                            }}
                          >
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ background: SC.bg, border: `1px solid ${SC.border}` }}
                            >
                              <SC.icon size={14} style={{ color: SC.color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">
                                {perm?.Name ?? req.Permission_Key}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {new Date(req.RequestedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                                {req.ReviewNote && ` · ${req.ReviewNote}`}
                              </p>
                            </div>
                            <span
                              className="text-[11px] font-bold px-2.5 py-1 rounded-lg flex-shrink-0"
                              style={{ background: SC.bg, border: `1px solid ${SC.border}`, color: SC.color }}
                            >
                              {SC.label}
                            </span>
                          </div>
                        );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* System Info */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6 flex items-center">
          <FiSettings className="mr-2" />System Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl border border-blue-200 dark:border-blue-700">
            <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center"><FiUser className="mr-2" />Application Name</p>
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
