import { z } from 'zod';

// Base64 image validator
const base64ImageValidator = z.string()
  .regex(/^data:image\/(png|jpeg|jpg|gif|webp);base64,/, 'Must be a valid base64 image')
  .optional();

const requiredBase64ImageValidator = z.string()
  .regex(/^data:image\/(png|jpeg|jpg|gif|webp);base64,/, 'Must be a valid base64 image');

export const createStudentSchema = z.object({
  body: z.object({
    Name: z.string().min(2, 'Name must be at least 2 characters').max(255),
    RollNumber: z.string().min(1, 'Roll number is required').max(50),
    Email: z.string().email('Invalid email address').max(255),
    Gender: z.string().optional(),
    Department: z.string().optional(),
    Face_Picture_1: requiredBase64ImageValidator,
    Face_Picture_2: base64ImageValidator,
    Face_Picture_3: base64ImageValidator,
    Face_Picture_4: base64ImageValidator,
    Face_Picture_5: base64ImageValidator,
  }),
});

export const updateStudentSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID must be a number').transform(Number),
  }),
  body: z.object({
    Name: z.string().min(2).max(255).optional(),
    RollNumber: z.string().min(1).max(50).optional(),
    Email: z.string().email().max(255).optional(),
    Gender: z.string().optional(),
    Department: z.string().optional(),
    Face_Picture_1: base64ImageValidator,
    Face_Picture_2: base64ImageValidator,
    Face_Picture_3: base64ImageValidator,
    Face_Picture_4: base64ImageValidator,
    Face_Picture_5: base64ImageValidator,
  }),
});

export const getStudentSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID must be a number').transform(Number),
  }),
});

export const deleteStudentSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID must be a number').transform(Number),
  }),
});

export const uploadFacePictureSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID must be a number').transform(Number),
  }),
  body: z.object({
    Face_Picture_1: base64ImageValidator,
    Face_Picture_2: base64ImageValidator,
    Face_Picture_3: base64ImageValidator,
    Face_Picture_4: base64ImageValidator,
    Face_Picture_5: base64ImageValidator,
  }),
});
