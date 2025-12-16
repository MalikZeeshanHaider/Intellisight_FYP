/**
 * Python Face Recognition Service Manager
 * Manages the lifecycle of Python face recognition processes
 */

import { spawn, exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const FACE_RECOGNITION_PATH = path.join(__dirname, '../../Facerecongination');
const RECOGNITION_SCRIPT = path.join(FACE_RECOGNITION_PATH, 'recognition_live.py');
const TRAIN_SCRIPT = path.join(FACE_RECOGNITION_PATH, 'train_incremental.py');

// Python executable - try Facerecongination venv first, then root venv, then system python
const FACE_VENV_PYTHON_WIN = path.join(FACE_RECOGNITION_PATH, 'venv/Scripts/python.exe');
const FACE_VENV_PYTHON_UNIX = path.join(FACE_RECOGNITION_PATH, 'venv/bin/python');
const VENV_PYTHON_WIN = path.join(__dirname, '../../.venv/Scripts/python.exe');
const VENV_PYTHON_UNIX = path.join(__dirname, '../../.venv/bin/python');

const getPythonExe = () => {
  // Prioritize Facerecongination venv (has all dependencies)
  if (existsSync(FACE_VENV_PYTHON_WIN)) return FACE_VENV_PYTHON_WIN;
  if (existsSync(FACE_VENV_PYTHON_UNIX)) return FACE_VENV_PYTHON_UNIX;
  // Fallback to root venv
  if (existsSync(VENV_PYTHON_WIN)) return VENV_PYTHON_WIN;
  if (existsSync(VENV_PYTHON_UNIX)) return VENV_PYTHON_UNIX;
  return 'python';
};

// Store running processes
const runningProcesses = new Map();

/**
 * Start face recognition for a specific zone
 * @param {number} zoneId - Zone ID to monitor
 * @returns {object} Process info
 */
export const startRecognitionForZone = (zoneId) => {
  const processKey = `recognition_zone_${zoneId}`;
  
  // Check if already running
  if (runningProcesses.has(processKey)) {
    logger.info(`[PYTHON] Recognition for Zone ${zoneId} already running`);
    return { success: true, message: 'Already running', pid: runningProcesses.get(processKey).pid };
  }

  if (!existsSync(RECOGNITION_SCRIPT)) {
    logger.error(`[PYTHON] Recognition script not found: ${RECOGNITION_SCRIPT}`);
    return { success: false, message: 'Recognition script not found' };
  }

  const pythonExe = getPythonExe();
  logger.info(`[PYTHON] Starting recognition for Zone ${zoneId} using: ${pythonExe}`);

  const pythonProcess = spawn(pythonExe, [RECOGNITION_SCRIPT, '--zone', zoneId.toString()], {
    cwd: FACE_RECOGNITION_PATH,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...global.process.env, PYTHONIOENCODING: 'utf-8' }
  });

  pythonProcess.stdout.on('data', (data) => {
    logger.info(`[RECOGNITION Zone ${zoneId}] ${data.toString().trim()}`);
  });

  pythonProcess.stderr.on('data', (data) => {
    logger.error(`[RECOGNITION Zone ${zoneId}] ${data.toString().trim()}`);
  });

  pythonProcess.on('close', (code) => {
    logger.info(`[PYTHON] Recognition for Zone ${zoneId} exited with code ${code}`);
    runningProcesses.delete(processKey);
  });

  pythonProcess.on('error', (err) => {
    logger.error(`[PYTHON] Failed to start recognition: ${err.message}`);
    runningProcesses.delete(processKey);
  });

  runningProcesses.set(processKey, pythonProcess);

  return { 
    success: true, 
    message: `Recognition started for Zone ${zoneId}`, 
    pid: pythonProcess.pid 
  };
};

/**
 * Stop face recognition for a specific zone
 * @param {number} zoneId - Zone ID
 */
export const stopRecognitionForZone = (zoneId) => {
  const processKey = `recognition_zone_${zoneId}`;
  
  if (!runningProcesses.has(processKey)) {
    return { success: false, message: 'Not running' };
  }

  const pythonProcess = runningProcesses.get(processKey);
  pythonProcess.kill('SIGTERM');
  runningProcesses.delete(processKey);
  
  logger.info(`[PYTHON] Stopped recognition for Zone ${zoneId}`);
  return { success: true, message: 'Stopped' };
};

/**
 * Run training script to generate embeddings
 * @param {string} personName - Optional person name for targeted training
 * @returns {Promise<object>} Training result
 */
export const runTraining = (personName = null) => {
  return new Promise((resolve, reject) => {
    if (!existsSync(TRAIN_SCRIPT)) {
      reject(new Error('Training script not found'));
      return;
    }

    const pythonExe = getPythonExe();
    logger.info(`[PYTHON] Starting training using: ${pythonExe}`);

    const trainProcess = spawn(pythonExe, [TRAIN_SCRIPT], {
      cwd: FACE_RECOGNITION_PATH,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...global.process.env, PYTHONIOENCODING: 'utf-8' }
    });

    let output = '';
    let errorOutput = '';

    trainProcess.stdout.on('data', (data) => {
      const msg = data.toString().trim();
      output += msg + '\n';
      logger.info(`[TRAIN] ${msg}`);
    });

    trainProcess.stderr.on('data', (data) => {
      const msg = data.toString().trim();
      errorOutput += msg + '\n';
      logger.error(`[TRAIN ERROR] ${msg}`);
    });

    trainProcess.on('close', (code) => {
      if (code === 0) {
        logger.info('[PYTHON] Training completed successfully');
        resolve({ success: true, output });
      } else {
        logger.error(`[PYTHON] Training failed with code ${code}`);
        reject(new Error(errorOutput || `Training failed with code ${code}`));
      }
    });

    trainProcess.on('error', (err) => {
      logger.error(`[PYTHON] Failed to start training: ${err.message}`);
      reject(err);
    });
  });
};

/**
 * Initialize Python services on startup
 * Verifies Python environment and runs initial training if needed
 */
export const initializePythonServices = async () => {
  logger.info('[PYTHON] Initializing Python face recognition services...');
  
  const pythonExe = getPythonExe();
  logger.info(`[PYTHON] Using Python executable: ${pythonExe}`);
  
  // Check if Python is available
  return new Promise((resolve) => {
    exec(`"${pythonExe}" --version`, (error, stdout, stderr) => {
      if (error) {
        logger.warn('[PYTHON] Python not available or venv not set up');
        logger.warn('[PYTHON] Face recognition features will be limited');
        resolve({ success: false, message: 'Python not available' });
        return;
      }
      
      const version = stdout.trim() || stderr.trim();
      logger.info(`[PYTHON] ${version} detected`);
      
      // Check if embeddings file exists, if not run training
      const embeddingsFile = path.join(FACE_RECOGNITION_PATH, 'embeddings', 'representations_facenet.json');
      if (!existsSync(embeddingsFile)) {
        logger.info('[PYTHON] No embeddings found, running initial training...');
        runTraining()
          .then(() => {
            logger.info('[PYTHON] Initial training complete');
            resolve({ success: true, message: 'Python services initialized with training' });
          })
          .catch((err) => {
            logger.warn(`[PYTHON] Initial training skipped: ${err.message}`);
            resolve({ success: true, message: 'Python services initialized (no training data)' });
          });
      } else {
        logger.info('[PYTHON] Embeddings file found, ready for recognition');
        resolve({ success: true, message: 'Python services initialized' });
      }
    });
  });
};

/**
 * Stop all running Python processes
 */
export const stopAllProcesses = () => {
  logger.info(`[PYTHON] Stopping ${runningProcesses.size} running processes...`);
  
  for (const [key, process] of runningProcesses) {
    try {
      process.kill('SIGTERM');
      logger.info(`[PYTHON] Stopped: ${key}`);
    } catch (err) {
      logger.error(`[PYTHON] Failed to stop ${key}: ${err.message}`);
    }
  }
  
  runningProcesses.clear();
};

/**
 * Get status of all running processes
 */
export const getProcessStatus = () => {
  const status = {};
  for (const [key, process] of runningProcesses) {
    status[key] = {
      pid: process.pid,
      running: !process.killed
    };
  }
  return status;
};

export default {
  startRecognitionForZone,
  stopRecognitionForZone,
  runTraining,
  initializePythonServices,
  stopAllProcesses,
  getProcessStatus
};
