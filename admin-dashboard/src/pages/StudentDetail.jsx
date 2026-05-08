import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiMail, FiUser, FiBook, FiImage, FiRefreshCw, FiCheckCircle, FiCamera } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { studentAPI } from '../api/api';
import { enrollPerson } from '../api/faceRecognition';
import AttendanceSummary from '../components/AttendanceSummary';

const StudentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollMsg, setEnrollMsg] = useState(null);
  const [uploadingPic, setUploadingPic] = useState(false);
  const profileInputRef = useRef(null);
  const isDarkMode = document.documentElement.classList.contains('dark');

  const handleProfilePictureChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        setUploadingPic(true);
        await studentAPI.updateStudent(id, { Profile_Picture: reader.result });
        await fetchStudentDetails();
      } catch (err) {
        console.error('Failed to update profile picture:', err);
      } finally {
        setUploadingPic(false);
        e.target.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleEnroll = async () => {
    try {
      setEnrolling(true);
      setEnrollMsg(null);
      await enrollPerson('Student', student.Student_ID);
      setEnrollMsg({ type: 'success', text: 'Face enrolled successfully' });
      await fetchStudentDetails();
    } catch (err) {
      setEnrollMsg({ type: 'error', text: err.response?.data?.message || 'Enrollment failed' });
    } finally {
      setEnrolling(false);
    }
  };

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
      <div className="min-h-screen flex items-center justify-center" style={{ 
        background: isDarkMode 
          ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.90))'
          : 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' 
      }}>
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2" style={{ borderColor: isDarkMode ? '#818cf8' : '#6365baff' }}></div>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ 
        background: isDarkMode 
          ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.90))'
          : 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' 
      }}>
        <div className="text-center">
          <p className="text-xl text-red-600 mb-4">{error || 'Student not found'}</p>
          <button
            onClick={() => navigate('/students')}
            className="px-6 py-2 rounded-xl font-semibold text-white"
            style={{ backgroundColor: isDarkMode ? '#818cf8' : '#6365baff' }}
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
            onClick={() => navigate('/students')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all mb-4"
            style={{
              background: isDarkMode ? 'rgba(129, 140, 248, 0.1)' : '#ffffff',
              color: isDarkMode ? '#818cf8' : '#6365baff',
              border: isDarkMode ? '2px solid rgba(129, 140, 248, 0.5)' : '2px solid #6365baff'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(129, 140, 248, 0.2)' : '#6365baff';
              e.currentTarget.style.color = isDarkMode ? '#818cf8' : '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(129, 140, 248, 0.1)' : '#ffffff';
              e.currentTarget.style.color = isDarkMode ? '#818cf8' : '#6365baff';
            }}
          >
            <FiArrowLeft size={20} />
            Back to Students
          </button>
          <h1 className="text-4xl font-bold" style={{ color: isDarkMode ? '#c0f0f0' : '#6365baff' }}>Student Details</h1>
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
                ? '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 30px rgba(129, 140, 248, 0.1)'
                : '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)',
              border: isDarkMode ? '1px solid rgba(129, 140, 248, 0.2)' : 'none'
            }}
          >
            <h2 className="text-2xl font-bold mb-6" style={{ color: isDarkMode ? '#818cf8' : '#6365baff' }}>Personal Information</h2>
            
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FiUser style={{ color: isDarkMode ? '#818cf8' : '#6b7280' }} size={18} />
                  <label className="text-xs font-semibold" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#4b5563' }}>Full Name</label>
                </div>
                <p className="text-lg font-semibold ml-6" style={{ color: isDarkMode ? '#c0f0f0' : '#111827' }}>{student.Name}</p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FiBook style={{ color: isDarkMode ? '#818cf8' : '#6b7280' }} size={18} />
                  <label className="text-xs font-semibold" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#4b5563' }}>Student ID</label>
                </div>
                <p className="text-lg font-semibold ml-6" style={{ color: isDarkMode ? '#818cf8' : '#305796' }}>
                  {student.Student_ID}
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FiBook style={{ color: isDarkMode ? '#818cf8' : '#6b7280' }} size={18} />
                  <label className="text-xs font-semibold" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#4b5563' }}>Roll Number</label>
                </div>
                <p className="text-lg font-semibold ml-6" style={{ color: isDarkMode ? '#c0f0f0' : '#111827' }}>{student.RollNumber}</p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FiMail style={{ color: isDarkMode ? '#818cf8' : '#6b7280' }} size={18} />
                  <label className="text-xs font-semibold" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#4b5563' }}>Email</label>
                </div>
                <p className="text-lg font-semibold ml-6" style={{ color: isDarkMode ? '#c0f0f0' : '#111827' }}>{student.Email}</p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FiUser style={{ color: isDarkMode ? '#818cf8' : '#6b7280' }} size={18} />
                    <label className="text-xs font-semibold" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#4b5563' }}>Gender</label>
                  </div>
                  <p className="text-lg font-semibold ml-6" style={{ color: isDarkMode ? '#c0f0f0' : '#111827' }}>{student.Gender || 'N/A'}</p>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FiBook style={{ color: isDarkMode ? '#818cf8' : '#6b7280' }} size={18} />
                    <label className="text-xs font-semibold" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#4b5563' }}>Department</label>
                  </div>
                  <p className="text-lg font-semibold ml-6" style={{ color: isDarkMode ? '#c0f0f0' : '#111827' }}>{student.Department || 'N/A'}</p>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FiBook style={{ color: isDarkMode ? '#818cf8' : '#6b7280' }} size={18} />
                  <label className="text-xs font-semibold" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#4b5563' }}>Enrollment Status</label>
                </div>
                <div className="ml-6 flex items-center gap-3 flex-wrap">
                  <span
                    className="px-3 py-1 rounded-full text-sm"
                    style={{
                      backgroundColor: student.is_enrolled
                        ? (isDarkMode ? 'rgba(52, 211, 153, 0.2)' : '#dcfce7')
                        : (isDarkMode ? 'rgba(250, 204, 21, 0.2)' : '#fef9c3'),
                      color: student.is_enrolled
                        ? (isDarkMode ? '#34d399' : '#15803d')
                        : (isDarkMode ? '#fbbf24' : '#a16207'),
                      border: isDarkMode
                        ? `1px solid ${student.is_enrolled ? 'rgba(52, 211, 153, 0.5)' : 'rgba(250, 204, 21, 0.5)'}`
                        : 'none'
                    }}
                  >
                    {student.is_enrolled ? 'Enrolled' : 'Not Enrolled'}
                  </span>

                  {/* Enroll / Re-Enroll button */}
                  <button
                    onClick={handleEnroll}
                    disabled={enrolling || !student.Face_Picture_1}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: isDarkMode ? 'rgba(129, 140, 248, 0.15)' : '#eef2ff',
                      color: isDarkMode ? '#818cf8' : '#6365baff',
                      border: isDarkMode ? '1px solid rgba(129, 140, 248, 0.4)' : '1px solid #a5b4fc'
                    }}
                    title={!student.Face_Picture_1 ? 'Add face pictures first' : student.is_enrolled ? 'Re-enroll (replaces existing embeddings)' : 'Enroll face'}
                  >
                    <FiRefreshCw size={13} className={enrolling ? 'animate-spin' : ''} />
                    {enrolling ? 'Enrolling…' : student.is_enrolled ? 'Re-Enroll' : 'Enroll Face'}
                  </button>

                  {enrollMsg && (
                    <span className="flex items-center gap-1 text-xs font-medium"
                      style={{ color: enrollMsg.type === 'success' ? (isDarkMode ? '#34d399' : '#15803d') : '#ef4444' }}>
                      {enrollMsg.type === 'success' && <FiCheckCircle size={13} />}
                      {enrollMsg.text}
                    </span>
                  )}
                </div>
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
                ? '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 30px rgba(129, 140, 248, 0.1)'
                : '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)',
              border: isDarkMode ? '1px solid rgba(129, 140, 248, 0.2)' : 'none'
            }}
          >
            <h3 className="text-xl font-bold mb-4" style={{ color: isDarkMode ? '#818cf8' : '#6365baff' }}>Profile Picture</h3>
            <div className="flex flex-col items-center gap-3">
              <div className="relative group cursor-pointer" onClick={() => profileInputRef.current?.click()}>
                <div
                  className="w-48 h-48 rounded-full flex items-center justify-center text-6xl font-bold overflow-hidden"
                  style={{
                    backgroundColor: isDarkMode ? 'rgba(129, 140, 248, 0.15)' : '#f3f4f6',
                    border: isDarkMode ? '4px solid rgba(129, 140, 248, 0.7)' : '4px solid #6365baff',
                    color: isDarkMode ? '#818cf8' : '#305796',
                    boxShadow: isDarkMode ? '0 0 30px rgba(129, 140, 248, 0.2)' : 'none'
                  }}
                >
                  {student.Profile_Picture ? (
                    <img src={student.Profile_Picture} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    student.Name?.[0] || '?'
                  )}
                </div>
                <div className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'rgba(0,0,0,0.45)' }}>
                  {uploadingPic
                    ? <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-white" />
                    : <FiCamera size={32} color="white" />}
                </div>
              </div>
              <p className="text-xs" style={{ color: isDarkMode ? 'rgba(192,240,240,0.5)' : '#9ca3af' }}>
                Click to {student.Profile_Picture ? 'change' : 'upload'} profile picture
              </p>
              <input
                ref={profileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleProfilePictureChange}
              />
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
                ? '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 30px rgba(129, 140, 248, 0.1)'
                : '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)',
              border: isDarkMode ? '1px solid rgba(129, 140, 248, 0.2)' : 'none'
            }}
          >
            <div className="flex items-center gap-2 mb-6">
              <FiImage style={{ color: isDarkMode ? '#818cf8' : '#6365baff' }} size={24} />
              <h2 className="text-2xl font-bold" style={{ color: isDarkMode ? '#818cf8' : '#6365baff' }}>
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
                      border: isDarkMode ? '2px solid rgba(129, 140, 248, 0.3)' : '2px solid #e5e7eb'
                    }}
                  />
                  <div 
                    className="absolute bottom-2 left-2 text-xs px-2 py-1 rounded"
                    style={{
                      backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.6)',
                      color: isDarkMode ? '#818cf8' : 'white'
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
              ? '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 30px rgba(129, 140, 248, 0.1)'
              : '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)',
            border: isDarkMode ? '1px solid rgba(129, 140, 248, 0.2)' : 'none'
          }}
        >
          <h2 className="text-2xl font-bold mb-6" style={{ color: isDarkMode ? '#818cf8' : '#6365baff' }}>Additional Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-semibold" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#4b5563' }}>Created At</label>
              <p className="text-lg font-semibold mt-2" style={{ color: isDarkMode ? '#c0f0f0' : '#111827' }}>
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
              <label className="text-xs font-semibold" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#4b5563' }}>Last Updated</label>
              <p className="text-lg font-semibold mt-2" style={{ color: isDarkMode ? '#c0f0f0' : '#111827' }}>
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

        {/* Attendance Summary */}
        <AttendanceSummary
          personId={student.Student_ID}
          personType="STUDENT"
          personName={student.Name}
          isDarkMode={isDarkMode}
        />
      </div>
    </div>
  );
};

export default StudentDetail;
