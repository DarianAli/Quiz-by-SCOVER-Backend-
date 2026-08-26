import prisma from "./src/config/prisma.js";

async function run() {
    const questions = await prisma.questions.findMany({
        include: { question_images: true, options: true, quiz: true }
    });
    console.log("Total questions in DB:", questions.length);
    for (const q of questions) {
        console.log(`\n=== Question ID: ${q.id} (UUID: ${q.uuid}, Quiz: ${q.quiz?.quiz_title} [${q.quiz?.uuid}]) ===`);
        console.log("question_image:", q.question_image);
        console.log("question_images count:", q.question_images.length);
        console.log("question_images records:", q.question_images);
        console.log("question_text snippet:\n", q.question_text);
    }
}
run();

