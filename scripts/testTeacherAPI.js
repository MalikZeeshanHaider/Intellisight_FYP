import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';

const API_BASE_URL = 'http://localhost:3000/api';

// Helper to convert image to base64
function imageToBase64(imagePath) {
  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const ext = path.extname(imagePath).toLowerCase();
    let mimeType = 'image/jpeg';
    
    if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
    else if (ext === '.gif') mimeType = 'image/gif';
    
    return `data:${mimeType};base64,${base64Image}`;
  } catch (error) {
    console.error(`Error reading image ${imagePath}:`, error.message);
    return null;
  }
}

// Helper to make POST request
function postRequest(url, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ data: parsed, status: res.statusCode });
          } else {
            reject({ response: { data: parsed, status: res.statusCode } });
          }
        } catch (e) {
          resolve({ data: responseData, status: res.statusCode });
        }
      });
    });
    
    req.on('error', (error) => {
      reject({ message: error.message });
    });
    
    req.write(postData);
    req.end();
  });
}

async function testCreateTeacher() {
  try {
    console.log('=== Testing Teacher Creation ===\n');
    
    const teacherData = {
      Name: 'Dr. John Smith',
      Email: 'john.smith@university.edu',
      Gender: 'Male',
      Faculty_Type: 'Permanent',
      Department: 'Computer Science',
      Face_Picture_1: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    };

    console.log('Sending request to:', `${API_BASE_URL}/teachers`);
    console.log('Payload:', JSON.stringify({
      ...teacherData,
      Face_Picture_1: teacherData.Face_Picture_1.substring(0, 50) + '...'
    }, null, 2));
    
    const response = await postRequest(`${API_BASE_URL}/teachers`, teacherData);

    console.log('\n✅ Success!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('\n❌ Error creating teacher:');
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('No response received');
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Test without Gender and Faculty_Type
async function testCreateTeacherMinimal() {
  try {
    console.log('\n\n=== Testing Minimal Teacher Creation (No Gender/Faculty_Type) ===\n');
    
    const teacherData = {
      Name: 'Prof. Jane Doe',
      Email: 'jane.doe@university.edu',
      Face_Picture_1: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    };

    console.log('Sending request to:', `${API_BASE_URL}/teachers`);
    console.log('Payload:', JSON.stringify({
      ...teacherData,
      Face_Picture_1: teacherData.Face_Picture_1.substring(0, 50) + '...'
    }, null, 2));
    
    const response = await postRequest(`${API_BASE_URL}/teachers`, teacherData);

    console.log('\n✅ Success!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('\n❌ Error creating teacher:');
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('No response received');
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Run tests
(async () => {
  await testCreateTeacher();
  await testCreateTeacherMinimal();
  
  console.log('\n\n=== Checking database after tests ===');
  // Import and use Prisma
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  
  const teachers = await prisma.teacher.findMany();
  console.log(`Total teachers now: ${teachers.length}`);
  
  teachers.forEach(t => {
    console.log(`- ${t.Name} (${t.Email})`);
  });
  
  await prisma.$disconnect();
})();
