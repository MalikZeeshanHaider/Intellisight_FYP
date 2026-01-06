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
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchActivePresence, 10000);
    return () => clearInterval(interval);
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
      const response = await getAllActivePresence();
      console.log('Active Presence API Response:', response);
      // Handle both array format and { success, data } format
      if (response?.success && Array.isArray(response.data)) {
        setActivePersons(response.data);
      } else if (Array.isArray(response.data)) {
        setActivePersons(response.data);
      } else if (Array.isArray(response)) {
        setActivePersons(response);
      } else {
        setActivePersons([]);
      }
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

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDuration = (entryTime) => {
    const now = new Date();
    const entry = new Date(entryTime);
    const minutes = Math.floor((now - entry) / 60000);
    
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
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

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="relative p-6 rounded-2xl bg-white" style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2" style={{ color: '#8849a1ff' }}>
              Active Presence
            </h1>
            <p className="text-sm font-medium" style={{ color: '#6b7280' }}>
              Currently <span className="font-bold" style={{ color: '#8849a1ff' }}>{activePersons.length}</span> identified {activePersons.length === 1 ? 'person' : 'people'} in zones
              {selectedZone !== 'all' && (
                <span> • Showing <span className="font-bold" style={{ color: '#8849a1ff' }}>{filteredPersons.length}</span> in selected zone</span>
              )}
            </p>
          </div>

          {/* Filter Section */}
          <div className="flex items-center gap-4">
            {/* Custom Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm bg-gray-100 hover:bg-purple-100 text-gray-700 hover:text-purple-700"
                style={{ minWidth: '140px' }}
              >
                <span>{getSelectedZoneName()}</span>
                <FiChevronDown className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {dropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-full min-w-[160px] bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50">
                  <button
                    onClick={() => { setSelectedZone('all'); setDropdownOpen(false); }}
                    className={`w-full text-left px-4 py-2 text-sm font-medium hover:bg-purple-100 hover:text-purple-700 ${selectedZone === 'all' ? 'bg-purple-50 text-purple-700' : 'text-gray-700'}`}
                  >
                    All Zones
                  </button>
                  {zones.map(zone => (
                    <button
                      key={zone.Zone_id}
                      onClick={() => { setSelectedZone(zone.Zone_id); setDropdownOpen(false); }}
                      className={`w-full text-left px-4 py-2 text-sm font-medium hover:bg-purple-100 hover:text-purple-700 ${selectedZone.toString() === zone.Zone_id.toString() ? 'bg-purple-50 text-purple-700' : 'text-gray-700'}`}
                    >
                      {zone.Zone_Name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Auto-refresh indicator */}
            <div className="flex items-center gap-2 text-gray-500 text-sm font-medium">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#8849a1ff' }}></div>
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
            className="bg-white rounded-xl p-6 transition-all duration-200"
            style={{ 
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(136, 73, 161, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)';
            }}
          >
            {/* Zone Header */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b" style={{ borderColor: 'rgba(136, 73, 161, 0.1)' }}>
              <div className="flex items-center gap-2">
                <FiMapPin style={{ color: '#8849a1ff' }} size={20} />
                <h2 className="text-xl font-semibold" style={{ color: '#8849a1ff' }}>
                  {zoneName}
                </h2>
              </div>
              <span 
                className="px-3 py-1 rounded-full text-sm font-medium"
                style={{ 
                  backgroundColor: 'rgba(136, 73, 161, 0.1)', 
                  color: '#8849a1ff'
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
                const isStudent = presence.personType === 'Student';
                
                return (
                  <div
                    key={presence.presenceId}
                    className="flex items-start gap-3 p-3 rounded-lg transition-all duration-200"
                    style={{ 
                      backgroundColor: '#f9fafb'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(136, 73, 161, 0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#f9fafb';
                    }}
                  >
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      <div 
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-lg"
                        style={{ 
                          backgroundColor: isStudent ? '#6365baff' : '#247e5bff'
                        }}
                      >
                        {person?.Name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                    </div>
                    
                    {/* Person Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {person?.Name || 'Unknown'}
                      </p>
                      <p className="text-xs text-gray-600 flex items-center gap-1">
                        <span className="px-2 py-0.5 rounded font-medium" style={{ 
                          backgroundColor: isStudent ? 'rgba(99, 101, 186, 0.1)' : 'rgba(36, 126, 91, 0.1)',
                          color: isStudent ? '#6365baff' : '#247e5bff'
                        }}>
                          {isStudent ? 'Student' : 'Faculty'}
                        </span>
                        {person?.Department && (
                          <>
                            <span className="text-gray-400">•</span>
                            <span>{person.Department}</span>
                          </>
                        )}
                      </p>
                      <p className="text-xs mt-1 flex items-center gap-1 font-medium" style={{ color: '#8849a1ff' }}>
                        <FiClock size={12} />
                        Entered {formatTime(presence.entryTime)} • {getDuration(presence.entryTime)}
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
        <div className="text-center py-16 bg-white rounded-xl" style={{ 
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)'
        }}>
          <div className="w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: 'rgba(136, 73, 161, 0.1)' }}>
            <FiActivity style={{ color: '#8849a1ff' }} size={40} />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No Identified Persons
          </h3>
          <p className="text-gray-600">
            No identified students or faculty are currently in {selectedZone === 'all' ? 'any zones' : 'this zone'}.
          </p>
        </div>
      )}
    </div>
  );
}
