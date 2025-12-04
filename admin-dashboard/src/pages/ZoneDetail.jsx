/**
 * Zone Detail Page
 * Shows detailed information about a specific zone and persons present
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FiMapPin, FiRefreshCw, FiArrowLeft, FiClock, FiAlertCircle } from 'react-icons/fi';
import { zoneAPI } from '../api/api';
import { format } from 'date-fns';

const ZoneDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [zone, setZone] = useState(null);
  const [persons, setPersons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

      {/* Persons in Zone */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">
          Persons Currently in {zone?.Zone_Name}
        </h2>
        
        {persons.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FiMapPin size={64} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg">No one is currently in this zone</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Entry Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {persons.map((person, index) => {
                  const entryTime = person.Timestamp ? new Date(person.Timestamp) : null;
                  const duration = entryTime ? Math.floor((new Date() - entryTime) / 1000 / 60) : 0;

                  return (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-semibold">
                              {person.student?.Name?.[0] || person.teacher?.Name?.[0] || '?'}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {person.student?.Name || person.teacher?.Name || 'Unknown'}
                            </div>
                            <div className="text-sm text-gray-500">
                              {person.student?.Email || person.teacher?.Email || 'N/A'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          person.PersonType === 'STUDENT' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {person.PersonType}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {entryTime ? format(entryTime, 'HH:mm a') : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
