import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiMail, FiUser, FiBook, FiImage, FiBriefcase } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { teacherAPI } from '../api/api';

const TeacherDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [teacher, setTeacher] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isDarkMode = document.documentElement.classList.contains('dark');

  useEffect(() => {
    fetchTeacherDetails();
  }, [id]);

  const fetchTeacherDetails = async () => {
    try {
      setLoading(true);
      const response = await teacherAPI.getTeacherById(id);
      setTeacher(response.data);
    } catch (err) {
      console.error('Error fetching faculty details:', err);
      setError('Failed to load faculty details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ 
        background: isDarkMode 
          ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.90))'
          : 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' 
      }}>
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2" style={{ borderColor: isDarkMode ? '#34d399' : '#247e5bff' }}></div>
      </div>
    );
  }

  if (error || !teacher) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ 
        background: isDarkMode 
          ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.90))'
          : 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' 
      }}>
        <div className="text-center">
          <p className="text-xl text-red-600 mb-4">{error || 'Faculty not found'}</p>
          <button
            onClick={() => navigate('/teachers')}
            className="px-6 py-2 rounded-xl font-semibold text-white"
            style={{ backgroundColor: isDarkMode ? '#34d399' : '#247e5bff' }}
          >
            Back to Faculty
          </button>
        </div>
      </div>
    );
  }

  const facePictures = [
    teacher.Face_Picture_1,
    teacher.Face_Picture_2,
    teacher.Face_Picture_3,
    teacher.Face_Picture_4,
    teacher.Face_Picture_5
  ].filter(Boolean);

  return (
    <div className="min-h-screen p-6" style={{ 
      background: isDarkMode 
        ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.90))'
        : 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' 
    }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <button
            onClick={() => navigate('/teachers')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all mb-4"
            style={{
              background: isDarkMode ? 'rgba(52, 211, 153, 0.1)' : '#ffffff',
              color: isDarkMode ? '#34d399' : '#247e5bff',
              border: isDarkMode ? '2px solid rgba(52, 211, 153, 0.5)' : '2px solid #247e5bff'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(52, 211, 153, 0.2)' : '#247e5bff';
              e.currentTarget.style.color = isDarkMode ? '#34d399' : '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(52, 211, 153, 0.1)' : '#ffffff';
              e.currentTarget.style.color = isDarkMode ? '#34d399' : '#247e5bff';
            }}
          >
            <FiArrowLeft size={20} />
            Back to Faculty
          </button>
          <h1 className="text-4xl font-bold" style={{ color: isDarkMode ? '#c0f0f0' : '#247e5bff' }}>Faculty Details</h1>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Personal Information Card */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2 rounded-2xl p-8"
            style={{
              background: isDarkMode 
                ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.90))'
                : 'white',
              boxShadow: isDarkMode 
                ? '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 30px rgba(52, 211, 153, 0.1)'
                : '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)',
              border: isDarkMode ? '1px solid rgba(52, 211, 153, 0.2)' : 'none'
            }}
          >
            <h2 className="text-2xl font-bold mb-6" style={{ color: isDarkMode ? '#34d399' : '#247e5bff' }}>Personal Information</h2>
            
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FiUser style={{ color: isDarkMode ? '#34d399' : '#6b7280' }} size={18} />
                  <label className="text-xs font-semibold" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#4b5563' }}>Full Name</label>
                </div>
                <p className="text-lg font-semibold ml-6" style={{ color: isDarkMode ? '#c0f0f0' : '#111827' }}>{teacher.Name}</p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FiBook style={{ color: isDarkMode ? '#34d399' : '#6b7280' }} size={18} />
                  <label className="text-xs font-semibold" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#4b5563' }}>Faculty ID</label>
                </div>
                <p className="text-lg font-semibold ml-6" style={{ color: isDarkMode ? '#34d399' : '#305796' }}>
                  {teacher.Teacher_ID}
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FiMail style={{ color: isDarkMode ? '#34d399' : '#6b7280' }} size={18} />
                  <label className="text-xs font-semibold" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#4b5563' }}>Email</label>
                </div>
                <p className="text-lg font-semibold ml-6" style={{ color: isDarkMode ? '#c0f0f0' : '#111827' }}>{teacher.Email}</p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FiUser style={{ color: isDarkMode ? '#34d399' : '#6b7280' }} size={18} />
                    <label className="text-xs font-semibold" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#4b5563' }}>Gender</label>
                  </div>
                  <p className="text-lg font-semibold ml-6" style={{ color: isDarkMode ? '#c0f0f0' : '#111827' }}>{teacher.Gender || 'N/A'}</p>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FiBriefcase style={{ color: isDarkMode ? '#34d399' : '#6b7280' }} size={18} />
                    <label className="text-xs font-semibold" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#4b5563' }}>Faculty Type</label>
                  </div>
                  <p className="text-lg font-semibold ml-6">
                    <span 
                      className="px-3 py-1 rounded-full text-sm"
                      style={{
                        backgroundColor: teacher.Faculty_Type === 'Permanent'
                          ? (isDarkMode ? 'rgba(52, 211, 153, 0.2)' : '#dcfce7')
                          : (isDarkMode ? 'rgba(96, 165, 250, 0.2)' : '#dbeafe'),
                        color: teacher.Faculty_Type === 'Permanent'
                          ? (isDarkMode ? '#34d399' : '#15803d')
                          : (isDarkMode ? '#60a5fa' : '#1d4ed8'),
                        border: isDarkMode 
                          ? `1px solid ${teacher.Faculty_Type === 'Permanent' ? 'rgba(52, 211, 153, 0.5)' : 'rgba(96, 165, 250, 0.5)'}`
                          : 'none'
                      }}
                    >
                      {teacher.Faculty_Type || 'N/A'}
                    </span>
                  </p>
                </div>
              </div>

              {teacher.Faculty_Type === 'Permanent' && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FiBook style={{ color: isDarkMode ? '#34d399' : '#6b7280' }} size={18} />
                    <label className="text-xs font-semibold" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#4b5563' }}>Department</label>
                  </div>
                  <p className="text-lg font-semibold ml-6" style={{ color: isDarkMode ? '#c0f0f0' : '#111827' }}>{teacher.Department || 'N/A'}</p>
                </div>
              )}

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FiBook style={{ color: isDarkMode ? '#34d399' : '#6b7280' }} size={18} />
                  <label className="text-xs font-semibold" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#4b5563' }}>Enrollment Status</label>
                </div>
                <p className="text-lg font-semibold ml-6">
                  <span 
                    className="px-3 py-1 rounded-full text-sm"
                    style={{
                      backgroundColor: teacher.is_enrolled 
                        ? (isDarkMode ? 'rgba(52, 211, 153, 0.2)' : '#dcfce7')
                        : (isDarkMode ? 'rgba(250, 204, 21, 0.2)' : '#fef9c3'),
                      color: teacher.is_enrolled 
                        ? (isDarkMode ? '#34d399' : '#15803d')
                        : (isDarkMode ? '#fbbf24' : '#a16207'),
                      border: isDarkMode 
                        ? `1px solid ${teacher.is_enrolled ? 'rgba(52, 211, 153, 0.5)' : 'rgba(250, 204, 21, 0.5)'}`
                        : 'none'
                    }}
                  >
                    {teacher.is_enrolled ? 'Enrolled' : 'Not Enrolled'}
                  </span>
                </p>
              </div>
            </div>
          </motion.div>

          {/* Profile Picture Card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl p-6"
            style={{
              background: isDarkMode 
                ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.90))'
                : 'white',
              boxShadow: isDarkMode 
                ? '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 30px rgba(52, 211, 153, 0.1)'
                : '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)',
              border: isDarkMode ? '1px solid rgba(52, 211, 153, 0.2)' : 'none'
            }}
          >
            <h3 className="text-xl font-bold mb-4" style={{ color: isDarkMode ? '#34d399' : '#247e5bff' }}>Profile Picture</h3>
            <div className="flex items-center justify-center">
              <div 
                className="w-48 h-48 rounded-full flex items-center justify-center text-6xl font-bold"
                style={{
                  backgroundColor: isDarkMode ? 'rgba(52, 211, 153, 0.15)' : '#ecfdf5',
                  border: isDarkMode ? '4px solid rgba(52, 211, 153, 0.7)' : '4px solid #247e5bff',
                  color: isDarkMode ? '#34d399' : '#247e5bff',
                  boxShadow: isDarkMode ? '0 0 30px rgba(52, 211, 153, 0.2)' : 'none'
                }}
              >
                {teacher.Name?.[0] || '?'}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Face Pictures Section */}
        {facePictures.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-6 rounded-2xl p-8"
            style={{
              background: isDarkMode 
                ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.90))'
                : 'white',
              boxShadow: isDarkMode 
                ? '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 30px rgba(52, 211, 153, 0.1)'
                : '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)',
              border: isDarkMode ? '1px solid rgba(52, 211, 153, 0.2)' : 'none'
            }}
          >
            <div className="flex items-center gap-2 mb-6">
              <FiImage style={{ color: isDarkMode ? '#34d399' : '#247e5bff' }} size={24} />
              <h2 className="text-2xl font-bold" style={{ color: isDarkMode ? '#34d399' : '#247e5bff' }}>
                Face Pictures ({facePictures.length})
              </h2>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {facePictures.map((picture, index) => (
                <div key={index} className="relative group">
                  <img
                    src={picture}
                    alt={`Face ${index + 1}`}
                    className="w-full h-40 object-cover rounded-xl transition-transform group-hover:scale-105"
                    style={{
                      border: isDarkMode ? '2px solid rgba(52, 211, 153, 0.3)' : '2px solid #e5e7eb'
                    }}
                  />
                  <div 
                    className="absolute bottom-2 left-2 text-xs px-2 py-1 rounded"
                    style={{
                      backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.6)',
                      color: isDarkMode ? '#34d399' : 'white'
                    }}
                  >
                    Picture {index + 1}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Additional Info Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-6 rounded-2xl p-8"
          style={{
            background: isDarkMode 
              ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.90))'
              : 'white',
            boxShadow: isDarkMode 
              ? '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 30px rgba(52, 211, 153, 0.1)'
              : '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)',
            border: isDarkMode ? '1px solid rgba(52, 211, 153, 0.2)' : 'none'
          }}
        >
          <h2 className="text-2xl font-bold mb-6" style={{ color: isDarkMode ? '#34d399' : '#247e5bff' }}>Additional Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-semibold" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#4b5563' }}>Created At</label>
              <p className="text-lg font-semibold mt-2" style={{ color: isDarkMode ? '#c0f0f0' : '#111827' }}>
                {teacher.createdAt ? new Date(teacher.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                }) : 'N/A'}
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#4b5563' }}>Last Updated</label>
              <p className="text-lg font-semibold mt-2" style={{ color: isDarkMode ? '#c0f0f0' : '#111827' }}>
                {teacher.updatedAt ? new Date(teacher.updatedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                }) : 'N/A'}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default TeacherDetail;
