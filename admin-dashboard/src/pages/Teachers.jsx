/**
 * Teachers Page
 * Display and manage all teachers
 */

import React, { useState, useEffect } from 'react';
import { FiRefreshCw, FiSearch, FiAlertCircle, FiPlus, FiEdit2, FiTrash2, FiUserCheck } from 'react-icons/fi';
import { GiTeacher } from 'react-icons/gi';
import { teacherAPI } from '../api/api';
import { enrollPerson } from '../api/faceRecognition';
import AddTeacherModal from '../components/AddTeacherModal';
import EditTeacherModal from '../components/EditTeacherModal';

const Teachers = () => {
  const [teachers, setTeachers] = useState([]);
  const [filteredTeachers, setFilteredTeachers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [enrollingIds, setEnrollingIds] = useState(new Set());

  // Fetch teachers
  const fetchTeachers = async () => {
    try {
      setError(null);
      setLoading(true);

      const response = await teacherAPI.getAllTeachers();

      if (response.success && response.data) {
        setTeachers(response.data);
        setFilteredTeachers(response.data);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error fetching teachers:', err);
      setError('Failed to load teachers');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  // Search filter
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredTeachers(teachers);
    } else {
      const filtered = teachers.filter(teacher =>
        teacher.Name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        teacher.Email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        teacher.Faculty_Type?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredTeachers(filtered);
    }
  }, [searchQuery, teachers]);

  // Handle edit
  const handleEdit = (teacher) => {
    setSelectedTeacher(teacher);
    setIsEditModalOpen(true);
  };

  // Handle delete
  const handleDelete = async (teacherId) => {
    if (deleteConfirm !== teacherId) {
      setDeleteConfirm(teacherId);
      setTimeout(() => setDeleteConfirm(null), 3000);
      return;
    }

    try {
      await teacherAPI.deleteTeacher(teacherId);
      await fetchTeachers();
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting teacher:', err);
      alert('Failed to delete teacher');
      setDeleteConfirm(null);
    }
  };

  // Handle enroll
  const handleEnroll = async (teacherId) => {
    try {
      setEnrollingIds(prev => new Set(prev).add(teacherId));
      const response = await enrollPerson('Teacher', teacherId);
      
      if (response.success) {
        alert(`Face enrollment successful for ${response.data.name}`);
        await fetchTeachers();
      }
    } catch (err) {
      console.error('Error enrolling teacher:', err);
      alert(err.response?.data?.message || 'Failed to enroll face embeddings');
    } finally {
      setEnrollingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(teacherId);
        return newSet;
      });
    }
  };

  if (loading && teachers.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mb-4"></div>
          <p className="text-gray-600">Loading teachers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Teachers</h1>
          <p className="text-gray-600 mt-1">{teachers.length} teachers registered</p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            <FiPlus size={16} />
            <span>Add Teacher</span>
          </button>
          <button
            onClick={fetchTeachers}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
          >
            <FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <FiAlertCircle className="text-red-500 mt-0.5 mr-3 flex-shrink-0" size={20} />
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white rounded-xl shadow-md p-4">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search by name, email, or designation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>
      </div>

      {/* Teachers Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {filteredTeachers.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <GiTeacher size={64} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg">
              {searchQuery ? 'No teachers found matching your search' : 'No teachers registered'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Faculty Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Gender
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTeachers.map((teacher) => (
                  <tr key={teacher.Teacher_ID} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {teacher.Teacher_ID}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                          <span className="text-green-600 font-semibold">
                            {teacher.Name?.[0] || '?'}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {teacher.Name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        teacher.Faculty_Type === 'Permanent' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {teacher.Faculty_Type || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {teacher.Gender || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEnroll(teacher.Teacher_ID)}
                        disabled={enrollingIds.has(teacher.Teacher_ID)}
                        className="text-purple-600 hover:text-purple-900 mr-4 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Enroll face embeddings"
                      >
                        {enrollingIds.has(teacher.Teacher_ID) ? (
                          <div className="animate-spin h-5 w-5 border-2 border-purple-600 border-t-transparent rounded-full" />
                        ) : (
                          <FiUserCheck size={18} />
                        )}
                      </button>
                      <button
                        onClick={() => handleEdit(teacher)}
                        className="text-green-600 hover:text-green-900 mr-4"
                        title="Edit teacher"
                      >
                        <FiEdit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(teacher.Teacher_ID)}
                        className={`${
                          deleteConfirm === teacher.Teacher_ID
                            ? 'text-red-700 font-bold'
                            : 'text-red-600 hover:text-red-900'
                        }`}
                        title={deleteConfirm === teacher.Teacher_ID ? 'Click again to confirm' : 'Delete teacher'}
                      >
                        <FiTrash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Teacher Modal */}
      <AddTeacherModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchTeachers}
      />

      {/* Edit Teacher Modal */}
      <EditTeacherModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedTeacher(null);
        }}
        onSuccess={fetchTeachers}
        teacher={selectedTeacher}
      />
    </div>
  );
};

export default Teachers;
