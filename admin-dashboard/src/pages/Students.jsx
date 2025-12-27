/**
 * Students Page
 * Display and manage all students
 */

import React, { useState, useEffect, useMemo } from 'react';
import { FiUsers, FiRefreshCw, FiSearch, FiAlertCircle, FiPlus, FiEdit2, FiTrash2, FiUserCheck } from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi';
import { motion } from 'framer-motion';
import { studentAPI } from '../api/api';
import { enrollPerson } from '../api/faceRecognition';
import AddStudentModal from '../components/AddStudentModal';
import EditStudentModal from '../components/EditStudentModal';
import { DepartmentDistributionChart, DepartmentBarChart } from '../components/DepartmentDistributionChart';

const Students = () => {
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [enrollingIds, setEnrollingIds] = useState(new Set());
  const [showAllStudents, setShowAllStudents] = useState(false);
  const DISPLAY_LIMIT = 6;

  // Fetch students
  const fetchStudents = async () => {
    try {
      setError(null);
      setLoading(true);

      const response = await studentAPI.getAllStudents();

      if (response.success && response.data) {
        setStudents(response.data);
        setFilteredStudents(response.data);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error fetching students:', err);
      setError('Failed to load students');
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
  const handleDelete = async (studentId) => {
    if (deleteConfirm !== studentId) {
      setDeleteConfirm(studentId);
      setTimeout(() => setDeleteConfirm(null), 3000);
      return;
    }

    try {
      await studentAPI.deleteStudent(studentId);
      await fetchStudents();
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting student:', err);
      alert('Failed to delete student');
      setDeleteConfirm(null);
    }
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
      {/* Animated Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-gradient-radial from-cyan-500/5 via-transparent to-transparent dark:from-cyan-500/10"></div>
        <div className="absolute inset-0 bg-gradient-radial from-blue-500/5 via-transparent to-transparent dark:from-blue-500/10" style={{ transform: 'translate(50%, 50%)' }}></div>
        
        {/* Asymmetrical Lines Effect */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.03] dark:opacity-[0.05]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="asymmetric-lines" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
              <line x1="0" y1="20" x2="100" y2="25" stroke="currentColor" strokeWidth="0.5" className="text-cyan-500" />
              <line x1="0" y1="45" x2="100" y2="40" stroke="currentColor" strokeWidth="0.5" className="text-blue-500" />
              <line x1="0" y1="70" x2="100" y2="75" stroke="currentColor" strokeWidth="0.5" className="text-purple-500" />
              <line x1="20" y1="0" x2="25" y2="100" stroke="currentColor" strokeWidth="0.5" className="text-cyan-400" />
              <line x1="60" y1="0" x2="55" y2="100" stroke="currentColor" strokeWidth="0.5" className="text-blue-400" />
              <line x1="85" y1="0" x2="90" y2="100" stroke="currentColor" strokeWidth="0.5" className="text-indigo-400" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#asymmetric-lines)" />
        </svg>
      </div>

      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative p-6 rounded-3xl overflow-hidden dark:bg-gradient-to-br dark:from-cyan-500/5 dark:to-blue-500/5 bg-gradient-to-br from-white/80 to-indigo-50/80 backdrop-blur-xl dark:border-cyan-500/20 border-indigo-200"
        style={{
          boxShadow: document.documentElement.classList.contains('dark') 
            ? '0 8px 32px rgba(0, 255, 255, 0.1)' 
            : '0 10px 40px rgba(99, 102, 241, 0.15), 0 4px 12px rgba(79, 70, 229, 0.1), inset 0 -2px 8px rgba(255, 255, 255, 0.8)'
        }}
      >
        {/* Glass shimmer effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

      <div className="flex items-center justify-between relative z-10">
        <div>
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent dark:from-cyan-300 dark:via-blue-400 dark:to-purple-500 flex items-center space-x-2">
            <HiSparkles className="text-cyan-500 dark:text-cyan-400" />
            <span>Students</span>
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">{students.length} students registered</p>
        </div>

        <div className="flex items-center space-x-3">
          <motion.button
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 dark:from-cyan-600 dark:to-blue-700 text-white rounded-lg shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-shadow"
          >
            <FiPlus size={16} />
            <span>Add Student</span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95, rotate: 180 }}
            onClick={fetchStudents}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 dark:from-cyan-500/20 dark:to-blue-500/20 backdrop-blur-sm text-cyan-700 dark:text-cyan-300 rounded-lg border border-cyan-500/30 hover:border-cyan-500/60 hover:shadow-lg hover:shadow-cyan-500/20 transition-all"
          >
            <motion.div
              animate={loading ? { rotate: 360 } : {}}
              transition={{ duration: 1, repeat: loading ? Infinity : 0, ease: "linear" }}
            >
              <FiRefreshCw size={16} className="text-cyan-500 dark:text-cyan-400" />
            </motion.div>
            <span className="font-semibold">Refresh</span>
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
        className="relative p-4 rounded-3xl overflow-hidden dark:bg-gradient-to-br dark:from-cyan-500/5 dark:to-blue-500/5 bg-gradient-to-br from-white/80 to-indigo-50/80 backdrop-blur-xl dark:border-cyan-500/20 border-indigo-200"
        style={{
          boxShadow: document.documentElement.classList.contains('dark') 
            ? '0 8px 32px rgba(0, 255, 255, 0.1)' 
            : '0 10px 40px rgba(99, 102, 241, 0.15), 0 4px 12px rgba(79, 70, 229, 0.1), inset 0 -2px 8px rgba(255, 255, 255, 0.8)'
        }}
      >
        {/* Glass shimmer effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
        
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-cyan-500 dark:text-cyan-400" size={20} />
          <input
            type="text"
            placeholder="Search by name, email, or roll number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-transparent border-none rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/50 dark:focus:ring-cyan-400/50 text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 font-medium"
          />
        </div>
      </motion.div>

      {/* Students Table */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative p-6 rounded-3xl overflow-hidden dark:bg-gradient-to-br dark:from-cyan-500/5 dark:to-blue-500/5 bg-gradient-to-br from-white/80 to-indigo-50/80 backdrop-blur-xl dark:border-cyan-500/20 border-indigo-200"
        style={{
          boxShadow: document.documentElement.classList.contains('dark') 
            ? '0 8px 32px rgba(0, 255, 255, 0.1)' 
            : '0 10px 40px rgba(99, 102, 241, 0.15), 0 4px 12px rgba(79, 70, 229, 0.1), inset 0 -2px 8px rgba(255, 255, 255, 0.8)'
        }}
      >
        {/* Glass shimmer effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
        
        {/* Table Header */}
        <div className="flex items-center justify-between mb-4 relative z-10">
          <h3 className="text-lg font-semibold text-cyan-700 dark:text-cyan-300">
            Student Records ({filteredStudents.length})
          </h3>
          {filteredStudents.length > DISPLAY_LIMIT && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowAllStudents(!showAllStudents)}
              className="px-4 py-2 text-sm font-medium text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 rounded-lg border border-cyan-500/30 transition-colors"
            >
              {showAllStudents ? 'Show Less' : `Show All (${filteredStudents.length})`}
            </motion.button>
          )}
        </div>
        
        {filteredStudents.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400 relative z-10">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <FiUsers size={64} className="mx-auto mb-4 opacity-30 text-cyan-500" />
            </motion.div>
            <p className="text-lg">
              {searchQuery ? 'No students found matching your search' : 'No students registered'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto relative z-10">
            <table className="min-w-full divide-y divide-cyan-500/10">
              <thead className="bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 dark:from-cyan-500/20 dark:via-blue-500/20 dark:to-purple-500/20 backdrop-blur-sm">
                <tr>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-cyan-700 dark:text-cyan-300 uppercase tracking-wider hidden lg:table-cell">
                    ID
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-cyan-700 dark:text-cyan-300 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-cyan-700 dark:text-cyan-300 uppercase tracking-wider hidden md:table-cell">
                    Department
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-cyan-700 dark:text-cyan-300 uppercase tracking-wider hidden sm:table-cell">
                    Gender
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-cyan-700 dark:text-cyan-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyan-500/10">
                {(showAllStudents ? filteredStudents : filteredStudents.slice(0, DISPLAY_LIMIT)).map((student) => (
                  <motion.tr 
                    key={student.Student_ID} 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    whileHover={{ backgroundColor: 'rgba(6, 182, 212, 0.05)' }}
                    className="transition-colors"
                  >
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-cyan-700 dark:text-cyan-300 hidden lg:table-cell">
                      {student.Student_ID}
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <motion.div 
                          whileHover={{ scale: 1.1 }}
                          className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 dark:from-cyan-500/30 dark:to-blue-500/30 rounded-full flex items-center justify-center border border-cyan-500/30 shadow-lg shadow-cyan-500/20"
                        >
                          <span className="text-cyan-600 dark:text-cyan-400 font-semibold">
                            {student.Name?.[0] || '?'}
                          </span>
                        </motion.div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {student.Name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400 hidden md:table-cell">
                      {student.Department || 'N/A'}
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400 hidden sm:table-cell">
                      {student.Gender || 'N/A'}
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleEnroll(student.Student_ID)}
                        disabled={enrollingIds.has(student.Student_ID)}
                        className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 mr-2 sm:mr-4 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Enroll face embeddings"
                      >
                        {enrollingIds.has(student.Student_ID) ? (
                          <div className="animate-spin h-5 w-5 border-2 border-green-600 dark:border-green-400 border-t-transparent rounded-full" />
                        ) : (
                          <FiUserCheck size={18} />
                        )}
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleEdit(student)}
                        className="text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 mr-2 sm:mr-4"
                        title="Edit student"
                      >
                        <FiEdit2 size={18} />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleDelete(student.Student_ID)}
                        className={`${
                          deleteConfirm === student.Student_ID
                            ? 'text-red-700 dark:text-red-500 font-bold'
                            : 'text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300'
                        }`}
                        title={deleteConfirm === student.Student_ID ? 'Click again to confirm' : 'Delete student'}
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

      {/* Department Distribution Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative p-6 rounded-3xl overflow-hidden dark:bg-gradient-to-br dark:from-cyan-500/5 dark:to-blue-500/5 bg-gradient-to-br from-white/80 to-indigo-50/80 backdrop-blur-xl dark:border-cyan-500/20 border-indigo-200"
          style={{
            boxShadow: document.documentElement.classList.contains('dark') 
              ? '0 8px 32px rgba(0, 255, 255, 0.1)' 
              : '0 10px 40px rgba(99, 102, 241, 0.15), 0 4px 12px rgba(79, 70, 229, 0.1)'
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
          className="relative p-6 rounded-3xl overflow-hidden dark:bg-gradient-to-br dark:from-cyan-500/5 dark:to-blue-500/5 bg-gradient-to-br from-white/80 to-indigo-50/80 backdrop-blur-xl dark:border-cyan-500/20 border-indigo-200"
          style={{
            boxShadow: document.documentElement.classList.contains('dark') 
              ? '0 8px 32px rgba(0, 255, 255, 0.1)' 
              : '0 10px 40px rgba(99, 102, 241, 0.15), 0 4px 12px rgba(79, 70, 229, 0.1)'
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
    </div>
  );
};

export default Students;
