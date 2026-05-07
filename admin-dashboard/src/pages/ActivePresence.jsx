import { useState, useEffect, useRef } from 'react';
import { getAllActivePresence } from '../api/faceRecognition';
import { zoneAPI } from '../api/api';
import { FiActivity, FiUsers, FiClock, FiMapPin, FiChevronDown } from 'react-icons/fi';

export default function ActivePresence() {
  const [activePersons, setActivePersons] = useState([]);
  const [zones, setZones] = useState([]);
  const [selectedZone, setSelectedZone] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [, setTick] = useState(0);
  // Offset between server clock and client clock (ms). Corrects timezone/clock skew.
  const serverClockOffset = useRef(0);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchZones();
    fetchActivePresence();

    // Auto-refresh data every 10 seconds
    const dataInterval = setInterval(fetchActivePresence, 10000);
    // Tick every second so getDuration() updates live without waiting for a data refresh
    const tickInterval = setInterval(() => setTick(t => t + 1), 1000);
    return () => {
      clearInterval(dataInterval);
      clearInterval(tickInterval);
    };
  }, []);

  const fetchZones = async () => {
    try {
      const response = await zoneAPI.getAllZones();
      // Handle both array format and { success, data } format
      if (response?.success && Array.isArray(response.data)) {
        setZones(response.data);
      } else if (Array.isArray(response.data)) {
        setZones(response.data);
      } else if (Array.isArray(response)) {
        setZones(response);
      } else {
        setZones([]);
      }
    } catch (err) {
      console.error('Error fetching zones:', err);
      setZones([]);
    }
  };

  const fetchActivePresence = async () => {
    try {
      setLoading(true);
      const clientBefore = Date.now();
      const response = await getAllActivePresence();
      const clientAfter = Date.now();

      // Compute server clock offset: server_now vs midpoint of request round-trip
      if (response?.serverTimestamp) {
        const roundTripMid = Math.round((clientBefore + clientAfter) / 2);
        serverClockOffset.current = response.serverTimestamp - roundTripMid;
      }

      const persons = response?.success && Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data)
          ? response.data
          : Array.isArray(response)
            ? response
            : [];

      setActivePersons(persons);
      setError(null);
    } catch (err) {
      console.error('Error fetching active presence:', err);
      setError(err.response?.data?.message || 'Failed to load active presence');
    } finally {
      setLoading(false);
    }
  };

  const filteredPersons = selectedZone === 'all' 
    ? activePersons 
    : activePersons.filter(p => p.zone?.Zone_id === parseInt(selectedZone));

  const getPersonsByZone = () => {
    const byZone = {};
    filteredPersons.forEach(p => {
      const zoneName = p.zone?.Zone_Name || 'Unknown Zone';
      if (!byZone[zoneName]) {
        byZone[zoneName] = [];
      }
      byZone[zoneName].push(p);
    });
    return byZone;
  };

  // Use entryTimestamp (Unix ms from server) so there is no string-parsing ambiguity.
  const formatTime = (entryTimestamp) => {
    const ms = typeof entryTimestamp === 'number' ? entryTimestamp : new Date(entryTimestamp).getTime();
    return new Date(ms).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  // serverNow = client clock corrected by the measured server clock offset.
  // entryTimestamp is a raw Unix ms number — no string parsing, no timezone ambiguity.
  const getDuration = (entryTimestamp) => {
    const entryMs = typeof entryTimestamp === 'number'
      ? entryTimestamp
      : new Date(entryTimestamp).getTime();
    if (isNaN(entryMs)) return 'Unknown';
    const serverNow = Date.now() + serverClockOffset.current;
    const totalSecs = Math.max(0, Math.floor((serverNow - entryMs) / 1000));
    if (totalSecs < 10) return 'Just arrived';
    if (totalSecs < 60) return `${totalSecs} sec`;
    const minutes = Math.floor(totalSecs / 60);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const personsByZone = getPersonsByZone();

  if (loading && activePersons.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#8849a1ff' }}></div>
      </div>
    );
  }

  // Get selected zone name for display
  const getSelectedZoneName = () => {
    if (selectedZone === 'all') return 'All Zones';
    const zone = zones.find(z => z.Zone_id.toString() === selectedZone.toString());
    return zone ? zone.Zone_Name : 'All Zones';
  };

  const isDarkMode = document.documentElement.classList.contains('dark');

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="relative p-6 rounded-2xl" style={{ 
        background: isDarkMode 
          ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.90))'
          : '#ffffff',
        border: isDarkMode ? '1px solid rgba(168, 85, 247, 0.2)' : 'none',
        boxShadow: isDarkMode 
          ? '0 4px 20px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(168, 85, 247, 0.1)'
          : '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)' 
      }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2" style={{ color: isDarkMode ? '#c0f0f0' : '#8849a1ff' }}>
              Active Presence
            </h1>
            <p className="text-sm font-medium" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#6b7280' }}>
              Currently <span className="font-bold" style={{ color: isDarkMode ? '#a855f7' : '#8849a1ff' }}>{activePersons.length}</span> identified {activePersons.length === 1 ? 'person' : 'people'} in zones
              {selectedZone !== 'all' && (
                <span> • Showing <span className="font-bold" style={{ color: isDarkMode ? '#a855f7' : '#8849a1ff' }}>{filteredPersons.length}</span> in selected zone</span>
              )}
            </p>
          </div>

          {/* Filter Section */}
          <div className="flex items-center gap-4">
            {/* Custom Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all"
                style={{ 
                  minWidth: '140px',
                  backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : '#f3f4f6',
                  color: isDarkMode ? '#c0f0f0' : '#374151',
                  border: isDarkMode ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid #e5e7eb'
                }}
              >
                <span>{getSelectedZoneName()}</span>
                <FiChevronDown className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {dropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-full min-w-[160px] rounded-xl shadow-lg py-1 z-50" style={{
                  backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.98)' : '#ffffff',
                  border: isDarkMode ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid #e5e7eb'
                }}>
                  <button
                    onClick={() => { setSelectedZone('all'); setDropdownOpen(false); }}
                    className="w-full text-left px-4 py-2 text-sm font-medium transition-all duration-200"
                    style={{
                      backgroundColor: selectedZone === 'all' ? (isDarkMode ? 'rgba(168, 85, 247, 0.2)' : '#faf5ff') : 'transparent',
                      color: selectedZone === 'all' ? (isDarkMode ? '#a855f7' : '#7c3aed') : (isDarkMode ? '#c0f0f0' : '#374151')
                    }}
                    onMouseEnter={(e) => {
                      if (selectedZone !== 'all') {
                        e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(168, 85, 247, 0.15)' : '#faf5ff';
                        e.currentTarget.style.color = isDarkMode ? '#a855f7' : '#7c3aed';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedZone !== 'all') {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = isDarkMode ? '#c0f0f0' : '#374151';
                      }
                    }}
                  >
                    All Zones
                  </button>
                  {zones.map(zone => (
                    <button
                      key={zone.Zone_id}
                      onClick={() => { setSelectedZone(zone.Zone_id); setDropdownOpen(false); }}
                      className="w-full text-left px-4 py-2 text-sm font-medium transition-all duration-200"
                      style={{
                        backgroundColor: selectedZone.toString() === zone.Zone_id.toString() ? (isDarkMode ? 'rgba(168, 85, 247, 0.2)' : '#faf5ff') : 'transparent',
                        color: selectedZone.toString() === zone.Zone_id.toString() ? (isDarkMode ? '#a855f7' : '#7c3aed') : (isDarkMode ? '#c0f0f0' : '#374151')
                      }}
                      onMouseEnter={(e) => {
                        if (selectedZone.toString() !== zone.Zone_id.toString()) {
                          e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(168, 85, 247, 0.15)' : '#faf5ff';
                          e.currentTarget.style.color = isDarkMode ? '#a855f7' : '#7c3aed';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedZone.toString() !== zone.Zone_id.toString()) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = isDarkMode ? '#c0f0f0' : '#374151';
                        }
                      }}
                    >
                      {zone.Zone_Name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Auto-refresh indicator */}
            <div className="flex items-center gap-2 text-sm font-medium" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.6)' : '#6b7280' }}>
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: isDarkMode ? '#a855f7' : '#8849a1ff' }}></div>
              Auto-refreshing every 10s
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl border" style={{ 
          backgroundColor: 'rgba(239, 68, 68, 0.1)', 
          borderColor: 'rgba(239, 68, 68, 0.3)'
        }}>
          <p className="text-sm font-medium" style={{ color: '#ef4444' }}>{error}</p>
        </div>
      )}

      {/* Zone Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {Object.entries(personsByZone).map(([zoneName, persons]) => (
          <div 
            key={zoneName} 
            className="rounded-xl p-6 transition-all duration-300"
            style={{ 
              background: isDarkMode 
                ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.90))'
                : '#ffffff',
              border: isDarkMode ? '1px solid rgba(168, 85, 247, 0.2)' : 'none',
              boxShadow: isDarkMode 
                ? '0 4px 20px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(168, 85, 247, 0.1)'
                : '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)'
            }}
            onMouseEnter={(e) => {
              if (isDarkMode) {
                e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.5)';
                e.currentTarget.style.boxShadow = '0 0 30px rgba(168, 85, 247, 0.2)';
              } else {
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(136, 73, 161, 0.2)';
              }
            }}
            onMouseLeave={(e) => {
              if (isDarkMode) {
                e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.2)';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(168, 85, 247, 0.1)';
              } else {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)';
              }
            }}
          >
            {/* Zone Header */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b" style={{ borderColor: isDarkMode ? 'rgba(168, 85, 247, 0.2)' : 'rgba(136, 73, 161, 0.1)' }}>
              <div className="flex items-center gap-2">
                <FiMapPin style={{ color: isDarkMode ? '#a855f7' : '#8849a1ff' }} size={20} />
                <h2 className="text-xl font-semibold" style={{ color: isDarkMode ? '#c0f0f0' : '#8849a1ff' }}>
                  {zoneName}
                </h2>
              </div>
              <span 
                className="px-3 py-1 rounded-full text-sm font-medium"
                style={{ 
                  backgroundColor: isDarkMode ? 'rgba(168, 85, 247, 0.2)' : 'rgba(136, 73, 161, 0.1)', 
                  color: isDarkMode ? '#a855f7' : '#8849a1ff'
                }}
              >
                <FiUsers size={14} className="inline mr-1" />
                {persons.length}
              </span>
            </div>

            {/* Persons List */}
            <div className="space-y-3">
              {persons.map((presence) => {
                const person = presence.person;
                const isStudent = (presence.personType || '').toUpperCase() === 'STUDENT';
                
                return (
                  <div
                    key={presence.presenceId}
                    className="flex items-start gap-3 p-3 rounded-lg transition-all duration-300"
                    style={{ 
                      backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.6)' : '#f9fafb',
                      border: isDarkMode ? '1px solid rgba(168, 85, 247, 0.1)' : 'none'
                    }}
                    onMouseEnter={(e) => {
                      if (isDarkMode) {
                        e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.15)';
                        e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.3)';
                      } else {
                        e.currentTarget.style.backgroundColor = 'rgba(136, 73, 161, 0.1)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (isDarkMode) {
                        e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.6)';
                        e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.1)';
                      } else {
                        e.currentTarget.style.backgroundColor = '#f9fafb';
                      }
                    }}
                  >
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      <div 
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-lg"
                        style={{ 
                          backgroundColor: isStudent 
                            ? (isDarkMode ? 'rgba(99, 102, 241, 0.8)' : '#6365baff') 
                            : (isDarkMode ? 'rgba(16, 185, 129, 0.8)' : '#247e5bff'),
                          boxShadow: isDarkMode 
                            ? `0 0 15px ${isStudent ? 'rgba(99, 102, 241, 0.3)' : 'rgba(16, 185, 129, 0.3)'}` 
                            : 'none'
                        }}
                      >
                        {person?.Name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                    </div>
                    
                    {/* Person Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: isDarkMode ? '#c0f0f0' : '#111827' }}>
                        {person?.Name || 'Unknown'}
                      </p>
                      <p className="text-xs flex items-center gap-1" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.6)' : '#4b5563' }}>
                        <span className="px-2 py-0.5 rounded font-medium" style={{ 
                          backgroundColor: isStudent 
                            ? (isDarkMode ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 101, 186, 0.1)')
                            : (isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(36, 126, 91, 0.1)'),
                          color: isStudent 
                            ? (isDarkMode ? '#818cf8' : '#6365baff') 
                            : (isDarkMode ? '#34d399' : '#247e5bff')
                        }}>
                          {isStudent ? 'Student' : 'Faculty'}
                        </span>
                        {person?.Department && (
                          <>
                            <span style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.4)' : '#9ca3af' }}>•</span>
                            <span>{person.Department}</span>
                          </>
                        )}
                      </p>
                      <p className="text-xs mt-1 flex items-center gap-1 font-medium" style={{ color: isDarkMode ? '#a855f7' : '#8849a1ff' }}>
                        <FiClock size={12} />
                        Entered {formatTime(presence.entryTimestamp || presence.entryTime)} • {getDuration(presence.entryTimestamp || presence.entryTime)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredPersons.length === 0 && !loading && (
        <div className="text-center py-16 rounded-xl" style={{ 
          background: isDarkMode 
            ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.90))'
            : '#ffffff',
          border: isDarkMode ? '1px solid rgba(168, 85, 247, 0.2)' : 'none',
          boxShadow: isDarkMode 
            ? '0 4px 20px rgba(0, 0, 0, 0.4)'
            : '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)'
        }}>
          <div className="w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-4" style={{ 
            backgroundColor: isDarkMode ? 'rgba(168, 85, 247, 0.2)' : 'rgba(136, 73, 161, 0.1)' 
          }}>
            <FiActivity style={{ color: isDarkMode ? '#a855f7' : '#8849a1ff' }} size={40} />
          </div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: isDarkMode ? '#c0f0f0' : '#111827' }}>
            No Identified Persons
          </h3>
          <p style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.6)' : '#4b5563' }}>
            No identified students or faculty are currently in {selectedZone === 'all' ? 'any zones' : 'this zone'}.
          </p>
        </div>
      )}
    </div>
  );
}
