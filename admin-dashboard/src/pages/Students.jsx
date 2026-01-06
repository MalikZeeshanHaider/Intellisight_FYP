/**
 * Students Page
 * Display and manage all students
 */

import React, { useState, useEffect, useMemo } from 'react';
import { FiUsers, FiRefreshCw, FiSearch, FiAlertCircle, FiPlus, FiEdit2, FiTrash2, FiUserCheck, FiEye } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { studentAPI } from '../api/api';
import { enrollPerson } from '../api/faceRecognition';
import AddStudentModal from '../components/AddStudentModal';
import EditStudentModal from '../components/EditStudentModal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import { DepartmentDistributionChart, DepartmentBarChart } from '../components/DepartmentDistributionChart';

const Students = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState(null);
  const [enrollingIds, setEnrollingIds] = useState(new Set());
  const [showAllStudents, setShowAllStudents] = useState(false);
  const DISPLAY_LIMIT = 6;

  // Fetch students
  const fetchStudents = async () => {
    try {
      setError(null);
      setLoading(true);

      const response = await studentAPI.getAllStudents();
      
      // Handle different response formats
      let studentsData = [];
      if (response?.success && response?.data) {
        studentsData = response.data;
      } else if (Array.isArray(response?.data)) {
        studentsData = response.data;
      } else if (Array.isArray(response)) {
        studentsData = response;
      }
      
      setStudents(studentsData);
      setFilteredStudents(studentsData);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching students:', err);
      setError('Failed to load students. Please check if the server is running.');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  // Search filter
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredStudents(students);
    } else {
      const filtered = students.filter(student =>
        student.Name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.Email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.RollNumber?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredStudents(filtered);
    }
  }, [searchQuery, students]);

  // Handle edit
  const handleEdit = (student) => {
    setSelectedStudent(student);
    setIsEditModalOpen(true);
  };
  // Handle delete
  const handleDelete = (studentId) => {
    setStudentToDelete(studentId);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      await studentAPI.deleteStudent(studentToDelete);
      await fetchStudents();
      setShowDeleteModal(false);
      setStudentToDelete(null);
    } catch (err) {
      console.error('Error deleting student:', err);
      alert('Failed to delete student');
      setShowDeleteModal(false);
      setStudentToDelete(null);
    }
  };

  // Handle view details
  const handleViewDetails = (studentId) => {
    navigate(`/students/${studentId}`);
  };

  // Handle enroll
  const handleEnroll = async (studentId) => {
    try {
      setEnrollingIds(prev => new Set(prev).add(studentId));
      const response = await enrollPerson('Student', studentId);
      
      if (response.success) {
        alert(`Face enrollment successful for ${response.data.name}`);
        await fetchStudents();
      }
    } catch (err) {
      console.error('Error enrolling student:', err);
      alert(err.response?.data?.message || 'Failed to enroll face embeddings');
    } finally {
      setEnrollingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(studentId);
        return newSet;
      });
    }
  };

  if (loading && students.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 shadow-lg shadow-cyan-500/50 mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300 text-lg">Loading students...</p>
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
          <h1 className="text-3xl font-bold mb-2" style={{ color: '#6365baff' }}>
            Students
          </h1>
          <p className="text-sm font-medium" style={{ color: '#6b7280' }}>{students.length} students registered</p>
        </div>

        <div className="flex items-center space-x-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 text-white rounded-xl font-semibold text-sm transition-all"
            style={{
              backgroundColor: '#6365baff',
              boxShadow: '0 2px 8px rgba(99, 101, 186, 0.25)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#5558a8'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#6365baff'}
          >
            <FiPlus size={16} />
            <span>Add Student</span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={fetchStudents}
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
              <FiRefreshCw size={16} style={{ color: '#6365baff' }} />
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
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2" style={{ color: '#305796' }} size={20} />
          <input
            type="text"
            placeholder="Search by name, email, or roll number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-[#305796] text-gray-800 placeholder-gray-400 font-medium transition-all"
          />
        </div>
      </motion.div>

      {/* Students Table */}
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
          <h3 className="text-lg font-bold" style={{ color: '#6b7280' }}>
            Student Records
          </h3>
          {filteredStudents.length > DISPLAY_LIMIT && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowAllStudents(!showAllStudents)}
              className="px-4 py-2 text-sm font-semibold rounded-xl transition-all"
              style={{
                backgroundColor: '#f3f4f6',
                color: '#305796'
              }}
            >
              {showAllStudents ? 'Show Less' : `Show All (${filteredStudents.length})`}
            </motion.button>
          )}
        </div>
        
        {filteredStudents.length === 0 ? (
          <div className="text-center py-12">
            <FiUsers size={64} className="mx-auto mb-4" style={{ color: '#d1d5db', opacity: 0.5 }} />
            <p className="text-lg font-medium" style={{ color: '#6b7280' }}>
              {searchQuery ? 'No students found matching your search' : 'No students registered'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="max-h-[400px] overflow-y-auto custom-student-table-scrollbar">
            <table className="min-w-full">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-bold uppercase tracking-wider hidden lg:table-cell" style={{ color: '#6b7280' }}>
                    ID
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{ color: '#6b7280' }}>
                    Name
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-bold uppercase tracking-wider hidden md:table-cell" style={{ color: '#6b7280' }}>
                    Department
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-bold uppercase tracking-wider hidden sm:table-cell" style={{ color: '#6b7280' }}>
                    Gender
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-right text-xs font-bold uppercase tracking-wider" style={{ color: '#6b7280' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(showAllStudents ? filteredStudents : filteredStudents.slice(0, DISPLAY_LIMIT)).map((student) => (
                  <motion.tr 
                    key={student.Student_ID} 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="transition-colors hover:bg-gray-50"
                  >
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-semibold hidden lg:table-cell" style={{ color: '#305796' }}>
                      {student.Student_ID}
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div 
                          className="flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center"
                          style={{
                            backgroundColor: '#f3f4f6',
                            border: '2px solid #e5e7eb'
                          }}
                        >
                          <span className="font-bold" style={{ color: '#305796' }}>
                            {student.Name?.[0] || '?'}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-semibold text-gray-900">
                            {student.Name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-600 hidden md:table-cell">
                      {student.Department || 'N/A'}
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-600 hidden sm:table-cell">
                      {student.Gender || 'N/A'}
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleViewDetails(student.Student_ID)}
                        className="mr-2 sm:mr-4"
                        style={{ color: '#6365baff' }}
                        title="View details"
                      >
                        <FiEye size={18} />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleEnroll(student.Student_ID)}
                        disabled={enrollingIds.has(student.Student_ID)}
                        className="mr-2 sm:mr-4 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ color: '#6b7280' }}
                        title="Enroll face embeddings"
                      >
                        {enrollingIds.has(student.Student_ID) ? (
                          <div className="animate-spin h-5 w-5 border-2 border-t-transparent rounded-full" style={{ borderColor: '#6b7280' }} />
                        ) : (
                          <FiUserCheck size={18} />
                        )}
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleEdit(student)}
                        className="mr-2 sm:mr-4"
                        style={{ color: '#6365baff' }}
                        title="Edit student"
                      >
                        <FiEdit2 size={18} />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleDelete(student.Student_ID)}
                        style={{ color: '#ef4444' }}
                        title="Delete student"
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

      {/* Department Distribution Charts */}
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
            data={(() => {
              const deptCounts = {};
              students.forEach(s => {
                const dept = s.Department || 'Unknown';
                deptCounts[dept] = (deptCounts[dept] || 0) + 1;
              });
              return Object.entries(deptCounts).map(([department, count]) => ({ department, count }));
            })()}
            title="Students by Department"
            type="students"
            height={250}
            colorScheme="cyan"
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
            data={(() => {
              const deptCounts = {};
              students.forEach(s => {
                const dept = s.Department || 'Unknown';
                deptCounts[dept] = (deptCounts[dept] || 0) + 1;
              });
              return Object.entries(deptCounts).map(([department, count]) => ({ department, count }));
            })()}
            title="Department Breakdown"
            colorScheme="cyan"
          />
        </motion.div>
      </div>

      {/* Add Student Modal */}
      <AddStudentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchStudents}
      />

      {/* Edit Student Modal */}
      <EditStudentModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedStudent(null);
        }}
        onSuccess={fetchStudents}
        student={selectedStudent}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setStudentToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Delete Student"
        message="Are you sure you want to delete this student? This action cannot be undone."
      />
    </div>
  );
};

export default Students;
