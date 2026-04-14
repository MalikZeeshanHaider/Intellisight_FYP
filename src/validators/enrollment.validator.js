import { z } from 'zod';

export const createEnrollmentSchema = z.object({
  body: z.object({
    Section_ID: z.number().int().positive('Section ID is required'),
    Student_ID: z.number().int().positive('Student ID is required'),
  }),
});

export const bulkEnrollSchema = z.object({
  body: z.object({
    Section_ID: z.number().int().positive('Section ID is required'),
    Student_IDs: z.array(z.number().int().positive()).min(1, 'At least one student ID is required'),
  }),
});

export const deleteEnrollmentSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/).transform(Number),
  }),
});

export const getEnrollmentsBySectionSchema = z.object({
  params: z.object({
    sectionId: z.string().regex(/^\d+$/).transform(Number),
  }),
});
