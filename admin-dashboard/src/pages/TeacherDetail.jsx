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

  useEffect(() => {
    fetchTeacherDetails();
  }, [id]);

  const fetchTeacherDetails = async () => {
    try {
      setLoading(true);
      const response = await teacherAPI.getTeacherById(id);
      setTeacher(response.data);
    } catch (err) {
      console.error('Error fetching teacher details:', err);
      setError('Failed to load teacher details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2" style={{ borderColor: '#247e5bff' }}></div>
      </div>
    );
  }

  if (error || !teacher) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
        <div className="text-center">
          <p className="text-xl text-red-600 mb-4">{error || 'Teacher not found'}</p>
          <button
            onClick={() => navigate('/teachers')}
            className="px-6 py-2 rounded-xl font-semibold text-white"
            style={{ backgroundColor: '#247e5bff' }}
          >
            Back to Teachers
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
    <div className="min-h-screen p-6" style={{ background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
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
              background: '#ffffff',
              color: '#247e5bff',
              border: '2px solid #247e5bff'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#247e5bff';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ffffff';
              e.currentTarget.style.color = '#247e5bff';
            }}
          >
            <FiArrowLeft size={20} />
            Back to Teachers
          </button>
          <h1 className="text-4xl font-bold" style={{ color: '#247e5bff' }}>Teacher Details</h1>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Personal Information Card */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2 bg-white rounded-2xl p-8"
            style={{
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)'
            }}
          >
            <h2 className="text-2xl font-bold mb-6" style={{ color: '#247e5bff' }}>Personal Information</h2>
            
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FiUser className="text-gray-500" size={18} />
                  <label className="text-xs font-semibold text-gray-600">Full Name</label>
                </div>
                <p className="text-lg font-semibold text-gray-900 ml-6">{teacher.Name}</p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FiBook className="text-gray-500" size={18} />
                  <label className="text-xs font-semibold text-gray-600">Teacher ID</label>
                </div>
                <p className="text-lg font-semibold ml-6" style={{ color: '#305796' }}>
                  {teacher.Teacher_ID}
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FiMail className="text-gray-500" size={18} />
                  <label className="text-xs font-semibold text-gray-600">Email</label>
                </div>
                <p className="text-lg font-semibold text-gray-900 ml-6">{teacher.Email}</p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FiUser className="text-gray-500" size={18} />
                    <label className="text-xs font-semibold text-gray-600">Gender</label>
                  </div>
                  <p className="text-lg font-semibold text-gray-900 ml-6">{teacher.Gender || 'N/A'}</p>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FiBriefcase className="text-gray-500" size={18} />
                    <label className="text-xs font-semibold text-gray-600">Faculty Type</label>
                  </div>
                  <p className="text-lg font-semibold ml-6">
                    <span className={`px-3 py-1 rounded-full text-sm ${
                      teacher.Faculty_Type === 'Permanent'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {teacher.Faculty_Type || 'N/A'}
                    </span>
                  </p>
                </div>
              </div>

              {teacher.Faculty_Type === 'Permanent' && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FiBook className="text-gray-500" size={18} />
                    <label className="text-xs font-semibold text-gray-600">Department</label>
                  </div>
                  <p className="text-lg font-semibold text-gray-900 ml-6">{teacher.Department || 'N/A'}</p>
                </div>
              )}

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FiBook className="text-gray-500" size={18} />
                  <label className="text-xs font-semibold text-gray-600">Enrollment Status</label>
                </div>
                <p className="text-lg font-semibold ml-6">
                  <span className={`px-3 py-1 rounded-full text-sm ${
                    teacher.is_enrolled 
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
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
            className="bg-white rounded-2xl p-6"
            style={{
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)'
            }}
          >
            <h3 className="text-xl font-bold mb-4" style={{ color: '#247e5bff' }}>Profile Picture</h3>
            <div className="flex items-center justify-center">
              <div 
                className="w-48 h-48 rounded-full flex items-center justify-center text-6xl font-bold"
                style={{
                  backgroundColor: '#ecfdf5',
                  border: '4px solid #247e5bff',
                  color: '#247e5bff'
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
            className="mt-6 bg-white rounded-2xl p-8"
            style={{
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)'
            }}
          >
            <div className="flex items-center gap-2 mb-6">
              <FiImage style={{ color: '#247e5bff' }} size={24} />
              <h2 className="text-2xl font-bold" style={{ color: '#247e5bff' }}>
                Face Pictures ({facePictures.length})
              </h2>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {facePictures.map((picture, index) => (
                <div key={index} className="relative group">
                  <img
                    src={picture}
                    alt={`Face ${index + 1}`}
                    className="w-full h-40 object-cover rounded-xl border-2 border-gray-200 transition-transform group-hover:scale-105"
                  />
                  <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
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
          className="mt-6 bg-white rounded-2xl p-8"
          style={{
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)'
          }}
        >
          <h2 className="text-2xl font-bold mb-6" style={{ color: '#247e5bff' }}>Additional Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-semibold text-gray-600">Created At</label>
              <p className="text-lg font-semibold text-gray-900 mt-2">
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
              <label className="text-xs font-semibold text-gray-600">Last Updated</label>
              <p className="text-lg font-semibold text-gray-900 mt-2">
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
