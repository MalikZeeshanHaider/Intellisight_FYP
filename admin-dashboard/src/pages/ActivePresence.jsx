import { useState, useEffect } from 'react';
import { getAllActivePresence } from '../api/faceRecognition';
import { zoneAPI } from '../api/api';

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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Active Presence</h1>
          <p className="text-gray-600 mt-1">
            Currently {filteredPersons.length} {filteredPersons.length === 1 ? 'person' : 'people'} in zones
          </p>
        </div>

        {/* Zone Filter */}
        <select
          value={selectedZone}
          onChange={(e) => setSelectedZone(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Zones</option>
          {zones.map(zone => (
            <option key={zone.Zone_id} value={zone.Zone_id}>
              {zone.Zone_Name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Zone Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {Object.entries(personsByZone).map(([zoneName, persons]) => (
          <div key={zoneName} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">{zoneName}</h2>
              <span className="bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full">
                {persons.length} {persons.length === 1 ? 'person' : 'people'}
              </span>
            </div>

            <div className="space-y-3">
              {persons.map((presence) => {
                const person = presence.person;
                const isStudent = presence.personType === 'Student';
                
                return (
                  <div
                    key={presence.presenceId}
                    className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                  >
                    <div className="flex-shrink-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${
                        isStudent ? 'bg-blue-500' : 'bg-green-500'
                      }`}>
                        {person?.Name?.charAt(0) || '?'}
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {person?.Name || 'Unknown'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {isStudent ? 'Student' : 'Teacher'}
                        {person?.Department && ` • ${person.Department}`}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
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

      {filteredPersons.length === 0 && !loading && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No active presence</h3>
          <p className="mt-1 text-sm text-gray-500">
            No one is currently detected in {selectedZone === 'all' ? 'any zones' : 'this zone'}.
          </p>
        </div>
      )}

      {/* Auto-refresh indicator */}
      <div className="text-center text-sm text-gray-500">
        Auto-refreshing every 10 seconds
      </div>
    </div>
  );
}
