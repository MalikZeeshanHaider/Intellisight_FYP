#!/usr/bin/env node

/**
 * Download face-api.js models
 * This script downloads the required face recognition models
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Models directory
const MODELS_DIR = path.join(__dirname, '..', 'public', 'models');

// Create models directory if it doesn't exist
if (!fs.existsSync(MODELS_DIR)) {
  fs.mkdirSync(MODELS_DIR, { recursive: true });
  console.log('✅ Created models directory');
}

// Base URL for face-api.js models
const BASE_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';

// List of model files to download
const MODELS = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2'
];

/**
 * Download a file from URL
 */
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });

    file.on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

/**
 * Download all models
 */
async function downloadModels() {
  console.log('🔄 Downloading face-api.js models...\n');

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const model of MODELS) {
    const url = `${BASE_URL}/${model}`;
    const dest = path.join(MODELS_DIR, model);

    // Check if file already exists
    if (fs.existsSync(dest)) {
      console.log(`⏭️  Skipping ${model} (already exists)`);
      skipped++;
      continue;
    }

    try {
      console.log(`📥 Downloading ${model}...`);
      await downloadFile(url, dest);
      console.log(`✅ Downloaded ${model}`);
      downloaded++;
    } catch (error) {
      console.error(`❌ Failed to download ${model}:`, error.message);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Downloaded: ${downloaded}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('='.repeat(50));

  if (downloaded > 0 || skipped === MODELS.length) {
    console.log('\n✅ All models are ready!');
    console.log(`📁 Models location: ${MODELS_DIR}`);
  } else {
    console.log('\n⚠️  Some models failed to download. Please try again.');
    process.exit(1);
  }
}

// Run the download
downloadModels().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
