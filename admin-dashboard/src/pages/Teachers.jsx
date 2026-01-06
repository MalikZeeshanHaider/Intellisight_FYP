/**
 * Faculty Page
 * Display and manage all faculty members
 */

import React, { useState, useEffect, useMemo } from 'react';
import { FiRefreshCw, FiSearch, FiAlertCircle, FiPlus, FiEdit2, FiTrash2, FiUserCheck, FiEye } from 'react-icons/fi';
import { GiTeacher } from 'react-icons/gi';
import { HiSparkles } from 'react-icons/hi';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { teacherAPI } from '../api/api';
import { enrollPerson } from '../api/faceRecognition';
import AddTeacherModal from '../components/AddTeacherModal';
import EditTeacherModal from '../components/EditTeacherModal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import { DepartmentDistributionChart, DepartmentBarChart } from '../components/DepartmentDistributionChart';

const Teachers = () => {
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState([]);
  const [filteredTeachers, setFilteredTeachers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [teacherToDelete, setTeacherToDelete] = useState(null);
  const [enrollingIds, setEnrollingIds] = useState(new Set());
  const [showAllTeachers, setShowAllTeachers] = useState(false);
  const DISPLAY_LIMIT = 6;

  // Calculate department data for charts
  const departmentData = useMemo(() => {
    if (!teachers || teachers.length === 0) return [];
    
    const deptCounts = teachers.reduce((acc, teacher) => {
      const dept = teacher.Faculty_Type || 'Unassigned';
      acc[dept] = (acc[dept] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(deptCounts).map(([name, count]) => ({
      name,
      count,
      percentage: ((count / teachers.length) * 100).toFixed(1)
    }));
  }, [teachers]);

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
  const handleDelete = (teacherId) => {
    setTeacherToDelete(teacherId);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      await teacherAPI.deleteTeacher(teacherToDelete);
      await fetchTeachers();
      setShowDeleteModal(false);
      setTeacherToDelete(null);
    } catch (err) {
      console.error('Error deleting teacher:', err);
      alert('Failed to delete teacher');
      setShowDeleteModal(false);
      setTeacherToDelete(null);
    }
  };

  // Handle view details
  const handleViewDetails = (teacherId) => {
    navigate(`/teachers/${teacherId}`);
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
          <p className="text-gray-600 dark:text-gray-300 text-lg">Loading faculty...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative p-6 rounded-2xl bg-white"
        style={{
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)'
        }}
      >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: '#247e5bff' }}>
            Faculty
          </h1>
          <p className="text-sm font-medium" style={{ color: '#6b7280' }}>{teachers.length} faculty members registered</p>
        </div>

        <div className="flex items-center space-x-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 text-white rounded-xl font-semibold text-sm transition-all"
            style={{
              backgroundColor: '#247e5bff',
              boxShadow: '0 2px 8px rgba(36, 126, 91, 0.25)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1d6549'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#247e5bff'}
          >
            <FiPlus size={16} />
            <span>Add Faculty</span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={fetchTeachers}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl font-medium text-sm transition-all"
            style={{
              backgroundColor: '#f3f4f6',
              color: '#6b7280'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
          >
            <motion.div
              animate={loading ? { rotate: 360 } : {}}
              transition={{ duration: 1, repeat: loading ? Infinity : 0, ease: "linear" }}
            >
              <FiRefreshCw size={16} style={{ color: '#247e5bff' }} />
            </motion.div>
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
          className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start"
        >
          <FiAlertCircle className="text-red-500 mt-0.5 mr-3 flex-shrink-0" size={20} />
          <p className="text-red-700 text-sm font-medium">{error}</p>
        </motion.div>
      )}

      {/* Search Bar */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative p-4 rounded-2xl bg-white"
        style={{
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)'
        }}
      >
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2" style={{ color: '#247e5bff' }} size={20} />
          <input
            type="text"
            placeholder="Search by name, email, or designation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#247e5bff] text-gray-800 placeholder-gray-500 font-medium transition-colors"
          />
        </div>
      </motion.div>

      {/* Faculty Table */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative p-6 rounded-2xl bg-white"
        style={{
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)'
        }}
      >
        {/* Table Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ color: '#6b7280' }}>
            Faculty Records
          </h3>
          {filteredTeachers.length > DISPLAY_LIMIT && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowAllTeachers(!showAllTeachers)}
              className="px-4 py-2 text-sm font-semibold rounded-xl transition-all"
              style={{
                color: '#247e5bff',
                backgroundColor: 'rgba(36, 126, 91, 0.1)',
                border: '2px solid rgba(36, 126, 91, 0.3)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(36, 126, 91, 0.2)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(36, 126, 91, 0.1)'}
            >
              {showAllTeachers ? 'Show Less' : `Show All (${filteredTeachers.length})`}
            </motion.button>
          )}
        </div>
        
        {filteredTeachers.length === 0 ? (
          <div className="text-center py-12" style={{ color: '#6b7280' }}>
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <GiTeacher size={64} className="mx-auto mb-4 opacity-30" style={{ color: '#247e5bff' }} />
            </motion.div>
            <p className="text-lg font-medium">
              {searchQuery ? 'No faculty found matching your search' : 'No faculty registered'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="max-h-[400px] overflow-y-auto custom-teacher-table-scrollbar">
            <table className="min-w-full">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider hidden lg:table-cell" style={{ color: '#6b7280' }}>
                    ID
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>
                    Name
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider hidden md:table-cell" style={{ color: '#6b7280' }}>
                    Faculty Type
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider hidden sm:table-cell" style={{ color: '#6b7280' }}>
                    Gender
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(showAllTeachers ? filteredTeachers : filteredTeachers.slice(0, DISPLAY_LIMIT)).map((teacher) => (
                  <motion.tr 
                    key={teacher.Teacher_ID} 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-semibold hidden lg:table-cell" style={{ color: '#247e5bff' }}>
                      {teacher.Teacher_ID}
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <motion.div 
                          whileHover={{ scale: 1.1 }}
                          className="flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center border-2 shadow-sm"
                          style={{ 
                            borderColor: '#247e5bff',
                            backgroundColor: 'rgba(36, 126, 91, 0.1)'
                          }}
                        >
                          <span className="font-semibold" style={{ color: '#247e5bff' }}>
                            {teacher.Name?.[0] || '?'}
                          </span>
                        </motion.div>
                        <div className="ml-4">
                          <div className="text-sm font-medium" style={{ color: '#1f2937' }}>
                            {teacher.Name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden md:table-cell">
                      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        teacher.Faculty_Type === 'Permanent' 
                          ? 'border-2' 
                          : 'border-2'
                      }`}
                      style={{
                        backgroundColor: teacher.Faculty_Type === 'Permanent' ? 'rgba(36, 126, 91, 0.15)' : 'rgba(36, 126, 91, 0.08)',
                        color: teacher.Faculty_Type === 'Permanent' ? '#1d6549' : '#247e5bff',
                        borderColor: teacher.Faculty_Type === 'Permanent' ? '#247e5bff' : 'rgba(36, 126, 91, 0.3)'
                      }}>
                        {teacher.Faculty_Type || 'N/A'}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm hidden sm:table-cell" style={{ color: '#6b7280' }}>
                      {teacher.Gender || 'N/A'}
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleViewDetails(teacher.Teacher_ID)}
                        className="mr-2 sm:mr-4"
                        style={{ color: '#247e5bff' }}
                        title="View details"
                      >
                        <FiEye size={18} />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleEnroll(teacher.Teacher_ID)}
                        disabled={enrollingIds.has(teacher.Teacher_ID)}
                        className="mr-2 sm:mr-4 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ color: '#6b7280' }}
                        title="Enroll face embeddings"
                      >
                        {enrollingIds.has(teacher.Teacher_ID) ? (
                          <div className="animate-spin h-5 w-5 border-2 border-t-transparent rounded-full" style={{ borderColor: '#6b7280' }} />
                        ) : (
                          <FiUserCheck size={18} />
                        )}
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleEdit(teacher)}
                        className="mr-2 sm:mr-4"
                        style={{ color: '#247e5bff' }}
                        title="Edit teacher"
                      >
                        <FiEdit2 size={18} />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleDelete(teacher.Teacher_ID)}
                        style={{ color: '#ef4444' }}
                        title="Delete teacher"
                      >
                        <FiTrash2 size={18} />
                      </motion.button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </motion.div>

      {/* Faculty Distribution Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative p-6 rounded-2xl bg-white"
          style={{
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)'
          }}
        >
          <DepartmentDistributionChart 
            data={departmentData} 
            title="Faculty by Type"
            type="teachers"
            height={250}
            colorScheme="green"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="relative p-6 rounded-2xl bg-white"
          style={{
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)'
          }}
        >
          <DepartmentBarChart 
            data={departmentData} 
            title="Faculty Breakdown" 
            colorScheme="green"
          />
        </motion.div>
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

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setTeacherToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Delete Teacher"
        message="Are you sure you want to delete this teacher? This action cannot be undone."
      />
    </div>
  );
};

export default Teachers;
