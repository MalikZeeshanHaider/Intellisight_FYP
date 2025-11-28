/**
 * Image Preprocessing Service
 * Preprocesses and stores optimized face images for faster detection
 */

import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';

const prisma = new PrismaClient();

/**
 * Preprocess all student and teacher images on system startup
 */
export const preprocessAllImages = async () => {
  try {
    console.log('🔄 Starting image preprocessing...');

    // Get all students with face pictures
    const students = await prisma.students.findMany({
      where: {
        OR: [
          { Face_Picture_1: { not: null } },
          { Face_Picture_2: { not: null } },
          { Face_Picture_3: { not: null } },
          { Face_Picture_4: { not: null } },
          { Face_Picture_5: { not: null } }
        ]
      },
      select: {
        Student_ID: true,
        Name: true,
        Face_Picture_1: true,
        Face_Picture_2: true,
        Face_Picture_3: true,
        Face_Picture_4: true,
        Face_Picture_5: true
      }
    });

    // Get all teachers with face pictures
    const teachers = await prisma.teacher.findMany({
      where: {
        OR: [
          { Face_Picture_1: { not: null } },
          { Face_Picture_2: { not: null } },
          { Face_Picture_3: { not: null } },
          { Face_Picture_4: { not: null } },
          { Face_Picture_5: { not: null } }
        ]
      },
      select: {
        Teacher_ID: true,
        Name: true,
        Face_Picture_1: true,
        Face_Picture_2: true,
        Face_Picture_3: true,
        Face_Picture_4: true,
        Face_Picture_5: true
      }
    });

    console.log(`📊 Found ${students.length} students and ${teachers.length} teachers to process`);

    let processedCount = 0;

    // Process students
    for (const student of students) {
      await preprocessPersonImages(student.Student_ID, 'Student', {
        image1: student.Face_Picture_1,
        image2: student.Face_Picture_2,
        image3: student.Face_Picture_3,
        image4: student.Face_Picture_4,
        image5: student.Face_Picture_5
      });
      processedCount++;
      console.log(`✅ Processed student: ${student.Name} (${processedCount}/${students.length + teachers.length})`);
    }

    // Process teachers
    for (const teacher of teachers) {
      await preprocessPersonImages(teacher.Teacher_ID, 'Teacher', {
        image1: teacher.Face_Picture_1,
        image2: teacher.Face_Picture_2,
        image3: teacher.Face_Picture_3,
        image4: teacher.Face_Picture_4,
        image5: teacher.Face_Picture_5
      });
      processedCount++;
      console.log(`✅ Processed teacher: ${teacher.Name} (${processedCount}/${students.length + teachers.length})`);
    }

    console.log(`🎉 Image preprocessing complete! Processed ${processedCount} people`);
    return { success: true, processed: processedCount };

  } catch (error) {
    console.error('❌ Error preprocessing images:', error);
    throw error;
  }
};

/**
 * Preprocess images for a single person
 */
const preprocessPersonImages = async (personId, personType, images) => {
  try {
    // Check if already processed
    const existing = await prisma.processedFaceImages.findFirst({
      where: {
        PersonType: personType,
        ...(personType === 'Student' 
          ? { Student_ID: personId }
          : { Teacher_ID: personId }
        )
      }
    });

    // Process each image
    const processedImages = {};
    
    for (let i = 1; i <= 5; i++) {
      const imageKey = `image${i}`;
      const base64Image = images[imageKey];
      
      if (base64Image) {
        try {
          const processedBuffer = await processImage(base64Image);
          processedImages[`Image${i}`] = processedBuffer;
        } catch (err) {
          console.warn(`⚠️ Failed to process image ${i} for ${personType} ${personId}:`, err.message);
          processedImages[`Image${i}`] = null;
        }
      } else {
        processedImages[`Image${i}`] = null;
      }
    }

    // Save or update processed images
    if (existing) {
      await prisma.processedFaceImages.update({
        where: { Processed_ID: existing.Processed_ID },
        data: processedImages
      });
    } else {
      await prisma.processedFaceImages.create({
        data: {
          PersonType: personType,
          ...(personType === 'Student' 
            ? { Student_ID: personId }
            : { Teacher_ID: personId }
          ),
          ...processedImages
        }
      });
    }

  } catch (error) {
    console.error(`Error preprocessing ${personType} ${personId}:`, error);
    throw error;
  }
};

/**
 * Process a single base64 image - resize and optimize
 */
const processImage = async (base64Image) => {
  try {
    // Remove base64 header if present
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Resize and optimize image using sharp
    const processedBuffer = await sharp(buffer)
      .resize(640, 480, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 85 })
      .toBuffer();

    return processedBuffer;

  } catch (error) {
    console.error('Error processing image:', error);
    throw error;
  }
};

/**
 * Get preprocessed images for face detection
 */
export const getPreprocessedImages = async () => {
  try {
    const processedImages = await prisma.processedFaceImages.findMany({
      include: {
        student: {
          select: {
            Student_ID: true,
            Name: true,
            Email: true,
            Department: true,
            RollNumber: true,
            Face_Embeddings: true
          }
        },
        teacher: {
          select: {
            Teacher_ID: true,
            Name: true,
            Email: true,
            Department: true,
            Face_Embeddings: true
          }
        }
      }
    });

    // Format for face detection
    const formattedData = {
      students: [],
      teachers: []
    };

    for (const record of processedImages) {
      if (record.PersonType === 'Student' && record.student) {
        // Convert buffer to base64 for frontend
        const images = [];
        for (let i = 1; i <= 5; i++) {
          const imageBuffer = record[`Image${i}`];
          if (imageBuffer) {
            images.push(`data:image/jpeg;base64,${imageBuffer.toString('base64')}`);
          }
        }

        formattedData.students.push({
          id: record.student.Student_ID,
          name: record.student.Name,
          email: record.student.Email,
          department: record.student.Department,
          rollNumber: record.student.RollNumber,
          type: 'Student',
          enrolled: record.student.Face_Embeddings !== null,
          faceImage: images[0] || null, // Use first image as primary
          allImages: images,
          hasEmbeddings: record.student.Face_Embeddings !== null
        });
      } else if (record.PersonType === 'Teacher' && record.teacher) {
        const images = [];
        for (let i = 1; i <= 5; i++) {
          const imageBuffer = record[`Image${i}`];
          if (imageBuffer) {
            images.push(`data:image/jpeg;base64,${imageBuffer.toString('base64')}`);
          }
        }

        formattedData.teachers.push({
          id: record.teacher.Teacher_ID,
          name: record.teacher.Name,
          email: record.teacher.Email,
          department: record.teacher.Department,
          type: 'Teacher',
          enrolled: record.teacher.Face_Embeddings !== null,
          faceImage: images[0] || null,
          allImages: images,
          hasEmbeddings: record.teacher.Face_Embeddings !== null
        });
      }
    }

    return formattedData;

  } catch (error) {
    console.error('Error getting preprocessed images:', error);
    throw error;
  }
};

/**
 * Preprocess images for a single person (used when adding/updating)
 */
export const preprocessSinglePerson = async (personId, personType) => {
  try {
    console.log(`🔄 Preprocessing images for ${personType} ${personId}...`);

    let person;
    if (personType === 'Student') {
      person = await prisma.students.findUnique({
        where: { Student_ID: personId },
        select: {
          Student_ID: true,
          Name: true,
          Face_Picture_1: true,
          Face_Picture_2: true,
          Face_Picture_3: true,
          Face_Picture_4: true,
          Face_Picture_5: true
        }
      });
    } else {
      person = await prisma.teacher.findUnique({
        where: { Teacher_ID: personId },
        select: {
          Teacher_ID: true,
          Name: true,
          Face_Picture_1: true,
          Face_Picture_2: true,
          Face_Picture_3: true,
          Face_Picture_4: true,
          Face_Picture_5: true
        }
      });
    }

    if (!person) {
      throw new Error(`${personType} not found`);
    }

    await preprocessPersonImages(personId, personType, {
      image1: person.Face_Picture_1,
      image2: person.Face_Picture_2,
      image3: person.Face_Picture_3,
      image4: person.Face_Picture_4,
      image5: person.Face_Picture_5
    });

    console.log(`✅ Successfully preprocessed ${personType} ${person.Name}`);
    return { success: true };

  } catch (error) {
    console.error(`Error preprocessing single person:`, error);
    throw error;
  }
};

export default {
  preprocessAllImages,
  getPreprocessedImages,
  preprocessSinglePerson
};
