const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const attempt = await prisma.attempt.findUnique({
        where: { id: 12 },
        include: { score: true, user: { include: { class: true } } }
    });
    console.log(JSON.stringify(attempt, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
