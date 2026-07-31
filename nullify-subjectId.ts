import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
    await prisma.$executeRaw`UPDATE quizzes SET subjectId = NULL`;
    console.log("Nullified subjectId in quizzes");
}
main().catch(console.error).finally(() => prisma.$disconnect());
