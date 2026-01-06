/**
 * Zone 1 Live Tracking Page
 * Real-time face recognition that starts automatically
 * No manual start needed - detects faces continuously when application runs
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FiRefreshCw, FiAlertCircle, FiCheckCircle, FiX } from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi';
import { motion } from 'framer-motion';
import LiveCameraFeed from '../components/Zone1/LiveCameraFeed';
import ZoneLogs from '../components/Zone1/ZoneLogs';
import CurrentPersons from '../components/Zone1/CurrentPersons';
import { zone1API } from '../api/zone1';
import { unknownFacesAPI } from '../api/unknownFaces';
import * as faceRecognition from '../utils/faceRecognition';

const Zone1 = () => {
  const isDarkMode = document.documentElement.classList.contains('dark');
  // State
  const [faceDatabase, setFaceDatabase] = useState({ students: [], teachers: [] });
  const [currentPersons, setCurrentPersons] = useState([]);
  const [logs, setLogs] = useState([]);
  const [unknownLogs, setUnknownLogs] = useState([]);
  
  // Camera management
  const [cameras, setCameras] = useState([
    { id: 1, label: 'Camera 1', type: 'Entry', enabled: true }
  ]);
  const [showAddCameraModal, setShowAddCameraModal] = useState(false);
  const [newCamera, setNewCamera] = useState({ label: '', type: 'Entry' });
  
  // Dynamic camera state
  const [cameraDetections, setCameraDetections] = useState({});
  const [cameraMatches, setCameraMatches] = useState({});
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isReEnrolling, setIsReEnrolling] = useState(false);
  const [stats, setStats] = useState({
    totalRecognized: 0,
    totalUnknown: 0,
    knownInZone: 0,
    unknownInZone: 0
  });

  // Camera refs stored dynamically
  const cameraRefs = useRef({});
  const processingRef = useRef(false);
  const recognizedPersonsRef = useRef(new Set()); // Track known persons {type-id}
  const unknownPersonsRef = useRef(new Set()); // Track unknown persons by time window
  const lastUnknownDetectionRef = useRef(0); // Track last unknown detection time
  const unknownDescriptorsRef = useRef([]); // Store descriptors of detected unknown persons

  // Load face-api.js models and face database on mount
  useEffect(() => {
    initializeFaceRecognition();
  }, []);

  // Periodic refresh of current persons in zone (every 5 seconds)
  useEffect(() => {
    // Initial fetch
    fetchCurrentPersons();
    fetchUnknownCount();
    
    // Set up interval for periodic updates
    const refreshInterval = setInterval(() => {
      fetchCurrentPersons();
      fetchUnknownCount();
    }, 5000); // Refresh every 5 seconds
    
    return () => clearInterval(refreshInterval);
  }, []);

  const initializeFaceRecognition = async () => {
    try {
      setError(null);
      
      // Load face-api.js models
      console.log('🔄 Loading face recognition models...');
      const modelsLoadedResult = await faceRecognition.loadModels();
      
      if (!modelsLoadedResult) {
        throw new Error('Failed to load face recognition models. Please check if model files exist in /public/models/');
      }

      setModelsLoaded(true);
      console.log('✅ Models loaded successfully');

      // Load face database from backend
      console.log('🔄 Loading face database...');
      const response = await zone1API.getFaceDatabase();
      
      console.log('📦 Backend response:', response);
      
      if (response?.success && response.data) {
        console.log('📊 Face database details:');
        console.log(`  - Students: ${response.data.students?.length || 0}`);
        console.log(`  - Teachers: ${response.data.teachers?.length || 0}`);
        console.log(`  - Total: ${response.data.total || 0}`);
        
        if (response.data.students?.length > 0) {
          console.log('👨‍🎓 Student details:');
          response.data.students.forEach(s => {
            console.log(`  - ${s.name} (ID: ${s.id})`);
            console.log(`    Has Face Image: ${s.faceImage ? 'YES' : 'NO'}`);
            console.log(`    Has Embeddings: ${s.hasEmbeddings ? 'YES' : 'NO'}`);
            console.log(`    Image length: ${s.faceImage?.length || 0} chars`);
          });
        }
        
        setFaceDatabase(response.data);
        
        console.log('🔄 Loading face descriptors...');
        await faceRecognition.loadFaceDatabase(response.data);
        console.log(`✅ Loaded ${response.data.total || 0} faces`);
        setSuccess(`Face recognition initialized with ${response.data.total || 0} known faces (${response.data.students?.length || 0} students, ${response.data.teachers?.length || 0} teachers)`);
        setTimeout(() => setSuccess(null), 5000);
      } else {
        console.warn('⚠️ No face database loaded - all faces will be marked as unknown');
        console.warn('Response data:', response);
        setFaceDatabase({ students: [], teachers: [] });
        setError('No enrolled students/teachers found. Please enroll faces first.');
      }

    } catch (err) {
      console.error('❌ Initialization error:', err);
      const errorMessage = err.message || 'Failed to initialize face recognition';
      
      // Check for specific error types with detailed messages
      if (err.message?.includes('TinyFaceDetector') || 
          err.message?.includes('FaceLandmark') || 
          err.message?.includes('FaceRecognition') ||
          err.message?.includes('models')) {
        setError(`Model loading failed: ${err.message}. Click "Retry" to try again or refresh the page.`);
      } else if (err.message?.includes('camera') || err.message?.includes('webcam')) {
        setError('Camera access denied. Please allow camera permissions and refresh.');
      } else if (err.message?.includes('network') || err.message?.includes('fetch')) {
        setError('Cannot connect to backend server. Please ensure it\'s running on port 3000.');
      } else {
        setError(errorMessage);
      }
    }
  };

  // Retry initialization
  const retryInitialization = async () => {
    setError(null);
    faceRecognition.resetModelsState();
    await initializeFaceRecognition();
  };

  // Start continuous face detection for all cameras
  const startFaceDetection = useCallback(() => {
    console.log('🎬 Starting face detection interval for all cameras...');
    
    const detectionInterval = setInterval(async () => {
      if (processingRef.current) {
        console.log('⏭️ Skipping detection - already processing');
        return;
      }
      
      if (!modelsLoaded) {
        return;
      }

      const enabledCameras = cameras.filter(cam => cam.enabled);
      if (enabledCameras.length === 0) {
        return;
      }

      processingRef.current = true;
      setIsProcessing(true);

      try {
        const newDetections = {};
        const newMatches = {};

        // Process each enabled camera
        for (const camera of enabledCameras) {
          const webcam = cameraRefs.current[camera.id]?.video;
          const isReady = webcam && webcam.readyState === 4 && webcam.videoWidth > 0;
          
          if (!isReady) {
            console.log(`⏸️ ${camera.label}: Camera not ready`);
            continue;
          }

          const detected = await faceRecognition.detectFaces(webcam, {
            withLandmarks: true,
            withDescriptors: true,
            withExpressions: false
          });

          console.log(`✅ ${camera.label}: ${detected.length} face(s) found`);
          newDetections[camera.id] = detected;

          // Match faces
          const matched = detected.map(detection => {
            if (!detection.descriptor) return null;
            return faceRecognition.matchFace(detection.descriptor, 0.6);
          });

          newMatches[camera.id] = matched;

          // Process detections for this camera
          await processDetections(matched, detected, camera.type, webcam);
        }

        setCameraDetections(newDetections);
        setCameraMatches(newMatches);

      } catch (err) {
        console.error('Detection error:', err);
      } finally {
        processingRef.current = false;
        setIsProcessing(false);
      }
    }, 3000); // Run every 3 seconds

    // Cleanup on unmount
    return () => {
      clearInterval(detectionInterval);
      processingRef.current = false;
    };
  }, [cameras, modelsLoaded]);

  // Start detection when models are loaded and cameras are available
  useEffect(() => {
    if (modelsLoaded && cameras.length > 0) {
      console.log('🎥 Starting detection loop...');
      const cleanup = startFaceDetection();
      return cleanup;
    }
  }, [modelsLoaded, cameras.length]); // Don't include startFaceDetection in deps

  // Process detections for a specific camera
  const processDetections = async (matched, detected, cameraType, webcam) => {
    // Log recognized/unknown persons
    for (let i = 0; i < matched.length; i++) {
      const match = matched[i];
      const detection = detected[i];

      if (match) {
        // Recognized person (KNOWN)
        const personKey = `${match.type}-${match.id}-${cameraType}`;
        
        if (!recognizedPersonsRef.current.has(personKey)) {
          await handleRecognizedPerson(match, cameraType);
          recognizedPersonsRef.current.add(personKey);
          
          // Remove from set after 5 minutes to allow re-entry
          setTimeout(() => {
            recognizedPersonsRef.current.delete(personKey);
          }, 5 * 60 * 1000);
        }
      } else if (detection.descriptor) {
        // Unknown person - check if already detected by comparing descriptors
        const isDuplicate = isUnknownPersonDuplicate(detection.descriptor);
        
        if (!isDuplicate) {
          // New unknown person - log it
          console.log('🆕 New unknown person detected');
          await handleUnknownPerson(webcam, detection, cameraType);
          
          // Store descriptor to prevent future duplicates
          unknownDescriptorsRef.current.push({
            descriptor: detection.descriptor,
            timestamp: Date.now()
          });
          
          // Clean up old descriptors (older than 1 hour)
          const oneHourAgo = Date.now() - (60 * 60 * 1000);
          unknownDescriptorsRef.current = unknownDescriptorsRef.current.filter(
            item => item.timestamp > oneHourAgo
          );
        } else {
          console.log('🔄 Duplicate unknown person detected - skipping');
        }
      }
    }
  };

  // Check if unknown person descriptor matches any previously detected unknown
  const isUnknownPersonDuplicate = (descriptor) => {
    const threshold = 0.6; // Same threshold used for face matching
    
    for (const stored of unknownDescriptorsRef.current) {
      const distance = faceRecognition.calculateDistance(descriptor, stored.descriptor);
      if (distance < threshold) {
        console.log(`🔄 Duplicate unknown person detected (distance: ${distance.toFixed(3)} < ${threshold})`);
        console.log(`⏰ Previously detected at: ${new Date(stored.timestamp).toLocaleTimeString()}`);
        return true;
      }
    }
    
    console.log('🆕 New unique unknown person (no match in stored descriptors)');
    return false;
  };

  // Handle recognized person
  const handleRecognizedPerson = async (match, cameraType) => {
    try {
      console.log(`✅ Recognized on ${cameraType} camera:`, match.name);
      
      await zone1API.logRecognizedPerson(
        match.id,
        match.type,
        parseFloat(match.confidence),
        cameraType
      );

      setStats(prev => ({
        ...prev,
        totalRecognized: prev.totalRecognized + 1
      }));

      await fetchCurrentPersons();
      await fetchLogs();

    } catch (err) {
      console.error('Error logging recognized person:', err);
    }
  };

  // Handle unknown person
  const handleUnknownPerson = async (videoElement, detection, cameraType) => {
    try {
      console.log(`🖌️ Starting face image extraction from ${cameraType} camera...`);
      
      // Extract face image
      const faceImage = await faceRecognition.extractFaceImage(videoElement, detection);
      
      if (faceImage) {
        console.log('✅ Face image extracted successfully');
        console.log('📤 Sending to backend API...');
        
        const response = await zone1API.logUnknownPerson(faceImage, 0, 'Detected by live camera');
        
        console.log('📥 Backend response:', response);

        setStats(prev => ({
          ...prev,
          totalUnknown: prev.totalUnknown + 1
        }));
        
        // Refresh logs and unknown count
        await fetchLogs();
        await fetchUnknownCount();
        
        setSuccess('Unknown person captured and logged!');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        console.error('❌ Failed to extract face image');
      }

    } catch (err) {
      console.error('❌ Error logging unknown person:', err);
      console.error('Error details:', err.message);
      console.error('Stack trace:', err.stack);
      setError('Failed to capture unknown person: ' + err.message);
      setTimeout(() => setError(null), 5000);
    }
  };

  // Fetch current persons in zone
  const fetchCurrentPersons = async () => {
    try {
      const response = await zone1API.getCurrentPersons();
      if (response.success) {
        setCurrentPersons(response.data);
        
        // Update knownInZone stat based on ActivePresence count
        setStats(prev => ({
          ...prev,
          knownInZone: response.data.length
        }));
      }
    } catch (err) {
      console.error('Error fetching current persons:', err);
    }
  };

  // Fetch unknown faces count
  const fetchUnknownCount = async () => {
    try {
      const response = await zone1API.getUnknownFacesCount();
      if (response.success) {
        setStats(prev => ({
          ...prev,
          unknownInZone: response.count
        }));
      }
    } catch (err) {
      console.error('Error fetching unknown count:', err);
    }
  };

  // Re-enroll faces function
  const handleReEnroll = async () => {
    try {
      setIsReEnrolling(true);
      setError(null);
      setSuccess(null);
      
      console.log('🔄 Starting re-enrollment...');
      
      // Call backend to trigger Python training
      const response = await zone1API.reEnrollFaces();
      
      if (response?.success) {
        const { studentsEnrolled, teachersEnrolled, totalEncodings } = response.data;
        
        setSuccess(`✅ Re-enrollment complete! Students: ${studentsEnrolled}, Teachers: ${teachersEnrolled}, Total encodings: ${totalEncodings}`);
        
        // Reload face database
        console.log('🔄 Reloading face database...');
        await initializeFaceRecognition();
        
        console.log('✅ System restarted with new enrollments');
      } else {
        throw new Error(response?.message || 'Re-enrollment failed');
      }
      
    } catch (err) {
      console.error('❌ Re-enrollment error:', err);
      setError(`Re-enrollment failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsReEnrolling(false);
      
      // Auto-hide success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000);
    }
  };

  // Manual detection test
  const runManualDetection = async () => {
    const webcam = webcamRef.current?.video || document.querySelector('video');
    if (!webcam) {
      setError('Camera not ready');
      return;
    }

    setIsProcessing(true);
    try {
      console.log('🔍 Running manual detection test...');
      console.log('Video element:', webcam);
      console.log('Video ready state:', webcam.readyState);
      console.log('Video dimensions:', webcam.videoWidth, 'x', webcam.videoHeight);
      
      const detected = await faceRecognition.detectFaces(webcam, {
        withLandmarks: true,
        withDescriptors: true
      });
      
      console.log('✅ Manual detection result:', detected);
      setSuccess(`Manual test: ${detected.length} face(s) detected`);
      setDetections(detected);
      
      // Match faces
      const matched = detected.map(detection => {
        if (!detection.descriptor) return null;
        return faceRecognition.matchFace(detection.descriptor, 0.6);
      });
      setMatches(matched);
      
    } catch (err) {
      console.error('❌ Manual detection error:', err);
      setError('Manual detection failed: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Fetch activity logs
  const fetchLogs = async () => {
    try {
      const [knownResponse, unknownResponse] = await Promise.all([
        zone1API.getZoneLogs(20),
        unknownFacesAPI.getUnknownFaces(20)
      ]);
      
      if (knownResponse.success) {
        setLogs(knownResponse.data);
      }
      
      if (unknownResponse.success) {
        setUnknownLogs(unknownResponse.data);
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
  };

  // Mark person exit
  const handleMarkExit = async (timetableId) => {
    try {
      await zone1API.markExit(timetableId);
      setSuccess('Exit marked successfully');
      await fetchCurrentPersons();
      await fetchLogs();
    } catch (err) {
      setError('Failed to mark exit');
    }
  };

  // Camera management functions
  const addCamera = () => {
    if (!newCamera.label.trim()) {
      setError('Please enter a camera label');
      return;
    }

    const newId = Math.max(...cameras.map(c => c.id), 0) + 1;
    const camera = {
      id: newId,
      label: newCamera.label,
      type: newCamera.type,
      enabled: true
    };

    setCameras([...cameras, camera]);
    setShowAddCameraModal(false);
    setNewCamera({ label: '', type: 'Entry' });
    setSuccess(`Camera "${camera.label}" added successfully`);
    setTimeout(() => setSuccess(null), 3000);
  };

  const removeCamera = (cameraId) => {
    if (cameras.filter(c => c.enabled).length === 1) {
      setError('Cannot remove the last camera');
      setTimeout(() => setError(null), 3000);
      return;
    }

    setCameras(cameras.filter(c => c.id !== cameraId));
    delete cameraRefs.current[cameraId];
    setSuccess('Camera removed successfully');
    setTimeout(() => setSuccess(null), 3000);
  };

  // Load initial logs only (no auto-refresh of database entries)
  useEffect(() => {
    fetchLogs(); // Load activity history
    
    // Auto-refresh logs every 10 seconds to see new entries
    const interval = setInterval(() => {
      fetchLogs();
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6 pb-20 relative">

      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-xl shadow-sm p-6"
        style={{
          backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : 'white',
          border: isDarkMode ? '1px solid rgba(0, 255, 255, 0.2)' : '1px solid #e5e7eb'
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-display font-black mb-2" style={{ color: isDarkMode ? '#c0f0f0' : '#003d82' }}>
              Zone 1 Live Tracking
            </h1>
          </div>

          <div className="flex items-center space-x-3">            {/* Database Stats Display */}
            <div 
              className="rounded-xl px-5 py-2.5 shadow-sm"
              style={{
                backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.9)' : 'white',
                border: isDarkMode ? '1px solid rgba(0, 255, 255, 0.2)' : '1px solid #e5e7eb'
              }}
            >
              <div className="flex items-center space-x-4">
                <div className="text-center">
                  <p className="text-xs font-medium" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.6)' : '#6b7280' }}>Students</p>
                  <p className="text-xl font-bold" style={{ color: isDarkMode ? '#00ffff' : '#003d82' }}>{faceDatabase.students?.length || 0}</p>
                </div>
                <div className="w-px h-8" style={{ backgroundColor: isDarkMode ? 'rgba(0, 255, 255, 0.2)' : '#d1d5db' }}></div>
                <div className="text-center">
                  <p className="text-xs font-medium" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.6)' : '#6b7280' }}>Teachers</p>
                  <p className="text-xl font-bold" style={{ color: isDarkMode ? '#00ffff' : '#003d82' }}>{faceDatabase.teachers?.length || 0}</p>
                </div>
                <div className="w-px h-8" style={{ backgroundColor: isDarkMode ? 'rgba(0, 255, 255, 0.2)' : '#d1d5db' }}></div>
                <div className="text-center">
                  <p className="text-xs font-medium" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.6)' : '#6b7280' }}>Total</p>
                  <p className="text-xl font-bold" style={{ color: isDarkMode ? '#00ffff' : '#003d82' }}>{(faceDatabase.students?.length || 0) + (faceDatabase.teachers?.length || 0)}</p>
                </div>
              </div>
              <p className="text-[10px] text-center mt-1" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.5)' : '#9ca3af' }}>📸 Images Loaded for Matching</p>
            </div>
          
            <div 
              className="flex items-center space-x-2 px-4 py-2 rounded-xl border"
              style={{ 
                backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)', 
                borderColor: 'rgba(16, 185, 129, 0.3)', 
                color: isDarkMode ? '#34d399' : '#10b981' 
              }}
            >
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="font-semibold">Auto Detection Active</span>
            </div>
          
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleReEnroll}
              disabled={isReEnrolling}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-semibold transition ${isReEnrolling ? 'opacity-50 cursor-not-allowed' : ''}`}
              style={{ 
                backgroundColor: isDarkMode ? 'rgba(0, 255, 255, 0.15)' : '#003d82', 
                color: isDarkMode ? '#00ffff' : '#fff',
                border: isDarkMode ? '1px solid rgba(0, 255, 255, 0.4)' : 'none',
                boxShadow: isDarkMode ? '0 0 15px rgba(0, 255, 255, 0.2)' : 'none'
              }}
              onMouseEnter={(e) => { 
                if (!isReEnrolling) {
                  e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(0, 255, 255, 0.25)' : '#305796';
                  if (isDarkMode) e.currentTarget.style.boxShadow = '0 0 20px rgba(0, 255, 255, 0.3)';
                }
              }}
              onMouseLeave={(e) => { 
                if (!isReEnrolling) {
                  e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(0, 255, 255, 0.15)' : '#003d82';
                  if (isDarkMode) e.currentTarget.style.boxShadow = '0 0 15px rgba(0, 255, 255, 0.2)';
                }
              }}
            >
              <FiRefreshCw size={16} className={isReEnrolling ? 'animate-spin' : ''} />
              <span>{isReEnrolling ? 'Re-enrolling...' : 'Restart & Re-enroll'}</span>
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Alerts */}
      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl p-4 flex items-start justify-between"
          style={{ 
            backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
            border: '1px solid rgba(239, 68, 68, 0.3)' 
          }}
        >
          <div className="flex items-start flex-1">
            <FiAlertCircle className="mt-0.5 mr-3 flex-shrink-0" style={{ color: isDarkMode ? '#f87171' : '#ef4444' }} size={20} />
            <p style={{ color: isDarkMode ? '#fca5a5' : '#dc2626' }}>{error}</p>
          </div>
          <div className="flex items-center gap-2">
            {error.includes('Model loading failed') && (
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={retryInitialization}
                className="px-3 py-1 text-sm font-semibold rounded-lg"
                style={{ backgroundColor: '#247e5b', color: 'white' }}
              >
                <FiRefreshCw className="inline mr-1" size={14} />
                Retry
              </motion.button>
            )}
            <motion.button 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setError(null)}
            >
              <FiX style={{ color: isDarkMode ? '#f87171' : '#ef4444' }} />
            </motion.button>
          </div>
        </motion.div>
      )}

      {success && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl p-4 flex items-start justify-between"
          style={{ 
            backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.1)', 
            border: '1px solid rgba(16, 185, 129, 0.3)' 
          }}
        >
          <div className="flex items-start">
            <FiCheckCircle className="mt-0.5 mr-3 flex-shrink-0" style={{ color: isDarkMode ? '#34d399' : '#10b981' }} size={20} />
            <p style={{ color: isDarkMode ? '#6ee7b7' : '#059669' }}>{success}</p>
          </div>
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setSuccess(null)}
          >
            <FiX style={{ color: isDarkMode ? '#34d399' : '#10b981' }} />
          </motion.button>
        </motion.div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="rounded-xl shadow-sm p-4"
          style={{
            backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : 'white',
            border: isDarkMode ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #e5e7eb'
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.6)' : '#6b7280' }}>Known in Zone</p>
              <p className="text-3xl font-bold" style={{ color: isDarkMode ? '#34d399' : '#059669' }}>{stats.knownInZone}</p>
            </div>
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)' }}
            >
              <FiCheckCircle style={{ color: isDarkMode ? '#34d399' : '#059669' }} size={24} />
            </div>
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="rounded-xl shadow-sm p-4"
          style={{
            backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : 'white',
            border: isDarkMode ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid #e5e7eb'
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.6)' : '#6b7280' }}>Unknown in Zone</p>
              <p className="text-3xl font-bold" style={{ color: '#d97706' }}>{stats.unknownInZone}</p>
            </div>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(217, 119, 6, 0.1)' }}>
              <FiAlertCircle style={{ color: '#d97706' }} size={24} />
            </div>
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="rounded-xl shadow-sm p-4"
          style={{
            backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : 'white',
            border: isDarkMode ? '1px solid rgba(0, 255, 255, 0.3)' : '1px solid #e5e7eb'
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.6)' : '#6b7280' }}>Total Recognized</p>
              <p className="text-3xl font-bold" style={{ color: isDarkMode ? '#00ffff' : '#003d82' }}>{stats.knownInZone + stats.unknownInZone}</p>
            </div>
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: isDarkMode ? 'rgba(0, 255, 255, 0.1)' : 'rgba(0, 61, 130, 0.1)' }}
            >
              <FiCheckCircle style={{ color: isDarkMode ? '#00ffff' : '#003d82' }} size={24} />
            </div>
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="rounded-xl shadow-sm p-4"
          style={{
            backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : 'white',
            border: isDarkMode ? '1px solid rgba(107, 155, 209, 0.3)' : '1px solid #e5e7eb'
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.6)' : '#6b7280' }}>Total Unknown</p>
              <p className="text-3xl font-bold" style={{ color: '#6b9bd1' }}>{stats.totalUnknown}</p>
            </div>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(107, 155, 209, 0.1)' }}>
              <FiAlertCircle style={{ color: '#6b9bd1' }} size={24} />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Main Content - Camera Feeds */}
      <div className="space-y-6">
        {/* Add Camera Button */}
        <div className="flex justify-end">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowAddCameraModal(true)}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl font-semibold transition"
            style={{ 
              backgroundColor: isDarkMode ? 'rgba(0, 255, 255, 0.15)' : '#003d82', 
              color: isDarkMode ? '#00ffff' : '#fff',
              border: isDarkMode ? '1px solid rgba(0, 255, 255, 0.4)' : 'none',
              boxShadow: isDarkMode ? '0 0 15px rgba(0, 255, 255, 0.2)' : 'none'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(0, 255, 255, 0.25)' : '#305796';
              if (isDarkMode) e.currentTarget.style.boxShadow = '0 0 20px rgba(0, 255, 255, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(0, 255, 255, 0.15)' : '#003d82';
              if (isDarkMode) e.currentTarget.style.boxShadow = '0 0 15px rgba(0, 255, 255, 0.2)';
            }}
          >
            <FiCheckCircle size={16} />
            <span>Add Camera</span>
          </motion.button>
        </div>

        {/* Camera Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {cameras.filter(cam => cam.enabled).map((camera) => {
            const detections = cameraDetections[camera.id] || [];
            const matches = cameraMatches[camera.id] || [];
            const cameraColorBg = camera.type === 'Entry' ? 'bg-green-500' : 'bg-orange-500';
            
            return (
              <motion.div 
                key={camera.id} 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-2"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold flex items-center" style={{ color: isDarkMode ? '#c0f0f0' : '#1f2937' }}>
                    <span className={`w-3 h-3 ${cameraColorBg} rounded-full mr-2 animate-pulse`}></span>
                    {camera.label}
                  </h3>
                  <div className="flex items-center space-x-3">
                    <span 
                      className="text-sm px-3 py-1 rounded-xl font-medium"
                      style={{ 
                        backgroundColor: isDarkMode ? 'rgba(0, 255, 255, 0.1)' : 'rgba(0, 61, 130, 0.1)', 
                        color: isDarkMode ? '#00ffff' : '#003d82' 
                      }}
                    >
                      {detections.length} face(s)
                    </span>
                    {cameras.filter(c => c.enabled).length > 1 && (
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => removeCamera(camera.id)}
                        style={{ color: isDarkMode ? '#f87171' : '#dc2626' }}
                        title="Remove camera"
                      >
                        <FiX size={20} />
                      </motion.button>
                    )}
                  </div>
                </div>
                <LiveCameraFeed
                  webcamRef={(ref) => { cameraRefs.current[camera.id] = ref; }}
                  cameraLabel={camera.label}
                  cameraType={camera.type}
                  onFaceDetection={() => {}}
                  isProcessing={isProcessing}
                  detections={detections}
                  matches={matches}
                />
              </motion.div>
            );
          })}
        </div>

        {/* Live Logs Below Cameras */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl shadow-sm"
          style={{
            backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : 'white',
            border: isDarkMode ? '1px solid rgba(0, 255, 255, 0.2)' : '1px solid #e5e7eb'
          }}
        >
          <ZoneLogs 
            knownLogs={logs} 
            unknownLogs={unknownLogs}
            loading={false} 
          />
        </motion.div>
      </div>

      {/* Add Camera Modal */}
      {showAddCameraModal && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{
            background: isDarkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(8px)'
          }}
        >
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-xl p-6 max-w-md w-full mx-4 shadow-xl"
            style={{
              background: isDarkMode 
                ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.95))'
                : 'white',
              border: isDarkMode ? '1px solid rgba(0, 255, 255, 0.3)' : '1px solid #e5e7eb',
              boxShadow: isDarkMode 
                ? '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(0, 255, 255, 0.1)'
                : '0 20px 60px rgba(0, 0, 0, 0.3)'
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold" style={{ color: isDarkMode ? '#c0f0f0' : '#003d82' }}>
                Add New Camera
              </h3>
              <motion.button 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowAddCameraModal(false)}
              >
                <FiX size={24} style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#6b7280' }} />
              </motion.button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#374151' }}>
                  Camera Label
                </label>
                <input
                  type="text"
                  value={newCamera.label}
                  onChange={(e) => setNewCamera({ ...newCamera, label: e.target.value })}
                  placeholder="e.g., Entry Camera, Exit Camera"
                  className="w-full px-3 py-2 rounded-xl focus:outline-none"
                  style={{
                    backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.8)' : 'white',
                    border: isDarkMode ? '1px solid rgba(0, 255, 255, 0.3)' : '1px solid #d1d5db',
                    color: isDarkMode ? '#c0f0f0' : '#1f2937'
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#374151' }}>
                  Camera Type
                </label>
                <select
                  value={newCamera.type}
                  onChange={(e) => setNewCamera({ ...newCamera, type: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl focus:outline-none"
                  style={{
                    backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.8)' : 'white',
                    border: isDarkMode ? '1px solid rgba(0, 255, 255, 0.3)' : '1px solid #d1d5db',
                    color: isDarkMode ? '#c0f0f0' : '#1f2937'
                  }}
                >
                  <option value="Entry">Entry (Adds to Active Presence)</option>
                  <option value="Exit">Exit (Logs to Attendance)</option>
                </select>
              </div>

              <div 
                className="rounded-xl p-3"
                style={{
                  backgroundColor: isDarkMode ? 'rgba(0, 255, 255, 0.05)' : '#f9fafb',
                  border: isDarkMode ? '1px solid rgba(0, 255, 255, 0.15)' : '1px solid #e5e7eb'
                }}
              >
                <p className="text-sm" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#374151' }}>
                  <strong style={{ color: isDarkMode ? '#00ffff' : '#003d82' }}>Entry Camera:</strong> Detects people entering and adds them to active presence.<br />
                  <strong style={{ color: '#6b9bd1' }}>Exit Camera:</strong> Detects people leaving and logs their attendance.
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowAddCameraModal(false)}
                className="px-4 py-2 rounded-xl font-semibold transition"
                style={{
                  background: isDarkMode ? 'rgba(107, 114, 128, 0.2)' : 'transparent',
                  border: isDarkMode ? '1px solid rgba(107, 114, 128, 0.4)' : '2px solid #d1d5db',
                  color: isDarkMode ? '#c0f0f0' : '#4b5563'
                }}
              >
                Cancel
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={addCamera}
                className="px-4 py-2 rounded-xl font-semibold transition"
                style={{ 
                  backgroundColor: isDarkMode ? 'rgba(0, 255, 255, 0.2)' : '#003d82', 
                  color: isDarkMode ? '#00ffff' : '#fff',
                  border: isDarkMode ? '1px solid rgba(0, 255, 255, 0.5)' : 'none',
                  boxShadow: isDarkMode ? '0 0 15px rgba(0, 255, 255, 0.2)' : 'none'
                }}
              >
                Add Camera
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Bottom: Live Detection Info */}
      <div 
        className="rounded-xl shadow-sm p-6"
        style={{
          backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : 'white',
          border: isDarkMode ? '1px solid rgba(0, 255, 255, 0.2)' : '1px solid #e5e7eb'
        }}
      >
        <h2 className="text-xl font-bold mb-4" style={{ color: isDarkMode ? '#c0f0f0' : '#1f2937' }}>Live Detection Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div 
            className="p-4 rounded-xl"
            style={{
              backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.05)',
              border: isDarkMode ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(16, 185, 129, 0.2)'
            }}
          >
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <h3 className="font-semibold" style={{ color: isDarkMode ? '#34d399' : '#047857' }}>Known Persons Detected</h3>
            </div>
            <p className="text-3xl font-bold" style={{ color: isDarkMode ? '#34d399' : '#059669' }}>{stats.knownInZone}</p>
            <p className="text-sm mt-1" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.5)' : '#6b7280' }}>People recognized from database</p>
          </div>
          
          <div 
            className="p-4 rounded-xl"
            style={{ 
              backgroundColor: isDarkMode ? 'rgba(217, 119, 6, 0.1)' : 'rgba(217, 119, 6, 0.05)', 
              border: isDarkMode ? '1px solid rgba(217, 119, 6, 0.3)' : '1px solid rgba(217, 119, 6, 0.2)' 
            }}
          >
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: '#d97706' }}></div>
              <h3 className="font-semibold" style={{ color: '#d97706' }}>Unknown Persons Detected</h3>
            </div>
            <p className="text-3xl font-bold" style={{ color: '#d97706' }}>{stats.unknownInZone}</p>
            <p className="text-sm mt-1" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.5)' : '#6b7280' }}>Faces not in database</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Zone1;
