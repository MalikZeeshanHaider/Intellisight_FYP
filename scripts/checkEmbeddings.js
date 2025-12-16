import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkEmbeddings() {
  console.log('Checking FaceEmbeddings table...\n');
  
  const embeddings = await prisma.faceEmbeddings.findMany({
    select: {
      Embedding_ID: true,
      PersonName: true,
      PersonType: true,
      ImagePath: true,
      EmbeddingJson: true,
    }
  });
  
  console.log(`Found ${embeddings.length} embeddings:\n`);
  
  for (const emb of embeddings) {
    const embedding = emb.EmbeddingJson ? JSON.parse(emb.EmbeddingJson) : [];
    console.log(`- ${emb.PersonName} (${emb.PersonType})`);
    console.log(`  ID: ${emb.Embedding_ID}`);
    console.log(`  Image: ${emb.ImagePath}`);
    console.log(`  Embedding length: ${embedding.length}`);
    console.log(`  First 5 values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
    console.log();
  }
  
  await prisma.$disconnect();
}

checkEmbeddings();
