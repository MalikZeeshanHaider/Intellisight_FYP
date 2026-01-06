/**
 * Current Persons Component
 * Displays grid of people currently in Zone 1
 */

import React from 'react';
import { FiUser, FiClock, FiMail } from 'react-icons/fi';
import { GiTeacher } from 'react-icons/gi';
import { format, formatDistanceToNow } from 'date-fns';

const CurrentPersons = ({ persons = [], onMarkExit }) => {
  
  const getPersonImage = (faceData) => {
    if (!faceData) return null;
    
    try {
      const base64 = faceData.type === 'Buffer' 
        ? btoa(String.fromCharCode(...faceData.data))
        : faceData;
      
      return `data:image/jpeg;base64,${base64}`;
    } catch (error) {
      return null;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">
          Currently in Zone 1
        </h2>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm font-medium text-gray-600">
            {persons.length} {persons.length === 1 ? 'person' : 'people'}
          </span>
        </div>
      </div>

      {/* Persons grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto custom-scrollbar">
        {persons.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-500">
            <FiUser size={48} className="mx-auto mb-4 opacity-30" />
            <p>No one currently in Zone 1</p>
          </div>
        ) : (
          persons.map((person) => (
            <div
              key={person.TimeTable_ID}
              className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 shadow-sm hover:shadow-md transition"
            >
              {/* Person header */}
              <div className="flex items-start space-x-3 mb-3">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {person.Face_Pictures ? (
                    <img
                      src={getPersonImage(person.Face_Pictures)}
                      alt={person.Name}
                      className="w-14 h-14 rounded-full object-cover border-2 border-white shadow"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">
                      {person.Name?.[0] || '?'}
                    </div>
                  )}
                </div>

                {/* Person info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800 truncate">
                    {person.Name || 'Unknown'}
                  </h3>
                  <div className="flex items-center space-x-2 mt-1">
                    {person.PersonType === 'TEACHER' ? (
                      <GiTeacher className="text-green-600" size={14} />
                    ) : (
                      <FiUser className="text-blue-600" size={14} />
                    )}
                    <span className="text-xs text-gray-600">
                      {person.PersonType}
                    </span>
                  </div>
                </div>
              </div>

              {/* Email */}
              {person.Email && (
                <div className="flex items-center space-x-2 text-xs text-gray-600 mb-2">
                  <FiMail size={12} />
                  <span className="truncate">{person.Email}</span>
                </div>
              )}

              {/* Entry time */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-1 text-gray-600">
                  <FiClock size={12} />
                  <span>Entered:</span>
                </div>
                <span className="font-medium text-gray-800">
                  {format(new Date(person.EntryTime), 'HH:mm:ss')}
                </span>
              </div>

              {/* Time elapsed */}
              <div className="mt-2 text-xs text-gray-500 text-center">
                {formatDistanceToNow(new Date(person.EntryTime), { addSuffix: true })}
              </div>

              {/* Exit button */}
              {onMarkExit && (
                <button
                  onClick={() => onMarkExit(person.TimeTable_ID)}
                  className="mt-3 w-full px-3 py-1 bg-red-500 text-white text-xs rounded-md hover:bg-red-600 transition"
                >
                  Mark Exit
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CurrentPersons;
