import React, { useState, useEffect, useRef } from 'react';
import { FiX, FiUpload, FiTrash2, FiChevronDown, FiRefreshCw, FiCamera } from 'react-icons/fi';
import { studentAPI } from '../api/api';
import { sectionAPI, enrollmentAPI } from '../api/attendance';
import { enrollPerson } from '../api/faceRecognition';

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
    const [profilePicture, setProfilePicture] = useState(null);
    const profilePicInputRef = useRef(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [enrollStatus, setEnrollStatus] = useState(null);
    const picturesChangedRef = useRef(false);

    const handleProfilePicUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => setProfilePicture(reader.result);
        reader.readAsDataURL(file);
        e.target.value = '';
    };
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
            setProfilePicture(student.Profile_Picture || null);
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

    const handleMultiImageUpload = (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        picturesChangedRef.current = true;
        const freeSlots = [1, 2, 3, 4, 5].filter(n => !facePictures[`Face_Picture_${n}`]);
        files.slice(0, freeSlots.length).forEach((file, i) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFacePictures(prev => ({ ...prev, [`Face_Picture_${freeSlots[i]}`]: reader.result }));
            };
            reader.readAsDataURL(file);
        });
        e.target.value = '';
    };

    const removeImage = (pictureNumber) => {
        picturesChangedRef.current = true;
        setFacePictures(prev => {
            const all = [1, 2, 3, 4, 5].map(n => prev[`Face_Picture_${n}`]).filter(Boolean);
            all.splice(pictureNumber - 1, 1);
            return {
                Face_Picture_1: all[0] || null,
                Face_Picture_2: all[1] || null,
                Face_Picture_3: all[2] || null,
                Face_Picture_4: all[3] || null,
                Face_Picture_5: all[4] || null,
            };
        });
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

            // Profile picture (optional)
            payload.Profile_Picture = profilePicture ?? null;

            // Add pictures (only include changed ones)
            if (facePictures.Face_Picture_1) payload.Face_Picture_1 = facePictures.Face_Picture_1;
            if (facePictures.Face_Picture_2) payload.Face_Picture_2 = facePictures.Face_Picture_2;
            if (facePictures.Face_Picture_3) payload.Face_Picture_3 = facePictures.Face_Picture_3;
            if (facePictures.Face_Picture_4) payload.Face_Picture_4 = facePictures.Face_Picture_4;
            if (facePictures.Face_Picture_5) payload.Face_Picture_5 = facePictures.Face_Picture_5;

            await studentAPI.updateStudent(student.Student_ID, payload);

            // Auto-enroll when face pictures were changed
            if (picturesChangedRef.current && facePictures.Face_Picture_1) {
                setEnrollStatus('enrolling');
                try {
                    await enrollPerson('Student', student.Student_ID);
                    setEnrollStatus('done');
                } catch {
                    setEnrollStatus('failed');
                }
                picturesChangedRef.current = false;
                // Brief pause so user sees the status before modal closes
                await new Promise(r => setTimeout(r, 1200));
            }

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
                    {/* Profile Picture (optional) */}
                    <div className="flex flex-col items-center gap-2 pb-2">
                        <div
                            className="relative group cursor-pointer w-24 h-24 rounded-full overflow-hidden flex items-center justify-center text-3xl font-bold"
                            style={{
                                background: isDarkMode ? 'rgba(129,140,248,0.15)' : '#f3f4f6',
                                border: isDarkMode ? '3px solid rgba(129,140,248,0.6)' : '3px solid #6365baff',
                                color: isDarkMode ? '#818cf8' : '#6365baff',
                            }}
                            onClick={() => profilePicInputRef.current?.click()}
                        >
                            {profilePicture
                                ? <img src={profilePicture} alt="Profile" className="w-full h-full object-cover" />
                                : <span>{student?.Name?.[0] || <FiCamera size={28} />}</span>}
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
                                style={{ background: 'rgba(0,0,0,0.4)' }}>
                                <FiCamera size={22} color="white" />
                            </div>
                        </div>
                        <span className="text-xs" style={{ color: isDarkMode ? 'rgba(192,240,240,0.5)' : '#9ca3af' }}>
                            Profile picture (optional) — click to {profilePicture ? 'change' : 'upload'}
                        </span>
                        {profilePicture && (
                            <button type="button" onClick={() => setProfilePicture(null)}
                                className="text-xs" style={{ color: '#ef4444' }}>
                                Remove
                            </button>
                        )}
                        <input ref={profilePicInputRef} type="file" accept="image/*" className="hidden" onChange={handleProfilePicUpload} />
                    </div>

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
                            Face Pictures (1–5 images)
                        </label>
                        <p className="text-xs mb-3" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.5)' : '#6b7280' }}>
                            {uploadedCount}/5 images selected. Leave unchanged to keep existing pictures.
                            {uploadedCount > 0 && uploadedCount < 5 && ` You can add ${5 - uploadedCount} more.`}
                            {uploadedCount === 5 && ' Maximum reached.'}
                        </p>

                        {/* Single multi-select upload button */}
                        {uploadedCount < 5 && (
                            <>
                                <input
                                    type="file"
                                    id="editStudentMultiImageUpload"
                                    accept="image/*"
                                    multiple
                                    onChange={handleMultiImageUpload}
                                    className="hidden"
                                />
                                <label
                                    htmlFor="editStudentMultiImageUpload"
                                    className="cursor-pointer flex flex-col items-center justify-center w-full py-6 border-2 border-dashed rounded-xl transition mb-3"
                                    style={{
                                        borderColor: isDarkMode ? 'rgba(129, 140, 248, 0.35)' : '#c7d2fe',
                                        backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.5)' : 'rgba(238, 242, 255, 0.5)'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = isDarkMode ? '#818cf8' : '#6365baff';
                                        e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(129, 140, 248, 0.1)' : 'rgba(238, 242, 255, 0.9)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = isDarkMode ? 'rgba(129, 140, 248, 0.35)' : '#c7d2fe';
                                        e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(15, 23, 42, 0.5)' : 'rgba(238, 242, 255, 0.5)';
                                    }}
                                >
                                    <FiUpload size={28} style={{ color: isDarkMode ? '#818cf8' : '#6365baff', marginBottom: '8px' }} />
                                    <span className="text-sm font-semibold" style={{ color: isDarkMode ? '#818cf8' : '#6365baff' }}>
                                        Click to select images
                                    </span>
                                    <span className="text-xs mt-1" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.5)' : '#9ca3af' }}>
                                        Select up to {5 - uploadedCount} image{5 - uploadedCount !== 1 ? 's' : ''} at once
                                    </span>
                                </label>
                            </>
                        )}

                        {/* Preview grid */}
                        {uploadedCount > 0 && (
                            <div className="grid grid-cols-3 gap-3">
                                {[1, 2, 3, 4, 5].map(num => {
                                    const picture = facePictures[`Face_Picture_${num}`];
                                    if (!picture) return null;
                                    return (
                                        <div key={num} className="relative group">
                                            <img
                                                src={picture}
                                                alt={`Picture ${num}`}
                                                className="w-full h-28 object-cover rounded-lg"
                                                style={{ border: isDarkMode ? '2px solid rgba(129, 140, 248, 0.3)' : '2px solid #d1d5db' }}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeImage(num)}
                                                className="absolute top-1.5 right-1.5 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition"
                                            >
                                                <FiTrash2 size={13} />
                                            </button>
                                            <div
                                                className="absolute bottom-1.5 left-1.5 text-xs px-1.5 py-0.5 rounded"
                                                style={{
                                                    backgroundColor: 'rgba(0,0,0,0.65)',
                                                    color: isDarkMode ? '#a5b4fc' : 'white'
                                                }}
                                            >
                                                #{num}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
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

                    {/* Enrollment status during save */}
                    {enrollStatus && (
                        <div className="rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2"
                            style={{
                                backgroundColor: enrollStatus === 'done'
                                    ? (isDarkMode ? 'rgba(52, 211, 153, 0.15)' : '#dcfce7')
                                    : enrollStatus === 'failed'
                                    ? (isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2')
                                    : (isDarkMode ? 'rgba(129, 140, 248, 0.15)' : '#eef2ff'),
                                color: enrollStatus === 'done'
                                    ? (isDarkMode ? '#34d399' : '#15803d')
                                    : enrollStatus === 'failed'
                                    ? '#ef4444'
                                    : (isDarkMode ? '#818cf8' : '#6365baff')
                            }}>
                            <FiRefreshCw size={14} className={enrollStatus === 'enrolling' ? 'animate-spin' : ''} />
                            {enrollStatus === 'enrolling' && 'Updating face embeddings…'}
                            {enrollStatus === 'done' && 'Face embeddings updated successfully'}
                            {enrollStatus === 'failed' && 'Saved, but enrollment failed — re-enroll manually'}
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
