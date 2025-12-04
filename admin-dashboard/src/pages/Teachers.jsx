/**
 * Teachers Page
 * Display and manage all teachers
 */

import React, { useState, useEffect } from 'react';
import { FiRefreshCw, FiSearch, FiAlertCircle, FiPlus, FiEdit2, FiTrash2, FiUserCheck } from 'react-icons/fi';
import { GiTeacher } from 'react-icons/gi';
import { HiSparkles } from 'react-icons/hi';
import { motion } from 'framer-motion';
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
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 shadow-lg shadow-green-500/50 mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300 text-lg">Loading teachers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {/* Animated Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-gradient-radial from-green-500/5 via-transparent to-transparent dark:from-green-500/10"></div>
        <div className="absolute inset-0 bg-gradient-radial from-purple-500/5 via-transparent to-transparent dark:from-purple-500/10" style={{ transform: 'translate(50%, 50%)' }}></div>
      </div>

      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative bg-white/80 dark:bg-surface/80 backdrop-blur-xl rounded-xl shadow-2xl p-6 border border-green-500/20"
      >
        {/* Scan Line Effect */}
        <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-green-500/10 via-transparent to-transparent animate-scan"></div>
        </div>

      <div className="flex items-center justify-between relative z-10">
        <div>
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-green-400 via-emerald-500 to-teal-600 bg-clip-text text-transparent dark:from-green-300 dark:via-emerald-400 dark:to-teal-500 flex items-center space-x-2">
            <HiSparkles className="text-green-500 dark:text-green-400" />
            <span>Teachers</span>
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">{teachers.length} teachers registered</p>
        </div>

        <div className="flex items-center space-x-3">
          <motion.button
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 dark:from-green-600 dark:to-emerald-700 text-white rounded-lg shadow-lg shadow-green-500/30 hover:shadow-green-500/50 transition-shadow"
          >
            <FiPlus size={16} />
            <span>Add Teacher</span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={fetchTeachers}
            className="flex items-center space-x-2 px-4 py-2 bg-white/50 dark:bg-surface/50 backdrop-blur-sm text-gray-700 dark:text-gray-300 rounded-lg border border-gray-300/50 dark:border-gray-600/50 hover:border-green-500/50 transition-colors"
          >
            <FiRefreshCw size={16} className={loading ? 'animate-spin text-green-500' : ''} />
            <span>Refresh</span>
          </motion.button>
        </div>
      </div>
      </motion.div>

      {/* Error Alert */}
      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/10 dark:bg-red-500/20 backdrop-blur-xl border border-red-500/30 rounded-lg p-4 flex items-start shadow-lg shadow-red-500/20 relative z-10"
        >
          <FiAlertCircle className="text-red-500 dark:text-red-400 mt-0.5 mr-3 flex-shrink-0" size={20} />
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </motion.div>
      )}

      {/* Search Bar */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative bg-white/80 dark:bg-surface/80 backdrop-blur-xl rounded-xl shadow-lg p-4 border border-green-500/20 overflow-hidden"
      >
        {/* Scan Line */}
        <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-transparent to-transparent pointer-events-none"></div>
        
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-green-500 dark:text-green-400" size={20} />
          <input
            type="text"
            placeholder="Search by name, email, or designation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/50 dark:bg-surface/50 backdrop-blur-sm border border-green-500/30 dark:border-green-500/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400 focus:border-transparent text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400"
          />
        </div>
      </motion.div>

      {/* Teachers Table */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative bg-white/80 dark:bg-surface/80 backdrop-blur-xl rounded-xl shadow-lg overflow-hidden border border-green-500/20"
      >
        {/* Scan Line */}
        <div className="absolute inset-0 bg-gradient-to-b from-green-500/5 via-transparent to-transparent pointer-events-none"></div>
        
        {filteredTeachers.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400 relative z-10">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <GiTeacher size={64} className="mx-auto mb-4 opacity-30 text-green-500" />
            </motion.div>
            <p className="text-lg">
              {searchQuery ? 'No teachers found matching your search' : 'No teachers registered'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto relative z-10">
            <table className="min-w-full divide-y divide-green-500/10">
              <thead className="bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-teal-500/10 dark:from-green-500/20 dark:via-emerald-500/20 dark:to-teal-500/20 backdrop-blur-sm">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-green-700 dark:text-green-300 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-green-700 dark:text-green-300 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-green-700 dark:text-green-300 uppercase tracking-wider">
                    Faculty Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-green-700 dark:text-green-300 uppercase tracking-wider">
                    Gender
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-green-700 dark:text-green-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-green-500/10">
                {filteredTeachers.map((teacher) => (
                  <motion.tr 
                    key={teacher.Teacher_ID} 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    whileHover={{ backgroundColor: 'rgba(34, 197, 94, 0.05)' }}
                    className="transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-700 dark:text-green-300">
                      {teacher.Teacher_ID}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <motion.div 
                          whileHover={{ scale: 1.1 }}
                          className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-green-500/20 to-emerald-500/20 dark:from-green-500/30 dark:to-emerald-500/30 rounded-full flex items-center justify-center border border-green-500/30 shadow-lg shadow-green-500/20"
                        >
                          <span className="text-green-600 dark:text-green-400 font-semibold">
                            {teacher.Name?.[0] || '?'}
                          </span>
                        </motion.div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {teacher.Name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${
                        teacher.Faculty_Type === 'Permanent' 
                          ? 'bg-green-500/10 dark:bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30' 
                          : 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30'
                      }`}>
                        {teacher.Faculty_Type || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {teacher.Gender || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleEnroll(teacher.Teacher_ID)}
                        disabled={enrollingIds.has(teacher.Teacher_ID)}
                        className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 mr-4 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Enroll face embeddings"
                      >
                        {enrollingIds.has(teacher.Teacher_ID) ? (
                          <div className="animate-spin h-5 w-5 border-2 border-purple-600 dark:border-purple-400 border-t-transparent rounded-full" />
                        ) : (
                          <FiUserCheck size={18} />
                        )}
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleEdit(teacher)}
                        className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 mr-4"
                        title="Edit teacher"
                      >
                        <FiEdit2 size={18} />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleDelete(teacher.Teacher_ID)}
                        className={`${
                          deleteConfirm === teacher.Teacher_ID
                            ? 'text-red-700 dark:text-red-500 font-bold'
                            : 'text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300'
                        }`}
                        title={deleteConfirm === teacher.Teacher_ID ? 'Click again to confirm' : 'Delete teacher'}
                      >
                        <FiTrash2 size={18} />
                      </motion.button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

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
