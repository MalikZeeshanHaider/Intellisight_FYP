import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { successResponse } from './utils/response.js';
import { env } from './config/env.js';
import { generalLimiter } from './middlewares/rateLimiter.js';

const app = express();

// Security middleware
app.use(helmet());

// Cookie parser — must come before routes so req.cookies is populated
app.use(cookieParser());

// CORS — only explicitly listed origins are allowed; everything else is blocked.
// Origins come from the required CORS_ORIGINS env variable (set in .env).
// Using a function instead of a plain array so unknown origins are rejected
// with a clear error rather than silently missing the header.
const allowedOrigins = new Set(env.CORS_ORIGINS);

const corsOptions = {
  origin: (requestOrigin, callback) => {
    // Allow server-to-server / Postman requests (no Origin header)
    if (!requestOrigin) return callback(null, true);

    // Explicitly block wildcard — safety net in case env is ever misconfigured
    if (requestOrigin === '*') {
      return callback(new Error('Wildcard origin is not permitted'), false);
    }

    if (allowedOrigins.has(requestOrigin)) {
      return callback(null, true);
    }

    // Log the blocked origin so it shows up in server logs
    console.warn(`[CORS] Blocked request from unknown origin: ${requestOrigin}`);
    return callback(new Error(`Origin "${requestOrigin}" is not allowed by CORS policy`), false);
  },
  credentials: true,           // Required for httpOnly cookies to be sent cross-origin
  optionsSuccessStatus: 200,   // Some legacy browsers choke on 204 for preflight
};
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' })); // Increased limit for base64 images
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (!env.IS_PRODUCTION) {
  app.use(morgan('dev'));
}

// Health check endpoint
app.get('/health', async (req, res) => {
  const { prisma } = await import('./config/database.js');
  
  try {
    await prisma.$queryRaw`SELECT 1`;
    return successResponse(res, {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
    });
  } catch (error) {
    return successResponse(res, {
      status: 'degraded',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
    });
  }
});

// General rate limit on all API routes (100 req / 15 min per IP)
app.use('/api', generalLimiter);

// API routes
app.use('/api', routes);

// 404 handler
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

export default app;
