/**
 * src/middlewares/rateLimiter.js
 *
 * Route-specific rate limiters using express-rate-limit.
 * Applied only to sensitive auth endpoints to prevent brute-force attacks.
 *
 * Each limiter tracks requests per IP address independently.
 */

import rateLimit from 'express-rate-limit';

const IS_DEV = process.env.NODE_ENV !== 'production';

/**
 * Shared handler — returns a consistent JSON error response
 * instead of the default plain-text HTML page.
 */
const rateLimitHandler = (req, res, next, options) => {
  res.status(options.statusCode).json({
    success: false,
    message: options.message,
    retryAfter: Math.ceil(options.windowMs / 1000 / 60), // minutes
  });
};

// In development, skip rate limiting entirely so testing is never blocked.
const skipInDev = () => IS_DEV;

/**
 * LOGIN — 20 attempts per 15 minutes per IP.
 * Blocks brute-force while giving legitimate users plenty of room.
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 20,
  skip: skipInDev,
  message: 'Too many login attempts. Please try again after 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/**
 * REGISTER — 5 registrations per hour per IP.
 * Prevents mass account creation / spam.
 */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,   // 1 hour
  max: 5,
  skip: skipInDev,
  message: 'Too many registration attempts. Please try again after 1 hour.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/**
 * FORGOT PASSWORD — 5 requests per hour per IP.
 * Prevents email bombing and user enumeration via timing.
 */
export const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,   // 1 hour
  max: 5,
  skip: skipInDev,
  message: 'Too many password reset requests. Please try again after 1 hour.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/**
 * RESET PASSWORD — 10 attempts per 15 minutes per IP.
 * Short window so stolen reset links can't be brute-forced.
 */
export const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 10,
  skip: skipInDev,
  message: 'Too many password reset attempts. Please try again after 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/**
 * GENERAL API — 5000 requests per 15 minutes per IP.
 * Broad protection against abuse while allowing normal dashboard
 * polling — Cameras, ZoneLive and the unknown-faces page each refresh
 * every few seconds, so the old 500-req cap was tripping legitimate use.
 * Disabled entirely in development so local testing is never blocked.
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 5000,
  skip: skipInDev,
  message: 'Too many requests. Please slow down and try again after 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});
