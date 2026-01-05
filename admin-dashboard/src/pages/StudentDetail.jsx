import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiMail, FiUser, FiBook, FiImage } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { studentAPI } from '../api/api';

const StudentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStudentDetails();
  }, [id]);

  const fetchStudentDetails = async () => {
    try {
      setLoading(true);
      const response = await studentAPI.getStudentById(id);
      setStudent(response.data);
    } catch (err) {
      console.error('Error fetching student details:', err);
      setError('Failed to load student details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2" style={{ borderColor: '#6365baff' }}></div>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
        <div className="text-center">
          <p className="text-xl text-red-600 mb-4">{error || 'Student not found'}</p>
          <button
            onClick={() => navigate('/students')}
            className="px-6 py-2 rounded-xl font-semibold text-white"
            style={{ backgroundColor: '#6365baff' }}
          >
            Back to Students
          </button>
        </div>
      </div>
    );
  }

  const facePictures = [
    student.Face_Picture_1,
    student.Face_Picture_2,
    student.Face_Picture_3,
    student.Face_Picture_4,
    student.Face_Picture_5
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
            onClick={() => navigate('/students')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all mb-4"
            style={{
              background: '#ffffff',
              color: '#6365baff',
              border: '2px solid #6365baff'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#6365baff';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ffffff';
              e.currentTarget.style.color = '#6365baff';
            }}
          >
            <FiArrowLeft size={20} />
            Back to Students
          </button>
          <h1 className="text-4xl font-bold" style={{ color: '#6365baff' }}>Student Details</h1>
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
            <h2 className="text-2xl font-bold mb-6" style={{ color: '#6365baff' }}>Personal Information</h2>
            
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FiUser className="text-gray-500" size={18} />
                  <label className="text-xs font-semibold text-gray-600">Full Name</label>
                </div>
                <p className="text-lg font-semibold text-gray-900 ml-6">{student.Name}</p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FiBook className="text-gray-500" size={18} />
                  <label className="text-xs font-semibold text-gray-600">Student ID</label>
                </div>
                <p className="text-lg font-semibold ml-6" style={{ color: '#305796' }}>
                  {student.Student_ID}
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FiBook className="text-gray-500" size={18} />
                  <label className="text-xs font-semibold text-gray-600">Roll Number</label>
                </div>
                <p className="text-lg font-semibold text-gray-900 ml-6">{student.RollNumber}</p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FiMail className="text-gray-500" size={18} />
                  <label className="text-xs font-semibold text-gray-600">Email</label>
                </div>
                <p className="text-lg font-semibold text-gray-900 ml-6">{student.Email}</p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FiUser className="text-gray-500" size={18} />
                    <label className="text-xs font-semibold text-gray-600">Gender</label>
                  </div>
                  <p className="text-lg font-semibold text-gray-900 ml-6">{student.Gender || 'N/A'}</p>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FiBook className="text-gray-500" size={18} />
                    <label className="text-xs font-semibold text-gray-600">Department</label>
                  </div>
                  <p className="text-lg font-semibold text-gray-900 ml-6">{student.Department || 'N/A'}</p>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FiBook className="text-gray-500" size={18} />
                  <label className="text-xs font-semibold text-gray-600">Enrollment Status</label>
                </div>
                <p className="text-lg font-semibold ml-6">
                  <span className={`px-3 py-1 rounded-full text-sm ${
                    student.is_enrolled 
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {student.is_enrolled ? 'Enrolled' : 'Not Enrolled'}
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
            <h3 className="text-xl font-bold mb-4" style={{ color: '#6365baff' }}>Profile Picture</h3>
            <div className="flex items-center justify-center">
              <div 
                className="w-48 h-48 rounded-full flex items-center justify-center text-6xl font-bold"
                style={{
                  backgroundColor: '#f3f4f6',
                  border: '4px solid #6365baff',
                  color: '#305796'
                }}
              >
                {student.Name?.[0] || '?'}
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
              <FiImage style={{ color: '#6365baff' }} size={24} />
              <h2 className="text-2xl font-bold" style={{ color: '#6365baff' }}>
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
          <h2 className="text-2xl font-bold mb-6" style={{ color: '#6365baff' }}>Additional Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-semibold text-gray-600">Created At</label>
              <p className="text-lg font-semibold text-gray-900 mt-2">
                {student.createdAt ? new Date(student.createdAt).toLocaleDateString('en-US', {
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
                {student.updatedAt ? new Date(student.updatedAt).toLocaleDateString('en-US', {
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

export default StudentDetail;
