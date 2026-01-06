import React, { useState, useRef, useEffect } from 'react';
import { FiX, FiUpload, FiTrash2, FiChevronDown } from 'react-icons/fi';
import { teacherAPI } from '../api/api';

const AddTeacherModal = ({ isOpen, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        Name: '',
        Email: '',
        Gender: '',
        Faculty_Type: '',
        Department: ''
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
    const [facultyDropdownOpen, setFacultyDropdownOpen] = useState(false);
    const genderDropdownRef = useRef(null);
    const facultyDropdownRef = useRef(null);

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (genderDropdownRef.current && !genderDropdownRef.current.contains(event.target)) {
                setGenderDropdownOpen(false);
            }
            if (facultyDropdownRef.current && !facultyDropdownRef.current.contains(event.target)) {
                setFacultyDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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
        if (!formData.Email.trim()) {
            setError('Email is required');
            return;
        }
        if (!facePictures.Face_Picture_1) {
            setError('At least one face picture is required');
            return;
        }
        if (formData.Faculty_Type === 'Permanent' && !formData.Department.trim()) {
            setError('Department is required for Permanent faculty');
            return;
        }

        setLoading(true);

        try {
            const payload = {
                Name: formData.Name.trim(),
                Email: formData.Email.trim(),
                Gender: formData.Gender || undefined,
                Faculty_Type: formData.Faculty_Type || undefined,
                Department: formData.Faculty_Type === 'Permanent' ? formData.Department.trim() : null,
                Face_Picture_1: facePictures.Face_Picture_1
            };

            // Add optional pictures
            if (facePictures.Face_Picture_2) payload.Face_Picture_2 = facePictures.Face_Picture_2;
            if (facePictures.Face_Picture_3) payload.Face_Picture_3 = facePictures.Face_Picture_3;
            if (facePictures.Face_Picture_4) payload.Face_Picture_4 = facePictures.Face_Picture_4;
            if (facePictures.Face_Picture_5) payload.Face_Picture_5 = facePictures.Face_Picture_5;

            await teacherAPI.createTeacher(payload);

            setFormData({ Name: '', Email: '', Gender: '', Faculty_Type: '', Department: '' });
            setFacePictures({
                Face_Picture_1: null,
                Face_Picture_2: null,
                Face_Picture_3: null,
                Face_Picture_4: null,
                Face_Picture_5: null
            });
            onSuccess();
            onClose();
        } catch (err) {
            console.error('Error creating teacher:', err);
            
            let errorMessage = 'Failed to create faculty. Please check all fields.';;
            
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto custom-teacher-modal-scrollbar">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h2 className="text-2xl font-bold" style={{ color: '#247e5bff' }}>Add New Faculty</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 transition"
                    >
                        <FiX size={24} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Name */}
                    <div>
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1e293b' }}>
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
                                background: 'rgba(255, 255, 255, 0.8)',
                                border: '2px solid rgba(148, 163, 184, 0.3)',
                                color: '#0F172A',
                                transition: 'border-color 0.15s ease'
                            }}
                            placeholder="Enter faculty name"
                            onFocus={(e) => e.target.style.borderColor = '#247e5bff'}
                            onBlur={(e) => e.target.style.borderColor = 'rgba(148, 163, 184, 0.3)'}
                        />
                    </div>

                    {/* Email */}
                    <div>
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1e293b' }}>
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
                                background: 'rgba(255, 255, 255, 0.8)',
                                border: '2px solid rgba(148, 163, 184, 0.3)',
                                color: '#0F172A',
                                transition: 'border-color 0.15s ease'
                            }}
                            placeholder="faculty@example.com"
                            onFocus={(e) => e.target.style.borderColor = '#247e5bff'}
                            onBlur={(e) => e.target.style.borderColor = 'rgba(148, 163, 184, 0.3)'}
                        />
                    </div>

                    {/* Gender - Custom Dropdown */}
                    <div>
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1e293b' }}>
                            Gender
                        </label>
                        <div className="relative" ref={genderDropdownRef}>
                            <button
                                type="button"
                                onClick={() => setGenderDropdownOpen(!genderDropdownOpen)}
                                className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none flex items-center justify-between"
                                style={{
                                    background: 'rgba(255, 255, 255, 0.8)',
                                    border: '2px solid rgba(148, 163, 184, 0.3)',
                                    color: formData.Gender ? '#0F172A' : '#9CA3AF'
                                }}
                            >
                                <span>{formData.Gender || 'Select gender'}</span>
                                <FiChevronDown className={`transition-transform ${genderDropdownOpen ? 'rotate-180' : ''}`} style={{ color: '#247e5b' }} />
                            </button>
                            
                            {genderDropdownOpen && (
                                <div className="absolute top-full left-0 mt-1 w-full bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50">
                                    {['Male', 'Female', 'Other'].map((gender) => (
                                        <button
                                            key={gender}
                                            type="button"
                                            onClick={() => {
                                                setFormData({ ...formData, Gender: gender });
                                                setGenderDropdownOpen(false);
                                            }}
                                            className={`w-full text-left px-4 py-2 text-sm font-medium hover:bg-green-100 hover:text-green-700 ${formData.Gender === gender ? 'bg-green-50 text-green-700' : 'text-gray-700'}`}
                                        >
                                            {gender}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Faculty Type - Custom Dropdown */}
                    <div>
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1e293b' }}>
                            Faculty Type
                        </label>
                        <div className="relative" ref={facultyDropdownRef}>
                            <button
                                type="button"
                                onClick={() => setFacultyDropdownOpen(!facultyDropdownOpen)}
                                className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none flex items-center justify-between"
                                style={{
                                    background: 'rgba(255, 255, 255, 0.8)',
                                    border: '2px solid rgba(148, 163, 184, 0.3)',
                                    color: formData.Faculty_Type ? '#0F172A' : '#9CA3AF'
                                }}
                            >
                                <span>{formData.Faculty_Type || 'Select faculty type'}</span>
                                <FiChevronDown className={`transition-transform ${facultyDropdownOpen ? 'rotate-180' : ''}`} style={{ color: '#247e5b' }} />
                            </button>
                            
                            {facultyDropdownOpen && (
                                <div className="absolute top-full left-0 mt-1 w-full bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50">
                                    {['Permanent', 'Visiting'].map((type) => (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => {
                                                setFormData({ ...formData, Faculty_Type: type });
                                                setFacultyDropdownOpen(false);
                                            }}
                                            className={`w-full text-left px-4 py-2 text-sm font-medium hover:bg-green-100 hover:text-green-700 ${formData.Faculty_Type === type ? 'bg-green-50 text-green-700' : 'text-gray-700'}`}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Department (conditional) */}
                    {formData.Faculty_Type === 'Permanent' && (
                        <div>
                            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1e293b' }}>
                                Department <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="Department"
                                value={formData.Department}
                                onChange={handleInputChange}
                                required
                                className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none"
                                style={{
                                    background: 'rgba(255, 255, 255, 0.8)',
                                    border: '2px solid rgba(148, 163, 184, 0.3)',
                                    color: '#0F172A',
                                    transition: 'border-color 0.15s ease'
                                }}
                                placeholder="Enter department"
                                onFocus={(e) => e.target.style.borderColor = '#247e5bff'}
                                onBlur={(e) => e.target.style.borderColor = 'rgba(148, 163, 184, 0.3)'}
                            />
                        </div>
                    )}

                    {/* Face Pictures Upload */}
                    <div>
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1e293b' }}>
                            Face Pictures (1-5 images) <span className="text-red-500">*</span>
                        </label>
                        <p className="text-xs text-gray-500 mb-3">
                            {uploadedCount}/5 images uploaded. First image is required.
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
                                            id={`teacherImageUpload${num}`}
                                            accept="image/*"
                                            onChange={handleImageUpload(num)}
                                            className="hidden"
                                        />
                                        
                                        {picture ? (
                                            <div className="relative group">
                                                <img
                                                    src={picture}
                                                    alt={`Picture ${num}`}
                                                    className="w-full h-32 object-cover rounded-lg border-2 border-gray-300"
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
                                                htmlFor={`teacherImageUpload${num}`}
                                                className="cursor-pointer flex flex-col items-center justify-center h-32 border-2 border-dashed border-gray-300 rounded-lg hover:border-[#247e5bff] transition"
                                            >
                                                <FiUpload size={24} className="text-gray-400 mb-1" />
                                                <span className="text-xs text-gray-600">
                                                    Picture {num}
                                                    {num === 1 && <span className="text-red-500">*</span>}
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
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <p className="text-red-800 font-semibold mb-1">Validation failed</p>
                            <p className="text-red-600 text-sm">{error}</p>
                        </div>
                    )}

                    {/* Submit Button */}
                    <div className="flex justify-end space-x-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2 rounded-xl text-sm font-semibold transition-all"
                            style={{
                                border: '2px solid #e5e7eb',
                                color: '#6b7280',
                                background: '#ffffff'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !facePictures.Face_Picture_1}
                            className={`px-6 py-2 text-white rounded-xl text-sm font-semibold transition-all ${
                                loading || !facePictures.Face_Picture_1 ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                            style={{ backgroundColor: '#247e5bff' }}
                            onMouseEnter={(e) => {
                                if (!loading && facePictures.Face_Picture_1) {
                                    e.currentTarget.style.backgroundColor = '#1d6549';
                                }
                            }}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#247e5bff'}
                        >
                            {loading ? 'Adding...' : 'Add Faculty'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddTeacherModal;
