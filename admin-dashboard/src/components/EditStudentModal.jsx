import React, { useState, useEffect } from 'react';
import { FiX, FiUpload, FiTrash2 } from 'react-icons/fi';
import { studentAPI } from '../api/api';

const EditStudentModal = ({ isOpen, onClose, onSuccess, student }) => {
    const [formData, setFormData] = useState({
        Name: '',
        RollNumber: '',
        Email: '',
        Gender: '',
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

    // Populate form when student prop changes
    useEffect(() => {
        if (student) {
            setFormData({
                Name: student.Name || '',
                RollNumber: student.RollNumber || '',
                Email: student.Email || '',
                Gender: student.Gender || '',
                Department: student.Department || ''
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
                Department: formData.Department.trim()
            };

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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h2 className="text-2xl font-bold text-gray-800">Edit Student</h2>
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
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            name="Name"
                            value={formData.Name}
                            onChange={handleInputChange}
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Enter student name"
                        />
                    </div>

                    {/* Roll Number */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Roll Number <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            name="RollNumber"
                            value={formData.RollNumber}
                            onChange={handleInputChange}
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Enter roll number"
                        />
                    </div>

                    {/* Email */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Email <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="email"
                            name="Email"
                            value={formData.Email}
                            onChange={handleInputChange}
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="student@example.com"
                        />
                    </div>

                    {/* Gender */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Gender
                        </label>
                        <select
                            name="Gender"
                            value={formData.Gender}
                            onChange={handleInputChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">Select gender</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>

                    {/* Department */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Department
                        </label>
                        <input
                            type="text"
                            name="Department"
                            value={formData.Department}
                            onChange={handleInputChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Enter department"
                        />
                    </div>

                    {/* Face Pictures Upload */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Face Pictures (1-5 images)
                        </label>
                        <p className="text-xs text-gray-500 mb-3">
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
                                                htmlFor={`editImageUpload${num}`}
                                                className="cursor-pointer flex flex-col items-center justify-center h-32 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 transition"
                                            >
                                                <FiUpload size={24} className="text-gray-400 mb-1" />
                                                <span className="text-xs text-gray-600">
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
                            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className={`px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition ${
                                loading ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
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
