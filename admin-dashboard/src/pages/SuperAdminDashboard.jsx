import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaUsers, FaUserClock, FaUserCheck, FaUserShield, FaTrash, FaCheck,
  FaTimes, FaUserPlus, FaTimes as FaClose, FaSignOutAlt, FaMoon, FaSun,
  FaUserCircle, FaChevronDown, FaTachometerAlt, FaShieldAlt, FaSave,
  FaPlus, FaUserTag, FaCheckCircle, FaTimesCircle, FaBell,
  FaKey, FaEnvelopeOpenText, FaEye, FaLock, FaUnlock,
} from 'react-icons/fa';
import api, { rolesAPI, accessRequestAPI } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

// ── Permission category accent colours ─────────────────────────────────────────
const CAT_DARK = {
  General:             { bg:'rgba(99,102,241,.1)',  border:'rgba(99,102,241,.4)',  label:'#818cf8' },
  Monitoring:          { bg:'rgba(6,182,212,.1)',   border:'rgba(6,182,212,.4)',   label:'#67e8f9' },
  'People Management': { bg:'rgba(34,197,94,.1)',   border:'rgba(34,197,94,.4)',   label:'#86efac' },
  Infrastructure:      { bg:'rgba(251,146,60,.1)',  border:'rgba(251,146,60,.4)',  label:'#fdba74' },
  System:              { bg:'rgba(168,85,247,.1)',  border:'rgba(168,85,247,.4)', label:'#d8b4fe' },
};
const CAT_LIGHT = {
  General:             { bg:'rgba(99,102,241,.08)', border:'rgba(99,102,241,.35)', label:'#4f46e5' },
  Monitoring:          { bg:'rgba(6,182,212,.08)',  border:'rgba(6,182,212,.35)',  label:'#0891b2' },
  'People Management': { bg:'rgba(34,197,94,.08)',  border:'rgba(34,197,94,.35)',  label:'#15803d' },
  Infrastructure:      { bg:'rgba(251,146,60,.08)', border:'rgba(251,146,60,.35)', label:'#c2410c' },
  System:              { bg:'rgba(168,85,247,.08)', border:'rgba(168,85,247,.35)',label:'#7e22ce' },
};
const catColor = (cat, light) =>
  (light ? CAT_LIGHT : CAT_DARK)[cat] ?? { bg:'rgba(107,114,128,.1)', border:'rgba(107,114,128,.4)', label:'#9ca3af' };

// ══════════════════════════════════════════════════════════════════════════════
const SuperAdminDashboard = () => {
  const { logout } = useAuth();
  const navigate   = useNavigate();

  // ── Theme ─────────────────────────────────────────────────────────────────
  const [isLightMode, setIsLightMode] = useState(
    window.matchMedia?.('(prefers-color-scheme: light)').matches ?? false,
  );
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  // ── Users / admins state ──────────────────────────────────────────────────
  const [statistics, setStatistics] = useState({
    totalUsers: 0, pendingApprovals: 0, approvedUsers: 0, adminUsers: 0,
  });
  const [allAdmins,    setAllAdmins]    = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Tabs: 'pending' | 'admins' | 'roles'
  const [selectedTab, setSelectedTab] = useState('pending');

  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUser,          setNewUser]          = useState({ name: '', email: '' });
  const [isAddingUser,     setIsAddingUser]     = useState(false);
  const [showLogoutConfirm,  setShowLogoutConfirm]  = useState(false);
  const [showDeleteConfirm,  setShowDeleteConfirm]  = useState(false);
  const [adminToDelete,      setAdminToDelete]      = useState(null);

  // ── Access Requests state ─────────────────────────────────────────────────
  const [accessRequests,      setAccessRequests]      = useState([]);
  const [accessRequestsLoaded,setAccessRequestsLoaded]= useState(false);
  const [reviewingId,         setReviewingId]         = useState(null); // request being submitted (async)
  const [noteMap,             setNoteMap]             = useState({});   // per-request note text
  const [pendingAccessCount,  setPendingAccessCount]  = useState(0);

  // ── View Admin modal ──────────────────────────────────────────────────────
  const [viewingAdmin,      setViewingAdmin]      = useState(null);
  const [viewRolePerms,     setViewRolePerms]     = useState([]);
  const [loadingViewPerms,  setLoadingViewPerms]  = useState(false);

  // ── Roles & Permissions state ─────────────────────────────────────────────
  const [roles,       setRoles]      = useState([]);
  const [allPerms,    setAllPerms]   = useState([]);
  const [rolesLoaded, setRolesLoaded]= useState(false);

  const [selectedRole, setSelectedRole] = useState(null);
  const [checkedKeys,  setCheckedKeys]  = useState(new Set());
  const [savingPerms,  setSavingPerms]  = useState(false);

  const [showCreateRole, setShowCreateRole] = useState(false);
  const [newRoleName,    setNewRoleName]    = useState('');
  const [newRoleDesc,    setNewRoleDesc]    = useState('');
  const [creatingRole,   setCreatingRole]   = useState(false);

  const [deleteRoleTarget, setDeleteRoleTarget] = useState(null);
  const [deletingRole,     setDeletingRole]     = useState(false);

  const [assignAdminId, setAssignAdminId] = useState('');
  const [assignRoleId,  setAssignRoleId]  = useState('');
  const [assigning,     setAssigning]     = useState(false);

  // ── Close dropdown on outside click ──────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('.profile-dropdown-container')) setShowProfileDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Sync checked keys when selected role changes ──────────────────────────
  useEffect(() => {
    if (selectedRole) setCheckedKeys(new Set(selectedRole.permissions ?? []));
  }, [selectedRole]);

  // ── Load users / admins + access requests ────────────────────────────────
  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      const [statsRes, adminsRes, pendingRes, accessRes] = await Promise.all([
        api.get('/auth/admin/statistics'),
        api.get('/auth/admin/all'),
        api.get('/auth/pending-users'),
        accessRequestAPI.getAll().catch(() => null),
      ]);
      setStatistics(statsRes.data.data);
      setAllAdmins(adminsRes.data.data.admins);
      setPendingUsers(pendingRes.data.data.users);
      if (accessRes) {
        const reqs = accessRes.data ?? [];
        setAccessRequests(reqs);
        setAccessRequestsLoaded(true);
        setPendingAccessCount(reqs.filter((r) => r.Status === 'pending').length);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  // ── Reload access requests ────────────────────────────────────────────────
  const loadAccessRequests = async () => {
    try {
      const res = await accessRequestAPI.getAll();
      const reqs = res.data ?? [];
      setAccessRequests(reqs);
      setAccessRequestsLoaded(true);
      setPendingAccessCount(reqs.filter((r) => r.Status === 'pending').length);
    } catch (err) {
      setAccessRequestsLoaded(true); // stop spinner even on error
      flashMsg(err.response?.data?.message || 'Failed to load access requests', true);
    }
  };

  const handleReviewRequest = async (id, action) => {
    try {
      setReviewingId(id);
      const note = noteMap[id] ?? '';
      await accessRequestAPI.review(id, action, note);
      setNoteMap((prev) => { const n = { ...prev }; delete n[id]; return n; });
      await loadAccessRequests();
      flashMsg(`Request ${action === 'approve' ? 'approved' : 'rejected'} — permission updated`);
    } catch (err) {
      flashMsg(err.response?.data?.message || 'Failed to review request', true);
    } finally {
      setReviewingId(null);
    }
  };

  // ── Load roles & permissions (lazy — first time the roles tab opens) ───────
  const loadRolesData = async () => {
    try {
      const [rolesRes, permsRes] = await Promise.all([
        rolesAPI.listRoles(),
        rolesAPI.listPermissions(),
      ]);
      setRoles(rolesRes.data ?? []);
      setAllPerms(permsRes.data ?? []);
      setRolesLoaded(true);
    } catch (err) {
      flashMsg(err.response?.data?.message || 'Failed to load roles data', true);
    }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (selectedTab === 'roles' && !rolesLoaded) loadRolesData();
  }, [selectedTab]);

  // Poll pending count every 30 s for badge
  useEffect(() => {
    const poll = () => {
      accessRequestAPI.getPendingCount()
        .then((res) => setPendingAccessCount(res.data?.count ?? 0))
        .catch(() => {});
    };
    poll();
    const t = setInterval(poll, 30000);
    return () => clearInterval(t);
  }, []);

  // ── Flash helper ──────────────────────────────────────────────────────────
  const flashMsg = (msg, isErr = false) => {
    if (isErr) { setError(msg); setTimeout(() => setError(''), 4000); }
    else       { setSuccessMessage(msg); setTimeout(() => setSuccessMessage(''), 4000); }
  };

  // ── User management handlers ──────────────────────────────────────────────
  const handleApprove = async (userId) => {
    try {
      await api.post(`/auth/admin/approve/${userId}`, {});
      flashMsg('User approved successfully');
      fetchData();
    } catch (err) {
      flashMsg(err.response?.data?.message || 'Failed to approve user', true);
    }
  };

  const handleReject = async (userId) => {
    try {
      await api.post(`/auth/admin/reject/${userId}`, { reason: 'No reason provided' });
      flashMsg('User rejected successfully');
      fetchData();
    } catch (err) {
      flashMsg(err.response?.data?.message || 'Failed to reject user', true);
    }
  };

  const handleDeleteAdmin = (adminId) => {
    setAdminToDelete(adminId);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteAdmin = async () => {
    if (!adminToDelete) return;
    try {
      await api.delete(`/auth/admin/${adminToDelete}`);
      flashMsg('Admin deleted successfully');
      setShowDeleteConfirm(false);
      setAdminToDelete(null);
      fetchData();
    } catch (err) {
      flashMsg(err.response?.data?.message || 'Failed to delete admin', true);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newUser.name.trim() || !newUser.email.trim()) {
      flashMsg('Name and email are required', true);
      return;
    }
    try {
      setIsAddingUser(true);
      await api.post('/auth/admin/add-user', newUser);
      setShowAddUserModal(false);
      setNewUser({ name: '', email: '' });
      fetchData();
      flashMsg(`User added. A password setup email was sent to ${newUser.email}.`);
    } catch (err) {
      flashMsg(err.response?.data?.message || 'Failed to add user', true);
    } finally {
      setIsAddingUser(false);
    }
  };

  // ── Roles management handlers ─────────────────────────────────────────────
  const handleCreateRole = async (e) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    try {
      setCreatingRole(true);
      const res = await rolesAPI.createRole({ name: newRoleName, description: newRoleDesc });
      const created = res.data;
      setRoles((prev) => [...prev, { ...created, permissions: [], adminCount: 0 }]);
      setSelectedRole({ ...created, permissions: [] });
      setNewRoleName(''); setNewRoleDesc(''); setShowCreateRole(false);
      flashMsg('Role created');
    } catch (err) {
      flashMsg(err.response?.data?.message || 'Failed to create role', true);
    } finally {
      setCreatingRole(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!deleteRoleTarget) return;
    try {
      setDeletingRole(true);
      await rolesAPI.deleteRole(deleteRoleTarget.Role_ID);
      setRoles((prev) => prev.filter((r) => r.Role_ID !== deleteRoleTarget.Role_ID));
      if (selectedRole?.Role_ID === deleteRoleTarget.Role_ID) {
        setSelectedRole(null);
        setCheckedKeys(new Set());
      }
      setDeleteRoleTarget(null);
      flashMsg('Role deleted');
    } catch (err) {
      flashMsg(err.response?.data?.message || 'Failed to delete role', true);
    } finally {
      setDeletingRole(false);
    }
  };

  const handleSavePermissions = async () => {
    if (!selectedRole) return;
    try {
      setSavingPerms(true);
      const keys = [...checkedKeys];
      await rolesAPI.setPermissions(selectedRole.Role_ID, keys);
      setRoles((prev) =>
        prev.map((r) => r.Role_ID === selectedRole.Role_ID ? { ...r, permissions: keys } : r),
      );
      setSelectedRole((prev) => ({ ...prev, permissions: keys }));
      flashMsg('Permissions saved');
    } catch (err) {
      flashMsg(err.response?.data?.message || 'Failed to save permissions', true);
    } finally {
      setSavingPerms(false);
    }
  };

  const handleAssignRole = async () => {
    if (!assignAdminId) return;
    try {
      setAssigning(true);
      await rolesAPI.assignRole(parseInt(assignAdminId), assignRoleId ? parseInt(assignRoleId) : null);
      await fetchData();
      await loadRolesData();
      flashMsg(assignRoleId ? 'Role assigned' : 'Role removed from admin');
      setAssignAdminId(''); setAssignRoleId('');
    } catch (err) {
      flashMsg(err.response?.data?.message || 'Failed to assign role', true);
    } finally {
      setAssigning(false);
    }
  };

  // ── Open admin detail view ────────────────────────────────────────────────
  const openAdminView = async (admin) => {
    setViewingAdmin(admin);
    setViewRolePerms([]);
    if (!admin.Role_ID) return;
    try {
      setLoadingViewPerms(true);
      // Load all roles+perms if not yet loaded, then find this admin's role
      let roleList = roles;
      let permList = allPerms;
      if (!rolesLoaded) {
        const [rolesRes, permsRes] = await Promise.all([
          rolesAPI.listRoles(),
          rolesAPI.listPermissions(),
        ]);
        roleList = rolesRes.data ?? [];
        permList = permsRes.data ?? [];
        setRoles(roleList);
        setAllPerms(permList);
        setRolesLoaded(true);
      }
      const role = roleList.find((r) => r.Role_ID === admin.Role_ID);
      const permKeys = new Set(role?.permissions ?? []);
      setViewRolePerms(permList.filter((p) => permKeys.has(p.Key)));
    } catch {
      setViewRolePerms([]);
    } finally {
      setLoadingViewPerms(false);
    }
  };

  // ── Permissions grouped by category ──────────────────────────────────────
  const permsByCategory = useMemo(() => {
    const map = {};
    for (const p of allPerms) (map[p.Category] ??= []).push(p);
    return map;
  }, [allPerms]);

  // ── Shared style helpers ──────────────────────────────────────────────────
  const L = isLightMode;

  const tabStyle = (active) =>
    active
      ? { background: L?'rgba(37,99,235,.15)':'rgba(6,182,212,.1)',
          border:      L?'1px solid rgba(37,99,235,.5)':'1px solid rgba(6,182,212,.4)',
          color:       L?'#1e40af':'#67e8f9' }
      : { background: 'rgba(229,231,235,.05)',
          border:      L?'1px solid rgba(71,85,105,.3)':'1px solid rgba(6,182,212,.2)',
          color:       L?'#475569':'#9ca3af' };

  const inputStyle = {
    background: L?'rgba(241,245,249,.8)':'rgba(229,231,235,.08)',
    border:     '1px solid rgba(107,114,128,.4)',
    outline:    'none',
    color:      L?'#0f172a':'#ffffff',
  };
  const primaryBtn = {
    background: L?'rgba(37,99,235,.15)':'rgba(6,182,212,.1)',
    border:     L?'1px solid rgba(37,99,235,.5)':'1px solid rgba(6,182,212,.4)',
    color:      L?'#1e40af':'#67e8f9',
  };
  const dangerBtn = {
    background: L?'rgba(185,28,28,.12)':'rgba(239,68,68,.1)',
    border:     L?'1px solid rgba(185,28,28,.4)':'1px solid rgba(239,68,68,.3)',
    color:      L?'#991b1b':'#fca5a5',
  };
  const textMain  = L?'#0f172a':'#e5e7eb';
  const textMuted = L?'#64748b':'#94a3b8';
  const divider   = L?'1px solid rgba(15,23,42,.12)':'1px solid rgba(6,182,212,.2)';

  // ── Stat card ─────────────────────────────────────────────────────────────
  const StatCard = ({ icon: Icon, title, value, glowColor, cardType }) => {
    const [hov, setHov] = useState(false);
    const lightStyles = {
      pending:  { iconBg:'rgba(251,191,36,.15)',  leftBorder:'#f59e0b', iconColor:'#d97706' },
      signup:   { iconBg:'rgba(59,130,246,.15)',  leftBorder:'#3b82f6', iconColor:'#2563eb' },
      approved: { iconBg:'rgba(34,197,94,.15)',   leftBorder:'#16a34a', iconColor:'#16a34a' },
      admins:   { iconBg:'rgba(99,102,241,.15)',  leftBorder:'#6366f1', iconColor:'#6366f1' },
    };
    const ls = lightStyles[cardType] ?? {};
    return (
      <motion.div
        whileHover={{ scale:1.02, y:-4 }} transition={{ duration:.25 }}
        onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
        className="relative overflow-hidden rounded-2xl p-6"
        style={{
          background:    L?'#f9f9f9ff':'rgba(15,23,42,.4)',
          backdropFilter:L?'none':'blur(20px)',
          border:        L?'1px solid #e2e8f0cc':(hov?'1px solid rgba(255,255,255,.4)':'1px solid rgba(255,255,255,.1)'),
          boxShadow:     L?'0 1px 3px rgba(0,0,0,.1)':'0 4px 16px rgba(0,0,0,.3)',
          borderLeft:    L&&ls.leftBorder?`4px solid ${ls.leftBorder}`:undefined,
          transition:    'border .3s,box-shadow .3s',
        }}
      >
        <div className="flex items-center justify-between relative z-10">
          <div>
            <p className="text-sm font-medium mb-2" style={{ color:L?'#64748b':'rgba(255,255,255,.7)' }}>{title}</p>
            <p className="text-4xl font-bold" style={{ color:L?'#1e293b':'#ffffff' }}>{value}</p>
          </div>
          <div className="p-4 rounded-xl"
            style={{ background:L?ls.iconBg:'rgba(255,255,255,.05)', border:L?'none':`1px solid ${glowColor}40` }}>
            <Icon className="text-4xl" style={{ color:L?ls.iconColor:glowColor }} />
          </div>
        </div>
      </motion.div>
    );
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh',
        background:L?'#f1f5f9':'#0a0e27' }}>
        <div style={{ width:40, height:40, borderRadius:'50%',
          border:'3px solid rgba(6,182,212,.2)', borderTopColor:'#06b6d4',
          animation:'spin .8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div
      className="min-h-screen p-6 relative overflow-hidden transition-colors duration-300"
      style={{
        background: L
          ? 'linear-gradient(180deg,#f8fafc 0%,#e2e8f0 50%,#f1f5f9 100%)'
          : 'linear-gradient(180deg,#0a0e27 0%,#1a1f3a 50%,#0f1729 100%)',
      }}
    >
      {/* Grid + glows */}
      <div className="absolute inset-0 opacity-5 pointer-events-none" style={{
        backgroundImage:`linear-gradient(rgba(0,255,255,.3) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,255,.3) 1px,transparent 1px)`,
        backgroundSize:'40px 40px',
      }} />
      <div className="absolute top-20 left-20 w-96 h-96 rounded-full opacity-10 pointer-events-none"
        style={{ background:'radial-gradient(circle,#00ffff 0%,transparent 70%)', filter:'blur(60px)' }} />
      <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full opacity-10 pointer-events-none"
        style={{ background:'radial-gradient(circle,#ff00ff 0%,transparent 70%)', filter:'blur(60px)' }} />

      <div className="max-w-7xl mx-auto relative z-10">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity:0, y:-20 }} animate={{ opacity:1, y:0 }}
          className="mb-8 flex items-start justify-between"
        >
          <div>
            <h1 className="text-5xl font-black mb-2 tracking-tight" style={{ color:L?'#0f172a':'#e5e7eb' }}>
              Admin Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <motion.button whileHover={{ scale:1.05 }} whileTap={{ scale:.95 }}
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all duration-300"
              style={{ background:L?'rgba(22,163,74,.12)':'rgba(34,197,94,.1)',
                border:L?'1px solid rgba(22,163,74,.4)':'1px solid rgba(34,197,94,.4)',
                color:L?'#15803d':'#4ade80' }}>
              <FaTachometerAlt /><span>Dashboard</span>
            </motion.button>

            {/* Profile dropdown */}
            <div className="relative profile-dropdown-container">
              <motion.button whileHover={{ scale:1.05 }} whileTap={{ scale:.95 }}
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                className="flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all duration-300"
                style={{ background:L?'rgba(15,23,42,.1)':'rgba(6,182,212,.1)',
                  border:L?'1px solid rgba(15,23,42,.3)':'1px solid rgba(6,182,212,.3)',
                  color:L?'#0f172a':'#06b6d4', boxShadow:'0 4px 16px rgba(0,0,0,.3)' }}>
                <FaUserCircle className="text-2xl" /><FaChevronDown className="text-sm" />
              </motion.button>
              <AnimatePresence>
                {showProfileDropdown && (
                  <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-10 }}
                    className="absolute right-0 mt-2 w-56 rounded-xl shadow-2xl overflow-hidden z-50"
                    style={{ background:L?'rgba(255,255,255,.95)':'rgba(15,23,42,.95)',
                      backdropFilter:'blur(20px)',
                      border:L?'1px solid rgba(71,85,105,.3)':'1px solid rgba(6,182,212,.3)' }}>
                    <button onClick={() => setIsLightMode(!isLightMode)}
                      className="w-full px-5 py-3 flex items-center gap-3 transition-all duration-200"
                      style={{ color:L?'#182440':'#e5e7eb', borderBottom:divider }}
                      onMouseEnter={(e)=>e.currentTarget.style.background=L?'rgba(71,85,105,.1)':'rgba(6,182,212,.1)'}
                      onMouseLeave={(e)=>e.currentTarget.style.background='transparent'}>
                      {L?<FaMoon/>:<FaSun/>}<span>{L?'Dark Mode':'Light Mode'}</span>
                    </button>
                    <button onClick={() => { setShowProfileDropdown(false); setShowLogoutConfirm(true); }}
                      className="w-full px-5 py-3 flex items-center gap-3 transition-all duration-200"
                      style={{ color:L?'#991b1b':'#fca5a5' }}
                      onMouseEnter={(e)=>e.currentTarget.style.background=L?'rgba(185,28,28,.1)':'rgba(239,68,68,.1)'}
                      onMouseLeave={(e)=>e.currentTarget.style.background='transparent'}>
                      <FaSignOutAlt/><span>Logout</span>
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
              className="mb-6 p-4 rounded-xl flex items-center gap-3"
              style={{ background:'rgba(239,68,68,.1)', backdropFilter:'blur(10px)',
                border:'1px solid rgba(239,68,68,.3)', color:L?'#991b1b':'#fca5a5' }}>
              <FaTimesCircle/> {error}
            </motion.div>
          )}
          {successMessage && (
            <motion.div key="ok" initial={{ opacity:0, x:-20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0 }}
              className="mb-6 p-4 rounded-xl flex items-center gap-3"
              style={{ background:'rgba(34,197,94,.1)', backdropFilter:'blur(10px)',
                border:'1px solid rgba(34,197,94,.3)', color:L?'#15803d':'#86efac' }}>
              <FaCheckCircle/> {successMessage}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Stat cards ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard icon={FaUserClock}  title="Pending Approvals"  value={statistics.pendingApprovals} glowColor="#FACC15" cardType="pending"  />
          <StatCard icon={FaUsers}      title="Signup Requests"    value={statistics.totalUsers}       glowColor="#0EA5E9" cardType="signup"   />
          <StatCard icon={FaUserCheck}  title="Approved Accounts"  value={statistics.approvedUsers}    glowColor="#D97706" cardType="approved" />
          <StatCard icon={FaUserShield} title="Active Admins"      value={statistics.adminUsers}       glowColor="#AC80D7" cardType="admins"   />
        </div>

        {/* ── Tabs container ──────────────────────────────────────────────── */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background:L?'rgba(255,255,255,.8)':'#0f172a1a',
            backdropFilter:'blur(20px)',
            border:L?'1px solid rgba(15,23,42,.3)':'1px solid rgba(255,255,255,.1)',
            boxShadow:L?'0 1px 3px rgba(0,0,0,.1)':'0 4px 16px rgba(0,0,0,.3)' }}>

          {/* Tab bar */}
          <div className="flex items-center justify-between gap-4 p-6" style={{ borderBottom:divider }}>
            <div className="flex gap-3 flex-wrap">
              <button onClick={() => setSelectedTab('pending')}
                className="px-6 py-3 rounded-xl font-medium transition-all duration-300"
                style={tabStyle(selectedTab==='pending')}>
                Pending Approvals ({statistics.pendingApprovals})
              </button>
              <button onClick={() => setSelectedTab('admins')}
                className="px-6 py-3 rounded-xl font-medium transition-all duration-300"
                style={tabStyle(selectedTab==='admins')}>
                All Admins ({statistics.totalUsers})
              </button>
              <button onClick={() => setSelectedTab('roles')}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300"
                style={tabStyle(selectedTab==='roles')}>
                <FaShieldAlt size={14}/> Roles & Permissions
              </button>
              <button onClick={() => setSelectedTab('access')}
                className="relative flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300"
                style={tabStyle(selectedTab==='access')}>
                <FaBell size={14}/> Access Requests
                {pendingAccessCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 flex items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ background:'#ef4444', padding:'0 4px', boxShadow:'0 2px 8px rgba(239,68,68,.6)' }}>
                    {pendingAccessCount}
                  </span>
                )}
              </button>
            </div>

            {selectedTab !== 'roles' && (
              <motion.button whileHover={{ scale:1.05 }} whileTap={{ scale:.95 }}
                onClick={() => setShowAddUserModal(true)}
                className="flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all duration-300"
                style={primaryBtn}>
                <FaUserPlus /> Add New User
              </motion.button>
            )}
          </div>

          {/* ── Pending tab ─────────────────────────────────────────────── */}
          {selectedTab === 'pending' && (
            <div className="space-y-4 p-6">
              {pendingUsers.length === 0 ? (
                <p className="text-center py-12 text-lg" style={{ color:L?'#182440':'#67e8f9' }}>No pending approvals</p>
              ) : (
                pendingUsers.map((u) => (
                  <motion.div key={u.Pending_ID} initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
                    className="rounded-xl p-5 flex items-center justify-between"
                    style={{ background:'rgba(229,231,235,.08)', backdropFilter:'blur(15px)',
                      border:'1px solid rgba(6,182,212,.25)', boxShadow:'0 4px 16px rgba(0,0,0,.2)' }}>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg" style={{ color:textMain }}>{u.Name}</h3>
                      <p className="text-sm mt-1" style={{ color:textMain }}>{u.Email}</p>
                      <p className="text-xs mt-2" style={{ color:textMuted }}>
                        Requested: {new Date(u.RequestedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => handleApprove(u.Pending_ID)}
                        className="px-5 py-2 rounded-lg font-medium flex items-center gap-2 text-green-300"
                        style={{ background:'rgba(34,197,94,.1)', border:'1px solid rgba(34,197,94,.4)' }}>
                        <FaCheck /> Approve
                      </button>
                      <button onClick={() => handleReject(u.Pending_ID)}
                        className="px-5 py-2 rounded-lg font-medium flex items-center gap-2 text-red-300"
                        style={{ background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.4)' }}>
                        <FaTimes /> Reject
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          )}

          {/* ── All admins tab ───────────────────────────────────────────── */}
          {selectedTab === 'admins' && (
            <div className="overflow-x-auto p-6">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom:divider }}>
                    {['Name','Email','Role','ID','Actions'].map((h) => (
                      <th key={h} className="text-left font-semibold py-4 px-4" style={{ color:textMain }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allAdmins.map((admin) => (
                    <tr key={admin.Admin_ID} className="transition-all duration-300"
                      style={{ borderBottom:L?'1px solid rgba(226,232,240,.6)':'1px solid rgba(6,182,212,.1)' }}
                      onMouseEnter={(e)=>e.currentTarget.style.background=L?'rgba(241,245,249,.5)':'rgba(6,182,212,.05)'}
                      onMouseLeave={(e)=>e.currentTarget.style.background='transparent'}>
                      <td className="py-4 px-4" style={{ color:textMain }}>{admin.Name}</td>
                      <td className="py-4 px-4" style={{ color:textMain }}>{admin.Email}</td>
                      <td className="py-4 px-4">
                        <span className="px-3 py-1 rounded-lg text-xs font-medium" style={{
                          color:textMain,
                          background:admin.Role==='Admin'?'rgba(168,85,247,.1)':'rgba(6,182,212,.1)',
                          border:admin.Role==='Admin'?'1px solid rgba(168,85,247,.4)':'1px solid rgba(6,182,212,.4)',
                        }}>
                          {admin.roleName ? `${admin.Role} (${admin.roleName})` : admin.Role}
                        </span>
                      </td>
                      <td className="py-4 px-4" style={{ color:textMain }}>#{admin.Admin_ID}</td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openAdminView(admin)}
                            className="p-2 rounded-lg transition-all duration-300"
                            style={primaryBtn} title="View Details">
                            <FaEye />
                          </button>
                          <button onClick={() => handleDeleteAdmin(admin.Admin_ID)}
                            className="p-2 rounded-lg transition-all duration-300"
                            style={dangerBtn} title="Delete Admin">
                            <FaTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Roles & Permissions tab ──────────────────────────────────── */}
          {selectedTab === 'roles' && (
            <div className="p-6">
              {!rolesLoaded ? (
                <div className="flex items-center justify-center py-16">
                  <div style={{ width:36, height:36, borderRadius:'50%',
                    border:'3px solid rgba(6,182,212,.2)', borderTopColor:'#06b6d4',
                    animation:'spin .8s linear infinite' }} />
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                  {/* ── Left: role list ─────────────────────────────────── */}
                  <div className="lg:col-span-1 space-y-4">

                    {/* Create role button */}
                    <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:.98 }}
                      onClick={() => setShowCreateRole(true)}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold"
                      style={primaryBtn}>
                      <FaPlus /> Create New Role
                    </motion.button>

                    {/* Create role inline form */}
                    <AnimatePresence>
                      {showCreateRole && (
                        <motion.div
                          initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}
                          className="rounded-2xl p-5 overflow-hidden"
                          style={{ background:L?'rgba(255,255,255,.7)':'rgba(15,23,42,.5)',
                            border:L?'1px solid rgba(15,23,42,.15)':'1px solid rgba(255,255,255,.1)' }}>
                          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color:textMuted }}>New Role</p>
                          <form onSubmit={handleCreateRole} className="space-y-3">
                            <input className="w-full px-4 py-2.5 rounded-xl text-sm" style={inputStyle}
                              placeholder="Role name *" value={newRoleName}
                              onChange={(e) => setNewRoleName(e.target.value)} required />
                            <input className="w-full px-4 py-2.5 rounded-xl text-sm" style={inputStyle}
                              placeholder="Description (optional)" value={newRoleDesc}
                              onChange={(e) => setNewRoleDesc(e.target.value)} />
                            <div className="flex gap-2 pt-1">
                              <button type="button"
                                onClick={() => { setShowCreateRole(false); setNewRoleName(''); setNewRoleDesc(''); }}
                                className="flex-1 py-2 rounded-xl text-sm"
                                style={{ background:L?'rgba(71,85,105,.1)':'rgba(107,114,128,.15)',
                                  border:L?'1px solid rgba(71,85,105,.3)':'1px solid rgba(107,114,128,.3)',
                                  color:textMuted }}>
                                Cancel
                              </button>
                              <button type="submit" disabled={creatingRole}
                                className="flex-1 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
                                style={primaryBtn}>
                                {creatingRole ? 'Creating…' : 'Create'}
                              </button>
                            </div>
                          </form>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Role list */}
                    <div className="rounded-2xl overflow-hidden"
                      style={{ background:L?'rgba(255,255,255,.6)':'rgba(15,23,42,.4)',
                        border:L?'1px solid rgba(15,23,42,.12)':'1px solid rgba(255,255,255,.08)' }}>
                      <div className="px-4 py-3" style={{ borderBottom:divider }}>
                        <p className="text-xs font-bold uppercase tracking-widest" style={{ color:textMuted }}>
                          Roles ({roles.length})
                        </p>
                      </div>
                      {roles.length === 0 ? (
                        <p className="px-4 py-8 text-center text-sm" style={{ color:textMuted }}>
                          No roles yet.
                        </p>
                      ) : (
                        <ul>
                          {roles.map((role) => {
                            const isSel = selectedRole?.Role_ID === role.Role_ID;
                            return (
                              <li key={role.Role_ID} style={{ borderBottom:divider }}>
                                <button onClick={() => setSelectedRole(role)}
                                  className="w-full text-left px-4 py-3.5 flex items-start justify-between gap-2 transition-all duration-200"
                                  style={{
                                    background: isSel?(L?'rgba(37,99,235,.08)':'rgba(6,182,212,.08)'):'transparent',
                                    borderLeft: isSel?(L?'3px solid #2563eb':'3px solid #06b6d4'):'3px solid transparent',
                                  }}>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-sm truncate" style={{ color:textMain }}>{role.Name}</p>
                                    {role.Description && (
                                      <p className="text-xs mt-0.5 truncate" style={{ color:textMuted }}>{role.Description}</p>
                                    )}
                                    <div className="flex gap-3 mt-1">
                                      <span className="text-xs" style={{ color:textMuted }}>
                                        {role.permissions?.length ?? 0} perms
                                      </span>
                                      <span className="text-xs" style={{ color:textMuted }}>
                                        {role.adminCount ?? 0} admin{role.adminCount !== 1 ? 's' : ''}
                                      </span>
                                    </div>
                                  </div>
                                  {!role.IsSystem && (
                                    <button onClick={(e) => { e.stopPropagation(); setDeleteRoleTarget(role); }}
                                      className="p-1.5 rounded-lg flex-shrink-0" style={dangerBtn} title="Delete">
                                      <FaTrash size={11} />
                                    </button>
                                  )}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>

                    {/* Assign role to admin */}
                    <div className="rounded-2xl p-5"
                      style={{ background:L?'rgba(255,255,255,.6)':'rgba(15,23,42,.4)',
                        border:L?'1px solid rgba(15,23,42,.12)':'1px solid rgba(255,255,255,.08)' }}>
                      <div className="flex items-center gap-2 mb-3">
                        <FaUserTag style={{ color:L?'#4f46e5':'#a5b4fc' }} />
                        <p className="text-xs font-bold uppercase tracking-widest" style={{ color:textMuted }}>
                          Assign Role to Admin
                        </p>
                      </div>
                      <div className="space-y-3">
                        <select value={assignAdminId} onChange={(e) => setAssignAdminId(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl text-sm" style={inputStyle}>
                          <option value="">Select admin…</option>
                          {allAdmins
                            .filter((a) => a.Role !== 'SuperAdmin')
                            .map((a) => (
                              <option key={a.Admin_ID} value={a.Admin_ID}>
                                {a.Name} ({a.roleName ?? 'No role'})
                              </option>
                            ))}
                        </select>
                        <select value={assignRoleId} onChange={(e) => setAssignRoleId(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl text-sm" style={inputStyle}>
                          <option value="">No role (remove)</option>
                          {roles.map((r) => (
                            <option key={r.Role_ID} value={r.Role_ID}>{r.Name}</option>
                          ))}
                        </select>
                        <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:.98 }}
                          onClick={handleAssignRole}
                          disabled={!assignAdminId || assigning}
                          className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
                          style={primaryBtn}>
                          {assigning ? 'Assigning…' : (assignRoleId ? 'Assign Role' : 'Remove Role')}
                        </motion.button>
                      </div>
                    </div>
                  </div>

                  {/* ── Right: permission editor ─────────────────────────── */}
                  <div className="lg:col-span-2">
                    {!selectedRole ? (
                      <div className="rounded-2xl h-64 flex flex-col items-center justify-center gap-3"
                        style={{ background:L?'rgba(255,255,255,.4)':'rgba(15,23,42,.3)',
                          border:L?'1px solid rgba(15,23,42,.1)':'1px solid rgba(255,255,255,.06)' }}>
                        <FaShieldAlt size={32} style={{ color:textMuted, opacity:.4 }} />
                        <p className="text-sm" style={{ color:textMuted }}>
                          Select a role to edit its permissions
                        </p>
                      </div>
                    ) : (
                      <motion.div key={selectedRole.Role_ID} initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
                        className="rounded-2xl overflow-hidden"
                        style={{ background:L?'rgba(255,255,255,.6)':'rgba(15,23,42,.4)',
                          border:L?'1px solid rgba(15,23,42,.12)':'1px solid rgba(255,255,255,.08)' }}>

                        {/* Role header */}
                        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom:divider }}>
                          <div>
                            <h3 className="text-lg font-bold" style={{ color:textMain }}>{selectedRole.Name}</h3>
                            {selectedRole.Description && (
                              <p className="text-xs mt-0.5" style={{ color:textMuted }}>{selectedRole.Description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs px-3 py-1 rounded-full" style={primaryBtn}>
                              {checkedKeys.size} selected
                            </span>
                            <motion.button whileHover={{ scale:1.04 }} whileTap={{ scale:.96 }}
                              onClick={handleSavePermissions} disabled={savingPerms}
                              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
                              style={primaryBtn}>
                              <FaSave /> {savingPerms ? 'Saving…' : 'Save'}
                            </motion.button>
                          </div>
                        </div>

                        {/* Quick-select row */}
                        <div className="px-5 py-2.5 flex gap-3" style={{ borderBottom:divider }}>
                          <button onClick={() => setCheckedKeys(new Set(allPerms.map((p) => p.Key)))}
                            className="text-xs px-3 py-1.5 rounded-lg"
                            style={{ background:'rgba(34,197,94,.1)', border:'1px solid rgba(34,197,94,.3)',
                              color:L?'#15803d':'#86efac' }}>
                            Select All
                          </button>
                          <button onClick={() => setCheckedKeys(new Set())}
                            className="text-xs px-3 py-1.5 rounded-lg"
                            style={{ background:L?'rgba(71,85,105,.1)':'rgba(107,114,128,.1)',
                              border:L?'1px solid rgba(71,85,105,.3)':'1px solid rgba(107,114,128,.3)',
                              color:textMuted }}>
                            Clear All
                          </button>
                        </div>

                        {/* Permission checkboxes by category */}
                        <div className="p-5 space-y-4">
                          {Object.entries(permsByCategory).map(([cat, perms]) => {
                            const col = catColor(cat, L);
                            const allCat = perms.every((p) => checkedKeys.has(p.Key));
                            return (
                              <div key={cat} className="rounded-xl p-4"
                                style={{ background:col.bg, border:`1px solid ${col.border}` }}>
                                <div className="flex items-center justify-between mb-3">
                                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color:col.label }}>
                                    {cat}
                                  </span>
                                  <button
                                    onClick={() => setCheckedKeys((prev) => {
                                      const next = new Set(prev);
                                      if (allCat) perms.forEach((p) => next.delete(p.Key));
                                      else        perms.forEach((p) => next.add(p.Key));
                                      return next;
                                    })}
                                    className="text-xs px-3 py-1 rounded-lg"
                                    style={{ background:L?'rgba(255,255,255,.6)':'rgba(0,0,0,.2)',
                                      border:`1px solid ${col.border}`, color:col.label }}>
                                    {allCat ? 'Deselect all' : 'Select all'}
                                  </button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {perms.map((perm) => {
                                    const checked = checkedKeys.has(perm.Key);
                                    return (
                                      <label key={perm.Key}
                                        className="flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all duration-150"
                                        style={{
                                          background: checked
                                            ? (L?'rgba(255,255,255,.7)':'rgba(255,255,255,.07)')
                                            : (L?'rgba(255,255,255,.4)':'rgba(0,0,0,.15)'),
                                          border: checked ? `1px solid ${col.border}` : '1px solid transparent',
                                        }}>
                                        <div className="mt-0.5 w-4 h-4 rounded flex-shrink-0 flex items-center justify-center"
                                          style={{
                                            background: checked ? col.label : (L?'rgba(71,85,105,.15)':'rgba(107,114,128,.2)'),
                                            border: `1.5px solid ${checked ? col.label : (L?'rgba(71,85,105,.4)':'rgba(107,114,128,.4)')}`,
                                          }}>
                                          {checked && <span style={{ color:'#fff', fontSize:9, fontWeight:900 }}>✓</span>}
                                        </div>
                                        <input type="checkbox" className="sr-only" checked={checked}
                                          onChange={() => setCheckedKeys((prev) => {
                                            const next = new Set(prev);
                                            if (checked) next.delete(perm.Key);
                                            else         next.add(perm.Key);
                                            return next;
                                          })} />
                                        <div className="min-w-0">
                                          <p className="text-sm font-semibold" style={{ color:textMain }}>{perm.Name}</p>
                                          {perm.Description && (
                                            <p className="text-xs mt-0.5" style={{ color:textMuted }}>{perm.Description}</p>
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

                        {/* Bottom save */}
                        <div className="px-5 pb-5">
                          <motion.button whileHover={{ scale:1.01 }} whileTap={{ scale:.99 }}
                            onClick={handleSavePermissions} disabled={savingPerms}
                            className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-40"
                            style={primaryBtn}>
                            <FaSave className="inline mr-2" />
                            {savingPerms ? 'Saving…' : `Save Permissions for "${selectedRole.Name}"`}
                          </motion.button>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Access Requests tab ──────────────────────────────────────── */}
          {selectedTab === 'access' && (
            <div className="p-6">
              {!accessRequestsLoaded ? (
                <div className="flex items-center justify-center py-16">
                  <div style={{ width:36, height:36, borderRadius:'50%',
                    border:'3px solid rgba(6,182,212,.2)', borderTopColor:'#06b6d4',
                    animation:'spin .8s linear infinite' }} />
                </div>
              ) : accessRequests.length === 0 ? (
                <div className="text-center py-16">
                  <FaEnvelopeOpenText size={40} className="mx-auto mb-3" style={{ color:textMuted, opacity:.3 }} />
                  <p className="text-lg font-semibold" style={{ color:textMain }}>No access requests</p>
                  <p className="text-sm mt-1" style={{ color:textMuted }}>Requests from admin users will appear here</p>
                  <button onClick={loadAccessRequests}
                    className="mt-4 px-4 py-2 rounded-xl text-sm font-medium"
                    style={primaryBtn}>
                    Refresh
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Filter row */}
                  <div className="flex gap-2 mb-4">
                    {['all','pending','approved','rejected'].map((s) => (
                      <button key={s}
                        onClick={async () => {
                          const res = await accessRequestAPI.getAll(s === 'all' ? undefined : s).catch(() => null);
                          if (res) setAccessRequests(res.data ?? []);
                        }}
                        className="px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
                        style={{
                          background: s==='pending'?'rgba(245,158,11,.12)':s==='approved'?'rgba(34,197,94,.1)':s==='rejected'?'rgba(239,68,68,.1)':L?'rgba(71,85,105,.1)':'rgba(107,114,128,.12)',
                          border:     s==='pending'?'1px solid rgba(245,158,11,.4)':s==='approved'?'1px solid rgba(34,197,94,.35)':s==='rejected'?'1px solid rgba(239,68,68,.3)':L?'1px solid rgba(71,85,105,.25)':'1px solid rgba(107,114,128,.25)',
                          color:      s==='pending'?'#f59e0b':s==='approved'?(L?'#15803d':'#86efac'):s==='rejected'?(L?'#991b1b':'#fca5a5'):textMuted,
                        }}>
                        {s === 'all' ? 'All' : s.charAt(0).toUpperCase()+s.slice(1)}
                      </button>
                    ))}
                  </div>

                  {accessRequests.map((req) => {
                    const isPending  = req.Status === 'pending';
                    const isApproved = req.Status === 'approved';
                    const statusColor = isPending ? '#f59e0b' : isApproved ? '#22c55e' : '#ef4444';
                    const statusBg    = isPending ? 'rgba(245,158,11,.12)' : isApproved ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)';
                    const statusBdr   = isPending ? 'rgba(245,158,11,.35)' : isApproved ? 'rgba(34,197,94,.35)' : 'rgba(239,68,68,.3)';
                    return (
                      <motion.div key={req.Request_ID} initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
                        className="rounded-xl p-5"
                        style={{ background:L?'rgba(255,255,255,.7)':'rgba(15,23,42,.4)',
                          border:L?'1px solid rgba(15,23,42,.1)':'1px solid rgba(255,255,255,.08)' }}>
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          {/* Left info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-sm" style={{ color:textMain }}>{req.admin?.Name ?? '—'}</p>
                              <span className="text-xs px-2 py-0.5 rounded-full"
                                style={{ background:L?'rgba(99,102,241,.1)':'rgba(168,85,247,.1)',
                                  border:L?'1px solid rgba(99,102,241,.3)':'1px solid rgba(168,85,247,.3)',
                                  color:L?'#4f46e5':'#d8b4fe' }}>
                                {req.admin?.Email}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg"
                                style={{ background:L?'rgba(6,182,212,.08)':'rgba(6,182,212,.1)',
                                  border:'1px solid rgba(6,182,212,.3)' }}>
                                <FaKey size={10} style={{ color:'#67e8f9' }} />
                                <span className="text-xs font-semibold" style={{ color:L?'#0891b2':'#67e8f9' }}>
                                  {req.permissionName}
                                </span>
                                <span className="text-[10px]" style={{ color:textMuted }}>· {req.permissionCategory}</span>
                              </div>
                              <span className="px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide"
                                style={{ background:statusBg, border:`1px solid ${statusBdr}`, color:statusColor }}>
                                {req.Status}
                              </span>
                            </div>
                            {req.Message && (
                              <p className="mt-2 text-xs italic" style={{ color:textMuted }}>
                                "{req.Message}"
                              </p>
                            )}
                            {req.ReviewNote && !isPending && (
                              <p className="mt-1 text-xs" style={{ color:textMuted }}>
                                Review note: {req.ReviewNote}
                              </p>
                            )}
                            <p className="mt-1 text-[11px]" style={{ color:textMuted }}>
                              Requested {new Date(req.RequestedAt).toLocaleString()}
                            </p>
                          </div>

                          {/* Approve / Reject buttons (pending only) */}
                          {isPending && (
                            <div className="flex flex-col gap-2 flex-shrink-0">
                              <input
                                className="px-3 py-1.5 rounded-lg text-xs"
                                style={{ ...inputStyle, width:160 }}
                                placeholder="Optional note…"
                                value={noteMap[req.Request_ID] ?? ''}
                                onChange={(e) => setNoteMap((prev) => ({ ...prev, [req.Request_ID]: e.target.value }))}
                              />
                              <div className="flex gap-2">
                                <motion.button whileHover={{ scale:1.04 }} whileTap={{ scale:.96 }}
                                  onClick={() => handleReviewRequest(req.Request_ID, 'approve')}
                                  disabled={reviewingId === req.Request_ID}
                                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
                                  style={{ background:'rgba(34,197,94,.12)', border:'1px solid rgba(34,197,94,.4)',
                                    color:L?'#15803d':'#86efac' }}>
                                  {reviewingId === req.Request_ID ? '…' : <><FaCheck size={10} /> Approve</>}
                                </motion.button>
                                <motion.button whileHover={{ scale:1.04 }} whileTap={{ scale:.96 }}
                                  onClick={() => handleReviewRequest(req.Request_ID, 'reject')}
                                  disabled={reviewingId === req.Request_ID}
                                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
                                  style={dangerBtn}>
                                  {reviewingId === req.Request_ID ? '…' : <><FaTimes size={10} /> Reject</>}
                                </motion.button>
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Add User Modal ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showAddUserModal && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
            style={{ background:L?'rgba(0,0,0,.4)':'rgba(0,0,0,.7)', backdropFilter:'blur(10px)' }}>
            <motion.div initial={{ opacity:0, scale:.9 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:.9 }}
              className="rounded-2xl p-8 max-w-md w-full shadow-2xl"
              style={{ background:L?'rgba(255,255,255,.95)':'rgba(15,23,42,.95)',
                backdropFilter:'blur(20px)',
                border:L?'1px solid rgba(37,99,235,.3)':'1px solid rgba(6,182,212,.3)',
                boxShadow:'0 20px 60px rgba(0,0,0,.5)' }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color:L?'#182440':'#ffffff' }}>
                  <FaUserPlus /> Add New User
                </h2>
                <button onClick={() => { setShowAddUserModal(false); setNewUser({ name:'', email:'' }); }}
                  style={{ color:L?'#64748b':'#9ca3af' }}>
                  <FaClose size={24} />
                </button>
              </div>
              <form onSubmit={handleAddUser} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color:L?'#182440':'#d1d5db' }}>Full Name</label>
                  <input type="text" value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name:e.target.value })}
                    className="w-full px-4 py-3 rounded-xl transition-all duration-200"
                    style={inputStyle}
                    onFocus={(e) => e.target.style.border=L?'1px solid rgba(37,99,235,.6)':'1px solid rgba(6,182,212,.6)'}
                    onBlur={(e)  => e.target.style.border='1px solid rgba(107,114,128,.4)'}
                    placeholder="Enter user's full name" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color:L?'#182440':'#d1d5db' }}>Email Address</label>
                  <input type="email" value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email:e.target.value })}
                    className="w-full px-4 py-3 rounded-xl transition-all duration-200"
                    style={inputStyle}
                    onFocus={(e) => e.target.style.border=L?'1px solid rgba(37,99,235,.6)':'1px solid rgba(6,182,212,.6)'}
                    onBlur={(e)  => e.target.style.border='1px solid rgba(107,114,128,.4)'}
                    placeholder="Enter user's email" required />
                </div>
                <div className="rounded-xl p-4" style={{ background:L?'rgba(37,99,235,.08)':'rgba(6,182,212,.05)',
                  border:L?'1px solid rgba(37,99,235,.2)':'1px solid rgba(6,182,212,.2)' }}>
                  <p className="text-sm" style={{ color:L?'#182440':'#d1d5db' }}>
                    A password reset email will be sent to the user automatically.
                  </p>
                </div>
                <div className="flex gap-3 mt-6">
                  <button type="button"
                    onClick={() => { setShowAddUserModal(false); setNewUser({ name:'', email:'' }); }}
                    className="flex-1 px-6 py-3 rounded-xl font-medium transition-all duration-300"
                    style={{ background:L?'rgba(71,85,105,.15)':'rgba(107,114,128,.2)',
                      border:L?'1px solid rgba(71,85,105,.4)':'1px solid rgba(107,114,128,.4)',
                      color:L?'#334155':'#d1d5db' }}
                    disabled={isAddingUser}>
                    Cancel
                  </button>
                  <button type="submit"
                    className="flex-1 px-6 py-3 rounded-xl font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    style={primaryBtn} disabled={isAddingUser}>
                    {isAddingUser ? 'Adding…' : <><FaUserPlus /> Add User</>}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Logout confirm modal ────────────────────────────────────────────── */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
            style={{ background:L?'rgba(0,0,0,.4)':'rgba(0,0,0,.7)', backdropFilter:'blur(10px)' }}>
            <motion.div initial={{ opacity:0, scale:.9 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:.9 }}
              className="rounded-2xl p-8 max-w-md w-full shadow-2xl"
              style={{ background:L?'rgba(255,255,255,.95)':'rgba(15,23,42,.95)',
                backdropFilter:'blur(20px)',
                border:L?'1px solid rgba(185,28,28,.3)':'1px solid rgba(239,68,68,.3)',
                boxShadow:'0 20px 60px rgba(0,0,0,.5)' }}>
              <div className="text-center">
                <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4"
                  style={{ background:L?'rgba(185,28,28,.15)':'rgba(239,68,68,.1)',
                    border:L?'1px solid rgba(185,28,28,.4)':'1px solid rgba(239,68,68,.3)' }}>
                  <FaSignOutAlt className="text-3xl" style={{ color:L?'#991b1b':'#f87171' }} />
                </div>
                <h2 className="text-2xl font-bold mb-2" style={{ color:L?'#182440':'#ffffff' }}>Logout Confirmation</h2>
                <p className="mb-6" style={{ color:L?'#475569':'#d1d5db' }}>Are you sure you want to logout?</p>
                <div className="flex gap-3">
                  <button onClick={() => setShowLogoutConfirm(false)}
                    className="flex-1 px-6 py-3 rounded-xl font-medium"
                    style={{ background:L?'rgba(71,85,105,.15)':'rgba(107,114,128,.2)',
                      border:L?'1px solid rgba(71,85,105,.4)':'1px solid rgba(107,114,128,.4)',
                      color:L?'#334155':'#d1d5db' }}>
                    Cancel
                  </button>
                  <button onClick={() => { logout(); navigate('/login'); }}
                    className="flex-1 px-6 py-3 rounded-xl font-medium"
                    style={dangerBtn}>
                    Logout
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Delete admin confirm modal ──────────────────────────────────────── */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
            style={{ background:L?'rgba(0,0,0,.4)':'rgba(0,0,0,.7)', backdropFilter:'blur(10px)' }}>
            <motion.div initial={{ opacity:0, scale:.9 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:.9 }}
              className="rounded-2xl p-8 max-w-md w-full shadow-2xl"
              style={{ background:L?'rgba(255,255,255,.95)':'rgba(15,23,42,.95)',
                backdropFilter:'blur(20px)',
                border:L?'1px solid rgba(185,28,28,.3)':'1px solid rgba(239,68,68,.3)',
                boxShadow:'0 20px 60px rgba(0,0,0,.5)' }}>
              <div className="text-center">
                <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4"
                  style={{ background:L?'rgba(185,28,28,.15)':'rgba(239,68,68,.1)',
                    border:L?'1px solid rgba(185,28,28,.4)':'1px solid rgba(239,68,68,.3)' }}>
                  <FaTrash className="text-3xl" style={{ color:L?'#991b1b':'#f87171' }} />
                </div>
                <h2 className="text-2xl font-bold mb-2" style={{ color:L?'#182440':'#ffffff' }}>Delete User</h2>
                <p className="mb-6" style={{ color:L?'#475569':'#d1d5db' }}>
                  Are you sure you want to delete this user? This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button onClick={() => { setShowDeleteConfirm(false); setAdminToDelete(null); }}
                    className="flex-1 px-6 py-3 rounded-xl font-medium"
                    style={{ background:L?'rgba(71,85,105,.15)':'rgba(107,114,128,.2)',
                      border:L?'1px solid rgba(71,85,105,.4)':'1px solid rgba(107,114,128,.4)',
                      color:L?'#334155':'#d1d5db' }}>
                    Cancel
                  </button>
                  <button onClick={confirmDeleteAdmin} className="flex-1 px-6 py-3 rounded-xl font-medium" style={dangerBtn}>
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Delete role confirm modal ───────────────────────────────────────── */}
      <AnimatePresence>
        {deleteRoleTarget && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
            style={{ background:'rgba(0,0,0,.6)', backdropFilter:'blur(8px)' }}>
            <motion.div initial={{ opacity:0, scale:.9 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:.9 }}
              className="rounded-2xl p-8 max-w-sm w-full"
              style={{ background:L?'rgba(255,255,255,.95)':'rgba(15,23,42,.95)',
                border:L?'1px solid rgba(185,28,28,.3)':'1px solid rgba(239,68,68,.3)',
                boxShadow:'0 20px 60px rgba(0,0,0,.5)' }}>
              <div className="text-center">
                <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-4"
                  style={{ background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.3)' }}>
                  <FaTrash size={22} style={{ color:L?'#991b1b':'#f87171' }} />
                </div>
                <h2 className="text-xl font-bold mb-1" style={{ color:L?'#182440':'#ffffff' }}>Delete Role</h2>
                <p className="mb-1 text-sm" style={{ color:textMain }}>
                  Delete <strong>"{deleteRoleTarget.Name}"</strong>?
                </p>
                <p className="mb-6 text-xs" style={{ color:textMuted }}>
                  Admins assigned to this role will lose their permissions.
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setDeleteRoleTarget(null)}
                    className="flex-1 py-2.5 rounded-xl text-sm"
                    style={{ background:L?'rgba(71,85,105,.1)':'rgba(107,114,128,.15)',
                      border:L?'1px solid rgba(71,85,105,.3)':'1px solid rgba(107,114,128,.3)',
                      color:textMuted }}>
                    Cancel
                  </button>
                  <button onClick={handleDeleteRole} disabled={deletingRole}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                    style={dangerBtn}>
                    {deletingRole ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Admin Detail View Modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {viewingAdmin && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
            style={{ background:L?'rgba(0,0,0,.4)':'rgba(0,0,0,.75)', backdropFilter:'blur(10px)' }}
            onClick={() => setViewingAdmin(null)}>
            <motion.div
              initial={{ opacity:0, scale:.93, y:16 }}
              animate={{ opacity:1, scale:1,   y:0  }}
              exit  ={{ opacity:0, scale:.93, y:16 }}
              transition={{ type:'spring', stiffness:300, damping:28 }}
              className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden"
              style={{ background:L?'rgba(255,255,255,.97)':'rgba(10,14,39,.98)',
                border:L?'1px solid rgba(37,99,235,.25)':'1px solid rgba(6,182,212,.25)',
                boxShadow:'0 24px 80px rgba(0,0,0,.55)' }}
              onClick={(e) => e.stopPropagation()}>

              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
                style={{ borderBottom:divider }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background:L?'rgba(37,99,235,.1)':'rgba(6,182,212,.12)',
                      border:L?'1px solid rgba(37,99,235,.3)':'1px solid rgba(6,182,212,.3)' }}>
                    <FaEye style={{ color:L?'#2563eb':'#67e8f9' }} />
                  </div>
                  <div>
                    <h2 className="font-bold text-base" style={{ color:textMain }}>Admin Details</h2>
                    <p className="text-xs" style={{ color:textMuted }}>Role, permissions &amp; access requests</p>
                  </div>
                </div>
                <button onClick={() => setViewingAdmin(null)}
                  className="p-2 rounded-xl transition-colors"
                  style={{ color:textMuted }}
                  onMouseEnter={(e) => e.currentTarget.style.background = L?'rgba(0,0,0,.06)':'rgba(255,255,255,.06)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                  <FaClose size={16} />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

                {/* Profile card */}
                <div className="flex items-center gap-4 p-4 rounded-2xl"
                  style={{ background:L?'rgba(241,245,249,.8)':'rgba(255,255,255,.04)',
                    border:divider }}>
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white flex-shrink-0"
                    style={{ background:L?'linear-gradient(135deg,#3b82f6,#6366f1)':'linear-gradient(135deg,#06b6d4,#6366f1)' }}>
                    {viewingAdmin.Name?.charAt(0).toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xl font-bold truncate" style={{ color:textMain }}>{viewingAdmin.Name}</p>
                    <p className="text-sm truncate mt-0.5" style={{ color:textMuted }}>{viewingAdmin.Email}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="px-3 py-1 rounded-lg text-xs font-semibold"
                        style={{ background:L?'rgba(99,102,241,.1)':'rgba(168,85,247,.12)',
                          border:L?'1px solid rgba(99,102,241,.3)':'1px solid rgba(168,85,247,.35)',
                          color:L?'#4f46e5':'#d8b4fe' }}>
                        #{viewingAdmin.Admin_ID}
                      </span>
                      <span className="px-3 py-1 rounded-lg text-xs font-semibold"
                        style={{ background:L?'rgba(6,182,212,.08)':'rgba(6,182,212,.1)',
                          border:'1px solid rgba(6,182,212,.3)', color:L?'#0891b2':'#67e8f9' }}>
                        {viewingAdmin.Role}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Role & permissions section */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest mb-3"
                    style={{ color:textMuted }}>
                    Role &amp; Permissions
                  </p>

                  {!viewingAdmin.Role_ID ? (
                    <div className="flex items-center gap-3 p-4 rounded-xl"
                      style={{ background:L?'rgba(245,158,11,.07)':'rgba(245,158,11,.08)',
                        border:'1px solid rgba(245,158,11,.3)' }}>
                      <FaLock style={{ color:'#f59e0b' }} />
                      <div>
                        <p className="text-sm font-semibold" style={{ color:L?'#92400e':'#fde68a' }}>No role assigned</p>
                        <p className="text-xs mt-0.5" style={{ color:textMuted }}>
                          This admin has no structured role — assign one in the Roles &amp; Permissions tab.
                        </p>
                      </div>
                    </div>
                  ) : loadingViewPerms ? (
                    <div className="flex items-center justify-center py-8">
                      <div style={{ width:28, height:28, borderRadius:'50%',
                        border:'3px solid rgba(6,182,212,.2)', borderTopColor:'#06b6d4',
                        animation:'spin .8s linear infinite' }} />
                    </div>
                  ) : (
                    <>
                      {/* Role name banner */}
                      <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-3"
                        style={{ background:L?'rgba(37,99,235,.08)':'rgba(6,182,212,.08)',
                          border:L?'1px solid rgba(37,99,235,.25)':'1px solid rgba(6,182,212,.25)' }}>
                        <FaShieldAlt style={{ color:L?'#2563eb':'#67e8f9' }} />
                        <span className="font-semibold text-sm" style={{ color:L?'#1e40af':'#67e8f9' }}>
                          {viewingAdmin.roleName ?? 'Custom Role'}
                        </span>
                        <span className="ml-auto text-xs" style={{ color:textMuted }}>
                          {viewRolePerms.length} permission{viewRolePerms.length !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {viewRolePerms.length === 0 ? (
                        <p className="text-sm text-center py-4" style={{ color:textMuted }}>
                          No permissions assigned to this role yet.
                        </p>
                      ) : (
                        (() => {
                          const grouped = {};
                          for (const p of viewRolePerms) (grouped[p.Category] ??= []).push(p);
                          return Object.entries(grouped).map(([cat, perms]) => {
                            const col = catColor(cat, L);
                            return (
                              <div key={cat} className="mb-3 rounded-xl overflow-hidden"
                                style={{ border:`1px solid ${col.border}` }}>
                                <div className="px-4 py-2 flex items-center gap-2"
                                  style={{ background:col.bg }}>
                                  <div className="w-1.5 h-1.5 rounded-full" style={{ background:col.label }} />
                                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color:col.label }}>
                                    {cat}
                                  </span>
                                </div>
                                <div className="divide-y" style={{ borderColor: L?'rgba(0,0,0,.04)':'rgba(255,255,255,.04)' }}>
                                  {perms.map((p) => (
                                    <div key={p.Key} className="flex items-center gap-3 px-4 py-2.5">
                                      <FaUnlock size={11} style={{ color:col.label, flexShrink:0 }} />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold" style={{ color:textMain }}>{p.Name}</p>
                                        {p.Description && (
                                          <p className="text-xs truncate" style={{ color:textMuted }}>{p.Description}</p>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          });
                        })()
                      )}
                    </>
                  )}
                </div>

                {/* Access request history for this admin */}
                {(() => {
                  const adminReqs = accessRequests.filter((r) => r.Admin_ID === viewingAdmin.Admin_ID);
                  if (!adminReqs.length) return null;
                  const statusStyle = {
                    pending:  { color:'#f59e0b', bg:'rgba(245,158,11,.1)',  border:'rgba(245,158,11,.3)'  },
                    approved: { color:'#22c55e', bg:'rgba(34,197,94,.1)',   border:'rgba(34,197,94,.3)'   },
                    rejected: { color:'#ef4444', bg:'rgba(239,68,68,.1)',   border:'rgba(239,68,68,.3)'   },
                  };
                  return (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color:textMuted }}>
                        Access Request History ({adminReqs.length})
                      </p>
                      <div className="space-y-2">
                        {adminReqs.map((req) => {
                          const ss = statusStyle[req.Status] ?? statusStyle.pending;
                          return (
                            <div key={req.Request_ID}
                              className="flex items-center gap-3 px-4 py-3 rounded-xl"
                              style={{ background:L?'rgba(241,245,249,.7)':'rgba(255,255,255,.03)',
                                border:divider }}>
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ background:ss.bg, border:`1px solid ${ss.border}` }}>
                                <FaKey size={11} style={{ color:ss.color }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate" style={{ color:textMain }}>
                                  {req.permissionName ?? req.Permission_Key}
                                </p>
                                <p className="text-xs" style={{ color:textMuted }}>
                                  {new Date(req.RequestedAt).toLocaleDateString(undefined, { day:'numeric', month:'short', year:'numeric' })}
                                  {req.ReviewNote && ` · ${req.ReviewNote}`}
                                </p>
                              </div>
                              <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg capitalize flex-shrink-0"
                                style={{ background:ss.bg, border:`1px solid ${ss.border}`, color:ss.color }}>
                                {req.Status}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 flex-shrink-0" style={{ borderTop:divider }}>
                <button onClick={() => setViewingAdmin(null)}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{ background:L?'rgba(71,85,105,.08)':'rgba(107,114,128,.12)',
                    border:L?'1px solid rgba(71,85,105,.2)':'1px solid rgba(107,114,128,.2)',
                    color:textMuted }}>
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SuperAdminDashboard;
