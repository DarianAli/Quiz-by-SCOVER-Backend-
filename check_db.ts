import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const questions = await prisma.questions.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  questions.forEach(q => {
    console.log(`--- Question ${q.id} ---`);
    console.log(q.question_text);
  });
}

main().finally(() => prisma.$disconnect());
