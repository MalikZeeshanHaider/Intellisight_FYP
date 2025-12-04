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
        setError(`Model loading failed: ${err.message}. 

Please ensure the following files exist in /public/models/:
- tiny_face_detector_model-weights_manifest.json
- tiny_face_detector_model-shard1
- face_landmark_68_model-weights_manifest.json  
- face_landmark_68_model-shard1
- face_recognition_model-weights_manifest.json
- face_recognition_model-shard1
- face_recognition_model-shard2

If models are missing, run: npm run download-models`);
      } else if (err.message?.includes('camera') || err.message?.includes('webcam')) {
        setError('Camera access denied. Please allow camera permissions and refresh.');
      } else if (err.message?.includes('network') || err.message?.includes('fetch')) {
        setError('Cannot connect to backend server. Please ensure it\'s running on port 3000.');
      } else {
        setError(errorMessage);
      }
    }
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
      {/* Animated Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-gradient-radial from-cyan-500/5 via-transparent to-transparent dark:from-cyan-500/10"></div>
        <div className="absolute inset-0 bg-gradient-radial from-purple-500/5 via-transparent to-transparent dark:from-purple-500/10" style={{ transform: 'translate(50%, 50%)' }}></div>
      </div>

      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative bg-white/80 dark:bg-surface/80 backdrop-blur-xl rounded-xl shadow-2xl p-6 border border-cyan-500/20"
      >
        {/* Scan Line Effect */}
        <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/10 via-transparent to-transparent animate-scan"></div>
        </div>

        <div className="flex items-center justify-between relative z-10">
        <div>
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent dark:from-cyan-300 dark:via-blue-400 dark:to-purple-500">
            Zone 1 Live Tracking
          </h1>
          <p className="text-gray-600 dark:text-gray-300 flex items-center space-x-2">
            <HiSparkles className="text-cyan-500 dark:text-cyan-400" />
            <span>Real-time face recognition and tracking</span>
          </p>
        </div>

        <div className="flex items-center space-x-3">{/* Database Stats Display */}
          <div className="bg-gradient-to-r from-purple-500 to-blue-600 text-white rounded-lg px-5 py-2.5 shadow-lg">
            <div className="flex items-center space-x-4">
              <div className="text-center">
                <p className="text-xs font-medium opacity-90">Students</p>
                <p className="text-xl font-bold">{faceDatabase.students?.length || 0}</p>
              </div>
              <div className="w-px h-8 bg-white opacity-30"></div>
              <div className="text-center">
                <p className="text-xs font-medium opacity-90">Teachers</p>
                <p className="text-xl font-bold">{faceDatabase.teachers?.length || 0}</p>
              </div>
              <div className="w-px h-8 bg-white opacity-30"></div>
              <div className="text-center">
                <p className="text-xs font-medium opacity-90">Total</p>
                <p className="text-xl font-bold">{(faceDatabase.students?.length || 0) + (faceDatabase.teachers?.length || 0)}</p>
              </div>
            </div>
            <p className="text-[10px] text-center mt-1 opacity-75">📸 Images Loaded for Matching</p>
          </div>
          
          <div className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 dark:from-green-500/30 dark:to-emerald-500/30 backdrop-blur-sm rounded-full border border-green-500/30 shadow-lg shadow-green-500/20">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-lg shadow-green-500/50"></div>
            <span className="text-green-700 dark:text-green-300 font-semibold">Auto Detection Active</span>
          </div>
          
          <motion.button
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleReEnroll}
            disabled={isReEnrolling}
            className={`flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 dark:from-cyan-600 dark:to-blue-700 text-white rounded-lg shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-shadow ${isReEnrolling ? 'opacity-50 cursor-not-allowed' : ''}`}
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
          className="bg-red-500/10 dark:bg-red-500/20 backdrop-blur-xl border border-red-500/30 rounded-lg p-4 flex items-start justify-between shadow-lg shadow-red-500/20"
        >
          <div className="flex items-start">
            <FiAlertCircle className="text-red-500 dark:text-red-400 mt-0.5 mr-3 flex-shrink-0" size={20} />
            <p className="text-red-700 dark:text-red-300">{error}</p>
          </div>
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setError(null)}
          >
            <FiX className="text-red-500 dark:text-red-400" />
          </motion.button>
        </motion.div>
      )}

      {success && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-500/10 dark:bg-green-500/20 backdrop-blur-xl border border-green-500/30 rounded-lg p-4 flex items-start justify-between shadow-lg shadow-green-500/20"
        >
          <div className="flex items-start">
            <FiCheckCircle className="text-green-500 dark:text-green-400 mt-0.5 mr-3 flex-shrink-0" size={20} />
            <p className="text-green-700 dark:text-green-300">{success}</p>
          </div>
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setSuccess(null)}
          >
            <FiX className="text-green-500 dark:text-green-400" />
          </motion.button>
        </motion.div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div 
          whileHover={{ scale: 1.02, y: -4 }}
          className="relative bg-white/80 dark:bg-surface/80 backdrop-blur-xl rounded-xl shadow-lg p-4 border border-green-500/20 overflow-hidden group"
        >
          {/* Scan Line */}
          <div className="absolute inset-0 bg-gradient-to-b from-green-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Known in Zone</p>
              <p className="text-3xl font-bold text-[#047857] dark:text-[#10b981]">{stats.knownInZone}</p>
            </div>
            <motion.div 
              whileHover={{ scale: 1.1, rotate: 360 }}
              transition={{ duration: 0.5 }}
              className="w-12 h-12 bg-gradient-to-br from-green-500/20 to-emerald-500/20 dark:from-green-500/30 dark:to-emerald-500/30 rounded-full flex items-center justify-center shadow-lg shadow-green-500/20"
            >
              <FiCheckCircle className="text-green-600 dark:text-green-400" size={24} />
            </motion.div>
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ scale: 1.02, y: -4 }}
          className="relative bg-white/80 dark:bg-surface/80 backdrop-blur-xl rounded-xl shadow-lg p-4 border border-red-500/20 overflow-hidden group"
        >
          {/* Scan Line */}
          <div className="absolute inset-0 bg-gradient-to-b from-red-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Unknown in Zone</p>
              <p className="text-3xl font-bold text-[#b91c1c] dark:text-[#ef4444]">{stats.unknownInZone}</p>
            </div>
            <motion.div 
              whileHover={{ scale: 1.1, rotate: 360 }}
              transition={{ duration: 0.5 }}
              className="w-12 h-12 bg-gradient-to-br from-red-500/20 to-rose-500/20 dark:from-red-500/30 dark:to-rose-500/30 rounded-full flex items-center justify-center shadow-lg shadow-red-500/20"
            >
              <FiAlertCircle className="text-red-600 dark:text-red-400" size={24} />
            </motion.div>
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ scale: 1.02, y: -4 }}
          className="relative bg-white/80 dark:bg-surface/80 backdrop-blur-xl rounded-xl shadow-lg p-4 border border-cyan-500/20 overflow-hidden group"
        >
          {/* Scan Line */}
          <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Recognized</p>
              <p className="text-3xl font-bold text-[#0369a1] dark:text-[#00ffff]">{stats.knownInZone + stats.unknownInZone}</p>
            </div>
            <motion.div 
              whileHover={{ scale: 1.1, rotate: 360 }}
              transition={{ duration: 0.5 }}
              className="w-12 h-12 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 dark:from-cyan-500/30 dark:to-blue-500/30 rounded-full flex items-center justify-center shadow-lg shadow-cyan-500/20"
            >
              <FiCheckCircle className="text-cyan-600 dark:text-cyan-400" size={24} />
            </motion.div>
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ scale: 1.02, y: -4 }}
          className="relative bg-white/80 dark:bg-surface/80 backdrop-blur-xl rounded-xl shadow-lg p-4 border border-orange-500/20 overflow-hidden group"
        >
          {/* Scan Line */}
          <div className="absolute inset-0 bg-gradient-to-b from-orange-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Unknown</p>
              <p className="text-3xl font-bold text-[#c2410c] dark:text-[#fb923c]">{stats.totalUnknown}</p>
            </div>
            <motion.div 
              whileHover={{ scale: 1.1, rotate: 360 }}
              transition={{ duration: 0.5 }}
              className="w-12 h-12 bg-gradient-to-br from-orange-500/20 to-amber-500/20 dark:from-orange-500/30 dark:to-amber-500/30 rounded-full flex items-center justify-center shadow-lg shadow-orange-500/20"
            >
              <FiAlertCircle className="text-orange-600 dark:text-orange-400" size={24} />
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Main Content - Camera Feeds */}
      <div className="space-y-6">
        {/* Auto Detection Info Banner */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="relative bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-cyan-500/10 dark:from-green-500/20 dark:via-emerald-500/20 dark:to-cyan-500/20 backdrop-blur-xl border border-green-500/30 rounded-lg p-4 overflow-hidden shadow-lg shadow-green-500/10"
        >
          {/* Animated Glow */}
          <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-emerald-500/5 to-transparent animate-pulse pointer-events-none"></div>
          
          <div className="flex items-start space-x-3 relative z-10">
            <div className="flex-shrink-0">
              <motion.div 
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/50"
              >
                <FiCheckCircle className="text-white" size={20} />
              </motion.div>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">🎥 Automatic Face Recognition Active</h3>
              <p className="text-gray-700 dark:text-gray-300 text-sm mb-2">
                The system is continuously monitoring all cameras. When someone stands in front of a camera, 
                their face will be automatically detected and recognized within 3 seconds.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
                <div className="flex items-center space-x-2 text-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full shadow-lg shadow-green-500/50"></div>
                  <span className="text-gray-600 dark:text-gray-400"><strong className="text-green-600 dark:text-green-400">Entry Camera:</strong> Adds to Active Presence</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <div className="w-2 h-2 bg-orange-500 rounded-full shadow-lg shadow-orange-500/50"></div>
                  <span className="text-gray-600 dark:text-gray-400"><strong className="text-orange-600 dark:text-orange-400">Exit Camera:</strong> Logs Attendance & Duration</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Add Camera Button */}
        <div className="flex justify-end">
          <motion.button
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowAddCameraModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 dark:from-cyan-600 dark:to-blue-700 text-white rounded-lg shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-shadow"
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
            const cameraColorBorder = camera.type === 'Entry' ? 'border-green-500/30' : 'border-orange-500/30';
            const cameraColorShadow = camera.type === 'Entry' ? 'shadow-green-500/20' : 'shadow-orange-500/20';
            
            return (
              <motion.div 
                key={camera.id} 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-2"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center">
                    <span className={`w-3 h-3 ${cameraColorBg} rounded-full mr-2 animate-pulse shadow-lg ${cameraColorShadow}`}></span>
                    {camera.label}
                  </h3>
                  <div className="flex items-center space-x-3">
                    <span className="text-sm px-3 py-1 rounded-full bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30">
                      {detections.length} face(s)
                    </span>
                    {cameras.filter(c => c.enabled).length > 1 && (
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => removeCamera(camera.id)}
                        className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
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
          className="bg-white/80 dark:bg-surface/80 backdrop-blur-xl rounded-xl shadow-lg border border-purple-500/20"
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
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
        >
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative bg-white/90 dark:bg-surface/90 backdrop-blur-xl rounded-xl p-6 max-w-md w-full mx-4 border border-cyan-500/30 shadow-2xl shadow-cyan-500/20"
          >
            {/* Scan Line Effect */}
            <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
              <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/10 via-transparent to-transparent animate-scan"></div>
            </div>

            <div className="flex items-center justify-between mb-4 relative z-10">
              <h3 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent dark:from-cyan-300 dark:to-blue-500">
                Add New Camera
              </h3>
              <motion.button 
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowAddCameraModal(false)}
              >
                <FiX className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" size={24} />
              </motion.button>
            </div>

            <div className="space-y-4 relative z-10">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Camera Label
                </label>
                <input
                  type="text"
                  value={newCamera.label}
                  onChange={(e) => setNewCamera({ ...newCamera, label: e.target.value })}
                  placeholder="e.g., Entry Camera, Exit Camera"
                  className="w-full px-3 py-2 border border-cyan-500/30 dark:border-cyan-500/20 bg-white/50 dark:bg-surface/50 backdrop-blur-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:focus:ring-cyan-400 focus:border-transparent text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Camera Type
                </label>
                <select
                  value={newCamera.type}
                  onChange={(e) => setNewCamera({ ...newCamera, type: e.target.value })}
                  className="w-full px-3 py-2 border border-cyan-500/30 dark:border-cyan-500/20 bg-white/50 dark:bg-surface/50 backdrop-blur-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:focus:ring-cyan-400 focus:border-transparent text-gray-800 dark:text-gray-200"
                >
                  <option value="Entry">Entry (Adds to Active Presence)</option>
                  <option value="Exit">Exit (Logs to Attendance)</option>
                </select>
              </div>

              <div className="bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 dark:from-cyan-500/20 dark:via-blue-500/20 dark:to-purple-500/20 backdrop-blur-sm border border-cyan-500/30 rounded-lg p-3">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <strong className="text-cyan-600 dark:text-cyan-400">Entry Camera:</strong> Detects people entering and adds them to active presence.<br />
                  <strong className="text-purple-600 dark:text-purple-400">Exit Camera:</strong> Detects people leaving and logs their attendance.
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6 relative z-10">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowAddCameraModal(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition"
              >
                Cancel
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={addCamera}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 dark:from-cyan-600 dark:to-blue-700 text-white rounded-lg shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-shadow"
              >
                Add Camera
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Bottom: Live Detection Info */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Live Detection Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <h3 className="font-semibold text-green-800">Known Persons Detected</h3>
            </div>
            <p className="text-3xl font-bold text-green-600">{stats.knownInZone}</p>
            <p className="text-sm text-gray-600 mt-1">People recognized from database</p>
          </div>
          
          <div className="p-4 bg-red-50 rounded-lg border border-red-200">
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <h3 className="font-semibold text-red-800">Unknown Persons Detected</h3>
            </div>
            <p className="text-3xl font-bold text-red-600">{stats.unknownInZone}</p>
            <p className="text-sm text-gray-600 mt-1">Faces not in database</p>
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> Counts update in real-time based on current camera detections.
            Green boxes = Known persons | Red boxes = Unknown persons
          </p>
        </div>
      </div>
    </div>
  );
};

export default Zone1;
