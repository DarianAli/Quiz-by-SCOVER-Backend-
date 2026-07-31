import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("Starting migration...");
    
    // 1. Get all subjects
    const subjects = await prisma.subject.findMany();
    console.log(`Found ${subjects.length} subjects.`);

    for (const subject of subjects) {
        // 2. Create a default module for the subject
        // We use $executeRaw because the generated Prisma client might not have `module` yet
        // due to the EPERM error on Windows.
        const moduleName = `Modul Utama - ${subject.subject_name}`;
        
        // Check if a module already exists for this subject to prevent duplicates on rerun
        const existingModules: any[] = await prisma.$queryRaw`SELECT id FROM modules WHERE subjectId = ${subject.id} LIMIT 1`;
        
        let moduleId;
        if (existingModules.length > 0) {
            moduleId = existingModules[0].id;
            console.log(`Module already exists for subject ${subject.id}`);
        } else {
            // Generate UUID for module
            await prisma.$executeRaw`
                INSERT INTO modules (uuid, module_name, description, order_index, subjectId, created_at, updated_at) 
                VALUES (UUID(), ${moduleName}, 'Modul bawaan untuk kuis yang sudah ada', 0, ${subject.id}, NOW(), NOW())
            `;
            const created: any[] = await prisma.$queryRaw`SELECT id FROM modules WHERE subjectId = ${subject.id} ORDER BY id DESC LIMIT 1`;
            moduleId = created[0].id;
            console.log(`Created module ${moduleId} for subject ${subject.id}`);
        }

        // 3. Move all quizzes from this subject to the new module
        const updated = await prisma.$executeRaw`
            UPDATE quizzes 
            SET moduleId = ${moduleId} 
            WHERE subjectId = ${subject.id} AND (moduleId IS NULL OR moduleId = 0)
        `;
        console.log(`Moved quizzes to module ${moduleId} for subject ${subject.id}`);
    }

    console.log("Migration complete.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
