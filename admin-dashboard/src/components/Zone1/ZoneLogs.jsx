/**
 * Zone Logs Component
 * Displays real-time entry/exit logs for KNOWN and UNKNOWN persons
 */

import React, { useState } from 'react';
import { FiClock, FiUser, FiLogIn, FiLogOut, FiAlertCircle } from 'react-icons/fi';
import { GiTeacher } from 'react-icons/gi';
import { format } from 'date-fns';

const ZoneLogs = ({ knownLogs = [], unknownLogs = [], loading = false }) => {
  const [activeTab, setActiveTab] = useState('known'); // 'known' or 'unknown'
  
  const getPersonIcon = (type) => {
    return type === 'TEACHER' 
      ? <GiTeacher className="text-green-600" size={20} />
      : <FiUser className="text-blue-600" size={20} />;
  };

  const getPersonImage = (faceData) => {
    if (!faceData) return null;
    
    try {
      // Convert Buffer to base64 if needed
      const base64 = faceData.type === 'Buffer' 
        ? btoa(String.fromCharCode(...faceData.data))
        : faceData;
      
      return `data:image/jpeg;base64,${base64}`;
    } catch (error) {
      console.error('Error converting image:', error);
      return null;
    }
  };

  const renderKnownLogs = () => (
    <div className="space-y-3">
      {knownLogs.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <FiUser size={48} className="mx-auto mb-4 opacity-30" />
          <p>No recognized persons yet</p>
        </div>
      ) : (
        knownLogs.map((log, index) => (
          <div
            key={log.TimeTable_ID || index}
            className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg hover:bg-green-100 transition border border-green-200"
          >
            {/* Face thumbnail */}
            <div className="flex-shrink-0">
              {log.Face_Pictures ? (
                <img
                  src={getPersonImage(log.Face_Pictures)}
                  alt={log.Name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-green-500 shadow"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-semibold">
                  {log.Name?.[0] || '?'}
                </div>
              )}
            </div>

            {/* Log details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                {getPersonIcon(log.PersonType)}
                <span className="font-semibold text-gray-800 truncate">
                  {log.Name || 'Unknown Person'}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-200 text-green-800 font-medium">
                  {log.PersonType}
                </span>
              </div>
              
              <div className="flex items-center space-x-4 text-xs text-gray-600">
                <span className="flex items-center">
                  <FiLogIn className="mr-1" />
                  {format(new Date(log.EntryTime), 'HH:mm:ss')}
                </span>
                
                {log.ExitTime && (
                  <span className="flex items-center">
                    <FiLogOut className="mr-1" />
                    {format(new Date(log.ExitTime), 'HH:mm:ss')}
                  </span>
                )}
                
                {!log.ExitTime && (
                  <span className="flex items-center text-green-600 font-medium">
                    <div className="w-2 h-2 bg-green-600 rounded-full mr-1 animate-pulse"></div>
                    Inside
                  </span>
                )}
              </div>
            </div>

            {/* Status indicator */}
            <div className="flex-shrink-0">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
          </div>
        ))
      )}
    </div>
  );

  const renderUnknownLogs = () => (
    <div className="space-y-3">
      {unknownLogs.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <FiAlertCircle size={48} className="mx-auto mb-4 opacity-30" />
          <p>No unknown persons detected</p>
        </div>
      ) : (
        unknownLogs.map((log, index) => (
          <div
            key={log.Unknown_ID || index}
            className="flex items-center space-x-3 p-3 bg-red-50 rounded-lg hover:bg-red-100 transition border border-red-200"
          >
            {/* Face thumbnail */}
            <div className="flex-shrink-0">
              {log.CapturedImage ? (
                <img
                  src={log.CapturedImage}
                  alt="Unknown Person"
                  className="w-12 h-12 rounded-full object-cover border-2 border-red-500 shadow"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-white font-semibold">
                  ?
                </div>
              )}
            </div>

            {/* Log details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <FiAlertCircle className="text-red-600" size={16} />
                <span className="font-semibold text-gray-800">
                  Unknown Person
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-200 text-red-800 font-medium">
                  {log.Status}
                </span>
              </div>
              
              <div className="text-xs text-gray-600">
                <FiClock className="inline mr-1" size={12} />
                {format(new Date(log.DetectedTime), 'HH:mm:ss')}
              </div>
              
              {log.Notes && (
                <div className="text-xs text-gray-500 mt-1 truncate">
                  {log.Notes}
                </div>
              )}
            </div>

            {/* Status indicator */}
            <div className="flex-shrink-0">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            </div>
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">Activity Log</h2>
        {loading && (
          <div className="flex items-center text-sm text-gray-500">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            Updating...
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 mb-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('known')}
          className={`px-4 py-2 font-medium transition border-b-2 ${
            activeTab === 'known'
              ? 'border-green-500 text-green-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center space-x-2">
            <FiUser size={16} />
            <span>Known ({knownLogs.length})</span>
          </div>
        </button>
        
        <button
          onClick={() => setActiveTab('unknown')}
          className={`px-4 py-2 font-medium transition border-b-2 ${
            activeTab === 'unknown'
              ? 'border-red-500 text-red-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center space-x-2">
            <FiAlertCircle size={16} />
            <span>Unknown ({unknownLogs.length})</span>
          </div>
        </button>
      </div>

      {/* Logs content */}
      <div className="max-h-96 overflow-y-auto custom-scrollbar">
        {activeTab === 'known' ? renderKnownLogs() : renderUnknownLogs()}
      </div>
    </div>
  );
};

export default ZoneLogs;
