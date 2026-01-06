import { z } from 'zod';

// Base64 image validator
const base64ImageValidator = z.string()
  .regex(/^data:image\/(png|jpeg|jpg|gif|webp);base64,/, 'Must be a valid base64 image')
  .optional();

export const createTeacherSchema = z.object({
  body: z.object({
    Name: z.string().min(2, 'Name must be at least 2 characters').max(255),
    Email: z.string().email('Invalid email address').max(255).optional(),
    Gender: z.union([z.enum(['Male', 'Female', 'Other']), z.literal('')]).optional(),
    Faculty_Type: z.union([z.enum(['Permanent', 'Visiting']), z.literal('')]).optional(),
    Department: z.union([z.string().max(255), z.null()]).optional(),
    Face_Picture_1: base64ImageValidator,
    Face_Picture_2: base64ImageValidator,
    Face_Picture_3: base64ImageValidator,
    Face_Picture_4: base64ImageValidator,
    Face_Picture_5: base64ImageValidator,
  }).refine(
    (data) => {
      // If Faculty_Type is Permanent, Department is required
      if (data.Faculty_Type === 'Permanent') {
        return !!data.Department && data.Department.trim().length > 0;
      }
      // If Faculty_Type is Visiting, Department must be null or empty
      if (data.Faculty_Type === 'Visiting') {
        return !data.Department || data.Department === null;
      }
      return true;
    },
    {
      message: 'Department is required for Permanent faculty and must be empty for Visiting faculty',
      path: ['Department'],
    }
  ),
});

export const updateTeacherSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID must be a number').transform(Number),
  }),
  body: z.object({
    Name: z.string().min(2).max(255).optional(),
    Email: z.string().email().max(255).optional(),
    Gender: z.union([z.enum(['Male', 'Female', 'Other']), z.literal('')]).optional(),
    Faculty_Type: z.union([z.enum(['Permanent', 'Visiting']), z.literal('')]).optional(),
    Department: z.union([z.string().max(255), z.null()]).optional(),
    Face_Picture_1: base64ImageValidator,
    Face_Picture_2: base64ImageValidator,
    Face_Picture_3: base64ImageValidator,
    Face_Picture_4: base64ImageValidator,
    Face_Picture_5: base64ImageValidator,
  }).refine(
    (data) => {
      // If Faculty_Type is Permanent, Department is required
      if (data.Faculty_Type === 'Permanent') {
        return data.Department !== null && data.Department !== undefined && data.Department.trim().length > 0;
      }
      return true;
    },
    {
      message: 'Department is required for Permanent faculty',
      path: ['Department'],
    }
  ),
});

export const getTeacherSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID must be a number').transform(Number),
  }),
});

export const deleteTeacherSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID must be a number').transform(Number),
  }),
});

export const uploadFacePictureSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID must be a number').transform(Number),
  }),
  body: z.object({
    Face_Pictures: z.string().regex(/^data:image\/(png|jpeg|jpg|gif|webp);base64,/, 'Must be a valid base64 image'),
  }),
});
