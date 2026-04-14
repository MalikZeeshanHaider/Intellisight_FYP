import { z } from 'zod';

export const createCourseSchema = z.object({
  body: z.object({
    Name: z.string().min(1, 'Course name is required').max(200),
    Code: z.string().min(1, 'Course code is required').max(20),
    CreditHours: z.number().int().min(1).max(10).optional(),
    Department: z.string().max(100).optional(),
  }),
});

export const updateCourseSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/).transform(Number),
  }),
  body: z.object({
    Name: z.string().min(1).max(200).optional(),
    Code: z.string().min(1).max(20).optional(),
    CreditHours: z.number().int().min(1).max(10).optional().nullable(),
    Department: z.string().max(100).optional().nullable(),
  }),
});

export const getCourseSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/).transform(Number),
  }),
});

export const deleteCourseSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/).transform(Number),
  }),
});
