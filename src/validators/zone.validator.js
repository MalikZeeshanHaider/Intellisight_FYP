import { z } from 'zod';

export const createZoneSchema = z.object({
  body: z.object({
    Zone_Name: z.string().min(2, 'Zone name must be at least 2 characters').max(255),
  }),
});

export const updateZoneSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID must be a number').transform(Number),
  }),
  body: z.object({
    Zone_Name: z.string().min(2).max(255).optional(),
  }),
});

export const getZoneSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID must be a number').transform(Number),
  }),
});

export const deleteZoneSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID must be a number').transform(Number),
  }),
});
