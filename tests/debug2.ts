import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const tentors = await prisma.user.findMany({ where: { role: 'TENTOR' }, select: { id: true, userName: true, classId: true } });
    console.log(JSON.stringify(tentors, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
