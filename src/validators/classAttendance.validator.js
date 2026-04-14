import { z } from 'zod';

export const aggregateAttendanceSchema = z.object({
  body: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
    sectionId: z.number().int().positive().optional(),
    slotId: z.number().int().positive().optional(),
  }),
});

export const getClassAttendanceSchema = z.object({
  query: z.object({
    slotId: z.string().regex(/^\d+$/).transform(Number).optional(),
    sectionId: z.string().regex(/^\d+$/).transform(Number).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    studentId: z.string().regex(/^\d+$/).transform(Number).optional(),
    teacherId: z.string().regex(/^\d+$/).transform(Number).optional(),
    status: z.enum(['PRESENT', 'ABSENT', 'LATE']).optional(),
  }),
});

export const getStudentWeeklySchema = z.object({
  params: z.object({
    studentId: z.string().regex(/^\d+$/).transform(Number),
  }),
  query: z.object({
    weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'weekStart must be YYYY-MM-DD'),
  }),
});

export const getSectionWeeklySchema = z.object({
  params: z.object({
    sectionId: z.string().regex(/^\d+$/).transform(Number),
  }),
  query: z.object({
    weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'weekStart must be YYYY-MM-DD'),
  }),
});

export const getSlotAttendanceSchema = z.object({
  params: z.object({
    slotId: z.string().regex(/^\d+$/).transform(Number),
  }),
  query: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  }),
});
