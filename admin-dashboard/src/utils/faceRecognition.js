/**
 * Face Recognition Utility
 * Handles face detection and matching using face-api.js
 */

import * as faceapi from 'face-api.js';

// Model paths - face-api.js models
const MODEL_URL = '/models';

let modelsLoaded = false;
let faceDescriptors = [];

/**
 * Load face-api.js models
 */
export const loadModels = async () => {
  if (modelsLoaded) return true;

  try {
    console.log('Loading face-api.js models from:', MODEL_URL);
    
    // Load only the models we need (and have downloaded)
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    console.log('✅ TinyFaceDetector loaded');
    
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    console.log('✅ FaceLandmark68Net loaded');
    
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    console.log('✅ FaceRecognitionNet loaded');

    modelsLoaded = true;
    console.log('✅ All face-api.js models loaded successfully');
    return true;
  } catch (error) {
    console.error('❌ Error loading face-api.js models:', error);
    console.error('Error details:', error.message);
    return false;
  }
};

/**
 * Detect faces in an image/video frame
 */
export const detectFaces = async (input, options = {}) => {
  try {
    if (!input) {
      console.error('❌ No input provided for face detection');
      return [];
    }

    // Check if video element is ready
    if (input.readyState !== 4) {
      console.log('⏳ Video not ready yet, readyState:', input.readyState);
      return [];
    }

    const {
      withLandmarks = true,
      withDescriptors = true,
      withExpressions = false
    } = options;

    // Use more sensitive detection options
    const detectionOptions = new faceapi.TinyFaceDetectorOptions({
      inputSize: 320,        // Lower for faster detection (224, 320, 416, 512)
      scoreThreshold: 0.4    // More sensitive (0.3-0.5, lower = more sensitive)
    });

    console.log('🎥 Starting face detection on video:', input.videoWidth, 'x', input.videoHeight);

    // Build detection pipeline
    let detectionPipeline = faceapi.detectAllFaces(input, detectionOptions);

    if (withLandmarks) {
      detectionPipeline = detectionPipeline.withFaceLandmarks();
    }

    if (withDescriptors) {
      detectionPipeline = detectionPipeline.withFaceDescriptors();
    }

    // Execute detection
    const detections = await detectionPipeline;

    console.log(`✅ Face detection complete: ${detections.length} face(s) found`);
    
    if (detections.length > 0) {
      console.log('📊 Detection details:', detections.map((d, i) => ({
        index: i,
        score: d.detection.score.toFixed(3),
        box: d.detection.box
      })));
    }

    return detections;
  } catch (error) {
    console.error('❌ Error detecting faces:', error);
    console.error('Stack trace:', error.stack);
    return [];
  }
};

/**
 * Load face database from backend
 * Convert images to face descriptors
 */
export const loadFaceDatabase = async (faceDatabase) => {
  try {
    console.log('🔄 Loading face database...', faceDatabase);
    console.log(`  Students to process: ${faceDatabase.students?.length || 0}`);
    console.log(`  Teachers to process: ${faceDatabase.teachers?.length || 0}`);
    
    const labeledDescriptors = [];

    // Process students
    for (const student of faceDatabase.students || []) {
      console.log(`📝 Processing student: ${student.name} (ID: ${student.id})`);
      console.log(`  Has faceImage: ${student.faceImage ? 'YES' : 'NO'}`);
      console.log(`  Image length: ${student.faceImage?.length || 0}`);
      
      if (student.faceImage) {
        console.log(`  🔍 Extracting face descriptor...`);
        const descriptor = await getFaceDescriptor(student.faceImage);
        if (descriptor) {
          console.log(`  ✅ Descriptor extracted successfully (${descriptor.length} dimensions)`);
          labeledDescriptors.push({
            id: student.id,
            name: student.name,
            type: 'STUDENT',
            email: student.email,
            descriptor: descriptor
          });
        } else {
          console.warn(`  ❌ Failed to extract descriptor for ${student.name}`);
        }
      } else {
        console.warn(`  ⚠️ No face image for ${student.name}`);
      }
    }

    // Process teachers
    for (const teacher of faceDatabase.teachers || []) {
      console.log(`📝 Processing teacher: ${teacher.name} (ID: ${teacher.id})`);
      console.log(`  Has faceImage: ${teacher.faceImage ? 'YES' : 'NO'}`);
      
      if (teacher.faceImage) {
        console.log(`  🔍 Extracting face descriptor...`);
        const descriptor = await getFaceDescriptor(teacher.faceImage);
        if (descriptor) {
          console.log(`  ✅ Descriptor extracted successfully (${descriptor.length} dimensions)`);
          labeledDescriptors.push({
            id: teacher.id,
            name: teacher.name,
            type: 'TEACHER',
            email: teacher.email,
            descriptor: descriptor
          });
        } else {
          console.warn(`  ❌ Failed to extract descriptor for ${teacher.name}`);
        }
      } else {
        console.warn(`  ⚠️ No face image for ${teacher.name}`);
      }
    }

    faceDescriptors = labeledDescriptors;
    console.log(`✅ Successfully loaded ${faceDescriptors.length} face descriptors`);
    
    if (faceDescriptors.length === 0) {
      console.error('⚠️ WARNING: No face descriptors loaded! All detections will be marked as unknown.');
    }
    
    return labeledDescriptors;
  } catch (error) {
    console.error('❌ Error loading face database:', error);
    console.error('Stack:', error.stack);
    return [];
  }
};

/**
 * Get face descriptor from base64 image
 */
const getFaceDescriptor = async (base64Image) => {
  try {
    console.log('  📸 Fetching image from base64...');
    const img = await faceapi.fetchImage(base64Image);
    console.log(`  ✅ Image loaded: ${img.width}x${img.height}`);
    
    console.log('  🔍 Detecting face...');
    const detection = await faceapi
      .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (detection) {
      console.log('  ✅ Face detected and descriptor extracted');
      return detection.descriptor;
    } else {
      console.warn('  ⚠️ No face detected in image');
      return null;
    }
  } catch (error) {
    console.error('  ❌ Error getting face descriptor:', error.message);
    return null;
  }
};

/**
 * Match detected face with database
 * Returns best match or null
 */
export const matchFace = (faceDescriptor, threshold = 0.6) => {
  if (!faceDescriptor || faceDescriptors.length === 0) {
    return null;
  }

  let bestMatch = null;
  let bestDistance = Infinity;

  for (const person of faceDescriptors) {
    const distance = faceapi.euclideanDistance(faceDescriptor, person.descriptor);
    
    if (distance < bestDistance && distance < threshold) {
      bestDistance = distance;
      bestMatch = {
        ...person,
        confidence: (1 - distance).toFixed(2),
        distance: distance.toFixed(3)
      };
    }
  }

  return bestMatch;
};

/**
 * Calculate Euclidean distance between two face descriptors
 * Used for checking duplicate unknown persons
 */
export const calculateDistance = (descriptor1, descriptor2) => {
  if (!descriptor1 || !descriptor2) {
    return Infinity;
  }
  return faceapi.euclideanDistance(descriptor1, descriptor2);
};

/**
 * Draw face detection boxes on canvas
 */
export const drawFaceBoxes = (canvas, detections, matches = []) => {
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  detections.forEach((detection, index) => {
    const box = detection.detection.box;
    const match = matches[index];

    // Draw box
    ctx.strokeStyle = match ? '#10B981' : '#EF4444'; // Green for match, red for unknown
    ctx.lineWidth = 3;
    ctx.strokeRect(box.x, box.y, box.width, box.height);

    // Draw label
    if (match) {
      const label = `${match.name} (${(match.confidence * 100).toFixed(0)}%)`;
      const labelHeight = 25;
      
      ctx.fillStyle = '#10B981';
      ctx.fillRect(box.x, box.y - labelHeight, box.width, labelHeight);
      
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '14px Arial';
      ctx.fillText(label, box.x + 5, box.y - 7);
    } else {
      const label = 'Unknown';
      const labelHeight = 25;
      
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(box.x, box.y - labelHeight, box.width, labelHeight);
      
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '14px Arial';
      ctx.fillText(label, box.x + 5, box.y - 7);
    }
  });
};

/**
 * Convert canvas to base64 image
 */
export const canvasToBase64 = (canvas) => {
  return canvas.toDataURL('image/jpeg', 0.8);
};

/**
 * Extract face image from detection
 */
export const extractFaceImage = async (videoElement, detection) => {
  try {
    const canvas = document.createElement('canvas');
    const box = detection.detection.box;
    
    // Add padding
    const padding = 20;
    const x = Math.max(0, box.x - padding);
    const y = Math.max(0, box.y - padding);
    const width = box.width + (padding * 2);
    const height = box.height + (padding * 2);

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(
      videoElement,
      x, y, width, height,
      0, 0, width, height
    );

    return canvas.toDataURL('image/jpeg', 0.9);
  } catch (error) {
    console.error('Error extracting face image:', error);
    return null;
  }
};
