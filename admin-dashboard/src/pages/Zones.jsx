/**
 * Zones Page
 * Display all zones with management options
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMapPin, FiRefreshCw, FiPlus, FiAlertCircle, FiVideo, FiZap } from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi';
import { zoneAPI } from '../api/api';

const Zones = () => {
  const [zones, setZones] = useState([]);
  const [zoneCounts, setZoneCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Fetch zones and person counts
  const fetchZones = async () => {
    try {
      setError(null);
      setLoading(true);

      const response = await zoneAPI.getAllZones();

      if (response.success && response.data) {
        setZones(response.data);

        // Fetch person count for each zone
        const counts = {};
        for (const zone of response.data) {
          try {
            const personsData = await zoneAPI.getPersonsInZone(zone.Zone_ID);
            counts[zone.Zone_ID] = personsData.data?.length || 0;
          } catch (err) {
            counts[zone.Zone_ID] = 0;
          }
        }
        setZoneCounts(counts);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error fetching zones:', err);
      setError('Failed to load zones');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchZones();
  }, []);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(fetchZones, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading && zones.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="inline-block w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full mb-4"
            style={{ boxShadow: '0 0 20px rgba(0, 255, 255, 0.5)' }}
          />
          <p style={{ color: 'var(--text-soft)' }} className="font-medium">Loading zones...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 relative"
    >
      {/* Animated Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden dark:opacity-30 opacity-15 z-0">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
            opacity: [0.3, 0.6, 0.3]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-1/2 -right-1/2 w-full h-full rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)'
          }}
        />
      </div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between relative z-10 px-6"
      >
        <div className="relative">
          <motion.div
            animate={{
              opacity: [0, 0.5, 0],
              x: [-5, 5, -5]
            }}
            transition={{ duration: 3, repeat: Infinity, repeatDelay: 5 }}
            className="absolute inset-0 text-4xl font-display font-bold text-indigo-500 blur-sm"
          >
            Zones
          </motion.div>
          
          <h1 className="text-5xl font-display font-black relative"
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #6366f1 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: '0 0 30px rgba(99, 102, 241, 0.5)'
            }}
          >
            Zones
          </h1>
          <motion.p
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-2 mt-2"
            style={{ color: 'var(--text-soft)' }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <HiSparkles className="text-indigo-400" />
            </motion.div>
            <span className="font-semibold">Manage tracking zones</span>
          </motion.p>
        </div>

        <motion.button
          whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(99, 102, 241, 0.6)' }}
          whileTap={{ scale: 0.95 }}
          onClick={fetchZones}
          className="flex items-center gap-3 px-6 py-3 rounded-2xl font-bold relative overflow-hidden group dark:bg-gradient-to-br dark:from-indigo-500 dark:to-purple-500 bg-gradient-to-br from-indigo-600 to-indigo-700 border-2 dark:border-white/20 border-indigo-800/30"
          style={{
            boxShadow: document.documentElement.classList.contains('dark') ? '0 4px 20px rgba(99, 102, 241, 0.4)' : '0 4px 20px rgba(99, 102, 241, 0.3)'
          }}
        >
          <motion.div
            animate={loading ? { rotate: 360 } : {}}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <FiRefreshCw size={18} className="text-white" />
          </motion.div>
          <span className="text-white relative z-10">Refresh</span>
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
          />
        </motion.button>
      </motion.div>

      {/* Error Alert */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative z-10 px-6"
          >
            <div className="dark:bg-gradient-to-br dark:from-red-500/10 dark:to-red-600/10 bg-red-50 border-l-4 border-red-500 rounded-2xl p-4 flex items-start backdrop-blur-xl"
              style={{
                boxShadow: document.documentElement.classList.contains('dark') ? '0 4px 20px rgba(239, 68, 68, 0.2)' : '0 4px 20px rgba(239, 68, 68, 0.1)'
              }}
            >
              <FiAlertCircle className="text-red-500 mt-0.5 mr-3 flex-shrink-0" size={20} />
              <p className="text-red-600 dark:text-red-400 font-medium">{error}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Zones Grid */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10 px-6"
      >
        {zones.map((zone, index) => (
          <motion.div
            key={zone.Zone_ID}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.03, y: -8 }}
            className="relative p-6 rounded-3xl overflow-hidden group cursor-pointer dark:bg-gradient-to-br dark:from-indigo-500/10 dark:to-purple-500/10 bg-gradient-to-br from-white/80 to-indigo-50/80 backdrop-blur-xl dark:border-indigo-500/30 border-indigo-200"
            style={{
              boxShadow: document.documentElement.classList.contains('dark') 
                ? '0 8px 32px rgba(99, 102, 241, 0.2)' 
                : '0 10px 40px rgba(99, 102, 241, 0.15), 0 4px 12px rgba(79, 70, 229, 0.1), inset 0 -2px 8px rgba(255, 255, 255, 0.8)'
            }}
          >
            {/* Animated Background */}
            <motion.div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{
                background: 'radial-gradient(circle at center, rgba(99, 102, 241, 0.2), transparent)'
              }}
            />
            
            {/* Scan Line */}
            <motion.div
              animate={{ y: ['-100%', '200%'] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear", delay: index * 0.5 }}
              className="absolute inset-0 h-20"
              style={{
                background: 'linear-gradient(180deg, transparent, rgba(99, 102, 241, 0.3), transparent)'
              }}
            />

            <div className="flex items-start justify-between mb-4 relative z-10">
              <motion.div
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.5 }}
                className="w-14 h-14 rounded-2xl flex items-center justify-center relative"
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  boxShadow: '0 0 30px rgba(99, 102, 241, 0.6)'
                }}
              >
                <FiMapPin className="text-white" size={24} />
              </motion.div>
              <div className="text-right">
                <motion.p
                  key={zoneCounts[zone.Zone_ID]}
                  initial={{ scale: 1.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-4xl font-black dark:text-[#6366f1] text-[#4338ca]"
                  style={{
                    textShadow: document.documentElement.classList.contains('dark') ? '0 0 20px rgba(99, 102, 241, 0.8)' : '0 0 10px rgba(67, 56, 202, 0.3)'
                  }}
                >
                  {zoneCounts[zone.Zone_ID] || 0}
                </motion.p>
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-soft)' }}>persons</p>
              </div>
            </div>

            <h3 className="text-xl font-black mb-2 relative z-10" style={{ color: 'var(--text-main)' }}>
              {zone.Zone_Name}
            </h3>

            <p className="text-sm mb-4 relative z-10" style={{ color: 'var(--text-soft)' }}>
              {zone.Description || 'No description'}
            </p>

            <div className="pt-4 border-t relative z-10 space-y-2" style={{ borderColor: 'var(--border-color)' }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-soft)' }}>Zone ID: {zone.Zone_ID}</span>
              </div>

              {/* Live View Button for Zone 1 */}
              {zone.Zone_ID === 1 && (
                <motion.button
                  whileHover={{ scale: 1.02, boxShadow: '0 0 25px rgba(16, 185, 129, 0.6)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate('/zone1-live')}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold relative overflow-hidden group dark:bg-gradient-to-br dark:from-green-500 dark:to-emerald-500 bg-gradient-to-br from-green-600 to-green-700 border-2 dark:border-white/20 border-green-800/30"
                  style={{
                    boxShadow: document.documentElement.classList.contains('dark') ? '0 4px 20px rgba(16, 185, 129, 0.4)' : '0 4px 20px rgba(5, 150, 105, 0.3)'
                  }}
                >
                  <FiVideo size={16} className="text-white" />
                  <span className="text-white relative z-10">🔴 Live View</span>
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                  />
                </motion.button>
              )}

              <Link
                to={`/zones/${zone.Zone_ID}`}
                className="block w-full text-center px-4 py-2.5 rounded-xl font-bold transition-all duration-300 dark:border-indigo-500/50 border-indigo-300 dark:text-indigo-400 text-indigo-600 hover:dark:bg-indigo-500/20 hover:bg-indigo-100 border-2"
              >
                View Details →
              </Link>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Empty State */}
      {zones.length === 0 && !loading && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 px-6"
        >
          <div className="dark:bg-gradient-to-br dark:from-indigo-500/10 dark:to-purple-500/10 bg-gradient-to-br from-white/80 to-indigo-50/80 backdrop-blur-xl rounded-3xl p-12 text-center dark:border-indigo-500/30 border-indigo-200 border-2"
            style={{
              boxShadow: document.documentElement.classList.contains('dark') 
                ? '0 8px 32px rgba(99, 102, 241, 0.2)' 
                : '0 10px 40px rgba(99, 102, 241, 0.15), 0 4px 12px rgba(79, 70, 229, 0.1), inset 0 -2px 8px rgba(255, 255, 255, 0.8)'
            }}
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <FiMapPin size={64} className="mx-auto mb-4" style={{ color: 'var(--text-soft)', filter: 'drop-shadow(0 0 20px rgba(99, 102, 241, 0.5))' }} />
            </motion.div>
            <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text-main)' }}>No Zones Found</h3>
            <p style={{ color: 'var(--text-soft)' }}>No tracking zones have been configured yet.</p>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default Zones;
