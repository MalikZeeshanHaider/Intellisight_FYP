import { useState, useEffect } from 'react';
import { getAllActivePresence } from '../api/faceRecognition';
import { zoneAPI } from '../api/api';
import { FiActivity, FiUsers, FiClock, FiMapPin, FiChevronDown } from 'react-icons/fi';

export default function ActivePresence() {
  const [activePersons, setActivePersons] = useState([]);
  const [zones, setZones] = useState([]);
  const [selectedZone, setSelectedZone] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
      setZones(response.data || []);
    } catch (err) {
      console.error('Error fetching zones:', err);
    }
  };

  const fetchActivePresence = async () => {
    try {
      setLoading(true);
      const response = await getAllActivePresence();
      setActivePersons(response.data || []);
      setError(null);
    } catch (err) {
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
              Currently {filteredPersons.length} {filteredPersons.length === 1 ? 'person' : 'people'} detected in zones
            </p>
          </div>

          {/* Filter Section */}
          <div className="flex items-center gap-4">
            {/* Custom Dropdown */}
            <div className="relative">
              <style>{`
                .custom-active-presence-dropdown {
                  appearance: none;
                  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238849a1' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
                  background-repeat: no-repeat;
                  background-position: right 0.75rem center;
                  background-size: 1.125em;
                  padding-right: 2.5rem;
                }
                .custom-active-presence-dropdown option {
                  background-color: white;
                  color: #374151;
                  padding: 8px;
                }
                .custom-active-presence-dropdown option:hover {
                  background-color: rgba(136, 73, 161, 0.1) !important;
                  color: #8849a1ff !important;
                }
                .custom-active-presence-dropdown option:checked {
                  background-color: rgba(136, 73, 161, 0.15);
                  color: #8849a1ff;
                }
              `}</style>
              <select
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
                className="custom-active-presence-dropdown px-4 py-2 rounded-xl font-medium text-sm transition-all cursor-pointer"
                style={{ 
                  backgroundColor: '#f3f4f6',
                  color: '#6b7280',
                  border: 'none',
                  outline: 'none'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(136, 73, 161, 0.1)';
                  e.currentTarget.style.color = '#8849a1ff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.color = '#6b7280';
                }}
              >
                <option value="all">All Zones</option>
                {zones.map(zone => (
                  <option key={zone.Zone_id} value={zone.Zone_id}>
                    {zone.Zone_Name}
                  </option>
                ))}
              </select>
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
                          {isStudent ? 'Student' : 'Teacher'}
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
            No Active Presence
          </h3>
          <p className="text-gray-600">
            No one is currently detected in {selectedZone === 'all' ? 'any zones' : 'this zone'}.
          </p>
        </div>
      )}
    </div>
  );
}
