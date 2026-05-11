import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  FaShieldAlt, FaTachometerAlt, FaPlus, FaTrash, FaSave,
  FaUserTag, FaMoon, FaSun, FaUserCircle, FaChevronDown,
  FaSignOutAlt, FaUsers, FaCheckCircle, FaTimesCircle,
} from 'react-icons/fa';
import { rolesAPI } from '../api/api';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';

// ── Category accent colours ───────────────────────────────────────────────────
const CAT_DARK = {
  General:            { bg: 'rgba(99,102,241,.1)',  border: 'rgba(99,102,241,.4)',  label: '#818cf8' },
  Monitoring:         { bg: 'rgba(6,182,212,.1)',   border: 'rgba(6,182,212,.4)',   label: '#67e8f9' },
  'People Management':{ bg: 'rgba(34,197,94,.1)',   border: 'rgba(34,197,94,.4)',   label: '#86efac' },
  Infrastructure:     { bg: 'rgba(251,146,60,.1)',  border: 'rgba(251,146,60,.4)',  label: '#fdba74' },
  System:             { bg: 'rgba(168,85,247,.1)',  border: 'rgba(168,85,247,.4)', label: '#d8b4fe' },
};
const CAT_LIGHT = {
  General:            { bg: 'rgba(99,102,241,.08)', border: 'rgba(99,102,241,.35)', label: '#4f46e5' },
  Monitoring:         { bg: 'rgba(6,182,212,.08)',  border: 'rgba(6,182,212,.35)',  label: '#0891b2' },
  'People Management':{ bg: 'rgba(34,197,94,.08)',  border: 'rgba(34,197,94,.35)',  label: '#15803d' },
  Infrastructure:     { bg: 'rgba(251,146,60,.08)', border: 'rgba(251,146,60,.35)', label: '#c2410c' },
  System:             { bg: 'rgba(168,85,247,.08)', border: 'rgba(168,85,247,.35)',label: '#7e22ce' },
};

const catColor = (cat, light) => (light ? CAT_LIGHT : CAT_DARK)[cat] ?? {
  bg: 'rgba(107,114,128,.1)', border: 'rgba(107,114,128,.4)', label: '#9ca3af',
};

// ── RolesPermissions page ─────────────────────────────────────────────────────
const RolesPermissions = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [isLight, setIsLight] = useState(
    window.matchMedia?.('(prefers-color-scheme: light)').matches ?? false,
  );
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Data
  const [roles, setRoles]             = useState([]);
  const [allPerms, setAllPerms]       = useState([]);
  const [admins, setAdmins]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState('');

  // Selected role & its checked permissions
  const [selectedRole, setSelectedRole]     = useState(null);
  const [checkedKeys, setCheckedKeys]       = useState(new Set());
  const [savingPerms, setSavingPerms]       = useState(false);

  // Create role form
  const [showCreate, setShowCreate]         = useState(false);
  const [newName, setNewName]               = useState('');
  const [newDesc, setNewDesc]               = useState('');
  const [creating, setCreating]             = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget]     = useState(null);
  const [deleting, setDeleting]             = useState(false);

  // Assign role to admin
  const [assignAdminId, setAssignAdminId]   = useState('');
  const [assignRoleId, setAssignRoleId]     = useState('');
  const [assigning, setAssigning]           = useState(false);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('.profile-menu-wrap')) setShowProfileMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Load all data ─────────────────────────────────────────────────────────
  const loadAll = async () => {
    try {
      setLoading(true);
      setError('');
      const [rolesRes, permsRes, adminsRes] = await Promise.all([
        rolesAPI.listRoles(),
        rolesAPI.listPermissions(),
        api.get('/auth/admin/all'),
      ]);
      setRoles(rolesRes.data ?? []);
      setAllPerms(permsRes.data ?? []);
      setAdmins(adminsRes.data?.data?.admins ?? []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  // Sync checked keys when selected role changes
  useEffect(() => {
    if (selectedRole) {
      setCheckedKeys(new Set(selectedRole.permissions ?? []));
    }
  }, [selectedRole]);

  // Group permissions by category
  const permsByCategory = useMemo(() => {
    const map = {};
    for (const p of allPerms) {
      (map[p.Category] ??= []).push(p);
    }
    return map;
  }, [allPerms]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const flash = (msg, isErr = false) => {
    if (isErr) { setError(msg); setTimeout(() => setError(''), 4000); }
    else        { setSuccess(msg); setTimeout(() => setSuccess(''), 4000); }
  };

  // ── Create role ───────────────────────────────────────────────────────────
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      setCreating(true);
      const res = await rolesAPI.createRole({ name: newName, description: newDesc });
      const created = res.data;
      setRoles((prev) => [...prev, { ...created, permissions: [], adminCount: 0 }]);
      setSelectedRole({ ...created, permissions: [] });
      setNewName(''); setNewDesc(''); setShowCreate(false);
      flash('Role created');
    } catch (err) {
      flash(err.response?.data?.message || 'Failed to create role', true);
    } finally {
      setCreating(false);
    }
  };

  // ── Delete role ───────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await rolesAPI.deleteRole(deleteTarget.Role_ID);
      setRoles((prev) => prev.filter((r) => r.Role_ID !== deleteTarget.Role_ID));
      if (selectedRole?.Role_ID === deleteTarget.Role_ID) {
        setSelectedRole(null);
        setCheckedKeys(new Set());
      }
      setDeleteTarget(null);
      flash('Role deleted');
    } catch (err) {
      flash(err.response?.data?.message || 'Failed to delete role', true);
    } finally {
      setDeleting(false);
    }
  };

  // ── Save permissions ──────────────────────────────────────────────────────
  const handleSavePerms = async () => {
    if (!selectedRole) return;
    try {
      setSavingPerms(true);
      const keys = [...checkedKeys];
      await rolesAPI.setPermissions(selectedRole.Role_ID, keys);
      setRoles((prev) =>
        prev.map((r) =>
          r.Role_ID === selectedRole.Role_ID ? { ...r, permissions: keys } : r,
        ),
      );
      setSelectedRole((prev) => ({ ...prev, permissions: keys }));
      flash('Permissions saved');
    } catch (err) {
      flash(err.response?.data?.message || 'Failed to save permissions', true);
    } finally {
      setSavingPerms(false);
    }
  };

  // ── Assign role to admin ──────────────────────────────────────────────────
  const handleAssign = async () => {
    if (!assignAdminId) return;
    try {
      setAssigning(true);
      await rolesAPI.assignRole(parseInt(assignAdminId), assignRoleId ? parseInt(assignRoleId) : null);
      await loadAll();
      flash(assignRoleId ? 'Role assigned to admin' : 'Role removed from admin');
      setAssignAdminId(''); setAssignRoleId('');
    } catch (err) {
      flash(err.response?.data?.message || 'Failed to assign role', true);
    } finally {
      setAssigning(false);
    }
  };

  // ── Shared style helpers ──────────────────────────────────────────────────
  const cardStyle = (extraBorder) => ({
    background:    isLight ? 'rgba(255,255,255,.85)' : 'rgba(15,23,42,.5)',
    backdropFilter:'blur(20px)',
    border:        extraBorder ?? (isLight ? '1px solid rgba(15,23,42,.15)' : '1px solid rgba(255,255,255,.1)'),
    boxShadow:     isLight ? '0 2px 8px rgba(0,0,0,.08)' : '0 4px 24px rgba(0,0,0,.4)',
  });

  const inputStyle = {
    background: isLight ? 'rgba(241,245,249,.9)' : 'rgba(255,255,255,.06)',
    border:     '1px solid ' + (isLight ? 'rgba(71,85,105,.3)' : 'rgba(107,114,128,.3)'),
    color:      isLight ? '#0f172a' : '#e2e8f0',
    outline:    'none',
  };

  const primaryBtn = {
    background: isLight ? 'rgba(37,99,235,.14)' : 'rgba(6,182,212,.1)',
    border:     isLight ? '1px solid rgba(37,99,235,.5)' : '1px solid rgba(6,182,212,.4)',
    color:      isLight ? '#1d4ed8' : '#67e8f9',
  };

  const dangerBtn = {
    background: isLight ? 'rgba(185,28,28,.12)' : 'rgba(239,68,68,.1)',
    border:     isLight ? '1px solid rgba(185,28,28,.4)' : '1px solid rgba(239,68,68,.3)',
    color:      isLight ? '#991b1b' : '#fca5a5',
  };

  const textMain  = isLight ? '#0f172a' : '#e5e7eb';
  const textMuted = isLight ? '#64748b' : '#94a3b8';
  const divider   = isLight ? '1px solid rgba(15,23,42,.12)' : '1px solid rgba(255,255,255,.08)';

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh',
        background: isLight ? '#f1f5f9' : '#0a0e27' }}>
        <div style={{ width:40, height:40, borderRadius:'50%',
          border:'3px solid rgba(6,182,212,.2)', borderTopColor:'#06b6d4',
          animation:'spin .8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen p-6 relative overflow-x-hidden transition-colors duration-300"
      style={{
        background: isLight
          ? 'linear-gradient(180deg,#f8fafc 0%,#e2e8f0 50%,#f1f5f9 100%)'
          : 'linear-gradient(180deg,#0a0e27 0%,#1a1f3a 50%,#0f1729 100%)',
      }}
    >
      {/* Grid overlay */}
      <div className="absolute inset-0 opacity-5 pointer-events-none" style={{
        backgroundImage: isLight
          ? 'linear-gradient(rgba(100,116,139,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(100,116,139,.5) 1px,transparent 1px)'
          : 'linear-gradient(rgba(0,255,255,.3) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,255,.3) 1px,transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      {/* Ambient glows */}
      <div className="absolute top-20 left-20 w-80 h-80 rounded-full opacity-10 pointer-events-none"
        style={{ background:'radial-gradient(circle,#00ffff 0%,transparent 70%)', filter:'blur(60px)' }} />
      <div className="absolute bottom-20 right-20 w-80 h-80 rounded-full opacity-10 pointer-events-none"
        style={{ background:'radial-gradient(circle,#8b5cf6 0%,transparent 70%)', filter:'blur(60px)' }} />

      <div className="max-w-7xl mx-auto relative z-10">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity:0, y:-20 }} animate={{ opacity:1, y:0 }}
          className="mb-8 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl" style={{
              background: isLight ? 'rgba(99,102,241,.12)' : 'rgba(99,102,241,.15)',
              border:     isLight ? '1px solid rgba(99,102,241,.35)' : '1px solid rgba(99,102,241,.4)',
            }}>
              <FaShieldAlt size={28} style={{ color: isLight ? '#4f46e5' : '#a5b4fc' }} />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight" style={{ color: textMain }}>
                Roles & Permissions
              </h1>
              <p className="text-sm mt-0.5" style={{ color: textMuted }}>
                Define roles and control what each admin can access
              </p>
            </div>
          </div>

          {/* Header actions */}
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale:1.04 }} whileTap={{ scale:.96 }}
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium"
              style={{ background:'rgba(34,197,94,.1)', border:'1px solid rgba(34,197,94,.4)',
                color: isLight ? '#15803d' : '#4ade80' }}
            >
              <FaTachometerAlt /> Dashboard
            </motion.button>

            <motion.button
              whileHover={{ scale:1.04 }} whileTap={{ scale:.96 }}
              onClick={() => navigate('/super-admin')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium"
              style={primaryBtn}
            >
              <FaUsers /> Manage Users
            </motion.button>

            {/* Profile dropdown */}
            <div className="relative profile-menu-wrap">
              <motion.button
                whileHover={{ scale:1.04 }} whileTap={{ scale:.96 }}
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
                style={{ ...primaryBtn }}
              >
                <FaUserCircle size={20} />
                <FaChevronDown size={12} />
              </motion.button>
              <AnimatePresence>
                {showProfileMenu && (
                  <motion.div
                    initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-8 }}
                    className="absolute right-0 mt-2 w-48 rounded-xl shadow-2xl overflow-hidden z-50"
                    style={cardStyle(isLight ? '1px solid rgba(71,85,105,.25)' : '1px solid rgba(6,182,212,.3)')}
                  >
                    <button
                      onClick={() => { setIsLight(!isLight); setShowProfileMenu(false); }}
                      className="w-full px-4 py-3 flex items-center gap-3 text-sm transition-colors"
                      style={{ color: textMain, borderBottom: divider }}
                      onMouseEnter={(e)=>e.currentTarget.style.background=isLight?'rgba(71,85,105,.1)':'rgba(255,255,255,.06)'}
                      onMouseLeave={(e)=>e.currentTarget.style.background='transparent'}
                    >
                      {isLight ? <FaMoon /> : <FaSun />}
                      {isLight ? 'Dark Mode' : 'Light Mode'}
                    </button>
                    <button
                      onClick={() => { setShowProfileMenu(false); setShowLogoutConfirm(true); }}
                      className="w-full px-4 py-3 flex items-center gap-3 text-sm transition-colors"
                      style={{ color: isLight ? '#991b1b' : '#fca5a5' }}
                      onMouseEnter={(e)=>e.currentTarget.style.background=isLight?'rgba(185,28,28,.1)':'rgba(239,68,68,.1)'}
                      onMouseLeave={(e)=>e.currentTarget.style.background='transparent'}
                    >
                      <FaSignOutAlt /> Logout
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* ── Flash messages ──────────────────────────────────────────────── */}
        <AnimatePresence>
          {error && (
            <motion.div key="err" initial={{ opacity:0, x:-20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0 }}
              className="mb-5 p-4 rounded-xl flex items-center gap-3"
              style={{ background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.35)', color: isLight?'#991b1b':'#fca5a5' }}>
              <FaTimesCircle /> {error}
            </motion.div>
          )}
          {success && (
            <motion.div key="ok" initial={{ opacity:0, x:-20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0 }}
              className="mb-5 p-4 rounded-xl flex items-center gap-3"
              style={{ background:'rgba(34,197,94,.1)', border:'1px solid rgba(34,197,94,.35)', color: isLight?'#15803d':'#86efac' }}>
              <FaCheckCircle /> {success}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Main 2-column layout ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ══ LEFT: Roles list ══════════════════════════════════════════════ */}
          <div className="lg:col-span-1 space-y-4">
            {/* Create role button */}
            <motion.button
              whileHover={{ scale:1.02 }} whileTap={{ scale:.98 }}
              onClick={() => setShowCreate(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold"
              style={primaryBtn}
            >
              <FaPlus /> Create New Role
            </motion.button>

            {/* Create role inline form */}
            <AnimatePresence>
              {showCreate && (
                <motion.div
                  initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}
                  className="rounded-2xl p-5 overflow-hidden"
                  style={cardStyle()}
                >
                  <h3 className="font-bold mb-4 text-sm uppercase tracking-widest" style={{ color: textMuted }}>New Role</h3>
                  <form onSubmit={handleCreate} className="space-y-3">
                    <input
                      className="w-full px-4 py-2.5 rounded-xl text-sm"
                      style={inputStyle}
                      placeholder="Role name *"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      required
                    />
                    <input
                      className="w-full px-4 py-2.5 rounded-xl text-sm"
                      style={inputStyle}
                      placeholder="Description (optional)"
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                    />
                    <div className="flex gap-2 pt-1">
                      <button type="button" onClick={() => { setShowCreate(false); setNewName(''); setNewDesc(''); }}
                        className="flex-1 py-2 rounded-xl text-sm"
                        style={{ background: isLight?'rgba(71,85,105,.1)':'rgba(107,114,128,.15)',
                          border: isLight?'1px solid rgba(71,85,105,.3)':'1px solid rgba(107,114,128,.3)',
                          color: textMuted }}>
                        Cancel
                      </button>
                      <button type="submit" disabled={creating}
                        className="flex-1 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
                        style={primaryBtn}>
                        {creating ? 'Creating…' : 'Create'}
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Roles list */}
            <div className="rounded-2xl overflow-hidden" style={cardStyle()}>
              <div className="px-5 py-4" style={{ borderBottom: divider }}>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: textMuted }}>
                  Roles ({roles.length})
                </p>
              </div>
              {roles.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm" style={{ color: textMuted }}>
                  No roles yet. Create one above.
                </p>
              ) : (
                <ul className="divide-y" style={{ borderColor: isLight?'rgba(15,23,42,.07)':'rgba(255,255,255,.05)' }}>
                  {roles.map((role) => {
                    const isSelected = selectedRole?.Role_ID === role.Role_ID;
                    return (
                      <li key={role.Role_ID}>
                        <button
                          onClick={() => setSelectedRole(role)}
                          className="w-full text-left px-5 py-4 flex items-start justify-between gap-3 transition-all duration-200"
                          style={{
                            background: isSelected
                              ? (isLight ? 'rgba(37,99,235,.08)' : 'rgba(6,182,212,.08)')
                              : 'transparent',
                            borderLeft: isSelected
                              ? (isLight ? '3px solid #2563eb' : '3px solid #06b6d4')
                              : '3px solid transparent',
                          }}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate" style={{ color: textMain }}>
                              {role.Name}
                            </p>
                            {role.Description && (
                              <p className="text-xs mt-0.5 truncate" style={{ color: textMuted }}>
                                {role.Description}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-1.5">
                              <span className="text-xs" style={{ color: textMuted }}>
                                {role.permissions?.length ?? 0} permissions
                              </span>
                              <span className="text-xs" style={{ color: textMuted }}>
                                {role.adminCount ?? 0} admin{role.adminCount !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                          {!role.IsSystem && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteTarget(role); }}
                              className="p-1.5 rounded-lg transition-colors flex-shrink-0"
                              style={dangerBtn}
                              title="Delete role"
                            >
                              <FaTrash size={12} />
                            </button>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* ── Assign role to admin ──────────────────────────────────────── */}
            <div className="rounded-2xl p-5" style={cardStyle()}>
              <div className="flex items-center gap-2 mb-4">
                <FaUserTag style={{ color: isLight ? '#4f46e5' : '#a5b4fc' }} />
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: textMuted }}>
                  Assign Role to Admin
                </p>
              </div>
              <div className="space-y-3">
                <select
                  value={assignAdminId}
                  onChange={(e) => setAssignAdminId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl text-sm"
                  style={inputStyle}
                >
                  <option value="">Select admin…</option>
                  {admins
                    .filter((a) => !a.isSuperAdmin && a.Role !== 'SuperAdmin')
                    .map((a) => (
                      <option key={a.Admin_ID} value={a.Admin_ID}>
                        {a.Name} ({a.Email})
                      </option>
                    ))}
                </select>
                <select
                  value={assignRoleId}
                  onChange={(e) => setAssignRoleId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl text-sm"
                  style={inputStyle}
                >
                  <option value="">No role (remove)</option>
                  {roles.map((r) => (
                    <option key={r.Role_ID} value={r.Role_ID}>{r.Name}</option>
                  ))}
                </select>
                <motion.button
                  whileHover={{ scale:1.02 }} whileTap={{ scale:.98 }}
                  onClick={handleAssign}
                  disabled={!assignAdminId || assigning}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
                  style={primaryBtn}
                >
                  {assigning ? 'Assigning…' : (assignRoleId ? 'Assign Role' : 'Remove Role')}
                </motion.button>
              </div>
            </div>
          </div>

          {/* ══ RIGHT: Permission editor ══════════════════════════════════════ */}
          <div className="lg:col-span-2">
            {!selectedRole ? (
              <div className="rounded-2xl h-64 flex flex-col items-center justify-center gap-3"
                style={cardStyle()}>
                <FaShieldAlt size={36} style={{ color: textMuted, opacity:.4 }} />
                <p className="text-sm" style={{ color: textMuted }}>
                  Select a role on the left to edit its permissions
                </p>
              </div>
            ) : (
              <motion.div
                key={selectedRole.Role_ID}
                initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
                className="rounded-2xl overflow-hidden"
                style={cardStyle()}
              >
                {/* Role header */}
                <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: divider }}>
                  <div>
                    <h2 className="text-xl font-bold" style={{ color: textMain }}>
                      {selectedRole.Name}
                    </h2>
                    {selectedRole.Description && (
                      <p className="text-sm mt-0.5" style={{ color: textMuted }}>
                        {selectedRole.Description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs px-3 py-1 rounded-full" style={{
                      background: isLight?'rgba(37,99,235,.1)':'rgba(6,182,212,.1)',
                      border:     isLight?'1px solid rgba(37,99,235,.35)':'1px solid rgba(6,182,212,.3)',
                      color:      isLight?'#1d4ed8':'#67e8f9',
                    }}>
                      {checkedKeys.size} selected
                    </span>
                    <motion.button
                      whileHover={{ scale:1.04 }} whileTap={{ scale:.96 }}
                      onClick={handleSavePerms}
                      disabled={savingPerms}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-40"
                      style={primaryBtn}
                    >
                      <FaSave /> {savingPerms ? 'Saving…' : 'Save Permissions'}
                    </motion.button>
                  </div>
                </div>

                {/* Quick-select controls */}
                <div className="px-6 py-3 flex items-center gap-4" style={{ borderBottom: divider }}>
                  <button
                    onClick={() => setCheckedKeys(new Set(allPerms.map((p) => p.Key)))}
                    className="text-xs px-3 py-1.5 rounded-lg"
                    style={{ background:'rgba(34,197,94,.1)', border:'1px solid rgba(34,197,94,.3)',
                      color: isLight?'#15803d':'#86efac' }}
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setCheckedKeys(new Set())}
                    className="text-xs px-3 py-1.5 rounded-lg"
                    style={{ background:isLight?'rgba(71,85,105,.1)':'rgba(107,114,128,.1)',
                      border:isLight?'1px solid rgba(71,85,105,.3)':'1px solid rgba(107,114,128,.3)',
                      color: textMuted }}
                  >
                    Clear All
                  </button>
                </div>

                {/* Permissions grouped by category */}
                <div className="p-6 space-y-5">
                  {Object.entries(permsByCategory).map(([cat, perms]) => {
                    const col = catColor(cat, isLight);
                    const allChecked = perms.every((p) => checkedKeys.has(p.Key));
                    return (
                      <div key={cat} className="rounded-xl p-4"
                        style={{ background: col.bg, border: `1px solid ${col.border}` }}>
                        {/* Category header with toggle-all */}
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-bold uppercase tracking-widest"
                            style={{ color: col.label }}>
                            {cat}
                          </span>
                          <button
                            onClick={() => {
                              setCheckedKeys((prev) => {
                                const next = new Set(prev);
                                if (allChecked) perms.forEach((p) => next.delete(p.Key));
                                else            perms.forEach((p) => next.add(p.Key));
                                return next;
                              });
                            }}
                            className="text-xs px-3 py-1 rounded-lg transition-all"
                            style={{ background: isLight?'rgba(255,255,255,.6)':'rgba(0,0,0,.2)',
                              border: `1px solid ${col.border}`, color: col.label }}
                          >
                            {allChecked ? 'Deselect all' : 'Select all'}
                          </button>
                        </div>

                        {/* Permission checkboxes */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {perms.map((perm) => {
                            const checked = checkedKeys.has(perm.Key);
                            return (
                              <label
                                key={perm.Key}
                                className="flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all duration-150"
                                style={{
                                  background: checked
                                    ? (isLight ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.07)')
                                    : (isLight ? 'rgba(255,255,255,.4)' : 'rgba(0,0,0,.15)'),
                                  border: checked
                                    ? `1px solid ${col.border}`
                                    : `1px solid transparent`,
                                }}
                              >
                                <div
                                  className="mt-0.5 w-4 h-4 rounded flex-shrink-0 flex items-center justify-center"
                                  style={{
                                    background: checked ? col.label : (isLight?'rgba(71,85,105,.15)':'rgba(107,114,128,.2)'),
                                    border:     `1.5px solid ${checked ? col.label : (isLight?'rgba(71,85,105,.4)':'rgba(107,114,128,.4)')}`,
                                  }}
                                >
                                  {checked && <span style={{ color:'#fff', fontSize:9, fontWeight:900 }}>✓</span>}
                                </div>
                                <input
                                  type="checkbox"
                                  className="sr-only"
                                  checked={checked}
                                  onChange={() => {
                                    setCheckedKeys((prev) => {
                                      const next = new Set(prev);
                                      if (checked) next.delete(perm.Key);
                                      else         next.add(perm.Key);
                                      return next;
                                    });
                                  }}
                                />
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold" style={{ color: textMain }}>
                                    {perm.Name}
                                  </p>
                                  {perm.Description && (
                                    <p className="text-xs mt-0.5" style={{ color: textMuted }}>
                                      {perm.Description}
                                    </p>
                                  )}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Bottom save button */}
                <div className="px-6 pb-6">
                  <motion.button
                    whileHover={{ scale:1.01 }} whileTap={{ scale:.99 }}
                    onClick={handleSavePerms}
                    disabled={savingPerms}
                    className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-40"
                    style={primaryBtn}
                  >
                    <FaSave className="inline mr-2" />
                    {savingPerms ? 'Saving…' : 'Save Permissions for ' + selectedRole.Name}
                  </motion.button>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* ── Delete confirmation modal ───────────────────────────────────────── */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
            style={{ background:'rgba(0,0,0,.6)', backdropFilter:'blur(8px)' }}>
            <motion.div
              initial={{ opacity:0, scale:.9 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:.9 }}
              className="rounded-2xl p-8 max-w-sm w-full"
              style={cardStyle(isLight?'1px solid rgba(185,28,28,.3)':'1px solid rgba(239,68,68,.3)')}
            >
              <div className="text-center">
                <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4"
                  style={{ background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.3)' }}>
                  <FaTrash size={24} style={{ color: isLight?'#991b1b':'#f87171' }} />
                </div>
                <h2 className="text-xl font-bold mb-2" style={{ color: textMain }}>Delete Role</h2>
                <p className="mb-1 text-sm" style={{ color: textMain }}>
                  Delete <strong>"{deleteTarget.Name}"</strong>?
                </p>
                <p className="mb-6 text-xs" style={{ color: textMuted }}>
                  Admins assigned to this role will lose their permissions.
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setDeleteTarget(null)}
                    className="flex-1 py-2.5 rounded-xl text-sm"
                    style={{ background:isLight?'rgba(71,85,105,.1)':'rgba(107,114,128,.15)',
                      border:isLight?'1px solid rgba(71,85,105,.3)':'1px solid rgba(107,114,128,.3)',
                      color: textMuted }}>
                    Cancel
                  </button>
                  <button onClick={handleDelete} disabled={deleting}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                    style={dangerBtn}>
                    {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Logout confirmation modal ───────────────────────────────────────── */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
            style={{ background:'rgba(0,0,0,.6)', backdropFilter:'blur(8px)' }}>
            <motion.div
              initial={{ opacity:0, scale:.9 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:.9 }}
              className="rounded-2xl p-8 max-w-sm w-full"
              style={cardStyle()}
            >
              <div className="text-center">
                <h2 className="text-xl font-bold mb-2" style={{ color: textMain }}>Confirm Logout</h2>
                <p className="mb-6 text-sm" style={{ color: textMuted }}>Are you sure you want to log out?</p>
                <div className="flex gap-3">
                  <button onClick={() => setShowLogoutConfirm(false)}
                    className="flex-1 py-2.5 rounded-xl text-sm"
                    style={{ background:isLight?'rgba(71,85,105,.1)':'rgba(107,114,128,.15)',
                      border:isLight?'1px solid rgba(71,85,105,.3)':'1px solid rgba(107,114,128,.3)',
                      color: textMuted }}>
                    Cancel
                  </button>
                  <button onClick={() => { logout(); navigate('/login'); }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                    style={dangerBtn}>
                    Logout
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RolesPermissions;
