/**
 * Zone Detail Page
 * Shows detailed information about a specific zone and persons present
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FiMapPin, FiRefreshCw, FiArrowLeft, FiClock, FiAlertCircle } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { zoneAPI } from '../api/api';
import { format } from 'date-fns';
import { HourlyOccupancyChart } from '../components/HourlyOccupancyChart';
import { ZoneCapacityGauge } from '../components/ZoneCapacityGauge';
import { DurationHistogram } from '../components/DurationHistogram';

const ZoneDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [zone, setZone] = useState(null);
  const [persons, setPersons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAllPersons, setShowAllPersons] = useState(false);
  const DISPLAY_LIMIT = 5;

  // Generate hourly occupancy data based on persons
  const hourlyData = useMemo(() => {
    const hours = [];
    const currentHour = new Date().getHours();
    
    for (let i = 0; i < 24; i++) {
      // Simulate occupancy pattern based on current persons
      let baseCount = 0;
      if (i >= 8 && i <= 17) {
        // Business hours - higher occupancy
        baseCount = Math.floor(persons.length * (0.5 + Math.random() * 0.5));
      } else if (i >= 6 && i < 8) {
        // Early morning - ramping up
        baseCount = Math.floor(persons.length * (0.1 + Math.random() * 0.3));
      } else if (i > 17 && i <= 20) {
        // Evening - ramping down
        baseCount = Math.floor(persons.length * (0.2 + Math.random() * 0.3));
      } else {
        // Night - minimal
        baseCount = Math.floor(persons.length * Math.random() * 0.1);
      }
      
      hours.push({
        hour: `${i.toString().padStart(2, '0')}:00`,
        count: i <= currentHour ? baseCount : null,
        capacity: zone?.Capacity || 50
      });
    }
    return hours;
  }, [persons, zone]);

  // Generate duration data based on persons
  const durationData = useMemo(() => {
    if (!persons.length) return [];
    
    return persons.map(person => {
      const entryTime = person.Timestamp ? new Date(person.Timestamp) : new Date();
      const durationMinutes = Math.floor((new Date() - entryTime) / 1000 / 60);
      return { duration: durationMinutes };
    });
  }, [persons]);

  // Redirect Zone 1 to live page
  useEffect(() => {
    if (id === '1' || id === 'zone1-live') {
      navigate('/zones/zone1-live', { replace: true });
    }
  }, [id, navigate]);

  // Fetch zone details and persons
  const fetchZoneData = async () => {
    try {
      setError(null);
      setLoading(true);

      const [zoneResponse, personsResponse] = await Promise.all([
        zoneAPI.getZoneById(id),
        zoneAPI.getPersonsInZone(id),
      ]);

      if (zoneResponse.success && zoneResponse.data) {
        setZone(zoneResponse.data);
      }

      if (personsResponse.success && personsResponse.data) {
        setPersons(personsResponse.data);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error fetching zone details:', err);
      setError('Failed to load zone details');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchZoneData();
  }, [id]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(fetchZoneData, 5000);
    return () => clearInterval(interval);
  }, [id]);

  if (loading && !zone) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading zone details...</p>
        </div>
      </div>
    );
  }

  if (error && !zone) {
    return (
      <div className="space-y-6">
        <Link to="/zones" className="inline-flex items-center text-blue-600 hover:text-blue-700">
          <FiArrowLeft className="mr-2" />
          Back to Zones
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link 
            to="/zones" 
            className="flex items-center justify-center w-10 h-10 bg-white rounded-lg shadow hover:shadow-md transition"
          >
            <FiArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">{zone?.Zone_Name}</h1>
            <p className="text-gray-600 mt-1">{zone?.Description || 'Zone details and current occupancy'}</p>
          </div>
        </div>
        
        <button
          onClick={fetchZoneData}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Zone Info Card */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center">
              <FiMapPin className="text-blue-600" size={32} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Zone ID</p>
              <p className="text-2xl font-bold text-gray-800">{zone?.Zone_ID}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-green-100 rounded-lg flex items-center justify-center">
              <span className="text-3xl font-bold text-green-600">{persons.length}</span>
            </div>
            <div>
              <p className="text-sm text-gray-600">Current Occupancy</p>
              <p className="text-2xl font-bold text-gray-800">{persons.length} Persons</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-purple-100 rounded-lg flex items-center justify-center">
              <FiClock className="text-purple-600" size={32} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Last Updated</p>
              <p className="text-lg font-bold text-gray-800">{format(new Date(), 'HH:mm:ss')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Zone Analytics Charts */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        <div className="lg:col-span-2">
          <HourlyOccupancyChart 
            data={hourlyData} 
            title={`${zone?.Zone_Name || 'Zone'} - Today's Occupancy`}
            capacity={zone?.Capacity || 50}
          />
        </div>
        <div className="space-y-6">
          <ZoneCapacityGauge 
            current={persons.length} 
            capacity={zone?.Capacity || 50}
            zoneName={zone?.Zone_Name}
          />
          {durationData.length > 0 && (
            <DurationHistogram 
              data={durationData}
              title="Visit Duration Distribution"
            />
          )}
        </div>
      </motion.div>

      {/* Persons in Zone */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100">
            Persons Currently in {zone?.Zone_Name} ({persons.length})
          </h2>
          {persons.length > DISPLAY_LIMIT && (
            <button
              onClick={() => setShowAllPersons(!showAllPersons)}
              className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded-lg border border-blue-300 dark:border-blue-700 transition-colors"
            >
              {showAllPersons ? 'Show Less' : `Show All (${persons.length})`}
            </button>
          )}
        </div>
        
        {persons.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <FiMapPin size={64} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg">No one is currently in this zone</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden sm:table-cell">
                    Type
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell">
                    Entry Time
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Duration
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {(showAllPersons ? persons : persons.slice(0, DISPLAY_LIMIT)).map((person, index) => {
                  const entryTime = person.Timestamp ? new Date(person.Timestamp) : null;
                  const duration = entryTime ? Math.floor((new Date() - entryTime) / 1000 / 60) : 0;

                  return (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 dark:text-blue-400 font-semibold">
                              {person.student?.Name?.[0] || person.teacher?.Name?.[0] || '?'}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {person.student?.Name || person.teacher?.Name || 'Unknown'}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 hidden sm:block">
                              {person.student?.Email || person.teacher?.Email || 'N/A'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          person.PersonType === 'STUDENT' 
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' 
                            : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        }`}>
                          {person.PersonType}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell">
                        {entryTime ? format(entryTime, 'HH:mm a') : 'N/A'}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {duration > 0 ? `${duration} min` : 'Just now'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ZoneDetail;
