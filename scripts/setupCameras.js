/**
 * Update Cameras Script
 * Adds Entry and Exit cameras for Zone 1
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateCameras() {
  try {
    console.log('🔧 Updating cameras with Entry/Exit types...\n');

    // Get or create Zone 1
    let zone = await prisma.zone.findFirst({
      where: { Zone_id: 1 }
    });

    if (!zone) {
      zone = await prisma.zone.create({
        data: {
          Zone_Name: 'Main Building'
        }
      });
      console.log('✓ Created Zone 1: Main Building');
    }

    // Check existing cameras
    const existingCameras = await prisma.camara.findMany({
      where: { Zone_id: 1 }
    });

    console.log(`Found ${existingCameras.length} existing cameras for Zone 1\n`);

    // Update or create Entry camera
    const entryCamera = existingCameras.find(c => c.Camera_Type === 'Entry');
    if (entryCamera) {
      await prisma.camara.update({
        where: { Camara_Id: entryCamera.Camara_Id },
        data: {
          Camera_Type: 'Entry',
          Camera_URL: '0' // Default webcam
        }
      });
      console.log(`✓ Updated Entry Camera (ID: ${entryCamera.Camara_Id})`);
    } else {
      const newEntry = await prisma.camara.create({
        data: {
          Zone_id: 1,
          Camera_Type: 'Entry',
          Camera_URL: '0',
          Password: 'entry123'
        }
      });
      console.log(`✓ Created Entry Camera (ID: ${newEntry.Camara_Id})`);
    }

    // Update or create Exit camera
    const exitCamera = existingCameras.find(c => c.Camera_Type === 'Exit');
    if (exitCamera) {
      await prisma.camara.update({
        where: { Camara_Id: exitCamera.Camara_Id },
        data: {
          Camera_Type: 'Exit',
          Camera_URL: '0' // Default webcam (use different camera in production)
        }
      });
      console.log(`✓ Updated Exit Camera (ID: ${exitCamera.Camara_Id})`);
    } else {
      const newExit = await prisma.camara.create({
        data: {
          Zone_id: 1,
          Camera_Type: 'Exit',
          Camera_URL: '0',
          Password: 'exit123'
        }
      });
      console.log(`✓ Created Exit Camera (ID: ${newExit.Camara_Id})`);
    }

    console.log('\n✅ Camera setup complete!');
    console.log('\n📝 Next steps:');
    console.log('1. Update Camera_URL fields with actual camera sources');
    console.log('   - Device index (0, 1, 2...) for USB cameras');
    console.log('   - RTSP URL for IP cameras');
    console.log('2. Add students/teachers with 5 face pictures each');
    console.log('3. Click "Enroll" button to generate face embeddings');
    console.log('4. Run: cd face-recognition && python recognition.py --zone 1');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateCameras();
