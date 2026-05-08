/**
 * src/config/env.js
 *
 * Loads .env and validates all required environment variables.
 * This module MUST be the first import in server.js.
 * If any required variable is missing the process exits immediately.
 */

// Load .env here — dotenv.config() in server.js runs AFTER all imports are
// hoisted in ES modules, so we must load it inside this file instead.
import dotenv from 'dotenv';
dotenv.config();

// ── Required variables ────────────────────────────────────────────────────────
// Each entry: { name, description }
const REQUIRED = [
  { name: 'DATABASE_URL',          description: 'PostgreSQL connection string' },
  { name: 'JWT_SECRET',            description: 'Secret key for signing JWT tokens (min 32 chars)' },
  { name: 'EMAIL_USER',            description: 'Gmail address used to send system emails' },
  { name: 'EMAIL_PASS',            description: 'Gmail App Password for EMAIL_USER' },
  { name: 'SUPER_ADMIN_EMAIL',     description: 'Email address of the super-admin account' },
  { name: 'SUPER_ADMIN_PASSWORD',  description: 'Password for the super-admin account' },
  { name: 'DB_PASSWORD',           description: 'PostgreSQL database password (also used by Python services)' },
  { name: 'CORS_ORIGINS',          description: 'Comma-separated list of allowed frontend origins (e.g. http://localhost:5173)' },
];

// ── Optional variables with their defaults (documented here for visibility) ──
// These do NOT cause a crash but are listed so developers know what they can set.
export const ENV_DEFAULTS = {
  PORT:             3000,
  NODE_ENV:         'development',
  JWT_EXPIRES_IN:   '7d',
  BCRYPT_ROUNDS:    10,
  FRONTEND_URL:     'http://localhost:5173',
  BACKEND_URL:      'http://localhost:3000',
  MAX_FILE_SIZE:    5242880,
  LOG_LEVEL:        'info',
};

// ── Validation ────────────────────────────────────────────────────────────────
const missing = REQUIRED.filter(({ name }) => !process.env[name] || process.env[name].trim() === '');

if (missing.length > 0) {
  console.error('\n╔══════════════════════════════════════════════════════════════╗');
  console.error('║          FATAL: Missing required environment variables        ║');
  console.error('╠══════════════════════════════════════════════════════════════╣');
  missing.forEach(({ name, description }) => {
    console.error(`║  ✗  ${name.padEnd(24)} — ${description}`);
  });
  console.error('╠══════════════════════════════════════════════════════════════╣');
  console.error('║  Copy .env.example → .env and fill in all required values.  ║');
  console.error('╚══════════════════════════════════════════════════════════════╝\n');
  process.exit(1);
}

// ── JWT secret strength check ─────────────────────────────────────────────────
if (process.env.JWT_SECRET.length < 32) {
  console.error('[FATAL] JWT_SECRET must be at least 32 characters long.');
  console.error('        Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
  process.exit(1);
}

// ── Typed, ready-to-use exports ───────────────────────────────────────────────
export const env = {
  // Server
  PORT:                 parseInt(process.env.PORT)            || ENV_DEFAULTS.PORT,
  NODE_ENV:             process.env.NODE_ENV                  || ENV_DEFAULTS.NODE_ENV,
  IS_PRODUCTION:        process.env.NODE_ENV === 'production',

  // Database
  DATABASE_URL:         process.env.DATABASE_URL,
  DB_HOST:              process.env.DB_HOST                   || 'localhost',
  DB_PORT:              parseInt(process.env.DB_PORT)         || 5432,
  DB_NAME:              process.env.DB_NAME                   || 'FYP_Intellisight',
  DB_USER:              process.env.DB_USER                   || 'postgres',
  DB_PASSWORD:          process.env.DB_PASSWORD,

  // JWT
  JWT_SECRET:           process.env.JWT_SECRET,
  JWT_EXPIRES_IN:       process.env.JWT_EXPIRES_IN            || ENV_DEFAULTS.JWT_EXPIRES_IN,

  // Bcrypt
  BCRYPT_ROUNDS:        parseInt(process.env.BCRYPT_ROUNDS)   || ENV_DEFAULTS.BCRYPT_ROUNDS,

  // Email
  EMAIL_USER:           process.env.EMAIL_USER,
  EMAIL_PASS:           process.env.EMAIL_PASS,
  ADMIN_EMAIL:          process.env.ADMIN_EMAIL               || process.env.EMAIL_USER,

  // Super Admin
  SUPER_ADMIN_EMAIL:    process.env.SUPER_ADMIN_EMAIL,
  SUPER_ADMIN_PASSWORD: process.env.SUPER_ADMIN_PASSWORD,
  SUPER_ADMIN_NAME:     process.env.SUPER_ADMIN_NAME          || 'Super Administrator',

  // URLs
  FRONTEND_URL:         process.env.FRONTEND_URL              || ENV_DEFAULTS.FRONTEND_URL,
  BACKEND_URL:          process.env.BACKEND_URL               || ENV_DEFAULTS.BACKEND_URL,

  // CORS — required, no fallback. Parsed into a trimmed string array.
  CORS_ORIGINS:         process.env.CORS_ORIGINS
                          .split(',')
                          .map((o) => o.trim())
                          .filter(Boolean),

  // Uploads
  MAX_FILE_SIZE:        parseInt(process.env.MAX_FILE_SIZE)   || ENV_DEFAULTS.MAX_FILE_SIZE,

  // Logging
  LOG_LEVEL:            process.env.LOG_LEVEL                 || ENV_DEFAULTS.LOG_LEVEL,

  // Gemini AI (timetable extraction) — optional
  GEMINI_API_KEY:       process.env.GEMINI_API_KEY            || '',
};

console.log(`[ENV] Configuration validated. NODE_ENV=${env.NODE_ENV}, PORT=${env.PORT}`);
