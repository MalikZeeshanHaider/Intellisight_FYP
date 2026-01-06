import { z } from 'zod';
import { PERSON_TYPES } from '../config/constants.js';

export const entrySchema = z.object({
  body: z.object({
    personType: z.enum([PERSON_TYPES.TEACHER, PERSON_TYPES.STUDENT], {
      errorMap: () => ({ message: 'personType must be TEACHER or STUDENT' }),
    }),
    personId: z.number().int().positive('personId must be a positive integer'),
    zoneId: z.number().int().positive('zoneId must be a positive integer'),
    cameraId: z.number().int().positive().optional(),
    timestamp: z.string().datetime().optional(), // ISO 8601 format
  }),
});

export const exitSchema = z.object({
  body: z.object({
    personType: z.enum([PERSON_TYPES.TEACHER, PERSON_TYPES.STUDENT], {
      errorMap: () => ({ message: 'personType must be TEACHER or STUDENT' }),
    }),
    personId: z.number().int().positive('personId must be a positive integer'),
    zoneId: z.number().int().positive('zoneId must be a positive integer').optional(),
    timestamp: z.string().datetime().optional(),
  }),
});

export const queryTimetableSchema = z.object({
  query: z.object({
    zoneId: z.string().regex(/^\d+$/).transform(Number).optional(),
    personType: z.enum([PERSON_TYPES.TEACHER, PERSON_TYPES.STUDENT]).optional(),
    personId: z.string().regex(/^\d+$/).transform(Number).optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  }),
});
