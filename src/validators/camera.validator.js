import { z } from 'zod';

export const createCameraSchema = z.object({
  body: z.object({
    Password: z.string().min(4, 'Password must be at least 4 characters').max(255).optional(),
    Zone_id: z.number().int().positive().optional(),
    Camera_URL: z.string().max(500, 'Camera URL must be at most 500 characters').optional(),
    Camera_Type: z.enum(['Entry', 'Exit', 'Both']).optional().default('Entry'),
  }),
});

export const updateCameraSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID must be a number').transform(Number),
  }),
  body: z.object({
    Password: z.string().min(4).max(255).optional(),
    Zone_id: z.number().int().positive().nullable().optional(),
    Camera_URL: z.string().max(500, 'Camera URL must be at most 500 characters').optional(),
    Camera_Type: z.enum(['Entry', 'Exit', 'Both']).optional(),
  }),
});

export const getCameraSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID must be a number').transform(Number),
  }),
});

export const deleteCameraSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID must be a number').transform(Number),
  }),
});
