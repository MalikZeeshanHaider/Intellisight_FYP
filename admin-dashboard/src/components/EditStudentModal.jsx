import React, { useState, useEffect, useRef } from 'react';
import { FiX, FiUpload, FiTrash2, FiChevronDown } from 'react-icons/fi';
import { studentAPI } from '../api/api';
import { sectionAPI, enrollmentAPI } from '../api/attendance';

const EditStudentModal = ({ isOpen, onClose, onSuccess, student }) => {
    const isDarkMode = document.documentElement.classList.contains('dark');
    const [formData, setFormData] = useState({
        Name: '',
        RollNumber: '',
        Email: '',
        Gender: '',
        Department: '',
        Section_ID: ''
    });
    const [facePictures, setFacePictures] = useState({
        Face_Picture_1: null,
        Face_Picture_2: null,
        Face_Picture_3: null,
        Face_Picture_4: null,
        Face_Picture_5: null
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [genderDropdownOpen, setGenderDropdownOpen] = useState(false);
    const genderDropdownRef = useRef(null);
    const [sections, setSections] = useState([]);
    const [sectionsLoading, setSectionsLoading] = useState(false);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (genderDropdownRef.current && !genderDropdownRef.current.contains(event.target)) {
                setGenderDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Load sections once — show all sections, Section_ID is optional
    useEffect(() => {
        setSectionsLoading(true);
        sectionAPI.getAll()
            .then(res => {
                const list = Array.isArray(res) ? res : (res.data ?? []);
                setSections(list);
            })
            .catch(() => setSections([]))
            .finally(() => setSectionsLoading(false));
    }, []);

    // Load current enrollment for student
    useEffect(() => {
        async function loadEnrollment(studentId) {
            if (!studentId) return;
            try {
                const res = await enrollmentAPI.getByStudent(studentId);
                const sectionsList = Array.isArray(res?.sections) ? res.sections : [];
                if (sectionsList.length) {
                    setFormData(prev => ({ ...prev, Section_ID: String(sectionsList[0].Section_ID) }));
                } else {
                    setFormData(prev => ({ ...prev, Section_ID: '' }));
                }
            } catch {
                setFormData(prev => ({ ...prev, Section_ID: '' }));
            }
        }
        if (student?.Student_ID) {
            loadEnrollment(student.Student_ID);
        }
    }, [student?.Student_ID]);

    // Populate form when student prop changes
    useEffect(() => {
        if (student) {
            setFormData({
                Name: student.Name || '',
                RollNumber: student.RollNumber || '',
                Email: student.Email || '',
                Gender: student.Gender || '',
                Department: student.Department || '',
                Section_ID: student.Section_ID ? String(student.Section_ID) : ''
            });
            setFacePictures({
                Face_Picture_1: student.Face_Picture_1 || null,
                Face_Picture_2: student.Face_Picture_2 || null,
                Face_Picture_3: student.Face_Picture_3 || null,
                Face_Picture_4: student.Face_Picture_4 || null,
                Face_Picture_5: student.Face_Picture_5 || null
            });
        }
    }, [student]);

    const handleInputChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleImageUpload = (pictureNumber) => (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            setFacePictures(prev => ({
                ...prev,
                [`Face_Picture_${pictureNumber}`]: reader.result
            }));
        };
        reader.readAsDataURL(file);
    };

    const removeImage = (pictureNumber) => {
        setFacePictures(prev => ({
            ...prev,
            [`Face_Picture_${pictureNumber}`]: null
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Validation
        if (!formData.Name.trim()) {
            setError('Name is required');
            return;
        }
        if (!formData.RollNumber.trim()) {
            setError('Roll Number is required');
            return;
        }
        if (!formData.Email.trim()) {
            setError('Email is required');
            return;
        }
        setLoading(true);

        try {
            const payload = {
                Name: formData.Name.trim(),
                RollNumber: formData.RollNumber.trim(),
                Email: formData.Email.trim(),
                Gender: formData.Gender,
                Department: formData.Department.trim(),
            };

            // Section_ID is optional — only include if selected
            if (formData.Section_ID) {
                payload.Section_ID = parseInt(formData.Section_ID, 10);
            }

            // Add pictures (only include changed ones)
            if (facePictures.Face_Picture_1) payload.Face_Picture_1 = facePictures.Face_Picture_1;
            if (facePictures.Face_Picture_2) payload.Face_Picture_2 = facePictures.Face_Picture_2;
            if (facePictures.Face_Picture_3) payload.Face_Picture_3 = facePictures.Face_Picture_3;
            if (facePictures.Face_Picture_4) payload.Face_Picture_4 = facePictures.Face_Picture_4;
            if (facePictures.Face_Picture_5) payload.Face_Picture_5 = facePictures.Face_Picture_5;

            await studentAPI.updateStudent(student.Student_ID, payload);

            onSuccess();
            onClose();
        } catch (err) {
            console.error('Error updating student:', err);
            
            let errorMessage = 'Failed to update student. Please check all fields.';
            
            if (err.response?.data) {
                const data = err.response.data;
                
                if (data.details && Array.isArray(data.details)) {
                    errorMessage = data.details.map(d => `${d.field}: ${d.message}`).join(', ');
                } else if (data.message) {
                    errorMessage = data.message;
                } else if (data.error) {
                    errorMessage = data.error;
                }
            } else if (err.message) {
                errorMessage = err.message;
            }
            
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const uploadedCount = Object.values(facePictures).filter(Boolean).length;

    return (
        <div 
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            style={{
                background: isDarkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
                backdropFilter: 'blur(8px)'
            }}
        >
            <div 
                className="rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto custom-student-modal-scrollbar"
                style={{
                    background: isDarkMode 
                        ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.95))'
                        : 'white',
                    border: isDarkMode ? '1px solid rgba(129, 140, 248, 0.3)' : 'none',
                    boxShadow: isDarkMode 
                        ? '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(129, 140, 248, 0.1)'
                        : '0 20px 60px rgba(0, 0, 0, 0.3)'
                }}
            >
                {/* Header */}
                <div 
                    className="flex items-center justify-between p-6"
                    style={{ 
                        borderBottom: isDarkMode ? '1px solid rgba(129, 140, 248, 0.2)' : '1px solid #e5e7eb'
                    }}
                >
                    <h2 className="text-2xl font-bold" style={{ color: isDarkMode ? '#818cf8' : '#6365baff' }}>Edit Student</h2>
                    <button
                        onClick={onClose}
                        className="transition"
                        style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#6b7280' }}
                        onMouseEnter={(e) => e.currentTarget.style.color = isDarkMode ? '#c0f0f0' : '#374151'}
                        onMouseLeave={(e) => e.currentTarget.style.color = isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#6b7280'}
                    >
                        <FiX size={24} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Name */}
                    <div>
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#1e293b' }}>
                            Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            name="Name"
                            value={formData.Name}
                            onChange={handleInputChange}
                            required
                            className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none"
                            style={{
                                background: isDarkMode ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                                border: isDarkMode ? '2px solid rgba(129, 140, 248, 0.3)' : '2px solid rgba(148, 163, 184, 0.3)',
                                color: isDarkMode ? '#c0f0f0' : '#0F172A',
                                transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
                            }}
                            placeholder="Enter student name"
                            onFocus={(e) => {
                                e.target.style.borderColor = isDarkMode ? '#818cf8' : '#6365baff';
                                if (isDarkMode) e.target.style.boxShadow = '0 0 15px rgba(129, 140, 248, 0.3)';
                            }}
                            onBlur={(e) => {
                                e.target.style.borderColor = isDarkMode ? 'rgba(129, 140, 248, 0.3)' : 'rgba(148, 163, 184, 0.3)';
                                e.target.style.boxShadow = 'none';
                            }}
                        />
                    </div>

                    {/* Roll Number */}
                    <div>
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#1e293b' }}>
                            Roll Number <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            name="RollNumber"
                            value={formData.RollNumber}
                            onChange={handleInputChange}
                            required
                            className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none"
                            style={{
                                background: isDarkMode ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                                border: isDarkMode ? '2px solid rgba(129, 140, 248, 0.3)' : '2px solid rgba(148, 163, 184, 0.3)',
                                color: isDarkMode ? '#c0f0f0' : '#0F172A',
                                transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
                            }}
                            placeholder="Enter roll number"
                            onFocus={(e) => {
                                e.target.style.borderColor = isDarkMode ? '#818cf8' : '#6365baff';
                                if (isDarkMode) e.target.style.boxShadow = '0 0 15px rgba(129, 140, 248, 0.3)';
                            }}
                            onBlur={(e) => {
                                e.target.style.borderColor = isDarkMode ? 'rgba(129, 140, 248, 0.3)' : 'rgba(148, 163, 184, 0.3)';
                                e.target.style.boxShadow = 'none';
                            }}
                        />
                    </div>

                    {/* Email */}
                    <div>
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#1e293b' }}>
                            Email <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="email"
                            name="Email"
                            value={formData.Email}
                            onChange={handleInputChange}
                            required
                            className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none"
                            style={{
                                background: isDarkMode ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                                border: isDarkMode ? '2px solid rgba(129, 140, 248, 0.3)' : '2px solid rgba(148, 163, 184, 0.3)',
                                color: isDarkMode ? '#c0f0f0' : '#0F172A',
                                transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
                            }}
                            placeholder="student@example.com"
                            onFocus={(e) => {
                                e.target.style.borderColor = isDarkMode ? '#818cf8' : '#6365baff';
                                if (isDarkMode) e.target.style.boxShadow = '0 0 15px rgba(129, 140, 248, 0.3)';
                            }}
                            onBlur={(e) => {
                                e.target.style.borderColor = isDarkMode ? 'rgba(129, 140, 248, 0.3)' : 'rgba(148, 163, 184, 0.3)';
                                e.target.style.boxShadow = 'none';
                            }}
                        />
                    </div>

                    {/* Gender - Custom Dropdown */}
                    <div>
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#1e293b' }}>
                            Gender
                        </label>
                        <div className="relative" ref={genderDropdownRef}>
                            <button
                                type="button"
                                onClick={() => setGenderDropdownOpen(!genderDropdownOpen)}
                                className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none flex items-center justify-between"
                                style={{
                                    background: isDarkMode ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                                    border: isDarkMode ? '2px solid rgba(129, 140, 248, 0.3)' : '2px solid rgba(148, 163, 184, 0.3)',
                                    color: formData.Gender ? (isDarkMode ? '#c0f0f0' : '#0F172A') : '#9CA3AF'
                                }}
                            >
                                <span>{formData.Gender || 'Select gender'}</span>
                                <FiChevronDown className={`transition-transform ${genderDropdownOpen ? 'rotate-180' : ''}`} style={{ color: isDarkMode ? '#818cf8' : '#6365ba' }} />
                            </button>
                            
                            {genderDropdownOpen && (
                                <div 
                                    className="absolute top-full left-0 mt-1 w-full rounded-xl shadow-lg py-1 z-50"
                                    style={{
                                        background: isDarkMode ? 'rgba(30, 41, 59, 0.98)' : 'white',
                                        border: isDarkMode ? '1px solid rgba(129, 140, 248, 0.3)' : '1px solid #e5e7eb',
                                        boxShadow: isDarkMode ? '0 10px 40px rgba(0, 0, 0, 0.5)' : '0 10px 40px rgba(0, 0, 0, 0.15)'
                                    }}
                                >
                                    {['Male', 'Female', 'Other'].map((gender) => (
                                        <button
                                            key={gender}
                                            type="button"
                                            onClick={() => {
                                                setFormData({ ...formData, Gender: gender });
                                                setGenderDropdownOpen(false);
                                            }}
                                            className="w-full text-left px-4 py-2 text-sm font-medium transition-colors"
                                            style={{
                                                backgroundColor: formData.Gender === gender 
                                                    ? (isDarkMode ? 'rgba(129, 140, 248, 0.2)' : '#f3e8ff')
                                                    : 'transparent',
                                                color: formData.Gender === gender 
                                                    ? (isDarkMode ? '#818cf8' : '#7c3aed')
                                                    : (isDarkMode ? '#c0f0f0' : '#374151')
                                            }}
                                            onMouseEnter={(e) => {
                                                if (formData.Gender !== gender) {
                                                    e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(129, 140, 248, 0.1)' : '#f3e8ff';
                                                    e.currentTarget.style.color = isDarkMode ? '#818cf8' : '#7c3aed';
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (formData.Gender !== gender) {
                                                    e.currentTarget.style.backgroundColor = 'transparent';
                                                    e.currentTarget.style.color = isDarkMode ? '#c0f0f0' : '#374151';
                                                }
                                            }}
                                        >
                                            {gender}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                                    {/* Section */}
                                    <div>
                                        <label className="block text-xs font-semibold mb-1.5" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#1e293b' }}>
                                            Section <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            name="Section_ID"
                                            value={formData.Section_ID}
                                            onChange={handleInputChange}
                                            required
                                            disabled={sectionsLoading || sections.length === 0}
                                            className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none"
                                            style={{
                                                background: isDarkMode ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                                                border: isDarkMode ? '2px solid rgba(129, 140, 248, 0.3)' : '2px solid rgba(148, 163, 184, 0.3)',
                                                color: formData.Section_ID ? (isDarkMode ? '#c0f0f0' : '#0F172A') : (isDarkMode ? 'rgba(192, 240, 240, 0.5)' : '#9CA3AF'),
                                                transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
                                            }}
                                            onFocus={(e) => {
                                                e.target.style.borderColor = isDarkMode ? '#818cf8' : '#6365baff';
                                                if (isDarkMode) e.target.style.boxShadow = '0 0 15px rgba(129, 140, 248, 0.3)';
                                            }}
                                            onBlur={(e) => {
                                                e.target.style.borderColor = isDarkMode ? 'rgba(129, 140, 248, 0.3)' : 'rgba(148, 163, 184, 0.3)';
                                                e.target.style.boxShadow = 'none';
                                            }}
                                        >
                                            <option value="" disabled>{sectionsLoading ? 'Loading sections...' : (sections.length ? 'Select section' : 'No attendance sections available')}</option>
                                            {sections.map((section) => {
                                                const labelParts = [section.Name || `Section ${section.Section_ID}`];
                                                if (section.Semester) labelParts.push(`Sem ${section.Semester}`);
                                                if (section.Shift) labelParts.push(section.Shift);
                                                return (
                                                    <option key={section.Section_ID} value={section.Section_ID}>
                                                        {labelParts.join(' — ')}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>

                    {/* Department */}
                    <div>
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#1e293b' }}>
                            Department
                        </label>
                        <input
                            type="text"
                            name="Department"
                            value={formData.Department}
                            onChange={handleInputChange}
                            className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none"
                            style={{
                                background: isDarkMode ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                                border: isDarkMode ? '2px solid rgba(129, 140, 248, 0.3)' : '2px solid rgba(148, 163, 184, 0.3)',
                                color: isDarkMode ? '#c0f0f0' : '#0F172A',
                                transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
                            }}
                            placeholder="Enter department"
                            onFocus={(e) => {
                                e.target.style.borderColor = isDarkMode ? '#818cf8' : '#6365baff';
                                if (isDarkMode) e.target.style.boxShadow = '0 0 15px rgba(129, 140, 248, 0.3)';
                            }}
                            onBlur={(e) => {
                                e.target.style.borderColor = isDarkMode ? 'rgba(129, 140, 248, 0.3)' : 'rgba(148, 163, 184, 0.3)';
                                e.target.style.boxShadow = 'none';
                            }}
                        />
                    </div>

                    {/* Face Pictures Upload */}
                    <div>
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#1e293b' }}>
                            Face Pictures (1-5 images)
                        </label>
                        <p className="text-xs mb-3" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.5)' : '#6b7280' }}>
                            {uploadedCount}/5 images uploaded. Leave unchanged to keep existing pictures.
                        </p>

                        {/* Image Upload Grid */}
                        <div className="grid grid-cols-3 gap-4">
                            {[1, 2, 3, 4, 5].map(num => {
                                const pictureKey = `Face_Picture_${num}`;
                                const picture = facePictures[pictureKey];

                                return (
                                    <div key={num} className="relative">
                                        <input
                                            type="file"
                                            id={`editImageUpload${num}`}
                                            accept="image/*"
                                            onChange={handleImageUpload(num)}
                                            className="hidden"
                                        />
                                        
                                        {picture ? (
                                            <div className="relative group">
                                                <img
                                                    src={picture}
                                                    alt={`Picture ${num}`}
                                                    className="w-full h-32 object-cover rounded-lg"
                                                    style={{ 
                                                        border: isDarkMode ? '2px solid rgba(129, 140, 248, 0.3)' : '2px solid #d1d5db'
                                                    }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => removeImage(num)}
                                                    className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition"
                                                >
                                                    <FiTrash2 size={16} />
                                                </button>
                                                <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
                                                    Picture {num}
                                                </div>
                                            </div>
                                        ) : (
                                            <label
                                                htmlFor={`editImageUpload${num}`}
                                                className="cursor-pointer flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-lg transition"
                                                style={{
                                                    borderColor: isDarkMode ? 'rgba(129, 140, 248, 0.3)' : '#d1d5db',
                                                    backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.5)' : 'transparent'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.borderColor = isDarkMode ? '#818cf8' : '#3b82f6'}
                                                onMouseLeave={(e) => e.currentTarget.style.borderColor = isDarkMode ? 'rgba(129, 140, 248, 0.3)' : '#d1d5db'}
                                            >
                                                <FiUpload size={24} style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.5)' : '#9ca3af', marginBottom: '4px' }} />
                                                <span className="text-xs" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.6)' : '#6b7280' }}>
                                                    Picture {num}
                                                </span>
                                            </label>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div 
                            className="rounded-lg p-4"
                            style={{
                                backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2',
                                border: isDarkMode ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid #fecaca'
                            }}
                        >
                            <p className="font-semibold mb-1" style={{ color: isDarkMode ? '#f87171' : '#991b1b' }}>Validation failed</p>
                            <p className="text-sm" style={{ color: isDarkMode ? '#fca5a5' : '#dc2626' }}>{error}</p>
                        </div>
                    )}

                    {/* Submit Button */}
                    <div className="flex justify-end space-x-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2 rounded-xl text-sm font-semibold transition-all"
                            style={{
                                border: isDarkMode ? '2px solid rgba(129, 140, 248, 0.3)' : '2px solid #e5e7eb',
                                color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#6b7280',
                                background: isDarkMode ? 'transparent' : '#ffffff'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(129, 140, 248, 0.1)' : '#f9fafb';
                                e.currentTarget.style.borderColor = isDarkMode ? 'rgba(129, 140, 248, 0.5)' : '#e5e7eb';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = isDarkMode ? 'transparent' : '#ffffff';
                                e.currentTarget.style.borderColor = isDarkMode ? 'rgba(129, 140, 248, 0.3)' : '#e5e7eb';
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className={`px-6 py-2 text-white rounded-xl text-sm font-semibold transition-all ${
                                loading ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                            style={{ 
                                backgroundColor: isDarkMode ? 'rgba(129, 140, 248, 0.8)' : '#6365baff',
                                boxShadow: isDarkMode ? '0 0 20px rgba(129, 140, 248, 0.3)' : 'none'
                            }}
                            onMouseEnter={(e) => {
                                if (!loading) {
                                    e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(129, 140, 248, 1)' : '#5558a8';
                                    if (isDarkMode) e.currentTarget.style.boxShadow = '0 0 30px rgba(129, 140, 248, 0.5)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(129, 140, 248, 0.8)' : '#6365baff';
                                if (isDarkMode) e.currentTarget.style.boxShadow = '0 0 20px rgba(129, 140, 248, 0.3)';
                            }}
                        >
                            {loading ? 'Updating...' : 'Update Student'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditStudentModal;
