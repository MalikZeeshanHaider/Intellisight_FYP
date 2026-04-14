import { z } from 'zod';

const DAYS_OF_WEEK = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/; // HH:mm 24-hr format

export const createSlotSchema = z.object({
  body: z.object({
    Section_ID: z.number().int().positive('Section ID is required'),
    Course_ID: z.number().int().positive().optional().nullable(),
    Teacher_ID: z.number().int().positive().optional().nullable(),
    TeacherName: z.string().max(100).optional().nullable(),
    SubjectName: z.string().min(1, 'Subject name is required').max(200),
    DayOfWeek: z.enum(DAYS_OF_WEEK, {
      errorMap: () => ({ message: `DayOfWeek must be one of: ${DAYS_OF_WEEK.join(', ')}` }),
    }),
    StartTime: z.string().regex(TIME_REGEX, 'StartTime must be HH:mm format (e.g., 09:00)'),
    EndTime: z.string().regex(TIME_REGEX, 'EndTime must be HH:mm format (e.g., 10:00)'),
    Zone_id: z.number().int().positive().optional().nullable(),
    RoomName: z.string().max(100).optional().nullable(),
    IsActive: z.boolean().optional(),
  }).refine(data => {
    if (data.StartTime && data.EndTime) {
      return data.StartTime < data.EndTime;
    }
    return true;
  }, { message: 'StartTime must be before EndTime' }),
});

export const updateSlotSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/).transform(Number),
  }),
  body: z.object({
    Section_ID: z.number().int().positive().optional(),
    Course_ID: z.number().int().positive().optional().nullable(),
    Teacher_ID: z.number().int().positive().optional().nullable(),
    TeacherName: z.string().max(100).optional().nullable(),
    SubjectName: z.string().min(1).max(200).optional(),
    DayOfWeek: z.enum(DAYS_OF_WEEK).optional(),
    StartTime: z.string().regex(TIME_REGEX).optional(),
    EndTime: z.string().regex(TIME_REGEX).optional(),
    Zone_id: z.number().int().positive().optional().nullable(),
    RoomName: z.string().max(100).optional().nullable(),
    IsActive: z.boolean().optional(),
  }),
});

export const getSlotSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/).transform(Number),
  }),
});

export const deleteSlotSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/).transform(Number),
  }),
});

export const getSlotsBySectionSchema = z.object({
  params: z.object({
    sectionId: z.string().regex(/^\d+$/).transform(Number),
  }),
});

export const bulkCreateSlotsSchema = z.object({
  body: z.object({
    slots: z.array(
      z.object({
        Section_ID: z.number().int().positive(),
        Course_ID: z.number().int().positive().optional().nullable(),
        Teacher_ID: z.number().int().positive().optional().nullable(),
        TeacherName: z.string().max(100).optional().nullable(),
        SubjectName: z.string().min(1).max(200),
        DayOfWeek: z.enum(DAYS_OF_WEEK),
        StartTime: z.string().regex(TIME_REGEX),
        EndTime: z.string().regex(TIME_REGEX),
        Zone_id: z.number().int().positive().optional().nullable(),
        RoomName: z.string().max(100).optional().nullable(),
        IsActive: z.boolean().optional(),
      })
    ).min(1, 'At least one slot is required'),
  }),
});

export const validateOverlapsSchema = z.object({
  body: z.object({
    Section_ID: z.number().int().positive().optional(),
    Teacher_ID: z.number().int().positive().optional(),
    DayOfWeek: z.enum(DAYS_OF_WEEK),
    StartTime: z.string().regex(TIME_REGEX),
    EndTime: z.string().regex(TIME_REGEX),
    excludeSlotId: z.number().int().positive().optional(),
  }),
});
