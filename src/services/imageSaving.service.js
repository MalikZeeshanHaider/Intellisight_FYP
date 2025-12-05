/**
 * Image Saving Service for Face Recognition Training
 * Saves uploaded face images to:
 * 1. Facerecongination/images folder for training
 * 2. ProcessedFaceImages table in database (binary)
 * 3. Embeddings to Students/Teacher table after training
 * 
 * Flow:
 * 1. Frontend uploads student/teacher with face pictures
 * 2. Images saved to Facerecongination/images/{PersonName}/
 * 3. Binary images saved to ProcessedFaceImages table
 * 4. Auto-training triggered to generate embeddings
 * 5. Embeddings saved to database
 */

import fs from 'fs/promises';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { prisma } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the new face recognition folder
const FACE_RECOGNITION_PATH = path.join(__dirname, '../../Facerecongination');
const IMAGES_FOLDER = path.join(FACE_RECOGNITION_PATH, 'images');
const TRAIN_SCRIPT = path.join(FACE_RECOGNITION_PATH, 'train_incremental.py'); // Use incremental training
const VENV_PYTHON = path.join(FACE_RECOGNITION_PATH, 'venv', 'Scripts', 'python.exe');

/**
 * Ensure the images folder exists
 */
export const ensureImagesFolderExists = () => {
  if (!existsSync(IMAGES_FOLDER)) {
    mkdirSync(IMAGES_FOLDER, { recursive: true });
    console.log(`[IMAGE SERVICE] Created images folder: ${IMAGES_FOLDER}`);
  }
};

// Initialize on module load
ensureImagesFolderExists();

/**
 * Save a base64 image to the training folder
 * @param {string} base64Image - Base64 encoded image string
 * @param {string} personType - 'student' or 'teacher'
 * @param {number} personId - Person's database ID
 * @param {string} personName - Person's name (used for folder naming)
 * @param {number} imageIndex - Image number (1-5)
 * @returns {Promise<string|null>} - Path to saved image or null on error
 */
export const saveImageToTrainFolder = async (base64Image, personType, personId, personName, imageIndex) => {
  try {
    if (!base64Image) return null;

    // Create folder name from person name or fallback to ID
    const safeName = personName 
      ? personName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50)
      : `${personType}_${personId}`;
    
    const folderPath = path.join(IMAGES_FOLDER, safeName);
    
    // Create folder if not exists
    if (!existsSync(folderPath)) {
      mkdirSync(folderPath, { recursive: true });
      console.log(`[IMAGE SERVICE] Created person folder: ${folderPath}`);
    }

    // Remove data URL prefix if present
    let imageData = base64Image;
    if (imageData.includes(',')) {
      imageData = imageData.split(',')[1];
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(imageData, 'base64');

    // Save image
    const filename = `image_${imageIndex}.jpg`;
    const filepath = path.join(folderPath, filename);
    
    await fs.writeFile(filepath, buffer);
    console.log(`[IMAGE SERVICE] Saved image: ${filepath}`);

    return filepath;
  } catch (error) {
    console.error(`[IMAGE SERVICE ERROR] Failed to save image: ${error.message}`);
    return null;
  }
};

/**
 * Save all face pictures for a person
 * @param {string} personType - 'student' or 'teacher'
 * @param {number} personId - Person's database ID
 * @param {string} personName - Person's name
 * @param {object} facePictures - Object containing Face_Picture_1 to Face_Picture_5
 * @returns {Promise<string[]>} - Array of saved image paths
 */
export const savePersonImages = async (personType, personId, personName, facePictures) => {
  const savedPaths = [];

  for (let i = 1; i <= 5; i++) {
    const pictureKey = `Face_Picture_${i}`;
    const base64Image = facePictures[pictureKey];
    
    if (base64Image) {
      const savedPath = await saveImageToTrainFolder(
        base64Image, 
        personType, 
        personId, 
        personName, 
        i
      );
      if (savedPath) {
        savedPaths.push(savedPath);
      }
    }
  }

  console.log(`[IMAGE SERVICE] Saved ${savedPaths.length} images for ${personName || personType + '_' + personId}`);
  
  // Save binary images to ProcessedFaceImages table
  if (savedPaths.length > 0) {
    try {
      await saveProcessedImagesToDb(personType, personId, facePictures);
    } catch (err) {
      console.warn('[IMAGE SERVICE] Failed to save processed images to DB:', err.message);
    }
  }
  
  // Auto-trigger incremental training after saving images
  if (savedPaths.length > 0) {
    // Get the person's folder name for targeted training
    const safeName = personName 
      ? personName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50)
      : `${personType}_${personId}`;
    triggerAutoTraining(safeName, personType, personId);
  }
  
  return savedPaths;
};

/**
 * Save binary images to ProcessedFaceImages table
 * @param {string} personType - 'student' or 'teacher'
 * @param {number} personId - Person's database ID
 * @param {object} facePictures - Object containing Face_Picture_1 to Face_Picture_5
 */
export const saveProcessedImagesToDb = async (personType, personId, facePictures) => {
  try {
    // Convert base64 images to binary buffers
    const imageBuffers = {};
    for (let i = 1; i <= 5; i++) {
      const pictureKey = `Face_Picture_${i}`;
      const base64Image = facePictures[pictureKey];
      
      if (base64Image) {
        let imageData = base64Image;
        if (imageData.includes(',')) {
          imageData = imageData.split(',')[1];
        }
        imageBuffers[`Image${i}`] = Buffer.from(imageData, 'base64');
      }
    }

    // Check if record already exists
    const existingRecord = await prisma.processedFaceImages.findFirst({
      where: personType === 'student' 
        ? { Student_ID: personId, PersonType: 'STUDENT' }
        : { Teacher_ID: personId, PersonType: 'TEACHER' }
    });

    if (existingRecord) {
      // Update existing record
      await prisma.processedFaceImages.update({
        where: { Processed_ID: existingRecord.Processed_ID },
        data: {
          Image1: imageBuffers.Image1 || existingRecord.Image1,
          Image2: imageBuffers.Image2 || existingRecord.Image2,
          Image3: imageBuffers.Image3 || existingRecord.Image3,
          Image4: imageBuffers.Image4 || existingRecord.Image4,
          Image5: imageBuffers.Image5 || existingRecord.Image5,
        }
      });
      console.log(`[DB] Updated ProcessedFaceImages for ${personType} ${personId}`);
    } else {
      // Create new record
      await prisma.processedFaceImages.create({
        data: {
          PersonType: personType.toUpperCase(),
          Student_ID: personType === 'student' ? personId : null,
          Teacher_ID: personType === 'teacher' ? personId : null,
          Image1: imageBuffers.Image1,
          Image2: imageBuffers.Image2,
          Image3: imageBuffers.Image3,
          Image4: imageBuffers.Image4,
          Image5: imageBuffers.Image5,
        }
      });
      console.log(`[DB] Created ProcessedFaceImages for ${personType} ${personId}`);
    }
  } catch (error) {
    console.error(`[DB ERROR] Failed to save processed images: ${error.message}`);
    throw error;
  }
};

/**
 * Save embeddings to database after training
 * @param {string} personType - 'student' or 'teacher'
 * @param {number} personId - Person's database ID
 * @param {Array} embeddings - Array of embedding values
 */
export const saveEmbeddingsToDb = async (personType, personId, embeddings) => {
  try {
    // Convert embeddings array to binary buffer
    const embeddingsBuffer = Buffer.from(JSON.stringify(embeddings));
    
    if (personType === 'student') {
      await prisma.students.update({
        where: { Student_ID: personId },
        data: { Face_Embeddings: embeddingsBuffer }
      });
    } else {
      await prisma.teacher.update({
        where: { Teacher_ID: personId },
        data: { Face_Embeddings: embeddingsBuffer }
      });
    }
    
    console.log(`[DB] Saved embeddings for ${personType} ${personId}`);
  } catch (error) {
    console.error(`[DB ERROR] Failed to save embeddings: ${error.message}`);
    throw error;
  }
};

/**
 * Trigger auto-training in background for a specific person
 * Runs train_incremental.py to generate embeddings only for new images
 * @param {string} personName - Name of the person to train (optional)
 * @param {string} personType - 'student' or 'teacher' (optional)
 * @param {number} personId - Person's database ID (optional)
 */
export const triggerAutoTraining = (personName = null, personType = null, personId = null) => {
  console.log(`[AUTO-TRAIN] Starting incremental training for: ${personName || 'all'}`);
  
  const trainScript = path.join(FACE_RECOGNITION_PATH, 'train_incremental.py');
  
  if (!existsSync(trainScript)) {
    console.error(`[AUTO-TRAIN ERROR] train_incremental.py not found at: ${trainScript}`);
    return;
  }

  // Use venv Python if available, otherwise system Python
  const pythonExe = existsSync(VENV_PYTHON) ? VENV_PYTHON : 'python';
  console.log(`[AUTO-TRAIN] Using Python: ${pythonExe}`);

  // Run training script in background
  const pythonProcess = spawn(pythonExe, [trainScript], {
    cwd: FACE_RECOGNITION_PATH,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
  });

  pythonProcess.stdout.on('data', (data) => {
    console.log(`[TRAIN] ${data.toString().trim()}`);
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`[TRAIN ERROR] ${data.toString().trim()}`);
  });

  pythonProcess.on('close', async (code) => {
    if (code === 0) {
      console.log('[AUTO-TRAIN] [OK] Training completed successfully!');
      
      // Save embeddings to database if personType and personId are provided
      if (personType && personId && personName) {
        try {
          await saveEmbeddingsFromFileToDb(personName, personType, personId);
        } catch (err) {
          console.warn(`[AUTO-TRAIN] Failed to save embeddings to DB: ${err.message}`);
        }
      }
    } else {
      console.error(`[AUTO-TRAIN] Training exited with code ${code}`);
    }
  });

  pythonProcess.on('error', (err) => {
    console.error(`[AUTO-TRAIN ERROR] Failed to start training: ${err.message}`);
  });

  // Unref to allow the main process to exit independently
  pythonProcess.unref();
};

/**
 * Read embeddings from JSON file and save to FaceEmbeddings table
 * @param {string} personName - Person's folder name
 * @param {string} personType - 'student' or 'teacher'
 * @param {number} personId - Person's database ID
 */
const saveEmbeddingsFromFileToDb = async (personName, personType, personId) => {
  const embeddingsFile = path.join(FACE_RECOGNITION_PATH, 'embeddings', 'representations_facenet.json');
  
  if (!existsSync(embeddingsFile)) {
    console.warn('[EMBEDDINGS] Embeddings file not found:', embeddingsFile);
    return;
  }
  
  try {
    const embeddingsData = JSON.parse(await fs.readFile(embeddingsFile, 'utf-8'));
    
    // Find embeddings for this person
    const personEmbeddings = embeddingsData.filter(item => {
      const imagePath = item.identity || item.image_path || '';
      return imagePath.includes(personName);
    });
    
    if (personEmbeddings.length > 0) {
      // Delete existing embeddings for this person
      await prisma.faceEmbeddings.deleteMany({
        where: personType === 'student'
          ? { Student_ID: personId, PersonType: 'STUDENT' }
          : { Teacher_ID: personId, PersonType: 'TEACHER' }
      });
      
      // Save each embedding to FaceEmbeddings table
      for (const item of personEmbeddings) {
        const embedding = item.embedding || item.representation || [];
        const imagePath = item.identity || item.image_path || '';
        
        await prisma.faceEmbeddings.create({
          data: {
            PersonType: personType.toUpperCase(),
            Student_ID: personType === 'student' ? personId : null,
            Teacher_ID: personType === 'teacher' ? personId : null,
            PersonName: personName,
            ImagePath: imagePath,
            Embedding: Buffer.from(JSON.stringify(embedding)),
            EmbeddingJson: JSON.stringify(embedding)
          }
        });
      }
      
      // Also update the Face_Embeddings field in Students/Teacher table (aggregated)
      const allEmbeddings = personEmbeddings.map(item => item.embedding || item.representation || []);
      await saveEmbeddingsToDb(personType, personId, allEmbeddings);
      
      console.log(`[EMBEDDINGS] Saved ${personEmbeddings.length} embeddings to FaceEmbeddings table for ${personName}`);
    } else {
      console.log(`[EMBEDDINGS] No embeddings found for ${personName}`);
    }
  } catch (error) {
    console.error(`[EMBEDDINGS ERROR] Failed to read/save embeddings: ${error.message}`);
  }
};

/**
 * Delete person's image folder
 * @param {string} personName - Person's name (folder name)
 * @returns {Promise<boolean>} - Success status
 */
export const deletePersonImages = async (personName) => {
  try {
    if (!personName) return false;

    const safeName = personName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    const folderPath = path.join(IMAGES_FOLDER, safeName);

    if (existsSync(folderPath)) {
      await fs.rm(folderPath, { recursive: true, force: true });
      console.log(`[IMAGE SERVICE] Deleted folder: ${folderPath}`);
      
      // Re-train after deletion to update embeddings
      triggerAutoTraining();
      
      return true;
    }

    return false;
  } catch (error) {
    console.error(`[IMAGE SERVICE ERROR] Failed to delete folder: ${error.message}`);
    return false;
  }
};

/**
 * Get path to the face recognition images folder
 * @returns {string} - Path to images folder
 */
export const getImagesFolderPath = () => {
  return IMAGES_FOLDER;
};

/**
 * Get path to the face recognition folder
 * @returns {string} - Path to Facerecongination folder
 */
export const getFaceRecognitionPath = () => {
  return FACE_RECOGNITION_PATH;
};

export default {
  saveImageToTrainFolder,
  savePersonImages,
  saveProcessedImagesToDb,
  saveEmbeddingsToDb,
  deletePersonImages,
  triggerAutoTraining,
  getImagesFolderPath,
  getFaceRecognitionPath,
  ensureImagesFolderExists
};
