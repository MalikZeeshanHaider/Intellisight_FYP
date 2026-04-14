import { z } from 'zod';

export const createSectionSchema = z.object({
  body: z.object({
    Name: z.string().min(1, 'Section name is required').max(100),
    Department: z.string().max(100).optional(),
    Semester: z.string().max(20).optional(),
    Shift: z.string().max(20).optional(),
  }),
});

export const updateSectionSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/).transform(Number),
  }),
  body: z.object({
    Name: z.string().min(1).max(100).optional(),
    Department: z.string().max(100).optional(),
    Semester: z.string().max(20).optional(),
    Shift: z.string().max(20).optional(),
  }),
});

export const getSectionSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/).transform(Number),
  }),
});

export const deleteSectionSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/).transform(Number),
  }),
});
